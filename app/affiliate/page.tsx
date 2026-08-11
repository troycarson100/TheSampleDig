import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getAffiliateStats } from "@/lib/affiliate"
import AffiliateDashboard from "@/components/affiliate/AffiliateDashboard"
import SiteNav from "@/components/SiteNav"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

function Note({ text }: { text: string }) {
  return (
    <>
      <SiteNav />
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-neutral-300">
        <p>{text}</p>
        <p className="mt-4 text-sm">
          <Link href="/" className="underline">
            Back home
          </Link>
        </p>
      </div>
    </>
  )
}

// Logged-in entry to the same dashboard the token link shows.
export default async function AffiliatePage() {
  const session = await auth()
  if (!session?.user?.id) return <Note text="Sign in to view your affiliate dashboard." />

  let affiliate = await prisma.affiliate.findUnique({ where: { userId: session.user.id } })
  if (!affiliate) {
    // Auto-link: verified account email matching an unlinked affiliate record.
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (user?.emailVerified) {
      const match = await prisma.affiliate.findFirst({
        where: { email: { equals: user.email, mode: "insensitive" }, userId: null },
      })
      if (match) {
        affiliate = await prisma.affiliate.update({ where: { id: match.id }, data: { userId: user.id } })
      }
    }
  }
  if (!affiliate) {
    return (
      <Note text="The shft affiliate program is invite-only. If you make videos and want in, reach out via the Discord — otherwise, nothing to see here." />
    )
  }
  const stats = await getAffiliateStats(affiliate.id)
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  return (
    <>
      <SiteNav />
      <AffiliateDashboard affiliate={{ name: affiliate.name, code: affiliate.code }} stats={stats} baseUrl={baseUrl} />
    </>
  )
}
