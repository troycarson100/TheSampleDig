import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { getAffiliateStats } from "@/lib/affiliate"
import AffiliateDashboard from "@/components/affiliate/AffiliateDashboard"
import SiteNav from "@/components/SiteNav"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

// Private token dashboard — the link emailed to a creator on invite. No login.
export default async function AffiliateTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const affiliate = await prisma.affiliate.findUnique({ where: { dashboardToken: token } })
  if (!affiliate) notFound()
  const stats = await getAffiliateStats(affiliate.id)
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  return (
    <>
      <SiteNav />
      <AffiliateDashboard affiliate={{ name: affiliate.name, code: affiliate.code }} stats={stats} baseUrl={baseUrl} />
    </>
  )
}
