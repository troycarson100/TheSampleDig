import Link from "next/link"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import ProductChangelog from "@/components/ProductChangelog"
import SiteNav from "@/components/SiteNav"
import WindowsInstallNote from "@/components/WindowsInstallNote"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getProduct } from "@/lib/products"

export const metadata: Metadata = {
  title: "My Products | Sample Roll",
  robots: { index: false, follow: false },
}

export default async function ProductsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/products")
  }

  const purchases = await prisma.purchase.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-2xl mx-auto px-3 sm:px-4 mt-[56px] pb-16 pt-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          My Products
        </h1>
        <p className="text-[15px] mb-8" style={{ color: "var(--muted-foreground, var(--foreground))", opacity: 0.75 }}>
          Your purchases and downloads, tied to {session.user.email}.
        </p>

        {purchases.length === 0 ? (
          <div
            className="rounded-xl border p-6 text-[15px]"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <p className="mb-3">You don&apos;t have any products yet.</p>
            <Link href="/shft" className="underline font-medium" style={{ color: "var(--primary)" }}>
              Check out shft →
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {purchases.map((purchase) => {
              const def = getProduct(purchase.product)
              if (!def) return null
              return (
                <section
                  key={purchase.id}
                  className="rounded-xl border p-5 sm:p-6"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <div>
                      <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                        {def.name}
                      </h2>
                      {def.version && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--foreground)", opacity: 0.55 }}>
                          v{def.version}
                        </p>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.55 }}>
                      Purchased {purchase.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[14px] mb-4" style={{ color: "var(--foreground)", opacity: 0.75 }}>
                    {def.blurb}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {def.assets.map((asset) => (
                      <a
                        key={asset.id}
                        href={`/api/products/${def.id}/download?asset=${asset.id}`}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold no-underline"
                        style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)" }}
                      >
                        ↓ {asset.label}
                      </a>
                    ))}
                  </div>

                  {def.assets.some((a) => a.id === "installer-win") && <WindowsInstallNote />}

                  {def.changelog && def.changelog.length > 0 && (
                    <ProductChangelog releases={def.changelog} />
                  )}
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
