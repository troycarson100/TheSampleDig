"use client"

import Link from "next/link"
import SiteNav from "@/components/SiteNav"

export default function CookiesPageBody() {
  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      {/* Fixed .site-header is 56px (globals.css); offset main so content isn’t covered */}
      <main className="max-w-2xl mx-auto px-3 sm:px-4 mt-[56px] pb-8 pt-6">
        <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>
          Cookie Policy
        </h1>
        <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
          <p className="mb-4">
            Last updated: April 2026. This Cookie Policy explains how Sample Roll (&quot;Sample Roll&quot;, &quot;we&quot;,
            &quot;us&quot;, or &quot;our&quot;) uses cookies and similar technologies when you visit or use our website and
            services (the &quot;Service&quot;). It should be read together with our{" "}
            <Link href="/privacy" className="underline" style={{ color: "var(--primary)" }}>
              Privacy Policy
            </Link>
            , which describes how we handle personal data more broadly.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">What are cookies and similar technologies?</h2>
          <p className="mb-4">
            <strong>Cookies</strong> are small text files placed on your device when you visit a site. They often include an
            identifier and may be <strong>session</strong> cookies (deleted when you close the browser) or{" "}
            <strong>persistent</strong> cookies (stored for a set period or until you delete them).
          </p>
          <p className="mb-4">
            We also use <strong>similar technologies</strong>, including <strong>browser local storage</strong> and{" "}
            <strong>session storage</strong>, to save preferences and data on your device without always using a traditional
            cookie file. Where this policy refers to &quot;cookies,&quot; it includes these technologies unless we say
            otherwise.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Why we use cookies</h2>
          <p className="mb-4">
            We use cookies and similar technologies to run the Service securely, remember your settings, and (where
            applicable) show advertising or load embedded content from partners. Depending on your region, we may rely on
            your consent for non-essential cookies, or on another lawful basis such as providing a service you asked for or
            legitimate interests—where allowed by law.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">1. Strictly necessary (authentication and security)</h2>
          <p className="mb-4">
            When you sign in, we use <strong>HTTP cookies</strong> managed by our authentication system (for example,
            NextAuth.js-style session cookies) to keep you logged in, protect your account, and prevent abuse. These are
            required for core functionality; without them, sign-in and account features will not work reliably.
          </p>
          <p className="mb-4">
            These cookies are typically <strong>first-party</strong> (set by our domain) and may be session-based or
            short-lived persistent cookies, depending on the &quot;remember me&quot; behavior and security settings we use.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">2. Preferences and functionality (local storage)</h2>
          <p className="mb-4">
            To improve your experience, we store certain choices in your browser using <strong>local storage</strong> or{" "}
            <strong>session storage</strong> (not always visible as classic &quot;cookies&quot; in every browser UI, but
            similar in purpose). Examples include:
          </p>
          <ul className="list-disc pl-5 mb-4 space-y-2">
            <li>Dig page settings such as filters, autoplay, and display preferences</li>
            <li>Interface state such as chop mode, onboarding hints, and sidebar-related flags</li>
            <li>Data that helps the app work offline in the browser session, such as temporary navigation or history where we
              offer it</li>
            <li>Other app-specific keys needed to sync your experience between visits on the same device</li>
          </ul>
          <p className="mb-4">
            You can clear this data through your browser&apos;s settings (e.g. &quot;clear site data&quot;). Doing so may
            reset preferences or require you to sign in again.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">3. Embedded media: YouTube</h2>
          <p className="mb-4">
            Sample Roll may embed or load <strong>YouTube</strong> players or use the YouTube API so you can discover and
            play videos. When you interact with YouTube content, <strong>Google</strong> may set or read cookies and use
            identifiers on their domains. That processing is governed by Google&apos;s policies, not ours.
          </p>
          <p className="mb-4">
            For more information, see Google&apos;s{" "}
            <a
              href="https://policies.google.com/technologies/cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              How Google uses cookies
            </a>
            , the{" "}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              YouTube Terms of Service
            </a>
            , and Google&apos;s{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              Privacy Policy
            </a>
            .
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">4. Advertising (Google AdSense on Dig)</h2>
          <p className="mb-4">
            On certain pages (for example, the Dig experience), we may load <strong>Google AdSense</strong> or similar
            display advertising for users who are not on an ad-free plan. Google and its partners may use cookies and
            similar technologies to measure delivery, limit how often you see an ad, and personalize ads where permitted.
          </p>
          <p className="mb-4">
            If you subscribe to a plan that includes an ad-free experience where we offer it, we aim not to load those
            advertising scripts for that experience. Ad personalization and opt-out tools are described in Google&apos;s
            help center; you can also use industry tools such as the{" "}
            <a
              href="https://optout.aboutads.info/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              Digital Advertising Alliance
            </a>{" "}
            (U.S.) or the{" "}
            <a
              href="https://www.youronlinechoices.eu/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              Your Online Choices
            </a>{" "}
            (EU) where available.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">5. Payments (Stripe)</h2>
          <p className="mb-4">
            If you purchase a subscription or other paid product, you may be redirected to a checkout experience hosted by{" "}
            <strong>Stripe</strong> (or processed via Stripe on our behalf). Stripe may use cookies and similar
            technologies for fraud prevention, session management, and compliance. See Stripe&apos;s{" "}
            <a
              href="https://stripe.com/legal/cookies-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              Cookie Policy
            </a>{" "}
            and{" "}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--primary)" }}
            >
              Privacy Policy
            </a>
            .
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Retention</h2>
          <p className="mb-4">
            How long a cookie or stored value lasts depends on its purpose: session cookies expire when you close the
            browser; persistent cookies and local storage entries remain until they expire, we delete them as part of an
            update, or you clear your browser data. Third parties apply their own retention rules.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Your choices and controls</h2>
          <p className="mb-4">
            <strong>Browser settings.</strong> Most browsers let you block or delete cookies and site data. Blocking all
            cookies may break sign-in or features that depend on storage.
          </p>
          <p className="mb-4">
            <strong>Google and advertising.</strong> You can manage certain Google ad and personalization settings through
            your Google Account and tools linked from Google&apos;s privacy and ads help pages.
          </p>
          <p className="mb-4">
            <strong>Do Not Track.</strong> Some browsers send a &quot;Do Not Track&quot; signal. There is no consistent
            industry standard; we do not guarantee a specific response to that signal today, but we describe our practices in
            this policy and our Privacy Policy.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">EEA, UK, and similar regions</h2>
          <p className="mb-4">
            If you are in the European Economic Area, the United Kingdom, or another region with specific privacy laws, you
            may have rights regarding cookies and personal data (including access, correction, deletion, restriction,
            objection, and portability in some cases). See our Privacy Policy for how to exercise rights and our contact
            details. Non-essential cookies (such as some advertising cookies) may require consent under local law; essential
            cookies may be used as needed to provide the Service.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">California and U.S. state privacy notices</h2>
          <p className="mb-4">
            Depending on where you live, you may have rights to know what personal information is collected, to delete
            certain information, and to opt out of &quot;sale&quot; or &quot;sharing&quot; of personal information for
            cross-context behavioral advertising, as those terms are defined by applicable law. We describe our practices in
            our Privacy Policy. For cookie-based advertising, you may use browser controls and the opt-out tools linked
            above.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Children</h2>
          <p className="mb-4">
            The Service is not directed at children under 13 (or the age required in your jurisdiction). We do not
            knowingly use cookies to profile children for marketing.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Changes to this Cookie Policy</h2>
          <p className="mb-4">
            We may update this Cookie Policy from time to time. We will post the updated version on this page and change the
            &quot;Last updated&quot; date. Material changes may be communicated through the Service or by email where
            appropriate.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">Contact</h2>
          <p className="mb-4">
            For questions about this Cookie Policy or our use of cookies, contact us using the contact method provided on
            Sample Roll, or refer to the contact section of our{" "}
            <Link href="/privacy" className="underline" style={{ color: "var(--primary)" }}>
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
