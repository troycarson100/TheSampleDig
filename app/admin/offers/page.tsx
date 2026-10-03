import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin"
import AdminMemberOffer from "@/components/offers/AdminMemberOffer"
import AdminOfferReminder from "@/components/offers/AdminOfferReminder"
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
      </main>
    </div>
  )
}
