import { redirect } from "next/navigation"

// The cart is the bundle's home now, so this page has nothing left to show.
// Kept as a redirect rather than deleted: the URL is in sent email, in the
// site alert history, and indexed — and affiliate share links already in
// circulation mint /plugins?ref=<code> (see AffiliateDashboard.tsx and
// AdminAffiliates.tsx, which now mint fresh links against /shft directly).
//
// The query string MUST survive the redirect: AffiliateRefCapture reads
// window.location.search on the landing page to record the click and set the
// 60-day shft_ref cookie, and in a production build this redirect is served
// before any client JS runs. A bare redirect("/shft") drops the whole query
// string, silently losing every affiliate click and the commission it would
// have earned — see the whole-increment review's Critical 2.
export default async function PluginsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const forwarded = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    for (const v of Array.isArray(value) ? value : [value]) forwarded.append(key, v)
  }
  const query = forwarded.toString()
  redirect(query ? `/shft?${query}` : "/shft")
}
