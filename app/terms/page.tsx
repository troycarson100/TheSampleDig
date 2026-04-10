import Link from "next/link"

export const metadata = {
  title: "Terms of Service - Sample Roll",
  description: "Terms of service for Sample Roll",
}

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
          <p className="mb-4">
            Last updated: April 2026. By using Sample Roll (&quot;the Service&quot;), you agree to these terms.
          </p>
          <h2 className="text-lg font-semibold mt-6 mb-2">Use of the Service</h2>
          <p className="mb-4">
            Sample Roll helps you discover and work with music samples. You agree to use the Service only for lawful purposes
            and in compliance with applicable copyright and licensing rules for any audio or video you access or create.
          </p>
          <h2 className="text-lg font-semibold mt-6 mb-2">Accounts</h2>
          <p className="mb-4">
            You are responsible for your account credentials and for activity under your account. You must provide accurate
            information when registering.
          </p>
          <h2 className="text-lg font-semibold mt-6 mb-2">YouTube</h2>
          <p className="mb-4">
            Features that use YouTube are also subject to the{" "}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              YouTube Terms of Service
            </a>
            .
          </p>
          <h2 className="text-lg font-semibold mt-6 mb-2">Disclaimer</h2>
          <p className="mb-4">
            The Service is provided &quot;as is&quot; without warranties of any kind. We may change or discontinue features
            with reasonable notice when possible.
          </p>
        </div>
      </main>
    </div>
  )
}
