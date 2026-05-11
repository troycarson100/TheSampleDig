import Link from "next/link"
import { getFeaturedBlogPostsForHome } from "@/lib/blog-posts"
import styles from "./HomeBlogTeaser.module.css"

export default function HomeBlogTeaser() {
  const posts = getFeaturedBlogPostsForHome(3)

  return (
    <section className={styles.section} aria-labelledby="home-blog-teaser-heading">
      <p className={styles.eyebrow}>From the blog</p>
      <h2 id="home-blog-teaser-heading" className={styles.title}>
        Guides for producers and crate diggers
      </h2>
      <ul className={styles.list}>
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className={styles.link}>
              <h3 className={styles.postTitle}>{post.title}</h3>
              <p className={styles.excerpt}>{post.excerpt}</p>
              <p className={styles.meta}>
                {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/blog" className={styles.all}>
        View all posts →
      </Link>
    </section>
  )
}
