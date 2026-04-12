import FeatureGate from "@/components/FeatureGate"
import Link from "next/link"

export default function MarketplaceSoundsPage() {
  return (
    <FeatureGate fallback={<MarketplaceDisabled />}>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-semibold mb-3">Marketplace Sounds</h1>
        <p style={{ color: "var(--muted)" }}>
          Marketplace is enabled. This is the Phase 0 scaffold for upcoming sounds pages.
        </p>
      </main>
    </FeatureGate>
  )
}

function MarketplaceDisabled() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold mb-2">Marketplace is disabled</h1>
      <p style={{ color: "var(--muted)" }}>
        Set <code>NEXT_PUBLIC_MARKETPLACE_ENABLED=true</code> to view marketplace routes.
      </p>
      <div className="mt-6">
        <Link href="/dig">Back to Dig</Link>
      </div>
    </main>
  )
}
