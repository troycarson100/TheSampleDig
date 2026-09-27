import type { NextRequest } from "next/server"

// The cart is the bundle's home now, so this path has nothing left to show.
// Kept as a redirect rather than deleted: the URL is in sent email, in the
// site alert history, and indexed — and affiliate share links already in
// circulation mint /plugins?ref=<code> (see AffiliateDashboard.tsx and
// AdminAffiliates.tsx, which now mint fresh links against /shft directly).
//
// This is a Route Handler, not a page, precisely so the redirect is a real
// HTTP 3xx. A page-based `redirect()` here shares the root layout's global
// `app/loading.tsx` Suspense boundary, which flushes the shell as 200 before
// the page resolves — so by the time redirect() throws, the status is
// already committed and Next falls back to a client-executed redirect
// instead. That shipped as this route's original bug: the query string
// (and with it, AffiliateRefCapture's read of it) survived the client
// redirect, but the extra client-side landing meant it ran twice, recording
// two clicks for one visit. A Route Handler responds directly, outside the
// page tree and its loading boundary, so the query string and the query
// string alone travels in the Location header of a genuine 307, served
// before any client JS runs.
export async function GET(request: NextRequest) {
  // A relative Location ("/shft?...") rather than an absolute URL built off
  // request.url: Next's dev server reports request.url with its own
  // canonical host (localhost) even when the browser actually requested
  // 127.0.0.1, which would otherwise redirect a 127.0.0.1 visitor to a
  // different origin. A relative Location is valid (RFC 7231 ss7.1.2) and
  // every browser resolves it against whatever origin it actually asked -
  // 127.0.0.1 stays 127.0.0.1, localhost stays localhost, and in production
  // it stays the real domain either way.
  const search = new URL(request.url).search
  return new Response(null, { status: 307, headers: { Location: `/shft${search}` } })
}
