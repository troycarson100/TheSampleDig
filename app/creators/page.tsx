import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import CreatorApplyForm from "@/components/affiliate/CreatorApplyForm"
import { CREATOR_COMMISSION_PERCENT } from "@/lib/affiliate-application-logic"
import { PLUGINS, PLUGIN_ORDER } from "@/lib/plugins"

// The creator program's public page: what it pays, and the application. No
// sign-in. Approval happens in /admin/affiliates (lib/affiliate-application.ts).

export const metadata: Metadata = {
  title: "Creator program | Sample Roll",
  description: `Make videos with Sample Roll plugins and earn ${CREATOR_COMMISSION_PERCENT}% of every sale made through your link.`,
}

const muted = { color: "var(--foreground)", opacity: 0.75 } as const
const card = { borderColor: "var(--border)" } as const

const STEPS = [
  { n: "1", title: "Apply", body: "Tell us about you and what you'd make. We read every application." },
  { n: "2", title: "Get your link", body: "Approved creators get a personal link and code, and a dashboard with their clicks and sales." },
  {
    n: "3",
    title: `Earn ${CREATOR_COMMISSION_PERCENT}%`,
    body: `${CREATOR_COMMISSION_PERCENT}% of every purchase made through your link or with your code, paid to your Stripe account automatically after each sale.`,
  },
]

export default function CreatorsPage() {
  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-2xl mx-auto px-4 mt-[56px] pt-10 pb-20">
        <p className="text-xs uppercase tracking-widest mb-2" style={muted}>
          Creator program
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
          Make videos with our plugins. Earn {CREATOR_COMMISSION_PERCENT}% back.
        </h1>
        <p className="text-[16px] mb-8" style={muted}>
          If you make music videos, tutorials or beats on YouTube, Instagram or TikTok, apply below. Approved
          creators earn <strong>{CREATOR_COMMISSION_PERCENT}%</strong> of every purchase made with their link.
        </p>

        <ul className="grid gap-3 sm:grid-cols-3 mb-10">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-xl border p-4" style={card}>
              <p className="text-xs mb-1" style={{ ...muted, fontFamily: "var(--font-ibm-mono), monospace" }}>
                {s.n}
              </p>
              <p className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                {s.title}
              </p>
              <p className="text-[14px]" style={muted}>
                {s.body}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex gap-3 mb-10 overflow-hidden">
          {PLUGIN_ORDER.map((id) => (
            <div key={id} className="flex-1 min-w-0 rounded-xl border overflow-hidden" style={card}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PLUGINS[id].art.card} alt="" className="w-full h-24 object-cover" />
              <p className="px-3 py-2 text-[14px]" style={{ color: "var(--foreground)" }}>
                <strong>{PLUGINS[id].name}</strong> <span style={muted}>{PLUGINS[id].category}</span>
              </p>
            </div>
          ))}
        </div>

        <section className="rounded-xl border p-5 sm:p-6" style={card} id="apply">
          <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--foreground)" }}>
            Apply
          </h2>
          <p className="text-[14px] mb-5" style={muted}>
            We&apos;ll email you either way. If you&apos;re approved, the email has your link, your code and your
            dashboard.
          </p>
          <CreatorApplyForm />
        </section>
      </main>
    </div>
  )
}
