import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const youtubeId = searchParams.get("youtubeId")

    if (!youtubeId) {
      return NextResponse.json(
        { error: "YouTube ID is required" },
        { status: 400 }
      )
    }

    // Check video availability using YouTube oEmbed API
    // This is a public API that doesn't require authentication
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`
    
    try {
      const response = await fetch(oembedUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        // Video is unavailable (404 or other error)
        return NextResponse.json(
          { available: false },
          { status: 200 } // Return 200 with available: false instead of 404
        )
      }

      // Video is available
      return NextResponse.json({ available: true })
    } catch (fetchError: any) {
      // If fetch fails, assume video might be available (don't auto-skip)
      console.warn("Error fetching oEmbed:", fetchError?.message)
      return NextResponse.json(
        { available: true },
        { status: 200 }
      )
    }
  } catch (error: any) {
    console.error("Error checking video availability:", error)
    // On error, assume video might be available (don't auto-skip)
    return NextResponse.json(
      { available: true, error: error?.message },
      { status: 200 }
    )
  }
}
