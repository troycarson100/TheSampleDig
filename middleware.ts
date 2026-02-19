import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Next.js 16 dev server (webpack) generates middleware-manifest.json only when this file exists.
// Same behavior as proxy.ts; proxy.ts is the v16 convention but dev manifests still use "middleware".
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ["/profile/:path*"],
}
