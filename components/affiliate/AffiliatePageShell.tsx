import SiteNav from "@/components/SiteNav"

// Standard site chrome for affiliate pages: vinyl theme, fixed header, offset main.
// Mirrors the wrapper used by /settings and /products.
export default function AffiliatePageShell({
  children,
  wide = false,
}: {
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className={`${wide ? "max-w-5xl" : "max-w-2xl"} mx-auto px-3 sm:px-4 mt-[56px] pb-16 pt-8`}>
        {children}
      </main>
    </div>
  )
}
