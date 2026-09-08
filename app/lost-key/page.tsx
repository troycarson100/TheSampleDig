import type { Metadata } from "next"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import LostKeyForm from "@/components/LostKeyForm"

export const metadata: Metadata = {
  title: "Find your licence key | Sample Roll",
  robots: { index: false, follow: false },
}

export default function LostKeyPage() {
  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-md mx-auto px-3 sm:px-4 mt-[56px] pb-16 pt-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Find your licence key
        </h1>
        <p className="text-[15px] mb-8" style={{ color: "var(--foreground)", opacity: 0.75 }}>
          Enter the email you bought with and we&apos;ll resend your receipt - keys, download
          links, and how to get into My Products.
        </p>
        <LostKeyForm />
        <p className="text-[13px] mt-8" style={{ color: "var(--foreground)", opacity: 0.6 }}>
          Already have a password?{" "}
          <Link href="/login?callbackUrl=%2Fproducts" className="underline">
            Sign in
          </Link>{" "}
          to see everything on My Products.
        </p>
      </main>
    </div>
  )
}
