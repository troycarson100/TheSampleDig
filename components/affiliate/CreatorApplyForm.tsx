"use client"

import { useState } from "react"
import { APPLICATION_PLUGINS, APPLICATION_PLUGIN_LABEL, MAX_SOCIALS } from "@/lib/affiliate-application-logic"
import { CREATOR_COUNTRIES } from "@/lib/creator-countries"

// The application on /creators. Every rule is also checked by the server
// (lib/affiliate-application-logic.ts); these are here to catch typos early.

const label = "block text-[13px] font-medium mb-1.5"
const field = "w-full rounded-lg border px-3 py-2.5 text-[15px] outline-none"
const fieldStyle = { borderColor: "var(--border)", color: "var(--foreground)", background: "rgba(255, 255, 255, 0.55)" }
const muted = { color: "var(--foreground)", opacity: 0.7 } as const

export default function CreatorApplyForm() {
  const [form, setForm] = useState({ name: "", email: "", country: "", plugin: "", message: "", website: "" })
  const [socials, setSocials] = useState<string[]>([""])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/creators/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, socials }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Couldn't send your application. Try again.")
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your application. Try again.")
    }
    setBusy(false)
  }

  if (done) {
    return (
      <div className="rounded-lg border px-4 py-4" style={{ borderColor: "var(--border)" }} data-apply-done>
        <p className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
          Thanks, {form.name.split(" ")[0]} - your application is in.
        </p>
        <p className="text-[14px]" style={muted}>
          We&apos;ll email <strong>{form.email.trim()}</strong> once we&apos;ve had a look.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="apply-name" style={{ color: "var(--foreground)" }}>
            Name
          </label>
          <input id="apply-name" required maxLength={80} autoComplete="name" className={field} style={fieldStyle} value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label className={label} htmlFor="apply-email" style={{ color: "var(--foreground)" }}>
            Email
          </label>
          <input id="apply-email" type="email" required autoComplete="email" className={field} style={fieldStyle} value={form.email} onChange={set("email")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="apply-country" style={{ color: "var(--foreground)" }}>
            Country
          </label>
          <select id="apply-country" required className={field} style={fieldStyle} value={form.country} onChange={set("country")}>
            <option value="">Choose your country</option>
            {CREATOR_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-[12px] mt-1.5" style={muted}>
            We pay creators through Stripe, which pays out in these countries. Not listed? We can&apos;t pay creators
            where you are yet.
          </p>
        </div>
        <div>
          <label className={label} htmlFor="apply-plugin" style={{ color: "var(--foreground)" }}>
            Which plugin would you make a video on?
          </label>
          <select id="apply-plugin" required className={field} style={fieldStyle} value={form.plugin} onChange={set("plugin")}>
            <option value="">Choose one</option>
            {APPLICATION_PLUGINS.map((p) => (
              <option key={p} value={p}>
                {APPLICATION_PLUGIN_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={label} style={{ color: "var(--foreground)" }}>
          Social links
        </legend>
        <p className="text-[12px] -mt-0.5 mb-2" style={muted}>
          1 to {MAX_SOCIALS} links to where you post - YouTube, Instagram, TikTok or anywhere else.
        </p>
        <div className="space-y-2">
          {socials.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                id={i === 0 ? "apply-social" : undefined}
                aria-label={`Social link ${i + 1}`}
                required={i === 0}
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={300}
                placeholder={["youtube.com/@yourchannel", "instagram.com/you", "tiktok.com/@you"][i]}
                className={field}
                style={fieldStyle}
                value={s}
                onChange={(e) => setSocials((all) => all.map((v, j) => (j === i ? e.target.value : v)))}
              />
              {socials.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove social link ${i + 1}`}
                  className="shrink-0 rounded-lg border px-3 text-[18px] leading-none cursor-pointer"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "transparent" }}
                  onClick={() => setSocials((all) => all.filter((_, j) => j !== i))}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
        {socials.length < MAX_SOCIALS && (
          <button
            type="button"
            className="mt-2 text-[14px] font-medium underline cursor-pointer"
            style={{ color: "var(--foreground)", background: "none", border: "none", padding: 0 }}
            onClick={() => setSocials((all) => [...all, ""])}
            data-add-social
          >
            + Add another link
          </button>
        )}
      </fieldset>

      <div>
        <label className={label} htmlFor="apply-message" style={{ color: "var(--foreground)" }}>
          Message
        </label>
        <textarea
          id="apply-message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="What you make, who watches it, and the video you have in mind."
          className={field}
          style={fieldStyle}
          value={form.message}
          onChange={set("message")}
        />
      </div>

      {/* Hidden from people; bots fill it in. See app/api/creators/apply. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="apply-website">Website</label>
        <input id="apply-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>

      {error && <p className="text-[14px] text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center justify-center rounded-full px-6 py-3 text-[15px] font-semibold cursor-pointer disabled:opacity-50"
        style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)", border: "none" }}
      >
        {busy ? "Sending…" : "Send application"}
      </button>
    </form>
  )
}
