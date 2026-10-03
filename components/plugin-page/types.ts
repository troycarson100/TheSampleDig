import type { ReactNode } from "react"

/** A still or a clip. `poster` is required for video so nothing pops in black. */
export interface Media {
  kind: "image" | "video"
  src: string
  poster?: string
  alt: string
}

export interface FeatureBlock {
  title: string
  body: string
  /** The full detail behind `body`, folded under a "Full details" toggle. */
  more?: string
  media?: Media
  /** Small mono label above the title, e.g. "TRK 01". Renders nothing when absent. */
  osdTag?: string
}

export interface Capability {
  title: string
  body: string
  /** Optional glyph above the title. Renders nothing — no icon, no empty box — when absent. */
  icon?: ReactNode
}

export interface FaqItem {
  q: string
  a: string
}

/** One screenshot of the plugin window, at its real pixel size. */
export interface PanelShot {
  src: string
  alt: string
  width: number
  height: number
}

/** One control on a screenshot: where it is, and what the help bar says
    about it while the pointer is on it. */
export interface PanelSpot {
  /** Unique within its view. */
  id: string
  /** The control's centre and size, in the shot's own pixels, so a spot can
      be read straight off the screenshot. */
  at: { x: number; y: number; w: number; h: number }
  /** A knob rather than a box: the ring round it is drawn as a circle. */
  round?: boolean
  /** As the panel prints it, e.g. "DEPTH". */
  name: string
  /** What you hear, or see, when you move it. */
  what: string
  /** One thing worth trying with it. */
  tip?: string
  /** The colour of the section of the panel the control belongs to, for the
      ring. Left out, the ring takes the panel's accent. */
  tone?: string
  /** For the plugin's own page tabs: the id of the view a click opens. */
  opens?: string
}

/** One page of the plugin: a screenshot and the controls on it. */
export interface PanelView {
  id: string
  /** For the view switcher shown where there is no pointer to hover with. */
  label: string
  shot: PanelShot
  spots: PanelSpot[]
}

/**
 * The plugin's interface, shown in the hero in place of `hero.media`: a
 * screenshot that explains each control as the pointer crosses it, in a bar
 * underneath. The first view is the one the page opens on; the others are
 * reached by clicking the plugin's own page tabs in the screenshot.
 */
export interface Panel {
  views: PanelView[]
  /** What the bar says before anything has been pointed at. */
  idle: string
  /** The same, for a screen that is touched rather than pointed at. */
  idleTouch: string
  /** The plugin's own panel colours, for the bar under the screenshot — the
      two have to read as one object. Left out, it is drawn in shft's. */
  theme?: { ground: string; ink: string; accent: string }
}

/** Everything that differs between one product page and another. */
export interface PluginContent {
  hero: {
    /** Small flag above the name, e.g. "out now". */
    badge: string
    description: string
    /** A sentence or two under the description. Renders nothing when absent. */
    body?: string
    /** Overrides the default "One-time purchase · free updates" caption under the CTA. */
    caption?: string
    media?: Media
    /** Takes `media`'s place in the hero. With both set, `media` moves to its
        own section directly below and the hero links down to it. */
    panel?: Panel
  }
  /** Omit it and the page goes straight from the hero to `afterIntro` / the
      blocks — for a plugin whose hero already says what the intro would. */
  intro?: {
    /** Small label above the title, e.g. "Inside shft". Renders only when present. */
    eyebrow?: string
    title: string
    body: string
    media?: Media
  }
  blocks: FeatureBlock[]
  caps: { title: string; items: Capability[] }
  faq: FaqItem[]
  buy: { title: string; body: string }
}
