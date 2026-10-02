import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin"
import AdminComps from "@/components/comps/AdminComps"
import AdminGiftLinks from "@/components/comps/AdminGiftLinks"
import SiteNav from "@/components/SiteNav"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

const TABS = [
  { id: "codes", label: "Codes", href: "/admin/comps" },
  { id: "gifts", label: "Gift links", href: "/admin/comps?tab=gifts" },
] as const

// Gated by the ADMIN_EMAILS env allowlist, same as /admin/affiliates.
export default async function AdminCompsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!(await requireAdmin())) notFound()
  const tab = (await searchParams).tab === "gifts" ? "gifts" : "codes"

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-4xl mx-auto px-3 sm:px-4 mt-[56px] py-8" style={{ color: "var(--foreground)" }}>
        <h1 className="text-2xl font-bold mb-4">Comp codes</h1>
        <nav className="mb-6 flex gap-1 border-b" style={{ borderColor: "var(--border)" }} aria-label="Comp code tabs">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              aria-current={tab === t.id ? "page" : undefined}
              data-comps-tab={t.id}
              className="-mb-px border-b-2 px-3 py-2 text-sm font-medium no-underline"
              style={{
                borderColor: tab === t.id ? "var(--primary)" : "transparent",
                color: tab === t.id ? "var(--primary)" : "var(--foreground)",
                opacity: tab === t.id ? 1 : 0.7,
              }}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {tab === "gifts" ? <AdminGiftLinks /> : <AdminComps />}
      </main>
    </div>
  )
}
