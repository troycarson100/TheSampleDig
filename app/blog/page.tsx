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
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="w-full py-2" style={{ background: "#F6F0E8" }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <SiteNav />
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="pt-2 pb-4">
          <h1 className="text-3xl sm:text-4xl font-semibold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-halant), Georgia, serif" }}>
            Blog
          </h1>
          <p className="text-[15px]" style={{ color: "var(--muted)" }}>
            {blogPosts.length} {blogPosts.length === 1 ? "post" : "posts"}
          </p>
        </div>

        <div className="pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {blogPosts.map((post, i) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="rounded-2xl overflow-hidden border transition-all hover:border-[var(--primary)]/40 block"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
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
                  <h2 className="font-semibold text-lg mb-1 line-clamp-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-halant), Georgia, serif" }}>
                    {post.title}
                  </h2>
                  <p className="text-sm line-clamp-2 mb-2" style={{ color: "var(--muted)" }}>
                    {post.excerpt}
                  </p>
                  <time className="text-xs" style={{ color: "var(--muted)" }} dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </time>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <footer className="mt-10 pt-8 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="text-lg font-semibold" style={{ fontFamily: "var(--font-halant), Georgia, serif", color: "var(--foreground)" }}>Sample Roll</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>Helping you find samples that matter.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm" style={{ color: "var(--muted)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
              <Link href="/dig" className="hover:text-[var(--foreground)] transition">Dig</Link>
              <Link href="/profile" className="hover:text-[var(--foreground)] transition">My Samples</Link>
              <Link href="/blog" className="hover:text-[var(--foreground)] transition">Blog</Link>
              <Link href="/login" className="hover:text-[var(--foreground)] transition">Login</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
