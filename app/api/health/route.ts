import { NextResponse } from "next/server"
import { getFirstYouTubeApiKey } from "@/lib/youtube-keys"

export async function GET() {
  try {
    const checks = {
      youtubeApiKey: !!getFirstYouTubeApiKey(),
      databaseUrl: !!process.env.DATABASE_URL,
      nextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    }

    // Test database connection
    let dbConnected = false
    let dbError = null
    try {
      const { prisma } = await import("@/lib/db")
      await prisma.$connect()
      dbConnected = true
      await prisma.$disconnect()
    } catch (error: any) {
      dbError = error.message
    }

    return NextResponse.json({
      status: "ok",
      checks,
      database: {
        connected: dbConnected,
        error: dbError,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    )
  }
}
