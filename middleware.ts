import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Allow /profile to be accessible (it will show login prompt if not authenticated)
  // Only protect API routes that require authentication
  return NextResponse.next()
}

export const config = {
  matcher: ["/profile/:path*"],
}
