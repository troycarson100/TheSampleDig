import Link from "next/link"

export const metadata = {
  title: "Settings - Sample Roll",
  description: "Account and app settings for Sample Roll",
}

const linkClass =
  "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 no-underline transition hover:opacity-90"

export default function SettingsPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="w-full py-2 border-b" style={{ background: "#F6F0E8", borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <Link
            href="/dig"
            className="text-[15px] font-medium hover:underline"
            style={{ color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
          >
            ← Sample Roll
          </Link>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-3 sm:px-4 py-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Settings
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
          Account, billing, and legal links.
        </p>
        <nav className="flex flex-col gap-3" aria-label="Settings sections">
          <Link href="/profile" className={linkClass} style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
            <span style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>My Crate & profile</span>
            <span aria-hidden className="text-lg opacity-50">
              →
            </span>
          </Link>
          <Link href="/pro" className={linkClass} style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
            <span style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>Pricing & Pro</span>
            <span aria-hidden className="text-lg opacity-50">
              →
            </span>
          </Link>
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
