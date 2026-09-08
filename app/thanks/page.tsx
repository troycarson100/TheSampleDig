import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import ThanksPage from "./ThanksPage"

export const metadata: Metadata = {
  title: "Thanks | Sample Roll",
  robots: { index: false, follow: false },
}

// Stripe's success URL. The client component reads the session id from the
// query string, claims it, and shows the keys - no sign-in needed.
export default function Page() {
  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-2xl mx-auto px-3 sm:px-4 mt-[56px] pb-16 pt-8">
        <ThanksPage />
      </main>
    </div>
  )
}
