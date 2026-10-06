import { isCreatorCountry, type CreatorCountry } from "./creator-countries"

// The creator program's public application: what it accepts, and the code an
// approved applicant is given. Pure - lib/affiliate-application.ts does the
// I/O, app/creators the form.

/** What creators earn on sales through their link, as the page offers it and
 *  as an approved application is set up. */
export const CREATOR_COMMISSION_PERCENT = 25

export const APPLICATION_PLUGINS = ["fltr", "shft", "drft", "all"] as const
export type ApplicationPlugin = (typeof APPLICATION_PLUGINS)[number]

export const APPLICATION_PLUGIN_LABEL: Record<ApplicationPlugin, string> = {
  fltr: "fltr",
  shft: "shft",
  drft: "drft",
  all: "All three",
}

export type ApplicationInput = {
  email: string
  name: string
  country: CreatorCountry
  plugin: ApplicationPlugin
  /** 1 to MAX_SOCIALS links to where they post, for review. Each is an
   *  absolute http(s) URL by the time it gets here. */
  socials: string[]
  message: string
}

export const MAX_SOCIALS = 3

const MAX_NAME = 80
const MAX_MESSAGE = 2000

/** The same shape check the site applies everywhere: an @ with something
 *  either side, no spaces. The reply is the real check. */
function readEmail(v: unknown): string | null {
  if (typeof v !== "string") return null
  const e = v.trim().toLowerCase()
  if (!e || e.length > 254 || /\s/.test(e)) return null
  const at = e.indexOf("@")
  return at > 0 && at === e.lastIndexOf("@") && at < e.length - 1 && e.slice(at).includes(".") ? e : null
}

/**
 * The social links, as typed: blanks dropped, a missing "https://" added
 * ("youtube.com/@you" is how people copy them), anything else that isn't a
 * web address refused - they are opened from the admin page, so only http(s)
 * gets through. Repeats count once.
 */
export function readSocials(v: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  const raw = Array.isArray(v) ? v : []
  const typed = raw.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)
  if (typed.length === 0) return { ok: false, error: "Add at least one link to where you post." }
  if (typed.length > MAX_SOCIALS) return { ok: false, error: `Add up to ${MAX_SOCIALS} links.` }
  const out: string[] = []
  for (const s of typed) {
    const bad = { ok: false as const, error: `"${s.slice(0, 60)}" doesn't look like a link. Paste the full address, like youtube.com/@yourchannel.` }
    if (s.length > 300 || /\s/.test(s)) return bad
    let url: URL
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`)
    } catch {
      return bad
    }
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".") || url.username || url.password) return bad
    if (!out.includes(url.href)) out.push(url.href)
  }
  return { ok: true, value: out }
}

export type ReadResult = { ok: true; value: ApplicationInput } | { ok: false; error: string }

export function readApplication(body: unknown): ReadResult {
  const b = (body ?? {}) as Record<string, unknown>
  const email = readEmail(b.email)
  if (!email) return { ok: false, error: "Enter a valid email address." }
  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : ""
  if (!name) return { ok: false, error: "Enter your name." }
  if (name.length > MAX_NAME) return { ok: false, error: "That name is too long." }
  if (!isCreatorCountry(b.country)) {
    return { ok: false, error: "Pick your country. We can only pay creators in the countries listed." }
  }
  if (!(APPLICATION_PLUGINS as readonly unknown[]).includes(b.plugin)) {
    return { ok: false, error: "Pick which plugin you'd make a video on." }
  }
  const socials = readSocials(b.socials)
  if (!socials.ok) return socials
  const message = typeof b.message === "string" ? b.message.trim() : ""
  if (message.length < 10) return { ok: false, error: "Tell us a little about you and your channel." }
  if (message.length > MAX_MESSAGE) return { ok: false, error: `Keep the message under ${MAX_MESSAGE} characters.` }
  return { ok: true, value: { email, name, country: b.country, plugin: b.plugin as ApplicationPlugin, socials: socials.value, message } }
}

/**
 * A referral code made from a name - "DJ Mo' Beats" becomes "dj-mo-beats" -
 * that is not in `taken`. The admin can change it before sending the link.
 * Codes are 2-32 of a-z, 0-9 and "-" (lib/affiliate-logic.ts).
 */
export function suggestCode(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28)
      .replace(/-+$/g, "") || "creator"
  const padded = base.length < 2 ? `${base}-1` : base
  if (!taken.has(padded)) return padded
  for (let n = 2; n < 1000; n++) {
    const candidate = `${padded.slice(0, 28)}-${n}`
    if (!taken.has(candidate)) return candidate
  }
  return `creator-${Date.now().toString(36)}`
}
