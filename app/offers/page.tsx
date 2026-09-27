import { redirect } from "next/navigation"

// /offers existed to surface a discount for owners of one plugin buying the
// other. That discount is retired — singles and the three-plugin bundle are
// the whole story now, and both live in the cart. /plugins itself now also
// redirects to /shft, so this points straight there rather than adding a
// second hop through that redirect.
// Kept as a redirect rather than deleted: the URL is in already-sent email.
export default function OffersPage() {
  redirect("/shft")
}
