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
            description={`To everyone who takes email and doesn't own all three. Owns nothing: the bundle at its sale price. Owns one or two: the rest of the set at $${COMPLETE_SET_PRICE[2]} or $${COMPLETE_SET_PRICE[1]}. Their $10 code appears only beside the bundle, the one deal it stacks with ($49). And a section for each plugin - owned, or its price. Everything ends October 31.`}
            testNote="The code is an example and works nowhere, and the complete-your-set button goes to the fltr page."
          />
        </div>
        <div className="mt-12">
          <AdminCampaign
            url="/api/admin/offers/video2"
            title="Fifth email - shft's video"
            description={`shft's video (any sound into a rhythm), to the same people and deals as the third email: their $10 code if it's still unused, and the other two plugins for $${COMPLETE_SET_PRICE[2]} (until October 31) if they own exactly one. A row of the plugins under the video - all three with prices for someone who owns none, only the missing ones for an owner. Anyone with neither deal isn't sent it, and neither is anyone who has unsubscribed.`}
            testNote={`The code is an example and works nowhere, and the $${COMPLETE_SET_PRICE[2]} button goes to the fltr page.`}
          />
        </div>
      </main>
    </div>
  )
}
