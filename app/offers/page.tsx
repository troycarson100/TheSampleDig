import { redirect } from "next/navigation"

// /offers existed to surface a discount for owners of one plugin buying the
// other. That discount is retired — singles and the three-plugin bundle are
// the whole story now, and both live on /plugins.
// Kept as a redirect rather than deleted: the URL is in already-sent email.
export default function OffersPage() {
  redirect("/plugins")
}
