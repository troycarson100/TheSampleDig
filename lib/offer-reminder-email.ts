import { CODE_PLACEHOLDER, OFFER_URL_PLACEHOLDER, UNSUBSCRIBE_PLACEHOLDER } from "./email"
import { PLUGINS, pluginList } from "./plugins"
import { REMINDER_PLUGIN, type ReminderPrices, type ReminderVariant } from "./offer-reminder-logic"

// The reminder email, drawn. Pure: it returns HTML with CODE_PLACEHOLDER,
// OFFER_URL_PLACEHOLDER and UNSUBSCRIBE_PLACEHOLDER where each person's own
// parts go, exactly as the first member-offer email does, so
// sendMemberOfferEmail fills and sends it unchanged.
//
// Written the way email has to be: tables for layout, every style inline, no
// stylesheet and no web font - Gmail drops the first and Outlook ignores most
// of the rest. It is a fragment, not a document, because the admin page shows
// it inside its own. Rounded corners and the max-width are niceties Outlook
// skips; nothing depends on them.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

/** The pictures, served by the site itself (so they are only there once the
 *  site is deployed). JPEG and PNG, never WebP: Outlook shows no WebP. Each is
 *  twice the size it is drawn at, for dense screens. Cut from the same art the
 *  plugin pages use - see public/email/. */
export const REMINDER_IMAGES = {
  logo: `${APP_URL}/email/logo.png`,
  hero: `${APP_URL}/email/fltr-hero.jpg`,
  shft: `${APP_URL}/email/shft.jpg`,
  drft: `${APP_URL}/email/drft.jpg`,
  fltr: `${APP_URL}/email/fltr.jpg`,
} as const

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const MONO = "'SF Mono', Menlo, Consolas, 'Courier New', monospace"

// The storefront's cream and ink, and fltr's own dark ground and teal.
// `faint` and `rust` are a shade darker than the site's, so small print and
// the ticket's label keep 4.5:1 against the card, the cream and the ticket.
const C = {
  page: "#efe9dc",
  card: "#ffffff",
  ink: "#24211d",
  body: "#5c564c",
  faint: "#6b6457",
  rust: "#96562f",
  gold: "#d9a040",
  ticket: "#fdf6e3",
  night: PLUGINS.fltr.ground,
  nightInk: PLUGINS.fltr.ink,
  nightBody: "#9aa7b4",
  teal: PLUGINS.fltr.accent,
} as const

function esc(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export interface ReminderEmailOptions {
  variant: ReminderVariant
  prices: ReminderPrices
  /** "October 30" - the last day the reader's code works. */
  expires: string
  /** "October 31" - the last day of the bundle price, or null to name none. */
  bundleEnds: string | null
}

const eyebrow = (text: string, color: string) => `
          <p style="margin: 0 0 10px; font-family: ${MONO}; font-size: 12px; line-height: 1.4; letter-spacing: 0.14em; text-transform: uppercase; color: ${color};">
            ${text}
          </p>`

/** fltr, on its own dark ground: the picture, then what it is in the site's
 *  own words (app/fltr/content.ts). */
function hero() {
  const fltr = PLUGINS[REMINDER_PLUGIN]
  return `
    <tr>
      <td bgcolor="${C.night}" style="background: ${C.night}; border-radius: 14px;">
        <a href="${OFFER_URL_PLACEHOLDER}" style="display: block; text-decoration: none;">
          <img src="${REMINDER_IMAGES.hero}" width="600" alt="${fltr.name}: a glowing filter curve across the display, above its shape, drive, filter, modulate and push modules"
               style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; border-radius: 14px 14px 0 0;">
        </a>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 26px 28px 30px; font-family: ${SANS};">
              ${eyebrow(`New &middot; ${fltr.name}`, C.teal)}
              <h1 style="margin: 0 0 12px; font-family: ${SANS}; font-size: 30px; line-height: 1.15; font-weight: 700; letter-spacing: -0.01em; color: ${C.nightInk};">
                A filter that plays in key.
              </h1>
              <p style="margin: 0; font-size: 16px; line-height: 1.55; color: ${C.nightBody};">
                Nine characters and a Shape control that morphs each one. Tune it to your key and it
                stops being a filter you sweep and starts being one that plays.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
}

/** The three plugins side by side, each with its name and what it is. */
function range() {
  const cells = pluginList()
    .map(
      (p) => `
              <td width="33%" valign="top" style="padding: 0 5px; font-family: ${SANS};">
                <img src="${REMINDER_IMAGES[p.id]}" width="172" alt="${p.name}, ${p.category}"
                     style="display: block; width: 100%; max-width: 172px; height: auto; border: 0; border-radius: 8px;">
                <p style="margin: 10px 0 2px; font-size: 16px; line-height: 1.2; font-weight: 700; color: ${C.ink};">${p.name}</p>
                <p style="margin: 0; font-family: ${MONO}; font-size: 11px; line-height: 1.4; color: ${C.faint};">${esc(p.category)}</p>
              </td>`,
    )
    .join("")
  return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px;">
            <tr>${cells}
            </tr>
          </table>`
}

/** The reader's code, set like a ticket, with what it makes the price. */
function ticket(o: ReminderEmailOptions) {
  const { prices: p } = o
  const makes =
    o.variant === "bundle"
      ? `All three for <strong style="color: ${C.ink};">${p.bundleWithCode}</strong> &middot; ${PLUGINS[REMINDER_PLUGIN].name} alone for <strong style="color: ${C.ink};">${p.fltrWithCode}</strong>`
      : `${PLUGINS[REMINDER_PLUGIN].name} for <strong style="color: ${C.ink};">${p.fltrWithCode}</strong>, not ${p.fltr}`
  return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px;">
            <tr>
              <td align="center" bgcolor="${C.ticket}" style="background: ${C.ticket}; border: 2px dashed ${C.gold}; border-radius: 12px; padding: 20px 16px 18px; font-family: ${SANS};">
                <p style="margin: 0 0 10px; font-family: ${MONO}; font-size: 12px; line-height: 1.4; letter-spacing: 0.12em; text-transform: uppercase; color: ${C.rust};">
                  Extra ${p.amountOff} off for existing members
                </p>
                <p style="margin: 0 0 10px; font-family: ${MONO}; font-size: 28px; line-height: 1.1; font-weight: 700; letter-spacing: 0.08em; color: ${C.ink};">
                  ${CODE_PLACEHOLDER}
                </p>
                <p style="margin: 0 0 4px; font-size: 15px; line-height: 1.5; color: ${C.body};">
                  ${makes}
                </p>
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${C.faint};">
                  Yours alone. It works once, until ${esc(o.expires)}.
                </p>
              </td>
            </tr>
          </table>`
}

function button(label: string) {
  return `
          <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
            <tr>
              <td align="center" bgcolor="${C.ink}" style="background: ${C.ink}; border-radius: 10px;">
                <a href="${OFFER_URL_PLACEHOLDER}" style="display: inline-block; padding: 15px 32px; font-family: ${SANS}; font-size: 16px; line-height: 1.2; font-weight: 600; color: #ffffff; text-decoration: none;">
                  ${label}
                </a>
              </td>
            </tr>
          </table>`
}

/** For someone who owns nothing: the bundle price, the range, then the code. */
function bundleCard(o: ReminderEmailOptions) {
  const { prices: p } = o
  const names = pluginList().map((x) => x.name)
  const fltr = PLUGINS[REMINDER_PLUGIN].name
  return `
    <tr>
      <td bgcolor="${C.card}" style="background: ${C.card}; border-radius: 14px; padding: 28px 23px 30px; font-family: ${SANS};">
        <div style="padding: 0 5px;">
          ${eyebrow(o.bundleEnds ? `Bundle sale &middot; ends ${esc(o.bundleEnds)}` : "Bundle sale", C.rust)}
          <h2 style="margin: 0 0 8px; font-family: ${SANS}; font-size: 26px; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; color: ${C.ink};">
            All three plugins for ${p.bundle}
            <span style="font-size: 18px; font-weight: 400; color: ${C.faint}; text-decoration: line-through;">${p.bundleWas}</span>
          </h2>
          <p style="margin: 0 0 22px; font-size: 16px; line-height: 1.55; color: ${C.body};">
            Save ${p.bundleSaving} on ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} together.
          </p>
        </div>
        ${range()}
        <div style="padding: 0 5px;">
          ${ticket(o)}
          ${button(`Get all three for ${p.bundleWithCode}`)}
          <p style="margin: 14px 0 0; text-align: center; font-size: 15px; line-height: 1.5; color: ${C.body};">
            or <a href="${OFFER_URL_PLACEHOLDER}" style="color: ${C.rust}; text-decoration: underline;">just ${fltr}, for ${p.fltrWithCode}</a>
          </p>
          <p style="margin: 22px 0 0; font-size: 13px; line-height: 1.55; color: ${C.faint};">
            You don't need to type the code. The button puts it on your cart, and the bar at the top of the
            page adds all three. Signed in with this email address, it comes off at checkout by itself.
          </p>
        </div>
      </td>
    </tr>`
}

/** For someone who owns shft or drft already: fltr, and the code. Nothing
 *  about a bundle they cannot buy. */
function fltrCard(o: ReminderEmailOptions) {
  const { prices: p } = o
  const fltr = PLUGINS[REMINDER_PLUGIN].name
  const points: [string, string][] = [
    ["Nine characters, one Shape control", "Ladder, SEM, Fold, Comb, Formant, Phase, Chord, Harmony and Shift, each one morphed rather than switched."],
    ["Chord and Harmony play in key", "Snap what you feed it to a chord, or ring that chord through a resonator bank, in a root and scale you choose."],
    ["Two sounds, and a morph between them", "Every patch is an A and a B, and a bar that blends, glides or switches between them on the beat."],
  ]
  const rows = points
    .map(
      ([title, body]) => `
            <tr>
              <td width="18" valign="top" style="padding: 0 0 14px; font-family: ${MONO}; font-size: 15px; line-height: 1.5; color: ${C.rust};">+</td>
              <td valign="top" style="padding: 0 0 14px; font-family: ${SANS}; font-size: 15px; line-height: 1.5; color: ${C.body};">
                <strong style="color: ${C.ink};">${title}.</strong> ${body}
              </td>
            </tr>`,
    )
    .join("")
  return `
    <tr>
      <td bgcolor="${C.card}" style="background: ${C.card}; border-radius: 14px; padding: 28px 28px 30px; font-family: ${SANS};">
        ${eyebrow("For existing members", C.rust)}
        <h2 style="margin: 0 0 8px; font-family: ${SANS}; font-size: 26px; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; color: ${C.ink};">
          ${fltr} for ${p.fltrWithCode}
          <span style="font-size: 18px; font-weight: 400; color: ${C.faint}; text-decoration: line-through;">${p.fltr}</span>
        </h2>
        <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.55; color: ${C.body};">
          You already have a Sample Roll plugin. Here is what the new one adds to it.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 10px;">${rows}
        </table>
        ${ticket(o)}
        ${button(`Get ${fltr} for ${p.fltrWithCode}`)}
        <p style="margin: 22px 0 0; font-size: 13px; line-height: 1.55; color: ${C.faint};">
          You don't need to type the code. The button puts it on your cart, and signed in with this email
          address it comes off at checkout by itself. It works on anything else you don't own yet, too.
        </p>
      </td>
    </tr>`
}

/** The line a mail app shows beside the subject, before the email is opened. */
export function reminderPreheader(o: ReminderEmailOptions): string {
  const { prices: p } = o
  return o.variant === "bundle"
    ? `shft, drft and fltr together are ${p.bundle} this month. Your ${p.amountOff} member code makes it ${p.bundleWithCode}.`
    : `fltr is out, and your ${p.amountOff} member code still works: ${p.fltrWithCode} until ${o.expires}.`
}

/** The reminder email for one kind of reader, placeholders and all. */
export function renderOfferReminderHtml(o: ReminderEmailOptions): string {
  const gap = `
    <tr><td height="16" style="height: 16px; font-size: 0; line-height: 0;">&nbsp;</td></tr>`
  return `
<div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent; mso-hide: all;">
  ${esc(reminderPreheader(o))}
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background: ${C.page}; margin: 0;">
  <tr>
    <td align="center" style="padding: 28px 12px 36px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
    <tr>
      <td align="center" style="padding: 0 0 22px;">
        <a href="${OFFER_URL_PLACEHOLDER}" style="text-decoration: none;">
          <img src="${REMINDER_IMAGES.logo}" width="132" alt="Sample Roll" style="display: block; width: 132px; height: auto; border: 0;">
        </a>
      </td>
    </tr>${hero()}${gap}${o.variant === "bundle" ? bundleCard(o) : fltrCard(o)}
    <tr>
      <td align="center" style="padding: 22px 20px 0; font-family: ${SANS}; font-size: 12px; line-height: 1.6; color: ${C.faint};">
        You're getting this because you have a Sample Roll account.<br>
        <a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color: ${C.faint}; text-decoration: underline;">Unsubscribe from product emails</a>
        - you'll still get receipts and account emails.
      </td>
    </tr>
      </table>
    </td>
  </tr>
</table>
`
}
