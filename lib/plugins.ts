// Presentation catalog for the plugin range: display order, copy, theme and art.
// Fulfilment (downloads, licence keys, changelogs) lives in lib/products.ts and
// is joined to this by id. Keep the two apart — products.ts is already long, and
// these are different axes of change.

export const PLUGIN_ORDER = ["shft", "drft", "fltr"] as const
export type PluginId = (typeof PLUGIN_ORDER)[number]

export interface PluginMeta {
  id: PluginId
  /** Lowercase, as it is set everywhere on the site. */
  name: string
  /** The line under the name in the hero, e.g. "trance gate". */
  category: string
  /** One sentence. Used on the plugin card and the hero. */
  tagline: string
  href: string
  /** Page ground colour. Drives --plugin-ground. */
  ground: string
  /** Page foreground. Drives --plugin-ink. */
  ink: string
  accent: string
  accent2: string
  art: { card: string; hero: string; heroPoster?: string }
}

export const PLUGINS: Record<PluginId, PluginMeta> = {
  shft: {
    id: "shft",
    name: "shft",
    category: "trance gate",
    tagline: "Sixteen steps chop your audio into living rhythm.",
    href: "/shft",
    ground: "#efe9dc",
    ink: "#24211d",
    accent: "#a6633c",
    accent2: "#d9a040",
    art: { card: "/shft/card.jpg", hero: "/shft/hero-v2.mp4", heroPoster: "/shft/hero-v2-poster.jpg" },
  },
  drft: {
    id: "drft",
    name: "drft",
    category: "vhs / crt fx",
    tagline: "Your sound through a dying tape machine, picture and all.",
    href: "/drft",
    ground: "#e0c69f",
    ink: "#1c140f",
    accent: "#ef1f71",
    accent2: "#d99a2b",
    art: { card: "/drft/field.jpg", hero: "/drft/hero.mp4", heroPoster: "/drft/hero-poster.jpg" },
  },
  fltr: {
    id: "fltr",
    name: "fltr",
    category: "filter in key",
    tagline: "A morphing filter that tunes itself to your track, and plays chords in it.",
    href: "/fltr",
    ground: "#0d1117",
    ink: "#e6edf3",
    accent: "#4fd1c5",
    accent2: "#8b7fd4",
    art: { card: "/fltr/hero.png", hero: "/fltr/hero.png" },
  },
}

/** The plugins in display order. Use this rather than Object.values. */
export function pluginList(): PluginMeta[] {
  return PLUGIN_ORDER.map((id) => PLUGINS[id])
}

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]

/** Spells a small count as a word for copy like "Two left" — the plugin range
 *  is small enough that this always reads better than a numeral. Falls back
 *  to the numeral past ten so nothing renders blank if the range grows. */
export function countWord(n: number): string {
  const word = COUNT_WORDS[n]
  return word ? word[0].toUpperCase() + word.slice(1) : String(n)
}

/** When fltr's introductory price ends, as an ISO date-time string. Unset
 *  until fltr ships — its launch is gated on Phase 5, so there is no date to
 *  hardcode. Setting this is what turns the countdown on.
 *  MUST include a timezone offset — a trailing `Z` for UTC, or an explicit
 *  `+hh:mm`/`-hh:mm`. A bare "2026-10-01T00:00:00" with no offset is parsed
 *  as *local* time (see `introWindow` below), which would make the offer end
 *  at a different absolute instant in every visitor's timezone, while
 *  Stripe's own price change happens at exactly one instant.
 *  NEXT_PUBLIC_ because the clock ticks in the browser. */
export const FLTR_INTRO_ENDS: string | null = process.env.NEXT_PUBLIC_FLTR_INTRO_ENDS ?? null

export interface IntroWindow {
  /** The deadline, or null when unset or unparseable. */
  endsAt: Date | null
  /** True only when a valid deadline exists and is still in the future. */
  live: boolean
}

/**
 * The single place the intro deadline is interpreted. Unset, malformed and past
 * dates all resolve to `live: false`, which is what makes the ticker fall back to
 * the bundle offer rather than render a dead or negative clock.
 *
 * `raw` is injectable so the behaviour can be tested without touching env.
 */
export function introWindow(now: Date = new Date(), raw: string | null = FLTR_INTRO_ENDS): IntroWindow {
  if (!raw) return { endsAt: null, live: false }
  // `raw` must carry a timezone offset — see FLTR_INTRO_ENDS above. Without
  // one, `new Date(...)` parses it as local time, not UTC.
  const endsAt = new Date(raw)
  if (Number.isNaN(endsAt.getTime())) return { endsAt: null, live: false }
  return { endsAt, live: endsAt.getTime() > now.getTime() }
}
