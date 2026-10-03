import { REMINDER_IMAGES } from "./offer-reminder-email"
import { PLUGINS, PLUGIN_ORDER } from "./plugins"
import { PRICING } from "./products"
import type { PluginProduct } from "./plugin-products"

// The "you left this in your cart" email, drawn. Pure: HTML in, nothing sent.
// Same rules as the offer reminder's email (lib/offer-reminder-email.ts):
// tables, inline styles, no web fonts, JPEGs served by the site itself.

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const MONO = "'SF Mono', Menlo, Consolas, 'Courier New', monospace"
const C = { page: "#efe9dc", card: "#ffffff", ink: "#24211d", body: "#5c564c", faint: "#6b6457", red: "#b02818" } as const

function esc(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** What the cart costs as the site would charge it: the bundle price for all
 *  three, otherwise each at its own. */
export function cartTotal(products: readonly PluginProduct[]): { total: number; compareAt: number; bundle: boolean } {
  const bundle = PLUGIN_ORDER.every((id) => products.includes(id))
  const singles = products.reduce((sum, p) => sum + PRICING[p].price, 0)
  return bundle
    ? { total: PRICING.bundle.price, compareAt: PRICING.bundle.compareAt, bundle }
    : { total: singles, compareAt: products.reduce((sum, p) => sum + PRICING[p].msrp, 0), bundle }
}

export function cartRecoverySubject(products: readonly PluginProduct[]): string {
  const names = products.length === PLUGIN_ORDER.length ? "All three plugins" : products.join(" + ")
  return `${names} - still in your cart`
}

export function renderCartRecoveryHtml(o: { products: readonly PluginProduct[]; url: string; saleEnds: string | null }): string {
  const { total, compareAt, bundle } = cartTotal(o.products)
  const rows = o.products
    .map((id) => {
      const p = PLUGINS[id]
      return `
        <tr>
          <td width="72" style="padding: 0 16px 16px 0; vertical-align: middle;">
            <img src="${REMINDER_IMAGES[id]}" width="72" height="72" alt="${esc(p.name)}" style="display: block; border-radius: 10px; border: 0;">
          </td>
          <td style="padding: 0 0 16px; vertical-align: middle; font-family: ${SANS};">
            <div style="font-size: 17px; font-weight: 700; color: ${C.ink};">${esc(p.name)}
              <span style="font-family: ${MONO}; font-size: 11px; font-weight: 400; letter-spacing: 1px; text-transform: uppercase; color: ${C.faint};">&nbsp;${esc(p.category)}</span></div>
            <div style="font-size: 14px; line-height: 1.45; color: ${C.body}; padding-top: 2px;">${esc(p.tagline)}</div>
          </td>
        </tr>`
    })
    .join("")
  const sale = bundle && o.saleEnds
    ? `<p style="margin: 0 0 20px; font-family: ${SANS}; font-size: 14px; color: ${C.red};">The $${total} price for all three ends ${esc(o.saleEnds)}.</p>`
    : ""

  return `
  <div style="background: ${C.page}; padding: 32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto; background: ${C.card}; border-radius: 14px;">
      <tr><td style="padding: 28px 28px 8px;">
        <img src="${REMINDER_IMAGES.logo}" width="120" alt="Sample Roll" style="display: block; border: 0;">
      </td></tr>
      <tr><td style="padding: 12px 28px 0; font-family: ${SANS};">
        <h1 style="margin: 0 0 8px; font-size: 22px; line-height: 1.25; color: ${C.ink};">Still thinking it over?</h1>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.55; color: ${C.body};">
          You got as far as checkout and stopped. Your cart is saved - one click takes you back to it,
          exactly as you left it.
        </p>
      </td></tr>
      <tr><td style="padding: 0 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </td></tr>
      <tr><td style="padding: 4px 28px 0; font-family: ${SANS};">
        <p style="margin: 0 0 16px; font-size: 15px; color: ${C.ink};">
          <strong style="font-size: 20px;">$${total}</strong>
          <span style="color: ${C.faint}; text-decoration: line-through; padding-left: 6px;">$${compareAt}</span>
          <span style="color: ${C.faint}; font-size: 13px; padding-left: 6px;">one-time, free updates</span>
        </p>
        ${sale}
        <a href="${esc(o.url)}" style="display: inline-block; background: ${C.ink}; color: #ffffff; text-decoration: none; padding: 14px 26px; border-radius: 999px; font-weight: 600; font-size: 15px;">Finish checkout</a>
        <p style="margin: 20px 0 0; font-size: 13px; line-height: 1.5; color: ${C.faint};">
          macOS and Windows - VST3, AU and standalone. One key covers three machines.
        </p>
      </td></tr>
      <tr><td style="padding: 24px 28px 28px; font-family: ${SANS};">
        <p style="margin: 0; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; line-height: 1.5; color: ${C.faint};">
          You're getting this once, because you ticked the box to hear from Sample Roll at checkout.
          There won't be another about this cart. Questions? Just reply.
        </p>
      </td></tr>
    </table>
  </div>`
}
