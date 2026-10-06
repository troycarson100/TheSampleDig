import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getAffiliateStats } from "@/lib/affiliate"
import { refreshPayoutStatus } from "@/lib/affiliate-stripe"
import AffiliateDashboard from "@/components/affiliate/AffiliateDashboard"
import AffiliatePageShell from "@/components/affiliate/AffiliatePageShell"
import { CREATOR_COMMISSION_PERCENT } from "@/lib/affiliate-application-logic"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

function Note({ text, link }: { text: string; link?: { href: string; label: string } }) {
  return (
    <AffiliatePageShell>
      <div className="mx-auto max-w-xl py-12 text-center" style={{ color: "var(--foreground)" }}>
        <p className="text-[15px]">{text}</p>
        <p className="mt-4 text-sm">
          <Link href={link?.href ?? "/"} className="underline" style={{ color: "var(--primary)" }}>
            {link?.label ?? "Back home"}
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
      // Plain, pre-lowercased equals - not Prisma's `mode: "insensitive"`,
      // which compiles to an unescaped ILIKE and lets "%"/"_" act as
      // wildcards. Safe because `user.email` is a fresh row read (not
      // request input) and every write to User.email normalises to
      // lowercase first, matching how Affiliate.email is always written -
      // see findByEmail in lib/plugin-purchase-grant.ts.
      const match = await prisma.affiliate.findFirst({
        where: { email: user.email, userId: null },
      })
      if (match) {
        affiliate = await prisma.affiliate.update({ where: { id: match.id }, data: { userId: user.id } })
      }
    }
  }
  if (!affiliate) {
    return (
      <Note
        text={`This account isn't in the creator program. Make videos? Apply - approved creators get ${CREATOR_COMMISSION_PERCENT}% of every sale through their links.`}
        link={{ href: "/creators", label: "Apply to the creator program" }}
      />
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
