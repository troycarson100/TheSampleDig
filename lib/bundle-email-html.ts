import { PLUGIN_ORDER, PLUGINS, type PluginId } from "./plugins"
import { PRICING } from "./products"

// The fourth member email, drawn: dark, like the fltr page, where the first
// three were cream. The same email rules as the others (tables, inline
// styles, no web fonts, JPEG and PNG served by the site), and the brand kept:
// the Sample Roll mark (in cream, for the dark), each plugin's own accent, the
// bundle's red, mono for labels and prices.
//
// Drawn once as a template when the send starts; each person's parts go in at
// send time (fillBundleEmail) - placeholders for their code and links, and
// the parts that are not theirs cut out between <!--x--> markers.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

export const BUNDLE_IMAGES = {
  logo: `${APP_URL}/email/logo-light.png`,
  shft: `${APP_URL}/email/shft-wide.jpg`,
  drft: `${APP_URL}/email/drft-wide.jpg`,
  fltr: `${APP_URL}/email/fltr-wide.jpg`,
  thumb: { shft: `${APP_URL}/email/shft.jpg`, drft: `${APP_URL}/email/drft.jpg`, fltr: `${APP_URL}/email/fltr.jpg` },
} as const

export const BPH = {
  code: "{{CODE}}",
  offerUrl: "{{OFFER_URL}}",
  bundleUrl: "{{BUNDLE_URL}}",
  setUrl: "{{SET_URL}}",
  setNames: "{{SET_NAMES}}",
  setOwned: "{{SET_OWNED}}",
  setPrice: "{{SET_PRICE}}",
  setWas: "{{SET_WAS}}",
  setCta: "{{SET_CTA}}",
  promoQs: "{{PROMO_QS}}",
  unsubscribe: "{{UNSUBSCRIBE_URL}}",
} as const

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const MONO = "'SF Mono', Menlo, Consolas, 'Courier New', monospace"
// fltr's night, a step up for the card, and the inks on it. `dim` keeps
// 4.5:1 on the card; `red` is the bundle's red, lifted a shade for the dark.
const C = {
  page: "#050608",
  card: "#0d0f16",
  panel: "#141824",
  line: "#232838",
  ink: "#eef0f6",
  dim: "#a3abbd",
  faint: "#7d8598",
  red: "#ff5a3c",
  teal: PLUGINS.fltr.accent,
} as const

function esc(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

const kicker = (text: string, color: string = C.teal) =>
  `<p style="margin: 0 0 10px; font-family: ${MONO}; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: ${color};">${text}</p>`

const lightButton = (href: string, label: string) =>
  `<a href="${href}" style="display: inline-block; background: ${C.ink}; color: #0b0c13; text-decoration: none; padding: 14px 26px; border-radius: 999px; font-family: ${SANS}; font-weight: 700; font-size: 15px;">${label}</a>`

const outlineButton = (href: string, label: string, color: string = C.ink) =>
  `<a href="${href}" style="display: inline-block; border: 1px solid ${color}; color: ${color}; text-decoration: none; padding: 10px 18px; border-radius: 999px; font-family: ${MONO}; font-size: 13px; letter-spacing: 0.5px;">${label}</a>`

/** A second line for each plugin's section, beside its tagline. */
const MORE: Record<PluginId, string> = {
  shft: "A sixteen-step gate with beat repeat, granular and a full effects chain - everything in time with your session.",
  drft: "Tape wow, head burn, dropouts and snow, over a CRT that shows you every bit of what it does.",
  fltr: "Nine characters, Chord and Harmony playing in your key, and a morph between two whole sounds.",
}

function pluginSection(id: PluginId): string {
  const p = PLUGINS[id]
  const price = PRICING[id]
  return `
      <tr><td style="padding: 0 28px 26px;">
        <a href="${APP_URL}${p.href}${BPH.promoQs}" style="display: block; text-decoration: none;">
          <img src="${BUNDLE_IMAGES[id]}" width="504" alt="${esc(p.name)}" style="display: block; width: 100%; max-width: 504px; height: auto; border: 0; border-radius: 10px;">
        </a>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 14px;"><tr>
          <td style="border-left: 3px solid ${p.accent}; padding: 0 0 0 14px; font-family: ${SANS};">
            <p style="margin: 0 0 4px; font-size: 22px; font-weight: 800; color: ${C.ink};">${esc(p.name)}
              <span style="font-family: ${MONO}; font-size: 11px; font-weight: 400; letter-spacing: 1.5px; text-transform: uppercase; color: ${p.accent};">&nbsp;${esc(p.category)}</span></p>
            <p style="margin: 0 0 4px; font-size: 15px; line-height: 1.5; color: ${C.ink};">${esc(p.tagline)}</p>
            <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.5; color: ${C.dim};">${esc(MORE[id])}</p>
<!--owns-${id}-->            <p style="margin: 0; font-family: ${MONO}; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: ${p.accent};">&#10003; In your collection</p><!--/owns-${id}-->
<!--lacks-${id}-->            ${outlineButton(`${APP_URL}${p.href}${BPH.promoQs}`, `Get ${esc(p.name)} &middot; $${price.price} <span style="text-decoration: line-through; color: ${C.faint};">$${price.msrp}</span>`)}<!--/lacks-${id}-->
          </td>
        </tr></table>
      </td></tr>`
}

export function renderBundleEmailTemplate(o: { amountOffCents: number; codeExpires: string; setEnds: string }): string {
  const off = o.amountOffCents / 100
  const bundle = PRICING.bundle
  const save = bundle.compareAt - bundle.price
  const thumbs = PLUGIN_ORDER.map(
    (id) => `<td width="33%" style="padding: 0 4px;"><img src="${BUNDLE_IMAGES.thumb[id]}" width="160" alt="${esc(PLUGINS[id].name)}" style="display: block; width: 100%; height: auto; border: 0; border-radius: 8px;"></td>`,
  ).join("")

  return `
  <div style="background: ${C.page}; padding: 32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: ${C.card}; border: 1px solid ${C.line}; border-radius: 16px;">
      <tr><td style="padding: 26px 28px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><img src="${BUNDLE_IMAGES.logo}" width="110" alt="Sample Roll" style="display: block; border: 0;"></td>
          <td align="right" style="font-family: ${MONO}; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;">
            <span style="display: inline-block; border: 1px solid ${C.red}; color: ${C.red}; border-radius: 999px; padding: 5px 10px;">Ends ${esc(o.setEnds)}</span>
          </td>
        </tr></table>
      </td></tr>
<!--bundle-->
      <tr><td style="padding: 22px 28px 26px; font-family: ${SANS};">
        ${kicker("The bundle &middot; all three plugins")}
        <p style="margin: 0 0 14px; font-size: 30px; line-height: 1.1; font-weight: 800; letter-spacing: -0.5px; color: ${C.ink};">shft + drft + fltr</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 16px;"><tr>${thumbs}</tr></table>
        <p style="margin: 0 0 6px; color: ${C.ink};">
          <span style="font-size: 56px; line-height: 1; font-weight: 900; letter-spacing: -2px;">$${bundle.price}</span>
          <span style="font-size: 20px; color: ${C.faint}; text-decoration: line-through; padding-left: 8px;">$${bundle.compareAt}</span>
          <span style="display: inline-block; margin-left: 8px; background: ${C.red}; color: #ffffff; font-family: ${MONO}; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; border-radius: 6px; padding: 5px 9px; vertical-align: 10px;">Save $${save}</span>
        </p>
        <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.5; color: ${C.dim};">
          Every Sample Roll plugin, one checkout - the price of two. One-time, free updates, macOS and Windows.
<!--code-->          <br><span style="color: ${C.ink};">With your $${off} code it's <strong>$${bundle.price - off}</strong>.</span><!--/code-->
        </p>
        ${lightButton(BPH.bundleUrl, "Get all three &rarr;")}
      </td></tr>
<!--/bundle-->
<!--set-->
      <tr><td style="padding: 22px 28px 26px; font-family: ${SANS};">
        ${kicker("Complete your set")}
        <p style="margin: 0 0 4px; font-size: 15px; color: ${C.dim};">You have ${BPH.setOwned}. Add</p>
        <p style="margin: 0 0 12px; font-size: 30px; line-height: 1.1; font-weight: 800; letter-spacing: -0.5px; color: ${C.ink};">${BPH.setNames}</p>
        <p style="margin: 0 0 6px; color: ${C.ink};">
          <span style="font-size: 56px; line-height: 1; font-weight: 900; letter-spacing: -2px;">$${BPH.setPrice}</span>
          <span style="font-size: 20px; color: ${C.faint}; text-decoration: line-through; padding-left: 8px;">$${BPH.setWas}</span>
        </p>
        <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.5; color: ${C.dim};">
          The rest of Sample Roll's plugins at a price that's only through this link, until ${esc(o.setEnds)}.
        </p>
        ${lightButton(BPH.setUrl, BPH.setCta)}
      </td></tr>
<!--/set-->
<!--code-->
      <tr><td style="padding: 0 28px 28px; font-family: ${SANS};">
        <div style="background: ${C.panel}; border: 1px dashed ${C.red}; border-radius: 12px; padding: 18px 20px;">
          ${kicker(`Your code &middot; until ${esc(o.codeExpires)}`, C.red)}
          <p style="margin: 0 0 12px; font-size: 30px; line-height: 1.05; font-weight: 900; text-transform: uppercase; color: ${C.ink};"><span style="color: ${C.red};">$${off} off</span> anything</p>
          <p style="margin: 0 0 12px;"><span style="display: inline-block; font-family: ${MONO}; font-size: 20px; font-weight: 700; letter-spacing: 3px; color: ${C.ink}; border: 1px solid ${C.line}; background: ${C.card}; border-radius: 8px; padding: 8px 14px;">${BPH.code}</span></p>
          <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.5; color: ${C.dim};">
<!--code-on-bundle-->            Use it on the bundle - all three for $${bundle.price - off} - or $${PRICING.fltr.price - off} off a single plugin.<!--/code-on-bundle-->
<!--code-on-single-->            Or take it off any plugin you don't have yet - $${PRICING.fltr.price - off} instead of $${PRICING.fltr.price}.<!--/code-on-single-->
            It comes off by itself at checkout when you're signed in.
          </p>
          ${outlineButton(BPH.offerUrl, `Use my $${off} code &rarr;`, C.ink)}
        </div>
      </td></tr>
<!--/code-->
      <tr><td style="padding: 6px 28px 18px; font-family: ${SANS};">
        <p style="margin: 0; padding-top: 22px; border-top: 1px solid ${C.line};">${kicker("The plugins", C.dim)}</p>
      </td></tr>
${PLUGIN_ORDER.map(pluginSection).join("")}
      <tr><td style="padding: 4px 28px 28px; font-family: ${SANS};">
        <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.5; color: ${C.dim};">
          Thanks for being on Sample Roll. Questions about any of it? Just reply.
        </p>
        <p style="margin: 0; padding-top: 16px; border-top: 1px solid ${C.line}; font-size: 12px; line-height: 1.5; color: ${C.faint};">
          You're getting this because you have a Sample Roll account and get product emails.
          <a href="${BPH.unsubscribe}" style="color: ${C.faint};">Unsubscribe</a> - you'll still get receipts and account emails.
        </p>
      </td></tr>
    </table>
  </div>`
}

export type BundleFill = {
  offer: "bundle" | "set" | "none"
  owns: readonly PluginId[]
  missing: readonly PluginId[]
  code: string | null
  offerUrl: string | null
  setUrl: string | null
  setPrice: number | null
  setWas: number | null
  unsubscribeUrl: string
}

const cut = (html: string, name: string, keep: boolean) =>
  html.replace(new RegExp(`<!--${name}-->([\\s\\S]*?)<!--/${name}-->`, "g"), keep ? "$1" : "")

const names = (ids: readonly PluginId[]) => ids.map((id) => PLUGINS[id].name).join(" + ")

/** One person's email from the template. A part whose link is missing is
 *  cut too, so no button points nowhere. */
export function fillBundleEmail(template: string, f: BundleFill): string {
  const code = Boolean(f.code && f.offerUrl)
  const set = f.offer === "set" && Boolean(f.setUrl && f.setPrice)
  const bundle = f.offer === "bundle"
  let html = template
  for (const id of PLUGIN_ORDER) {
    html = cut(html, `owns-${id}`, f.owns.includes(id))
    html = cut(html, `lacks-${id}`, !f.owns.includes(id))
  }
  html = cut(html, "code-on-bundle", bundle)
  html = cut(html, "code-on-single", !bundle)
  html = cut(html, "bundle", bundle)
  html = cut(html, "set", set)
  html = cut(html, "code", code)
  const fltrUrl = `${APP_URL}${PLUGINS.fltr.href}`
  return html
    .split(BPH.code).join(esc(f.code ?? ""))
    .split(BPH.offerUrl).join(esc(f.offerUrl ?? ""))
    // The bundle is added from the sale strip at the top of any plugin page;
    // a code link puts their code on the cart on the way.
    .split(BPH.bundleUrl).join(esc(code ? f.offerUrl! : fltrUrl))
    .split(BPH.setUrl).join(esc(f.setUrl ?? ""))
    .split(BPH.setNames).join(esc(names(f.missing)))
    .split(BPH.setOwned).join(esc(names(f.owns)))
    .split(BPH.setPrice).join(String(f.setPrice ?? ""))
    .split(BPH.setWas).join(String(f.setWas ?? ""))
    .split(BPH.setCta).join(esc(`Get ${f.missing.length === 1 ? "it" : "both"} for $${f.setPrice ?? ""}`) + " &rarr;")
    .split(BPH.promoQs).join(code && f.code ? `?promo=${encodeURIComponent(f.code)}` : "")
    .split(BPH.unsubscribe).join(esc(f.unsubscribeUrl))
}
