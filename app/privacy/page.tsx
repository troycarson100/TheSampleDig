import Link from "next/link"

export const metadata = {
  title: "Privacy Policy - Sample Roll",
  description: "Privacy policy for Sample Roll",
}

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
          <p className="mb-4">
            Last updated: February 2025. Sample Roll (&quot;we&quot;, &quot;our&quot;) respects your privacy. This policy describes what information we collect and how we use it.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">YouTube API Services</h2>
          <p className="mb-4">
            This application uses the{" "}
            <a
              href="https://developers.google.com/youtube/terms/api-services-terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              YouTube API Services
            </a>{" "}
            to let you discover and play YouTube videos (e.g. for sampling). By using Sample Roll, you also agree to be bound by the{" "}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              YouTube Terms of Service
            </a>
            . Google&apos;s{" "}
            <a
              href="https://www.google.com/policies/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              Privacy Policy
            </a>{" "}
            describes how Google (and YouTube) treat data when you use their services.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Information we collect and use</h2>
          <p className="mb-4">
            We collect and store: (1) account information you provide when you register (e.g. email and password, stored securely); (2) the list of samples you save (video IDs, titles, chop points, and related metadata) so we can show &quot;My Samples&quot; and sync your saved collection. We use this to run the app, personalize your experience, and persist your saved samples. We do not sell your personal information.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Sharing</h2>
          <p className="mb-4">
            We do not sell or rent your data. Data may be processed by our hosting and database providers to operate the service. When you use features that load YouTube videos, YouTube/Google receives requests as described in their Privacy Policy.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Your choices</h2>
          <p className="mb-4">
            You can delete your account and saved data by contacting us or using any in-app account deletion we provide. If you have granted our app access to your Google or YouTube account data, you can revoke that access at{" "}
            <a
              href="https://security.google.com/settings/security/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              Google security settings
            </a>
            .
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Contact</h2>
          <p className="mb-4">
            For privacy questions or to request deletion of your data, contact us through the contact method provided on Sample Roll.
          </p>
        </div>
      </main>
    </div>
  )
}
