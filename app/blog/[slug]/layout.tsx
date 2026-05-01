import { BlogAdSenseScript } from "@/components/ads/BlogAdSenseScript"

/** Publisher script only on post pages — not on `/blog` index (policy-friendly). */
export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BlogAdSenseScript />
      {children}
    </>
  )
}
