import { BlogAdSenseScript } from "@/components/ads/BlogAdSenseScript"

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BlogAdSenseScript />
      {children}
    </>
  )
}
