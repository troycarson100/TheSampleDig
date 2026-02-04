import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Check if the path requires authentication
  const { pathname } = request.nextUrl
  
  // Only protect /profile, /dig is now public
  if (pathname.startsWith("/profile")) {
    // Check for session token in cookies
    const sessionToken = request.cookies.get("next-auth.session-token") || 
                        request.cookies.get("__Secure-next-auth.session-token")
    
    if (!sessionToken) {
      // Redirect to login if no session
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ["/profile/:path*"],
}
