import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import BlogCardImage from "@/components/BlogCardImage"
import { getPostBySlug, getAllSlugs } from "@/lib/blog-posts"

const placeholderGradients = [
  "linear-gradient(135deg, #e07c4a 0%, #d4a574 100%)",
  "linear-gradient(135deg, #9b9bb5 0%, #c9b8a8 100%)",
  "linear-gradient(135deg, #332B25 0%, #6B6560 100%)",
]

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return { title: "Post not found" }
  return {
    title: `${post.title} | Sample Roll Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      images: post.imageUrl ? [{ url: post.imageUrl, width: 1200, height: 630, alt: post.title }] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const gradientIndex = getAllSlugs().indexOf(slug) % placeholderGradients.length

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="w-full py-1" style={{ background: "#F6F0E8" }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <SiteNav />
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <article>
          <div className="rounded-2xl overflow-hidden border mb-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {post.imageUrl ? (
              <BlogCardImage
                src={post.imageUrl}
                alt=""
                sizes="(max-width: 1024px) 100vw, 1152px"
                priority
                gradientIndex={gradientIndex}
                aspectClass="aspect-[21/9]"
              />
            ) : (
              <div
                className="aspect-[21/9] w-full"
                style={{ background: placeholderGradients[gradientIndex] }}
              />
            )}
          </div>
          <header className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-semibold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-halant), Georgia, serif" }}>
              {post.title}
            </h1>
            <time className="text-sm" style={{ color: "var(--muted)" }} dateTime={post.date}>
              {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </time>
          </header>
          <div className="max-w-none" style={{ color: "var(--foreground)" }}>
            {post.content.map((block, i) => {
              if (block.type === "h2") {
                return (
                  <h2
                    key={i}
                    className="text-xl font-semibold mt-8 mb-3 first:mt-0"
                    style={{ fontFamily: "var(--font-halant), Georgia, serif", color: "var(--foreground)" }}
                  >
                    {block.text}
                  </h2>
                )
              }
              if (block.type === "h3") {
                return (
                  <h3
                    key={i}
                    className="text-lg font-semibold mt-6 mb-2"
                    style={{ fontFamily: "var(--font-halant), Georgia, serif", color: "var(--foreground)" }}
                  >
                    {block.text}
                  </h3>
                )
              }
              if (block.type === "p" && "segments" in block) {
                return (
                  <p
                    key={i}
                    className="text-[15px] leading-relaxed mb-4"
                    style={{ color: "var(--muted)" }}
                  >
                    {block.segments.map((seg, j) =>
                      seg.type === "link" ? (
                        <Link
                          key={j}
                          href={seg.href}
                          className="font-medium underline underline-offset-2 hover:opacity-80 transition"
                          style={{ color: "var(--primary)" }}
                          target={seg.href.startsWith("http") ? "_blank" : undefined}
                          rel={seg.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        >
                          {seg.value}
                        </Link>
                      ) : (
                        <span key={j}>{seg.value}</span>
                      )
                    )}
                  </p>
                )
              }
              return (
                <p
                  key={i}
                  className="text-[15px] leading-relaxed mb-4"
                  style={{ color: "var(--muted)" }}
                >
                  {block.text}
                </p>
              )
            })}
          </div>
        </article>

        <div className="mt-8">
          <Link href="/blog" className="text-sm font-medium hover:underline" style={{ color: "var(--primary)" }}>
            ← Back to Blog
          </Link>
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
