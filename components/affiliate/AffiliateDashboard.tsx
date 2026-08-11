import type { AffiliateStats } from "@/lib/affiliate"
import ConnectStripeButton from "@/components/affiliate/ConnectStripeButton"

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

const mono = { fontFamily: "var(--font-ibm-mono), monospace" }
const label = { ...mono, color: "var(--muted)" }

export default function AffiliateDashboard({
  affiliate,
  stats,
  baseUrl,
  payout,
  connectToken,
}: {
  affiliate: { name: string; code: string }
  stats: AffiliateStats
  baseUrl: string
  payout: { connected: boolean; enabled: boolean }
  connectToken?: string
}) {
  const link = `${baseUrl}/shft?ref=${affiliate.code}`
  const tiles: { name: string; value: string; hot?: boolean }[] = [
    { name: "Clicks (30d / all)", value: `${stats.clicks30d} / ${stats.clicksTotal}` },
    { name: "Sales", value: String(stats.salesCount) },
    { name: "Revenue driven", value: usd(stats.grossCents) },
    { name: "Commission earned", value: usd(stats.commissionCents) },
    { name: "Owed to you", value: usd(stats.owedCents), hot: true },
  ]
  return (
    <>
      <p className="text-xs uppercase tracking-widest mb-1" style={label}>
        shft affiliate
      </p>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
        {affiliate.name}
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
        Share your link or code — sales attribute automatically and show up here.
      </p>

      <div className="rounded-xl border p-4 sm:p-5 text-sm" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
        <p className="text-xs uppercase tracking-widest mb-2" style={label}>
          Your link
        </p>
        <p className="select-all break-all font-medium" style={{ ...mono, color: "var(--primary)" }}>
          {link}
        </p>
        <p className="text-xs uppercase tracking-widest mt-4 mb-2" style={label}>
          Your code — buyers can type it at checkout
        </p>
        <p className="select-all font-medium" style={{ ...mono, color: "var(--primary)" }}>
          {affiliate.code}
        </p>
      </div>

      <div className="mt-4 rounded-xl border p-4 sm:p-5 text-sm" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
        <p className="text-xs uppercase tracking-widest mb-2" style={label}>
          Payouts
        </p>
        {payout.enabled ? (
          <p>
            <span className="font-semibold" style={{ color: "var(--primary)" }}>
              Instant payouts on
            </span>{" "}
            — your cut is sent to your Stripe account right after each sale.
          </p>
        ) : payout.connected ? (
          <>
            <p className="mb-3">
              Your Stripe setup isn&apos;t finished yet — until it is, earnings collect here as owed.
            </p>
            <ConnectStripeButton token={connectToken} label="Finish Stripe setup" />
          </>
        ) : (
          <>
            <p className="mb-3">
              Connect Stripe once and every sale pays your cut automatically. Until then, earnings collect here as
              owed and get paid manually.
            </p>
            <ConnectStripeButton token={connectToken} label="Connect Stripe to get paid automatically" />
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.name} className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="text-[11px] uppercase tracking-wide" style={label}>
              {tile.name}
            </div>
            <div
              className="mt-1 text-lg font-bold"
              style={{ color: tile.hot ? "var(--primary)" : "var(--foreground)" }}
            >
              {tile.value}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
        Sales
      </h2>
      {stats.referrals.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: "var(--foreground)", opacity: 0.6 }}>
          No attributed sales yet — share your link to get started.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-left text-sm" style={{ color: "var(--foreground)" }}>
            <thead>
              <tr className="text-[11px] uppercase tracking-wide" style={label}>
                <th className="px-4 py-2 font-normal">Date</th>
                <th className="px-4 py-2 font-normal">Sale</th>
                <th className="px-4 py-2 font-normal">Your cut</th>
                <th className="px-4 py-2 font-normal">Via</th>
                <th className="px-4 py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.referrals.map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-2">{usd(r.grossAmountCents)}</td>
                  <td className="px-4 py-2 font-medium">{usd(r.commissionCents)}</td>
                  <td className="px-4 py-2">{r.source === "code" ? "typed code" : "link"}</td>
                  <td className="px-4 py-2" style={r.refundedAt ? { opacity: 0.55 } : undefined}>
                    {r.refundedAt ? "refunded" : r.paidOut ? "paid" : "pending payout"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
        Payouts
      </h2>
      {stats.payouts.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: "var(--foreground)", opacity: 0.6 }}>
          No payouts yet.
        </p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm" style={{ color: "var(--foreground)" }}>
          {stats.payouts.map((p) => (
            <li key={p.id} className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <span className="font-medium">{usd(p.amountCents)}</span>
              <span style={{ opacity: 0.6 }}> · {fmtDate(p.paidAt)}</span>
              {p.note ? <span style={{ opacity: 0.6 }}> · {p.note}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
