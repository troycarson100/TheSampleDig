import { REMINDER_IMAGES } from "./offer-reminder-email"
import { PLUGINS, PLUGIN_ORDER, type PluginId } from "./plugins"
import { PRICING } from "./products"
import { COMPLETE_SET_PRICE } from "./complete-set-logic"
import { VIDEO_EMAIL_2 } from "./video-email-2-logic"

// The shft video email, drawn. Pure, and built like the fltr one
// (lib/video-email-html.ts): a template drawn once when the send starts, each
// person's parts put in at send time, the parts that are not theirs taken out
// between <!--x--> markers. New here: a row of the plugins under the video -
// all three with their prices for someone who owns none, only the missing
// ones for an owner - cut per plugin with <!--p-<id>--> markers.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
export const VIDEO_IMAGE_2 = `${APP_URL}${VIDEO_EMAIL_2.videoImagePath}`

export const PH2 = {
  code: "{{CODE}}",
  offerUrl: "{{OFFER_URL}}",
  setUrl: "{{SET_URL}}",
  setNames: "{{SET_NAMES}}",
  setOwned: "{{SET_OWNED}}",
  unsubscribe: "{{UNSUBSCRIBE_URL}}",
} as const

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const MONO = "'SF Mono', Menlo, Consolas, 'Courier New', monospace"
const C = { page: "#efe9dc", card: "#ffffff", ink: "#24211d", body: "#5c564c", faint: "#6b6457", rust: "#96562f", ticket: "#fdf6e3", red: "#b02818" } as const

function esc(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display: inline-block; background: ${C.ink}; color: #ffffff; text-decoration: none; padding: 13px 24px; border-radius: 999px; font-family: ${SANS}; font-weight: 600; font-size: 15px;">${label}</a>`

/** One plugin in the row: its picture, name, what it is and its price. */
function cell(id: PluginId) {
  const p = PLUGINS[id]
  return `<!--p-${id}-->
              <td valign="top" style="padding: 0 6px; font-family: ${SANS};">
                <a href="${PH2.offerUrl}" style="text-decoration: none;">
                  <img src="${REMINDER_IMAGES[id]}" width="150" alt="${esc(p.name)}, ${esc(p.category)}" style="display: block; width: 100%; max-width: 160px; height: auto; border: 0; border-radius: 8px;">
                </a>
                <p style="margin: 8px 0 0; font-size: 15px; line-height: 1.3; color: ${C.ink};"><strong>${esc(p.name)}</strong> <span style="color: ${C.faint};">$${PRICING[id].price}</span></p>
                <p style="margin: 0; font-family: ${MONO}; font-size: 11px; line-height: 1.4; color: ${C.faint};">${esc(p.category)}</p>
              </td><!--/p-${id}-->`
}

export function renderVideoEmail2Template(o: { amountOffCents: number; codeExpires: string; setEnds: string }): string {
  const off = o.amountOffCents / 100
  const single = PRICING.shft.price - off
  const bundle = PRICING.bundle.price - off
  const setPrice = COMPLETE_SET_PRICE[2]
  const setWas = PRICING.drft.price + PRICING.fltr.price

  return `
  <div style="background: ${C.page}; padding: 32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: ${C.card}; border-radius: 14px;">
      <tr><td style="padding: 28px 28px 8px;">
        <img src="${REMINDER_IMAGES.logo}" width="120" alt="Sample Roll" style="display: block; border: 0;">
      </td></tr>
      <tr><td style="padding: 12px 28px 0; font-family: ${SANS};">
        <h1 style="margin: 0 0 8px; font-size: 23px; line-height: 1.25; color: ${C.ink};">SHFT Deep Dive: Turn Any Sound Into a Rhythm</h1>
        <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.55; color: ${C.body};">
          Take a closer look at SHFT, SampleRoll's rhythmic multi-effects plugin. Explore its 16-step sequencer,
          beat repeats, granular textures, modulation, and built-in effects as we transform simple sounds into
          evolving rhythms and entirely new ideas.
        </p>
      </td></tr>
      <tr><td style="padding: 0 28px;">
        <a href="${VIDEO_EMAIL_2.videoUrl}" style="display: block; text-decoration: none;">
          <img src="${VIDEO_IMAGE_2}" width="504" alt="Play the video: ${esc(VIDEO_EMAIL_2.videoTitle)}" style="display: block; width: 100%; max-width: 504px; height: auto; border: 0; border-radius: 10px;">
        </a>
        <p style="margin: 10px 0 0; font-family: ${SANS}; font-size: 13px; text-align: center;">
          <a href="${VIDEO_EMAIL_2.videoUrl}" style="color: ${C.rust}; font-weight: 600;">&#9654; Watch on YouTube</a>
        </p>
      </td></tr>
      <tr><td style="padding: 26px 22px 0; font-family: ${SANS};">
        <p style="margin: 0 6px 12px; font-family: ${MONO}; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: ${C.rust};"><!--owns-none-->The three plugins<!--/owns-none--><!--owns-some-->What you're missing<!--/owns-some--></p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout: fixed;">
          <tr>${PLUGIN_ORDER.map(cell).join("")}
          </tr>
        </table>
      </td></tr>
<!--set-->
      <tr><td style="padding: 24px 28px 0; font-family: ${SANS};">
        <div style="border: 2px solid ${C.ink}; border-radius: 12px; padding: 18px 20px;">
          <p style="margin: 0 0 6px; font-family: ${MONO}; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: ${C.rust};">Complete your set - until ${esc(o.setEnds)}</p>
          <p style="margin: 0 0 6px; font-size: 18px; font-weight: 700; color: ${C.ink};">
            You have ${PH2.setOwned}. Get ${PH2.setNames} for $${setPrice}
            <span style="font-weight: 400; color: ${C.faint}; text-decoration: line-through;">$${setWas}</span>
          </p>
          <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: ${C.body};">
            Both of the others in one checkout, at one price. Only through this link.
          </p>
          ${button(PH2.setUrl, `Get both for $${setPrice}`)}
        </div>
      </td></tr>
<!--/set-->
<!--code-->
      <tr><td style="padding: 24px 28px 0; font-family: ${SANS};">
        <div style="background: ${C.ticket}; border: 2px dashed ${C.rust}; border-radius: 12px; padding: 20px 20px 18px;">
          <p style="margin: 0 0 4px; font-family: ${MONO}; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: ${C.rust};"><!--set-->Or your code, still unused<!--/set--><!--noset-->Your code, still unused<!--/noset--> - until ${esc(o.codeExpires)}</p>
          <p style="margin: 0 0 14px; font-family: ${SANS}; font-size: 34px; line-height: 1.05; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; color: ${C.ink};"><span style="color: ${C.red};">$${off} off</span> anything</p>
          <p style="margin: 0 0 12px;"><span style="display: inline-block; font-family: ${MONO}; font-size: 20px; font-weight: 700; letter-spacing: 3px; color: ${C.ink}; background: #ffffff; border: 1px solid #e6dcc4; border-radius: 8px; padding: 8px 14px;">${PH2.code}</span></p>
          <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: ${C.body};">
<!--owns-none-->            shft for $${single} instead of $${PRICING.shft.price} - or all three plugins for $${bundle} instead of $${PRICING.bundle.price}.<!--/owns-none-->
<!--owns-some-->            $${off} off any plugin you don't have yet - $${single} instead of $${PRICING.shft.price}.<!--/owns-some-->
            It comes off by itself at checkout when you're signed in, or through this link.
          </p>
          ${button(PH2.offerUrl, `Use my $${off} code`)}
        </div>
      </td></tr>
<!--/code-->
      <tr><td style="padding: 24px 28px 28px; font-family: ${SANS};">
        <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.5; color: ${C.body};">
          Thanks for being on Sample Roll. Questions about any of it? Just reply.
        </p>
        <p style="margin: 0; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; line-height: 1.5; color: ${C.faint};">
          You're getting this because you have a Sample Roll account and get product emails.
          <a href="${PH2.unsubscribe}" style="color: ${C.faint};">Unsubscribe</a> - you'll still get receipts and account emails.
        </p>
      </td></tr>
    </table>
  </div>`
}

export type VideoFill2 = {
  code: string | null
  offerUrl: string | null
  setUrl: string | null
  setOwned: string | null
  setNames: string | null
  /** What they own: decides the pitch and which plugins are pictured. */
  owns: readonly PluginId[]
  unsubscribeUrl: string
}

const cut = (html: string, name: string, keep: boolean) =>
  html.replace(new RegExp(`<!--${name}-->([\\s\\S]*?)<!--/${name}-->`, "g"), keep ? "$1" : "")

/** One person's email from the template: their parts kept, the rest taken
 *  out, their code and links put in. The plugins pictured are the ones they
 *  don't own; the pictures link where the code does, or to shft's page. */
export function fillVideoEmail2(template: string, f: VideoFill2): string {
  const set = Boolean(f.setUrl && f.setNames && f.setOwned)
  const code = Boolean(f.code && f.offerUrl)
  const ownsNone = f.owns.length === 0
  let html = template
  for (const id of PLUGIN_ORDER) html = cut(html, `p-${id}`, !f.owns.includes(id))
  html = cut(html, "owns-none", ownsNone)
  html = cut(html, "owns-some", !ownsNone)
  html = cut(html, "noset", !set)
  html = cut(html, "code", code)
  html = cut(html, "set", set)
  return html
    .split(PH2.code).join(esc(f.code ?? ""))
    .split(PH2.offerUrl).join(esc(f.offerUrl ?? `${PLUGINS.shft.href}`))
    .split(PH2.setUrl).join(esc(f.setUrl ?? ""))
    .split(PH2.setNames).join(esc(f.setNames ?? ""))
    .split(PH2.setOwned).join(esc(f.setOwned ?? ""))
    .split(PH2.unsubscribe).join(esc(f.unsubscribeUrl))
}
