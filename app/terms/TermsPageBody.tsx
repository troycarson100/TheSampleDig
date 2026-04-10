"use client"

import SiteNav from "@/components/SiteNav"

/** Optional printable copy; keep in sync with this page. */
const TERMS_PDF_PATH = "/SampleRoll_Terms_and_Conditions.pdf"

export default function TermsPageBody() {
  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      {/* Fixed .site-header is 56px (globals.css); offset main so content isn’t covered */}
      <main className="max-w-2xl mx-auto px-3 sm:px-4 mt-[56px] pb-8 pt-6">
        <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>
          Terms and Conditions
        </h1>
        <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
          <p className="mb-4">
            Last updated: April 2026. These Terms and Conditions (&quot;Terms&quot;) govern your use of Sample Roll
            (&quot;Sample Roll&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) and the website, features, and
            services we offer (collectively, the &quot;Service&quot;). By creating an account or using the Service, you
            agree to these Terms. If you do not agree, do not use the Service.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">The Service</h2>
          <p className="mb-4">
            Sample Roll helps you discover, organize, and work with music and sample-related content. We may add, change, or
            discontinue features. We will try to give reasonable notice of material changes that affect how you use the
            Service when we can.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Accounts</h2>
          <p className="mb-4">
            You are responsible for safeguarding your login credentials and for all activity under your account. You agree to
            provide accurate information when you register and to keep it up to date. You must be old enough to enter a
            binding agreement where you live. You may not share your account in a way that abuses the Service or other
            users.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Acceptable use</h2>
          <p className="mb-4">
            You agree to use the Service only for lawful purposes. You will not attempt to disrupt the Service, access
            accounts or systems without permission, scrape or overload our infrastructure in ways we do not allow, or use
            the Service to violate the rights of others. You are responsible for complying with copyright, licensing, and
            other laws that apply to any audio, video, or other content you access, save, or create through the Service.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Intellectual property</h2>
          <p className="mb-4">
            The Service, including its design, branding, and software, is owned by us or our licensors. Content made
            available through third parties (for example, embedded or linked videos) remains the property of those third
            parties and is subject to their terms and licenses. Nothing in these Terms grants you ownership of third-party
            content.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">YouTube and third-party services</h2>
          <p className="mb-4">
            Features that use YouTube or other third-party services are also subject to their terms and policies. By using
            those features, you agree to comply with the{" "}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              YouTube Terms of Service
            </a>{" "}
            and other applicable Google or third-party terms when you interact with their services through Sample Roll.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Paid features</h2>
          <p className="mb-4">
            If you purchase a subscription or other paid offering, fees, billing, and cancellation are governed by the
            checkout flow and the payment provider&apos;s terms at the time of purchase, in addition to these Terms. Taxes
            may apply where required by law.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Disclaimers</h2>
          <p className="mb-4">
            The Service is provided &quot;as is&quot; and &quot;as available.&quot; To the fullest extent permitted by
            law, we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement. We do
            not guarantee that the Service will be uninterrupted, error-free, or free of harmful components.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Limitation of liability</h2>
          <p className="mb-4">
            To the fullest extent permitted by law, Sample Roll and its affiliates will not be liable for any indirect,
            incidental, special, consequential, or punitive damages, or any loss of profits, data, or goodwill, arising
            from your use of the Service. Our total liability for any claim arising out of these Terms or the Service is
            limited to the greater of (a) the amount you paid us for the Service in the twelve months before the claim or
            (b) fifty U.S. dollars, except where such a limitation is not allowed by law.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Changes to these Terms</h2>
          <p className="mb-4">
            We may update these Terms from time to time. We will post the updated version on this page and adjust the
            &quot;Last updated&quot; date. If changes are material, we may provide additional notice (for example, by email or
            an in-app message). Your continued use of the Service after changes become effective constitutes acceptance of
            the revised Terms.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Contact</h2>
          <p className="mb-4">
            For questions about these Terms, contact us through the contact method provided on Sample Roll.
          </p>

          <p className="mt-8 pt-6 border-t text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            A{" "}
            <a
              href={TERMS_PDF_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              PDF copy
            </a>{" "}
            of these terms may be available for your records if we host one; the terms on this page are the version that
            applies when you use the Service.
          </p>
        </div>
      </main>
    </div>
  )
}
