import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getAffiliateStats } from "@/lib/affiliate"
import { refreshPayoutStatus } from "@/lib/affiliate-stripe"
import AffiliateDashboard from "@/components/affiliate/AffiliateDashboard"
import AffiliatePageShell from "@/components/affiliate/AffiliatePageShell"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

function Note({ text }: { text: string }) {
  return (
    <AffiliatePageShell>
      <div className="mx-auto max-w-xl py-12 text-center" style={{ color: "var(--foreground)" }}>
        <p className="text-[15px]">{text}</p>
        <p className="mt-4 text-sm">
          <Link href="/" className="underline" style={{ color: "var(--primary)" }}>
            Back home
          </Link>
        </p>
      </div>
    </AffiliatePageShell>
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
      <Note text="The creator program is invite-only. If you make videos and want in, reach out via the Discord — otherwise, nothing to see here." />
    )
  }
  // Pick up freshly-completed Stripe onboarding (they land back here from Stripe).
  const payoutsEnabled = affiliate.stripePayoutsEnabled || (await refreshPayoutStatus(affiliate.id))
  const stats = await getAffiliateStats(affiliate.id)
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  return (
    <AffiliatePageShell>
      <AffiliateDashboard
        affiliate={{ name: affiliate.name, code: affiliate.code }}
        stats={stats}
        baseUrl={baseUrl}
        payout={{ connected: affiliate.stripeAccountId !== null, enabled: payoutsEnabled }}
      />
    </AffiliatePageShell>
  )
}
