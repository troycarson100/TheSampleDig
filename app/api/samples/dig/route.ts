import { NextResponse } from "next/server"
import { findRandomSample } from "@/lib/youtube"

export async function GET(request: Request) {
  try {
    // Sample Roll is DB-only for users; YouTube API is never used here (only admin populate uses keys).

    // Get excluded video IDs and optional genre / drumBreak from query params
    const { searchParams } = new URL(request.url)
    const excludedParam = searchParams.get("excluded")
    let excludedVideoIds: string[] = excludedParam ? excludedParam.split(",").filter(id => id.length === 11) : []
    const genreParam = searchParams.get("genre")
    const genre = (genreParam && genreParam.trim() !== "") ? genreParam.trim() : undefined
    const eraParam = searchParams.get("era")
    const samplePacks = searchParams.get("samplePacks") === "1" || searchParams.get("samplePacks") === "true" || searchParams.get("royaltyFree") === "1" || searchParams.get("royaltyFree") === "true"
    // When Sample Packs mode: ignore era (sample packs mostly post-1990)
    const era = (samplePacks ? undefined : (eraParam && eraParam.trim() !== "") ? eraParam.trim() : undefined)
    const drumBreak = searchParams.get("drumBreak") === "1" || searchParams.get("drumBreak") === "true"
    
    // Also exclude videos the user has saved (if logged in)
    // CRITICAL: Always fetch fresh saved videos on every request to ensure they're excluded
    try {
      const { auth } = await import("@/lib/auth")
      const session = await auth()
      if (session?.user?.id) {
        const { prisma } = await import("@/lib/db")
        const userSamples = await prisma.userSample.findMany({
          where: { userId: session.user.id },
          select: { sample: { select: { youtubeId: true } } }
        })
        const savedYoutubeIds = userSamples.map(us => us.sample.youtubeId).filter(Boolean) as string[]
        excludedVideoIds = [...excludedVideoIds, ...savedYoutubeIds]
        // Remove duplicates
        excludedVideoIds = [...new Set(excludedVideoIds)]
        if (savedYoutubeIds.length > 0) {
          console.log(`[Dig] Excluding ${savedYoutubeIds.length} saved videos:`, savedYoutubeIds.slice(0, 5).join(", "), savedYoutubeIds.length > 5 ? "..." : "")
        }
      }
    } catch (error) {
      // If auth fails, continue without excluding saved videos
      console.warn("[Dig] Could not fetch saved videos for exclusion:", error)
    }
    
    if (excludedVideoIds.length > 0) {
      console.log(`[Dig] Excluding ${excludedVideoIds.length} total videos (shown + saved):`, excludedVideoIds.slice(0, 5).join(", "), excludedVideoIds.length > 5 ? "..." : "")
    }

    // Get user ID if authenticated
    let userId: string | undefined
    try {
      const { auth } = await import("@/lib/auth")
      const session = await auth()
      userId = session?.user?.id
    } catch (error) {
      // Ignore auth errors
    }
    
    let video
    try {
      console.log(`[Dig] Calling findRandomSample with ${excludedVideoIds.length} exclusions${genre ? `, genre=${genre}` : ""}${era ? `, era=${era}` : ""}${drumBreak ? ", drumBreak=true" : ""}${samplePacks ? ", samplePacks=true" : ""}...`)
      try {
        video = await findRandomSample(excludedVideoIds, userId, { databaseOnly: true, genre, era, drumBreakOnly: drumBreak, royaltyFreeOnly: samplePacks })
      } catch (noFilterErr: any) {
        // When drum break or sample packs mode has no matches, fall back to any sample so digging isn't blocked
        if ((drumBreak || samplePacks) && /no samples|no results/i.test(noFilterErr?.message ?? "")) {
          console.log(`[Dig] No matching samples found (${samplePacks ? "sample packs" : "drum break"}), falling back to any sample`)
          video = await findRandomSample(excludedVideoIds, userId, { databaseOnly: true, genre, era: samplePacks ? undefined : era })
        } else {
          throw noFilterErr
        }
      }
      console.log(`[Dig] ✓ Found video: ${video.id} - ${video.title}`)
      // No YouTube API call: user path is DB-only; embeddable filtering is not done here.
    } catch (youtubeError: any) {
      console.error("[Dig] ✗ Error:", youtubeError?.message)
      console.error("[Dig] Excluded videos count:", excludedVideoIds.length)

      const errorMessage = youtubeError?.message || "Unknown error"
      const isNoSamples =
        errorMessage.includes("No samples available") ||
        errorMessage.includes("No valid videos found") ||
        errorMessage.includes("No results")

      let userMessage: string
      if (isNoSamples) {
        userMessage = "No samples in the database right now. Try again in a few minutes."
      } else {
        userMessage = "Failed to load sample. " + (errorMessage.length < 100 ? errorMessage : "")
      }

      return NextResponse.json(
        {
          error: userMessage,
          details: errorMessage,
          excludedCount: excludedVideoIds.length,
        },
        { status: 500 }
      )
    }

    if (!video || !video.id) {
      console.error("[Dig] ✗ Invalid video object returned")
      return NextResponse.json(
        { error: "Invalid video data." },
        { status: 500 }
      )
    }

    // Always try to save to database - this is required for saving functionality
    let sampleId: string | null = null
    let bpm: number | null = null
    let key: string | null = null
    let analysisStatus: string | null = "pending"
    
    try {
      console.log(`[Dig] Loading Prisma client...`)
      // Lazy load prisma to avoid errors if it's not available
      const { prisma } = await import("@/lib/db")
      console.log(`[Dig] ✓ Prisma client loaded`)
      
      // Check if sample already exists in database
      console.log(`[Dig] Looking up sample with YouTube ID: ${video.id}`)
      let sample = await prisma.sample.findUnique({
        where: { youtubeId: video.id }
      })
      console.log(`[Dig] Sample lookup result:`, sample ? `Found (${sample.id})` : "Not found")

      // Get YouTube channel ID from the video object if available
      const youtubeChannelId = video.channelId || video.channelTitle
      console.log(`[Dig] Channel ID: ${youtubeChannelId}, Channel Title: ${video.channelTitle}`)
      
      if (!youtubeChannelId) {
        throw new Error("No channel ID or title available from video")
      }
      
      // Get or create channel - with retry logic
      console.log(`[Dig] Looking up channel: ${youtubeChannelId}`)
      let channel = await prisma.channel.findUnique({
        where: { channelId: youtubeChannelId }
      })
      
      if (!channel) {
        console.log(`[Dig] Channel not found, creating...`)
        try {
          channel = await prisma.channel.create({
            data: {
              channelId: youtubeChannelId,
              name: video.channelTitle,
              reputation: 0.5,
            }
          })
          console.log(`[Dig] ✓ Created channel: ${channel.id} for ${youtubeChannelId}`)
        } catch (channelError: any) {
          console.error(`[Dig] Channel creation error:`, {
            code: channelError?.code,
            message: channelError?.message,
            meta: channelError?.meta
          })
          // Channel might have been created by another request
          if (channelError?.code === 'P2002') {
            console.log(`[Dig] Channel already exists (P2002), finding it...`)
            channel = await prisma.channel.findUnique({
              where: { channelId: youtubeChannelId }
            })
            if (!channel) {
              console.error(`[Dig] ✗ Channel not found after P2002 error`)
              throw new Error(`Failed to create or find channel: ${channelError.message}`)
            }
            console.log(`[Dig] ✓ Found existing channel: ${channel.id}`)
          } else {
            throw channelError
          }
        }
      } else {
        console.log(`[Dig] ✓ Found existing channel: ${channel.id}`)
      }
      
      if (!channel || !channel.id) {
        throw new Error("Channel is invalid after creation/lookup")
      }
      
      // Create sample if it doesn't exist - CRITICAL: This must succeed
      if (!sample) {
        console.log(`[Dig] Creating new sample for YouTube ID: ${video.id}`)
        try {
          sample = await prisma.sample.create({
            data: {
              youtubeId: video.id,
              title: video.title,
              channel: video.channelTitle,
              channelId: channel.id,
              thumbnailUrl: video.thumbnail,
              genre: video.genre || null,
              era: video.era || null,
              analysisStatus: "pending",
              dateAddedDb: new Date(),
            }
          })
          console.log(`[Dig] ✓ Created sample: ${sample.id} for YouTube ID: ${video.id}`)
        } catch (sampleError: any) {
          console.error(`[Dig] Sample creation error:`, {
            code: sampleError?.code,
            message: sampleError?.message,
            meta: sampleError?.meta
          })
          // Sample might have been created by another request
          if (sampleError?.code === 'P2002') {
            console.log(`[Dig] Sample already exists (P2002), finding it...`)
            sample = await prisma.sample.findUnique({
              where: { youtubeId: video.id }
            })
            if (!sample) {
              console.error(`[Dig] ✗ Failed to find sample after P2002 error`)
              throw new Error(`Failed to create or find sample: ${sampleError.message}`)
            }
            console.log(`[Dig] ✓ Found existing sample: ${sample.id}`)
          } else {
            throw sampleError
          }
        }
      } else {
        console.log(`[Dig] Updating existing sample: ${sample.id}`)
        // Update existing sample with latest metadata
        try {
          sample = await prisma.sample.update({
            where: { id: sample.id },
            data: {
              title: video.title,
              channel: video.channelTitle,
              thumbnailUrl: video.thumbnail,
              genre: video.genre || null,
              era: video.era || null,
            }
          })
          console.log(`[Dig] ✓ Updated existing sample: ${sample.id}`)
        } catch (updateError: any) {
          console.error(`[Dig] Sample update error:`, {
            code: updateError?.code,
            message: updateError?.message
          })
          // If update fails, continue with existing sample data
          console.log(`[Dig] Continuing with existing sample data`)
        }
      }
      
      // CRITICAL: Ensure we have a valid database ID
      if (!sample || !sample.id) {
        throw new Error("Failed to get valid sample ID from database")
      }
      
      sampleId = sample.id
      bpm = sample.bpm
      key = sample.key
      analysisStatus = sample.analysisStatus || "pending"
      
      console.log(`[Dig] Sample ready: ${sampleId} (YouTube: ${video.id})`)

      // BPM/key analysis disabled for dig page to avoid YouTube ToS and yt-dlp usage.
      // Dig page uses tap tempo for BPM only. Stem separation page still uses analyzeAudioFile (user uploads).
      // if (sample.analysisStatus !== "completed" && sample.analysisStatus !== "processing") {
      //   try {
      //     await prisma.sample.update({
      //       where: { id: sample.id },
      //       data: { analysisStatus: "processing" }
      //     })
      //     analysisStatus = "processing"
      //   } catch (updateError) {
      //     console.error("Failed to update analysis status:", updateError)
      //   }
      //   const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      //   setTimeout(() => {
      //     const controller = new AbortController()
      //     const timeoutId = setTimeout(() => controller.abort(), 35000)
      //     fetch(`${baseUrl}/api/audio/analyze`, {
      //       method: 'POST',
      //       headers: { 'Content-Type': 'application/json' },
      //       body: JSON.stringify({ youtubeId: video.id, sampleId: sample.id }),
      //       signal: controller.signal
      //     })
      //     .then(res => { clearTimeout(timeoutId); return res.ok ? res.json() : res.text().then(t => { throw new Error(t) }) })
      //     .then(data => console.log('[Analysis] Completed for sample', sample.id, data))
      //     .catch(err => {
      //       clearTimeout(timeoutId)
      //       prisma.sample.update({ where: { id: sample.id }, data: { analysisStatus: "failed" } }).catch(() => {})
      //     })
      //   }, 100)
      // }
    } catch (dbError: any) {
      // Database error - log but try to continue
      console.error("[Dig] Database error:", dbError?.message || dbError)
      console.error("[Dig] Error code:", dbError?.code)
      console.error("[Dig] Error meta:", dbError?.meta)
      
      // Try one more time to find the sample
      try {
        const { prisma } = await import("@/lib/db")
        const fallbackSample = await prisma.sample.findUnique({
          where: { youtubeId: video.id }
        })
        if (fallbackSample) {
          console.log(`[Dig] Found sample on fallback: ${fallbackSample.id}`)
          sampleId = fallbackSample.id
          bpm = fallbackSample.bpm
          key = fallbackSample.key
          analysisStatus = fallbackSample.analysisStatus || "pending"
        } else {
          // If we can't find or create, use YouTube ID as fallback
          // Save endpoint will handle creation
          console.warn("[Dig] Using YouTube ID as fallback - save endpoint will create sample")
          sampleId = video.id
        }
      } catch (fallbackError) {
        console.error("[Dig] Fallback lookup also failed:", fallbackError)
        // Use YouTube ID as last resort
        sampleId = video.id
      }
    }

    // CRITICAL: Double-check this video is not in excluded list (saved videos)
    if (excludedVideoIds.includes(video.id)) {
      console.error(`[Dig] ERROR: Selected video ${video.id} is in excluded list! This should never happen.`)
      console.error(`[Dig] Excluded list contains:`, excludedVideoIds.slice(0, 10).join(", "), excludedVideoIds.length > 10 ? "..." : "")
      // This is a critical error - retry with same exclusions
      const retryVideo = await findRandomSample(excludedVideoIds, userId, { databaseOnly: true, genre, era, royaltyFreeOnly: samplePacks })
      return NextResponse.json({
        id: retryVideo.id,
        youtubeId: retryVideo.id,
        title: retryVideo.title,
        channel: retryVideo.channelTitle,
        thumbnailUrl: retryVideo.thumbnail,
        genre: retryVideo.genre || null,
        era: retryVideo.era || null,
        duration: retryVideo.duration || null,
        bpm: null,
        key: null,
        analysisStatus: "pending",
      })
    }
    
    // Return the sample - use database ID if available, otherwise YouTube ID
    // Save endpoint will handle creation if needed.
    // bpm/key/analysisStatus are from DB only (metadata backfill); we do not use the yt-dlp analyzer on dig.
    console.log(`[Dig] Returning sample - ID: ${sampleId}, YouTube ID: ${video.id}, Excluded count: ${excludedVideoIds.length}`)
    console.log(`[Dig] ✓ Video ${video.id} is NOT in excluded list (verified)`)
    return NextResponse.json({
      id: sampleId || video.id, // Use database ID if available, otherwise YouTube ID
      youtubeId: video.id,
      title: video.title,
      channel: video.channelTitle,
      thumbnailUrl: video.thumbnail,
      genre: video.genre || null,
      era: video.era || null,
      duration: video.duration || null,
      bpm: bpm,
      key: key,
      analysisStatus: analysisStatus,
    })
  } catch (error: any) {
    console.error("[Dig] CRITICAL ERROR:", error)
    console.error("[Dig] Error stack:", error?.stack)
    console.error("[Dig] Error details:", {
      message: error?.message,
      code: error?.code,
      name: error?.name
    })
    const errorMessage = error?.message || "Failed to fetch sample"
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error?.stack?.split('\n')[0] || "Unknown error"
      },
      { status: 500 }
    )
  }
}
