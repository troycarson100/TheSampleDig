import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin"
import AdminComps from "@/components/comps/AdminComps"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

// Gated by the ADMIN_EMAILS env allowlist, same as /admin/affiliates.
export default async function AdminCompsPage() {
  if (!(await requireAdmin())) notFound()

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-8">
        <AdminComps />
      </main>
    </div>
  )
}
