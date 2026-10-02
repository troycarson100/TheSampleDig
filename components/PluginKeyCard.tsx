"use client"

import { useState } from "react"
import WindowsInstallNote from "@/components/WindowsInstallNote"

// A plugin's licence key and its downloads, as /thanks and /gift show them.

type Download = { id: string; label: string; href: string }
export type PluginKeyItem = { product: string; licenseKey: string; downloads: Download[] }

const muted = { color: "var(--foreground)", opacity: 0.75 } as const
const card = { borderColor: "var(--border)" } as const
const primaryBtn =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold no-underline"
const primaryBtnStyle = { background: "var(--primary)", color: "var(--primary-foreground, #fff)" } as const
const ghostBtn = "inline-flex items-center rounded-lg px-3 py-2 text-[13px] font-medium border"
const ghostBtnStyle = { borderColor: "var(--border)", color: "var(--foreground)" } as const

export function KeyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <code
        className="text-[15px] tracking-wider rounded-lg px-3 py-2 border"
        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
      >
        {value}
      </code>
      <button type="button" onClick={copy} className={ghostBtn} style={ghostBtnStyle}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}

export default function PluginKeyCard({ item }: { item: PluginKeyItem }) {
  return (
    <section className="rounded-xl border p-5 sm:p-6" style={card}>
      <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--foreground)" }}>
        {item.product}
      </h2>
      <p className="text-[13px] font-medium mb-2" style={{ color: "var(--foreground)", opacity: 0.7 }}>
        Licence key
      </p>
      <KeyRow value={item.licenseKey} />
      <p className="text-[14px] mt-3 mb-4" style={muted}>
        Paste it into {item.product} the first time you open it. One key covers 3 machines.
      </p>
      <div className="flex flex-wrap gap-3">
        {item.downloads.map((d) => (
          <a key={d.id} href={d.href} className={primaryBtn} style={primaryBtnStyle}>
            ↓ {d.label}
          </a>
        ))}
      </div>
      {item.downloads.some((d) => d.id === "installer-win") && (
        <WindowsInstallNote product={item.product} />
      )}
    </section>
  )
}
