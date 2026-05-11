import Link from "next/link"
import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"

export const metadata: Metadata = {
  title: "About Sample Roll",
  description:
    "Sample Roll helps producers and crate diggers discover rare samples on YouTube, save them, and stay organized. Learn who we are and how to reach us.",
}

export default function AboutPage() {
  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-2xl mx-auto px-3 sm:px-4 mt-[56px] pb-12 pt-8">
        <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>
          About Sample Roll
        </h1>
        <div className="space-y-4 text-[15px] leading-relaxed" style={{ color: "var(--foreground)" }}>
          <p>
            Sample Roll is a discovery tool for producers, beat-makers, and anyone who loves digging for sounds. We
            connect you to YouTube&apos;s vast catalog so you can roll through ideas, save what hits, and build your
            personal crate—without losing the thread of a session.
          </p>
          <p>
            Our goal is simple: make crate digging feel fast, focused, and fun. Whether you sample vinyl in the studio
            or pull inspiration from the web, Sample Roll is built to support a serious creative workflow.
          </p>
          <h2 className="text-lg font-semibold pt-4" style={{ color: "var(--foreground)" }}>
            Editorial blog
          </h2>
          <p>
            On our{" "}
            <Link href="/blog" className="underline" style={{ color: "var(--primary)" }}>
              blog
            </Link>
            , we publish practical guides on digging, sampling gear, chopping workflows, and sample clearance—written
            for working producers, not generic SEO filler.
          </p>
          <h2 className="text-lg font-semibold pt-4" style={{ color: "var(--foreground)" }}>
            Contact
          </h2>
          <p>
            Questions, partnerships, or feedback:{" "}
            <a href="mailto:hello@sampleroll.com" className="underline" style={{ color: "var(--primary)" }}>
              hello@sampleroll.com
            </a>
            .
          </p>
          <p className="pt-2 text-sm" style={{ color: "var(--muted)" }}>
            By using Sample Roll you also agree to the{" "}
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
        </div>
      </main>
    </div>
  )
}
