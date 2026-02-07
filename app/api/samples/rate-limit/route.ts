/**
 * Rate limiting API route
 * Tracks user API usage and enforces quotas
 */

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Rate limits per tier
const RATE_LIMITS = {
  free: {
    searchesPerDay: 20,
    searchesPerHour: 5,
  },
  paid: {
    searchesPerDay: 100,
    searchesPerHour: 20,
  },
  premium: {
    searchesPerDay: -1, // Unlimited
    searchesPerHour: -1,
  },
}

/**
 * GET /api/samples/rate-limit
 * Check user's rate limit status
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({
        tier: "free",
        remaining: RATE_LIMITS.free.searchesPerDay,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
    }
    
    // TODO: Get user tier from database (for now, default to free)
    const userTier = "free" // Replace with actual user tier lookup
    const limits = RATE_LIMITS[userTier]
    
    // Count searches in last 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    // TODO: Track API usage in database
    // For now, return unlimited for authenticated users
    const searchesToday = 0 // Replace with actual count
    const searchesThisHour = 0 // Replace with actual count
    
    const remainingToday = limits.searchesPerDay === -1 
      ? -1 
      : Math.max(0, limits.searchesPerDay - searchesToday)
    const remainingThisHour = limits.searchesPerHour === -1
      ? -1
      : Math.max(0, limits.searchesPerHour - searchesThisHour)
    
    return NextResponse.json({
      tier: userTier,
      remaining: {
        today: remainingToday,
        thisHour: remainingThisHour,
      },
      limits: {
        perDay: limits.searchesPerDay,
        perHour: limits.searchesPerHour,
      },
      resetAt: {
        day: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        hour: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    })
  } catch (error: any) {
    console.error("[Rate Limit] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to check rate limit" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/samples/rate-limit
 * Record an API usage (called after each search)
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      // Anonymous users - track in memory or skip
      return NextResponse.json({ success: true })
    }
    
    // TODO: Record API usage in database
    // For now, just return success
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Rate Limit] Error recording usage:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to record usage" },
      { status: 500 }
    )
  }
}
