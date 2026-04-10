import Link from "next/link"
import { SITE_ALERTS } from "@/lib/site-alerts"

export const metadata = {
  title: "Alerts & updates - Sample Roll",
  description: "Product updates and announcements for Sample Roll",
}

function formatDate(iso: string) {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch {
    return iso
  }
}

export default function AlertsPage() {
  const sorted = [...SITE_ALERTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="w-full py-2 border-b" style={{ background: "#F6F0E8", borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <Link
            href="/dig"
            className="text-[15px] font-medium hover:underline"
            style={{ color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
          >
            ← Sample Roll
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Alerts & updates
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
          Announcements and release notes from the Sample Roll team.
        </p>
        <ul className="flex flex-col gap-8 list-none p-0 m-0">
          {sorted.map((item) => (
            <li key={item.id} className="border-b pb-8 last:border-0" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), monospace" }}>
                {formatDate(item.publishedAt)}
              </p>
              <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--foreground)" }}>
                {item.title}
              </h2>
              {item.body ? (
                <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--foreground)" }}>
                  {item.body}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
