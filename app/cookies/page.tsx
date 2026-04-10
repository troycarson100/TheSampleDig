import Link from "next/link"

export const metadata = {
  title: "Cookie Policy - Sample Roll",
  description: "Cookie policy for Sample Roll",
}

export default function CookiesPage() {
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
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-8">
        <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>
          Cookie Policy
        </h1>
        <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
          <p className="mb-4">
            Last updated: April 2026. This policy describes how Sample Roll uses cookies and similar technologies.
          </p>
          <h2 className="text-lg font-semibold mt-6 mb-2">Essential cookies</h2>
          <p className="mb-4">
            We use cookies and local storage that are necessary to operate the service—for example to keep you signed in,
            remember preferences, and maintain your saved samples. These are required for core functionality.
          </p>
          <h2 className="text-lg font-semibold mt-6 mb-2">Analytics and third parties</h2>
          <p className="mb-4">
            We may use analytics or embedded content (such as YouTube players) that set their own cookies or storage. Those
            providers have their own policies; see their sites for details.
          </p>
          <h2 className="text-lg font-semibold mt-6 mb-2">Your choices</h2>
          <p className="mb-4">
            You can control cookies through your browser settings. Blocking some cookies may limit certain features of Sample Roll.
          </p>
        </div>
      </main>
    </div>
  )
}
