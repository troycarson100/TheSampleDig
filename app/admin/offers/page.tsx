import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin"
import AdminMemberOffer from "@/components/offers/AdminMemberOffer"
import AdminOfferReminder from "@/components/offers/AdminOfferReminder"
import AdminCampaign from "@/components/offers/AdminCampaign"
import { COMPLETE_SET_PRICE } from "@/lib/complete-set-logic"
import SiteNav from "@/components/SiteNav"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

// Gated by the ADMIN_EMAILS env allowlist, same as /admin/releases.
export default async function AdminOffersPage() {
  if (!(await requireAdmin())) notFound()

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-4xl mx-auto px-3 sm:px-4 mt-[56px] py-8">
        <AdminMemberOffer />
        <div className="mt-12">
          <AdminOfferReminder />
        </div>
        <div className="mt-12">
          <AdminCampaign
            url="/api/admin/offers/video"
            title="Third email - the fltr video"
            description={`The deep-dive video, with each person's own offers: their $10 code if it's unused, and the other two plugins for $${COMPLETE_SET_PRICE[2]} (until October 31) if they own exactly one. Anyone with neither isn't sent it, and neither is anyone who has unsubscribed.`}
            testNote={`The code is an example and works nowhere, and the $${COMPLETE_SET_PRICE[2]} button goes to the fltr page.`}
          />
        </div>
        <div className="mt-12">
          <AdminCampaign
            url="/api/admin/offers/bundle"
            title="Fourth email - the bundle, dark"
            description={`To everyone who takes email and doesn't own all three. Owns nothing: the bundle at its sale price. Owns one or two: the rest of the set at $${COMPLETE_SET_PRICE[2]} or $${COMPLETE_SET_PRICE[1]}. Plus their $10 code if it's unused, and a section for each plugin - owned, or its price. Everything ends October 31.`}
            testNote="The code is an example and works nowhere, and the complete-your-set button goes to the fltr page."
          />
        </div>
      </main>
    </div>
  )
}
