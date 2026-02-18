import Link from "next/link"
import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import BlogCardImage from "@/components/BlogCardImage"
import { blogPosts } from "@/lib/blog-posts"

export const metadata: Metadata = {
  title: "Blog | Sample Roll",
  description:
    "Tips for producers: finding vinyl samples, sampling gear, sample chopping, and sample clearance. Sample Roll helps you discover and save rare samples for beat making.",
}

const placeholderGradients = [
  "linear-gradient(135deg, #e07c4a 0%, #d4a574 100%)",
  "linear-gradient(135deg, #9b9bb5 0%, #c9b8a8 100%)",
  "linear-gradient(135deg, #332B25 0%, #6B6560 100%)",
]

export default function BlogPage() {
  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <div className="blog-page-wrap">
        <div className="pt-2 pb-4">
          <h1 className="blog-title uppercase">Blog</h1>
          <p className="blog-meta">
            {blogPosts.length} {blogPosts.length === 1 ? "post" : "posts"}
          </p>
        </div>

        <div className="pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {blogPosts.map((post, i) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="rounded-2xl overflow-hidden border transition-all hover:border-[var(--rust)]/40 block"
                style={{
                  background: "var(--warm)",
                  borderColor: "rgba(74, 55, 40, 0.1)",
                }}
              >
                {post.imageUrl ? (
                  <BlogCardImage
                    src={post.imageUrl}
                    alt=""
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    gradientIndex={i}
                  />
                ) : (
                  <div
                    className="aspect-[16/10] w-full"
                    style={{ background: placeholderGradients[i % placeholderGradients.length] }}
                  />
                )}
                <div className="p-4">
                  <h2 className="font-semibold text-lg mb-1 line-clamp-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                    {post.title}
                  </h2>
                  <p className="text-sm line-clamp-2 mb-2" style={{ color: "var(--brown)", opacity: 0.85 }}>
                    {post.excerpt}
                  </p>
                  <time className="text-xs" style={{ color: "var(--brown)", opacity: 0.7, fontFamily: "var(--font-ibm-mono), 'IBM Plex Mono', monospace" }} dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </time>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
