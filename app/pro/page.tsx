"use client"

import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import TryProOfferingBlock from "@/components/pro/TryProOfferingBlock"

export default function ProPage() {
  const success = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("success") === "1"
  const canceled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("canceled") === "1"

  return (
    <div
      className="min-h-screen theme-vinyl flex flex-col"
      style={{ background: "var(--ink)", color: "var(--cream)" }}
    >
      <header className="site-header w-full shrink-0">
        <SiteNav />
      </header>
      <div className="w-full max-w-[960px] mx-auto flex-1 px-3 sm:px-5 pt-14 pb-10 sm:pb-14">
        {success && (
          <div
            className="mb-6 p-4 rounded-xl border text-center text-sm"
            style={{
              background: "rgba(34, 197, 94, 0.1)",
              borderColor: "rgba(74, 222, 128, 0.35)",
              color: "#bbf7d0",
            }}
          >
            Thanks for subscribing. You now have full Pro access. Refresh the page if you don’t see it yet.
          </div>
        )}
        {canceled && (
          <div
            className="mb-6 p-4 rounded-xl border text-center text-sm"
            style={{
              background: "rgba(240, 235, 225, 0.06)",
              borderColor: "rgba(240, 235, 225, 0.12)",
              color: "rgba(240, 235, 225, 0.65)",
            }}
          >
            Checkout was canceled. You can subscribe anytime below.
          </div>
        )}

        <TryProOfferingBlock headingTag="h1" headingId="pro-page-title" />

        <p className="text-center text-sm mt-10" style={{ color: "rgba(240, 235, 225, 0.45)" }}>
          <Link href="/dig" className="hover:underline transition" style={{ color: "rgba(240, 235, 225, 0.85)" }}>
            Back to Dig
          </Link>
        </p>
      </div>
    </div>
  )
}
