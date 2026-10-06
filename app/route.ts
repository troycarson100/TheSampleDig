import type { NextRequest } from "next/server"

// sampleroll.com opens on the plugins: "/" hands off to /plugins, which
// picks the storefront page (and carries ?ref= and the rest of the query
// along). The crate-digging landing that used to live here is /welcome,
// where the Dig link sends anyone signed out (components/SiteNav.tsx).
//
// A Route Handler rather than a page with redirect(), for the reason given in
// app/plugins/route.ts: a real 307 with the query string intact, served
// before the root layout's loading boundary can commit a 200. Relative
// Location for the same reason too.
export async function GET(request: NextRequest) {
  const search = new URL(request.url).search
  return new Response(null, { status: 307, headers: { Location: `/plugins${search}` } })
}
