import { redirect } from "next/navigation"

// The cart is the bundle's home now, so this page has nothing left to show.
// Kept as a redirect rather than deleted: the URL is in sent email, in the
// site alert history, and indexed.
export default function PluginsPage() {
  redirect("/shft")
}
