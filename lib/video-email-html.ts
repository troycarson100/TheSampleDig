import { REMINDER_IMAGES } from "./offer-reminder-email"
import { PRICING } from "./products"
import { VIDEO_EMAIL } from "./video-email-logic"

// The video email, drawn. Pure. Same rules as the other member emails
// (lib/offer-reminder-email.ts): tables, inline styles, no web fonts, JPEGs
// served by the site itself.
//
// Drawn once, when the send is started, as a template: the snapshot is what
// the admin previewed and what every batch sends. Each person's own parts go
// in at send time (fillVideoEmail) - their code and links as placeholders,
// and the parts that are not theirs taken out between <!--x--> markers.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

export const VIDEO_IMAGE = `${APP_URL}/email/fltr-video.jpg`

export const PH = {
  code: "{{CODE}}",
  offerUrl: "{{OFFER_URL}}",
  setUrl: "{{SET_URL}}",
  setNames: "{{SET_NAMES}}",
  setOwned: "{{SET_OWNED}}",
  unsubscribe: "{{UNSUBSCRIBE_URL}}",
} as const

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const MONO = "'SF Mono', Menlo, Consolas, 'Courier New', monospace"
const C = { page: "#efe9dc", card: "#ffffff", ink: "#24211d", body: "#5c564c", faint: "#6b6457", rust: "#96562f", ticket: "#fdf6e3" } as const

function esc(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display: inline-block; background: ${C.ink}; color: #ffffff; text-decoration: none; padding: 13px 24px; border-radius: 999px; font-family: ${SANS}; font-weight: 600; font-size: 15px;">${label}</a>`

export function renderVideoEmailTemplate(o: { amountOffCents: number; codeExpires: string; setEnds: string }): string {
  const off = o.amountOffCents / 100
  const single = PRICING.fltr.price - off
  const bundle = PRICING.bundle.price - off
  const setPrice = 39
  const setWas = PRICING.drft.price + PRICING.fltr.price

  return `
  <div style="background: ${C.page}; padding: 32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: ${C.card}; border-radius: 14px;">
      <tr><td style="padding: 28px 28px 8px;">
        <img src="${REMINDER_IMAGES.logo}" width="120" alt="Sample Roll" style="display: block; border: 0;">
      </td></tr>
      <tr><td style="padding: 12px 28px 0; font-family: ${SANS};">
        <h1 style="margin: 0 0 8px; font-size: 23px; line-height: 1.25; color: ${C.ink};">fltr, in depth</h1>
        <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.55; color: ${C.body};">
          There's a new deep dive on fltr up on YouTube: what each part of it does, and how it
          sounds on real material. It shows the plugin better than any page can.
        </p>
      </td></tr>
      <tr><td style="padding: 0 28px;">
        <a href="${VIDEO_EMAIL.videoUrl}" style="display: block; text-decoration: none;">
          <img src="${VIDEO_IMAGE}" width="504" alt="Play the video: ${esc(VIDEO_EMAIL.videoTitle)}" style="display: block; width: 100%; max-width: 504px; height: auto; border: 0; border-radius: 10px;">
        </a>
        <p style="margin: 10px 0 0; font-family: ${SANS}; font-size: 13px; text-align: center;">
          <a href="${VIDEO_EMAIL.videoUrl}" style="color: ${C.rust}; font-weight: 600;">&#9654; Watch on YouTube</a>
        </p>
      </td></tr>
<!--set-->
      <tr><td style="padding: 24px 28px 0; font-family: ${SANS};">
        <div style="border: 2px solid ${C.ink}; border-radius: 12px; padding: 18px 20px;">
          <p style="margin: 0 0 6px; font-family: ${MONO}; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: ${C.rust};">Complete your set - until ${esc(o.setEnds)}</p>
          <p style="margin: 0 0 6px; font-size: 18px; font-weight: 700; color: ${C.ink};">
            You have ${PH.setOwned}. Get ${PH.setNames} for $${setPrice}
            <span style="font-weight: 400; color: ${C.faint}; text-decoration: line-through;">$${setWas}</span>
          </p>
          <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: ${C.body};">
            The other two Sample Roll plugins, one checkout, one price - only through this link.
          </p>
          ${button(PH.setUrl, `Get both for $${setPrice}`)}
        </div>
      </td></tr>
<!--/set-->
<!--code-->
      <tr><td style="padding: 24px 28px 0; font-family: ${SANS};">
        <div style="background: ${C.ticket}; border-radius: 12px; padding: 18px 20px;">
          <p style="margin: 0 0 6px; font-family: ${MONO}; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: ${C.rust};"><!--set-->Or use your<!--/set--><!--noset-->Your<!--/noset--> $${off} code - until ${esc(o.codeExpires)}</p>
          <p style="margin: 0 0 8px; font-family: ${MONO}; font-size: 22px; font-weight: 700; letter-spacing: 2px; color: ${C.ink};">${PH.code}</p>
          <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: ${C.body};">
<!--owns-none-->            $${off} off anything: all three plugins for $${bundle} instead of $${PRICING.bundle.price}, or any one for $${single}.<!--/owns-none-->
<!--owns-some-->            $${off} off any plugin you don't have yet - $${single} instead of $${PRICING.fltr.price}.<!--/owns-some-->
            It comes off by itself at checkout when you're signed in, or through this link.
          </p>
          ${button(PH.offerUrl, `Use my $${off} code`)}
        </div>
      </td></tr>
<!--/code-->
      <tr><td style="padding: 24px 28px 28px; font-family: ${SANS};">
        <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.5; color: ${C.body};">
          Thanks for being on Sample Roll. Questions about any of it? Just reply.
        </p>
        <p style="margin: 0; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; line-height: 1.5; color: ${C.faint};">
          You're getting this because you have a Sample Roll account and get product emails.
          <a href="${PH.unsubscribe}" style="color: ${C.faint};">Unsubscribe</a> - you'll still get receipts and account emails.
        </p>
      </td></tr>
    </table>
  </div>`
}

export type VideoFill = {
  code: string | null
  offerUrl: string | null
  setUrl: string | null
  /** The plugin they own, and the two the offer would add. */
  setOwned: string | null
  setNames: string | null
  /** Owns none of the range: the code's pitch is the bundle. */
  ownsNone: boolean
  unsubscribeUrl: string
}

const cut = (html: string, name: string, keep: boolean) =>
  html.replace(new RegExp(`<!--${name}-->([\\s\\S]*?)<!--/${name}-->`, "g"), keep ? "$1" : "")

/** One person's email from the template: their parts kept, the rest taken
 *  out, their code and links put in. A part whose link is missing is taken
 *  out too, so a button never points nowhere. */
export function fillVideoEmail(template: string, f: VideoFill): string {
  const set = Boolean(f.setUrl && f.setNames && f.setOwned)
  const code = Boolean(f.code && f.offerUrl)
  let html = template
  // Inner markers first: <!--set--> also appears inside the code part.
  html = cut(html, "owns-none", f.ownsNone)
  html = cut(html, "owns-some", !f.ownsNone)
  html = cut(html, "noset", !set)
  html = cut(html, "code", code)
  html = cut(html, "set", set)
  return html
    .split(PH.code).join(esc(f.code ?? ""))
    .split(PH.offerUrl).join(esc(f.offerUrl ?? ""))
    .split(PH.setUrl).join(esc(f.setUrl ?? ""))
    .split(PH.setNames).join(esc(f.setNames ?? ""))
    .split(PH.setOwned).join(esc(f.setOwned ?? ""))
    .split(PH.unsubscribe).join(esc(f.unsubscribeUrl))
}
