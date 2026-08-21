import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import OffersView from "./OffersView"

export const metadata: Metadata = {
  title: "My Offers | Sample Roll",
  description:
    "Your Sample Roll plugin offers - complete the pair for $15, or take the shft + drft bundle for $34.",
  alternates: { canonical: "/offers" },
  // Personal to the signed-in visitor: nothing here belongs in search results.
  robots: { index: false, follow: false },
}

export default function OffersPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="site-header w-full shrink-0">
        <SiteNav />
      </header>
      <OffersView />
    </div>
  )
}
