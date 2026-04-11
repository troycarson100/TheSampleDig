import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Next.js 16 dev server (webpack) generates middleware-manifest.json only when this file exists.
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ["/profile/:path*"],
}
