import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin"
import AdminAffiliates from "@/components/affiliate/AdminAffiliates"
import SiteNav from "@/components/SiteNav"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

// Master panel: create affiliates, see everyone's numbers, record payouts.
// Gated by the ADMIN_EMAILS env allowlist; everyone else gets a 404.
export default async function AdminAffiliatesPage() {
  if (!(await requireAdmin())) notFound()
  return (
    <>
      <SiteNav />
      <AdminAffiliates baseUrl={process.env.NEXTAUTH_URL || "http://localhost:3000"} />
    </>
  )
}
