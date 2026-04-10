"use client"

import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import SettingsMarketingPreference from "@/components/SettingsMarketingPreference"
import SettingsPricingNavButton from "@/components/SettingsPricingNavButton"
import SettingsSubscriptionManage from "@/components/SettingsSubscriptionManage"

const linkClass =
  "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 no-underline transition hover:opacity-90"

export default function SettingsPageBody() {
  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      {/* Fixed .site-header is 56px (globals.css); offset main so content isn’t covered */}
      <main className="max-w-xl mx-auto px-3 sm:px-4 mt-[56px] pb-8 pt-6">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Settings
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
          Account, billing, and legal links.
        </p>
        <nav className="flex flex-col gap-3" aria-label="Settings sections">
          <SettingsMarketingPreference />
          <SettingsSubscriptionManage />
          <Link href="/profile" className={linkClass} style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
            <span style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>My Crate & profile</span>
            <span aria-hidden className="text-lg opacity-50">
              →
            </span>
          </Link>
          <SettingsPricingNavButton />
          <Link href="/alerts" className={linkClass} style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
            <span style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>Alerts & updates</span>
            <span aria-hidden className="text-lg opacity-50">
              →
            </span>
          </Link>
          <div className="pt-4 mt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs uppercase tracking-wide mb-3" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
              Legal
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/privacy" className="text-sm underline" style={{ color: "var(--foreground)" }}>
                Privacy Policy
              </Link>
              <Link href="/cookies" className="text-sm underline" style={{ color: "var(--foreground)" }}>
                Cookie Policy
              </Link>
              <Link href="/terms" className="text-sm underline" style={{ color: "var(--foreground)" }}>
                Terms of Service
              </Link>
            </div>
          </div>
        </nav>
      </main>
    </div>
  )
}
