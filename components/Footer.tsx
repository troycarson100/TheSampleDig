import Link from "next/link"

export default function Footer() {
  return (
    <footer
      className="mt-auto w-full py-4 px-3 sm:px-4 border-t text-center text-xs"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      role="contentinfo"
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link
          href="/privacy"
          className="hover:underline focus:underline focus:outline-none"
          style={{ color: "var(--muted)" }}
        >
          Privacy Policy
        </Link>
        <span aria-hidden>·</span>
        <a
          href="https://www.youtube.com/t/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline focus:underline focus:outline-none"
          style={{ color: "var(--muted)" }}
        >
          YouTube Terms of Service
        </a>
        <span aria-hidden>·</span>
        <a
          href="https://www.youtube.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline focus:underline focus:outline-none"
          style={{ color: "var(--muted)" }}
          aria-label="YouTube"
        >
          YouTube
        </a>
      </div>
      <p className="mt-2 text-[11px] opacity-90" style={{ color: "var(--muted)" }}>
        By using this app you agree to the{" "}
        <a
          href="https://www.youtube.com/t/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: "var(--muted)" }}
        >
          YouTube Terms of Service
        </a>
        .
      </p>
    </footer>
  )
}
