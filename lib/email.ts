import nodemailer from "nodemailer"
import { downloadsFor } from "@/lib/plugin-purchase-logic"
import type { PluginProduct } from "@/lib/plugin-products"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
const FROM = `Sample Roll <${process.env.SMTP_FROM || process.env.SMTP_USER}>`

const SMTP_HOST = process.env.SMTP_HOST?.trim()
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587
const SMTP_USER = process.env.SMTP_USER?.trim()
const SMTP_PASS = process.env.SMTP_PASS
const SMTP_SECURE = process.env.SMTP_SECURE

export function isEmailConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS)
}

function getSecureCandidates() {
  if (SMTP_SECURE === "true") return [true, false]
  if (SMTP_SECURE === "false") return [false, true]
  return SMTP_PORT === 465 ? [true, false] : [false, true]
}

function createTransporter(secure: boolean) {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  })
}

async function sendMailWithFallback(mail: nodemailer.SendMailOptions) {
  if (!isEmailConfigured()) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.")
  }

  let lastError: unknown = null

  for (const secure of getSecureCandidates()) {
    try {
      const transporter = createTransporter(secure)
      await transporter.sendMail(mail)
      return
    } catch (error) {
      lastError = error
      console.error(`[email] send failed with secure=${String(secure)}:`, error)
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to send email.")
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${APP_URL}/verify-email?token=${token}`

  await sendMailWithFallback({
    from: FROM,
    to: email,
    subject: "Confirm your Sample Roll account",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Verify your email</h1>
        <p style="color: #555; margin-bottom: 24px;">
          Thanks for signing up for Sample Roll. Click the button below to confirm your email address and activate your account.
        </p>
        <a href="${url}" style="display: inline-block; background: #e63c3c; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
          Confirm email
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="color: #ccc; font-size: 12px; margin-top: 8px;">
          Or copy this link: ${url}
        </p>
      </div>
    `,
  })
}

const PLUGIN_EMAIL_COPY: Record<string, { formats: string }> = {
  shft: { formats: "macOS (VST3 / AU / Standalone) or Windows (VST3 / Standalone)" },
  drft: { formats: "macOS (VST3 / AU / Standalone) or Windows (VST3 / Standalone)" },
  fltr: { formats: "macOS (VST3 / AU / Standalone) or Windows (VST3 / Standalone)" },
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** One licence key per item, each followed by its download links. Those links
 *  carry the key as their credential, so they work without signing in. Items
 *  with no key are left out rather than printing an empty box. */
function keyBlocksHtml(items: { product: PluginProduct; licenseKey: string | null }[]): string {
  return items
    .filter((i) => i.licenseKey)
    .map((i) => {
      const links = downloadsFor(i.product, i.licenseKey!)
        .map((d) => `<a href="${APP_URL}${d.href}" style="${linkChipStyle}">↓ ${d.label}</a>`)
        .join("")
      return `
        <p style="color: #555; margin-bottom: 8px; font-size: 14px;">Your ${i.product} licence key</p>
        <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 18px;
                  letter-spacing: 1px; background: #f4f4f4; border: 1px solid #e4e4e4;
                  border-radius: 8px; padding: 12px 16px; margin: 0 0 12px;">
          ${i.licenseKey}
        </p>
        <p style="color: #555; margin-bottom: 12px; font-size: 14px;">
          Paste it into ${i.product} the first time you open it. It activates up to 3 machines,
          and you can free one any time from My Products.
        </p>
        <div style="margin: 0 0 24px;">${links}</div>`
    })
    .join("")
}

function downloadLinesHtml(items: { product: PluginProduct }[]): string {
  return items
    .map((i) => `<strong>${i.product}</strong> for ${PLUGIN_EMAIL_COPY[i.product]?.formats ?? "macOS & Windows"}`)
    .join(" and ")
}

export type PurchaseEmailOptions = {
  /** Present when the account has no human-chosen password (it was created by
   *  this purchase). The email then says "set a password", not "sign in". */
  setPasswordUrl?: string | null
  /** Products this address already owned before this checkout. The charge is
   *  a duplicate and is refunded by hand. */
  duplicates?: readonly string[]
  /** The rest of the set at the complete-your-set price, for a day - see
   *  lib/complete-set-logic.ts. */
  completeSet?: { missing: readonly string[]; price: number; compareAt: number; url: string } | null
}

const buttonStyle =
  "display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;"
const linkChipStyle =
  "display: inline-block; margin: 0 8px 8px 0; padding: 8px 14px; border: 1px solid #d8d8d8; border-radius: 999px; color: #1a1a1a; text-decoration: none; font-size: 14px;"

/** Purchase receipt for one or more plugins (a bundle purchase sends one email
    covering both keys). Each key block is followed by direct download links
    that use the key as their credential, so a buyer who never signs in still
    gets the installer. Key blocks are omitted when a key is missing rather
    than printing an empty box — /products always shows the real one. */
export async function sendPluginPurchaseEmail(
  email: string,
  items: { product: PluginProduct; licenseKey: string | null }[],
  opts: PurchaseEmailOptions = {}
) {
  const url = `${APP_URL}/products`
  const names = items.map((i) => i.product).join(" + ")
  const safeEmail = escapeHtml(email)

  const keyBlocks = keyBlocksHtml(items)

  const downloadLines = downloadLinesHtml(items)

  const account = opts.setPasswordUrl
    ? `
        <p style="color: #555; margin: 0 0 12px; font-size: 14px;">
          Your purchase is saved to <strong>${safeEmail}</strong>. Set a password to see it on
          My Products, manage your machines, and re-download any time.
        </p>
        <a href="${opts.setPasswordUrl}" style="${buttonStyle}">Set password</a>`
    : `
        <p style="color: #555; margin: 0 0 12px; font-size: 14px;">
          Sign in with <strong>${safeEmail}</strong> to see it on My Products.
        </p>
        <a href="${url}" style="${buttonStyle}">Go to My Products</a>
        <p style="color: #999; font-size: 13px; margin-top: 12px;">
          Forgot your password? <a href="${APP_URL}/forgot-password" style="color: #555;">Reset it</a>.
        </p>`

  const duplicateNote = opts.duplicates?.length
    ? `
        <p style="color: #854d0e; background: #fef9c3; border: 1px solid #fde68a; border-radius: 8px;
                  padding: 12px 16px; font-size: 14px; margin: 24px 0 0;">
          It looks like ${safeEmail} already owned ${opts.duplicates.map(escapeHtml).join(" and ")}, so this charge
          will be refunded. Reply to this email if it hasn't landed within a few days.
        </p>`
    : ""

  const set = opts.completeSet
  const completeSet = set
    ? `
        <div style="border: 2px solid #1a1a1a; border-radius: 12px; padding: 18px 20px; margin: 28px 0 0;">
          <p style="font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #96562f; margin: 0 0 6px;">
            Complete your set - next 24 hours
          </p>
          <p style="font-size: 17px; font-weight: 600; margin: 0 0 6px;">
            Add ${set.missing.map(escapeHtml).join(" + ")} for $${set.price}
            <span style="color: #999; font-weight: 400; text-decoration: line-through;">$${set.compareAt}</span>
          </p>
          <p style="color: #555; font-size: 14px; margin: 0 0 14px;">
            The rest of Sample Roll's plugins, at a price that's only here until this time tomorrow.
          </p>
          <a href="${set.url}" style="${buttonStyle}">Get ${set.missing.length === 1 ? "it" : "both"} for $${set.price}</a>
        </div>`
    : ""

  await sendMailWithFallback({
    from: FROM,
    to: email,
    subject: `Your ${names} download is ready`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Thanks for buying ${names}</h1>
        <p style="color: #555; margin-bottom: 24px;">
          Your purchase is complete. Below is everything you need: your licence key and the
          download links for ${downloadLines}, plus the user manual.
        </p>
        ${keyBlocks}
        ${account}
        ${duplicateNote}
        ${completeSet}
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          Reply here if you hit any trouble and we'll sort you out.
        </p>
      </div>
    `,
  })
}

/** The email a gift link's recipient asks for: the keys and downloads, so it
 *  is useful the moment it lands, plus one link that saves the gift to this
 *  address - as a new account, or into the one the address already has. */
export async function sendGiftEmail(
  email: string,
  items: { product: PluginProduct; licenseKey: string | null }[],
  opts: { confirmUrl: string; privateUrl: string; message: string | null; existingAccount: boolean },
) {
  const names = items.map((i) => i.product).join(" + ")
  const note = opts.message
    ? `<p style="color: #1a1a1a; background: #f6f4ef; border-radius: 8px; padding: 14px 16px; margin: 0 0 24px; white-space: pre-line;">${escapeHtml(opts.message)}</p>`
    : ""
  const save = opts.existingAccount
    ? `This address already has a Sample Roll account. Confirm and the gift is added to it, next to
       everything else on My Products.`
    : `Confirm this address and set a password to keep them on My Products, where you can
       re-download and manage your machines any time.`

  await sendMailWithFallback({
    from: FROM,
    to: email,
    subject: `Your gift from Sample Roll: ${names}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">${names}, on us</h1>
        <p style="color: #555; margin-bottom: 24px;">
          Here are your licence ${items.length === 1 ? "key" : "keys"} and the downloads for
          ${downloadLinesHtml(items)}, plus the user manual.
        </p>
        ${note}
        ${keyBlocksHtml(items)}
        <p style="color: #555; margin: 0 0 12px; font-size: 14px;">${save}</p>
        <a href="${opts.confirmUrl}" style="${buttonStyle}">Save to my account</a>
        <p style="color: #999; font-size: 13px; margin-top: 12px;">
          That button works for 24 hours. Your keys and downloads above keep working either way, and
          so does <a href="${opts.privateUrl}" style="color: #555;">your gift page</a>.
        </p>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          Reply here if you hit any trouble and we'll sort you out.
        </p>
      </div>
    `,
  })
}

/** The abandoned-cart reminder. The HTML is drawn by lib/cart-recovery-email.ts. */
export async function sendCartRecoveryEmail(email: string, subject: string, html: string) {
  await sendMailWithFallback({ from: FROM, to: email, subject, html })
}

/** To the admins: someone applied to the creator program on /creators. */
export async function sendCreatorApplicationNotice(
  to: string[],
  app: { name: string; email: string; country: string; plugin: string; socials: string[]; message: string },
) {
  if (to.length === 0) return
  await sendMailWithFallback({
    from: FROM,
    to: to.join(", "),
    replyTo: app.email,
    subject: `Creator application: ${app.name} (${app.country})`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
        <h1 style="font-size: 18px; margin: 0 0 12px;">New creator application</h1>
        <p style="margin: 0 0 4px;"><strong>${escapeHtml(app.name)}</strong> &lt;${escapeHtml(app.email)}&gt;</p>
        <p style="margin: 0 0 4px; color: #555;">${escapeHtml(app.country)} &middot; wants to make a video on ${escapeHtml(app.plugin)}</p>
        ${app.socials.map((url) => `<p style="margin: 8px 0 0;"><a href="${escapeHtml(url)}" style="color: #1a1a1a;">${escapeHtml(url)}</a></p>`).join("")}
        <p style="margin: 16px 0; white-space: pre-line; background: #f4f4f4; border-radius: 8px; padding: 12px 14px;">${escapeHtml(app.message)}</p>
        <a href="${APP_URL}/admin/affiliates" style="${buttonStyle}">Review it</a>
        <p style="color: #999; font-size: 13px; margin-top: 16px;">Reply to this email to write to them directly.</p>
      </div>`,
  })
}

/** To an approved applicant: they're in, with their private dashboard link. */
export async function sendCreatorWelcomeEmail(
  to: string,
  o: { name: string; code: string; percent: number; dashboardUrl: string; shareUrl: string },
) {
  await sendMailWithFallback({
    from: FROM,
    to,
    subject: "You're in - welcome to the Sample Roll creator program",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">You're in, ${escapeHtml(o.name.split(" ")[0] ?? o.name)}</h1>
        <p style="color: #555; margin-bottom: 20px; line-height: 1.5;">
          Your application to the Sample Roll creator program is approved. You earn
          <strong>${o.percent}%</strong> of every purchase made through your link or with your code.
        </p>
        <p style="color: #555; margin: 0 0 6px; font-size: 14px;">Your link</p>
        <p style="font-family: ui-monospace, Menlo, monospace; background: #f4f4f4; border-radius: 8px; padding: 10px 14px; margin: 0 0 12px; word-break: break-all;">${escapeHtml(o.shareUrl)}</p>
        <p style="color: #555; margin: 0 0 6px; font-size: 14px;">Your code - buyers can type it at checkout</p>
        <p style="font-family: ui-monospace, Menlo, monospace; font-size: 18px; background: #f4f4f4; border-radius: 8px; padding: 10px 14px; margin: 0 0 24px;">${escapeHtml(o.code)}</p>
        <p style="color: #555; margin: 0 0 12px; line-height: 1.5;">
          Your private dashboard has every plugin's link, your clicks and sales, and where you
          connect Stripe so your share is paid automatically after each sale.
        </p>
        <a href="${o.dashboardUrl}" style="${buttonStyle}">Open my dashboard</a>
        <p style="color: #999; font-size: 13px; margin-top: 20px;">
          Keep the dashboard link to yourself - it's your private page. Questions? Just reply.
        </p>
      </div>`,
  })
}

/** Placeholder in a stored ReleaseAnnouncement.bodyHtml. The body is snapshotted
 *  once per blast, but the unsubscribe link is per-recipient, so it is
 *  substituted at send time rather than baked in. */
export const UNSUBSCRIBE_PLACEHOLDER = "{{UNSUBSCRIBE_URL}}"

/** Subject line. " - " rather than an em dash, matching how the plugins' own
 *  UI strings are written. */
export function releaseAnnouncementSubject(product: string, version: string) {
  return `${product} v${version} - Out Now`
}

/** The release email body, with UNSUBSCRIBE_PLACEHOLDER where the per-recipient
 *  link goes. Notes come from PRODUCTS[product].changelog - the same prose that
 *  renders on /products, so there is nothing extra to write per release. */
export function renderReleaseAnnouncementHtml(opts: {
  product: string
  version: string
  notes: string[]
}) {
  const url = `${APP_URL}/products`

  // Cap the list: a changelog can run to ten items and an email that long
  // does not get read. The rest are one click away on /products.
  const MAX_NOTES = 5
  const shown = opts.notes.slice(0, MAX_NOTES)
  const overflow = opts.notes.length - shown.length

  const noteItems = shown
    .map(
      (n) =>
        `<li style="color: #555; margin-bottom: 12px; line-height: 1.5;">${escapeHtml(n)}</li>`
    )
    .join("")

  const overflowLine = overflow > 0
    ? `<p style="color: #999; font-size: 13px; margin: 0 0 24px;">
         Plus ${overflow} more ${overflow === 1 ? "change" : "changes"} - the full notes are on My Products.
       </p>`
    : ""

  return `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">
          ${escapeHtml(opts.product)} v${escapeHtml(opts.version)} - Out Now
        </h1>
        <p style="color: #555; margin-bottom: 24px;">
          You own ${escapeHtml(opts.product)}, so this update is free. Download it from
          <strong>My Products</strong> - your licence key is unchanged and the new build
          activates with the key you already have.
        </p>
        <ul style="padding-left: 20px; margin: 0 0 24px;">${noteItems}</ul>
        ${overflowLine}
        <a href="${url}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
          Go to My Products
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          Sign in with this email address to see your download. Reply here if you hit any trouble and we'll sort you out.
        </p>
        <p style="color: #ccc; font-size: 12px; margin-top: 8px;">
          Or copy this link: ${url}
        </p>
        <p style="color: #ccc; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
          You're getting this because you own ${escapeHtml(opts.product)}.
          <a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color: #999;">Unsubscribe from update emails</a>
          - you'll still get receipts and account emails.
        </p>
      </div>
    `
}

/** A POOLED transporter for a blast. The one-shot path above opens a fresh
 *  connection per message, which is fine for a single receipt and ruinous for
 *  several hundred: most SMTP hosts throttle or drop on connection churn.
 *  Callers MUST close() when the batch is done. */
export function createBulkTransporter() {
  if (!isEmailConfigured()) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.")
  }
  // No secure-fallback loop here: the fallback exists for one-shot sends where
  // a wrong guess costs one retry. A pool that guesses wrong fails every
  // message, so the batch caller surfaces the error instead of quietly
  // retrying hundreds of times.
  const [secure] = getSecureCandidates()
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  })
}

/** Sends one release email over an already-open pooled transporter. Throws on
 *  failure so the caller can record which address failed and carry on. */
export async function sendReleaseAnnouncementEmail(
  transporter: nodemailer.Transporter,
  email: string,
  opts: { subject: string; html: string; unsubscribeUrl: string }
) {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: opts.subject,
    html: opts.html.split(UNSUBSCRIBE_PLACEHOLDER).join(opts.unsubscribeUrl),
    // Gmail/Outlook render a native "Unsubscribe" control from these and treat
    // its absence on bulk mail as a spam signal. One-Click means the client
    // POSTs the URL itself, so /api/unsubscribe accepts POST as well as the
    // human-facing GET page.
    headers: {
      "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  })
}

/** The per-person parts of a member-offer email, substituted at send time like
 *  UNSUBSCRIBE_PLACEHOLDER: the body is snapshotted once per offer, the code and
 *  its link are each recipient's own. */
export const CODE_PLACEHOLDER = "{{CODE}}"
export const OFFER_URL_PLACEHOLDER = "{{OFFER_URL}}"

/** The picture of fltr at the top of the member-offer email. Served by the site
 *  itself, so it is only there once the site is deployed - a test sent from a
 *  local dev server points at localhost. A JPEG, not the WebP the plugin page
 *  uses, because Outlook shows no WebP; 960px wide, so it is sharp at the
 *  432px the email draws it on a high-density screen. The picture is the
 *  close-up render of fltr's morph bar and curve, not a screenshot. */
export const MEMBER_OFFER_IMAGE = `${APP_URL}/fltr/email.jpg`

export function memberOfferSubject(amountOff: string) {
  return `${amountOff} off any Sample Roll plugin - thanks for being here`
}

/** The link in a member-offer email. It carries the code, so following it
 *  puts the code on the visitor's cart whether or not they are signed in - see
 *  lib/use-cart.ts. It lands on fltr, the plugin the email is about. */
export function memberOfferUrl(code: string) {
  return `${APP_URL}/fltr?promo=${encodeURIComponent(code)}`
}

/** The member-offer email, with CODE_PLACEHOLDER, OFFER_URL_PLACEHOLDER and
 *  UNSUBSCRIBE_PLACEHOLDER where each person's own parts go. */
export function renderMemberOfferHtml(opts: { amountOff: string; expires: string }) {
  const amount = escapeHtml(opts.amountOff)
  const expires = escapeHtml(opts.expires)
  return `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">
          ${amount} off any plugin, for you
        </h1>
        <a href="${OFFER_URL_PLACEHOLDER}" style="display: block; margin: 0 0 20px; text-decoration: none;">
          <img src="${MEMBER_OFFER_IMAGE}" width="432" alt="fltr, close up: the morph bar sliding from A to B above a glowing filter curve"
               style="display: block; width: 100%; max-width: 432px; height: auto; border: 0; border-radius: 10px;">
        </a>
        <p style="color: #555; margin-bottom: 16px; line-height: 1.5;">
          fltr is out - a morphing filter that plays in key. You were on Sample Roll before it
          launched, so here is ${amount} off it, or off shft, drft or all three together.
        </p>
        <p style="margin: 0 0 6px; color: #999; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;">
          Your code
        </p>
        <p style="margin: 0 0 20px; font-family: monospace; font-size: 22px; font-weight: 700; letter-spacing: 0.08em;">
          ${CODE_PLACEHOLDER}
        </p>
        <p style="color: #555; margin-bottom: 24px; line-height: 1.5;">
          You don't need to type it. It is taken off at checkout by itself when you're signed in
          with this email address, or when you follow the button below. It works once, and
          until ${expires}.
        </p>
        <a href="${OFFER_URL_PLACEHOLDER}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
          See fltr, ${amount} off
        </a>
        <p style="color: #ccc; font-size: 12px; margin-top: 16px;">
          Or copy this link: ${OFFER_URL_PLACEHOLDER}
        </p>
        <p style="color: #ccc; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
          You're getting this because you have a Sample Roll account.
          <a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color: #999;">Unsubscribe from product emails</a>
          - you'll still get receipts and account emails.
        </p>
      </div>
    `
}

/** Sends one member-offer email over an already-open pooled transporter.
 *  Throws on failure so the caller can record it and carry on. */
export async function sendMemberOfferEmail(
  transporter: nodemailer.Transporter,
  email: string,
  opts: { subject: string; html: string; code: string; unsubscribeUrl: string }
) {
  const html = opts.html
    .split(CODE_PLACEHOLDER).join(escapeHtml(opts.code))
    .split(OFFER_URL_PLACEHOLDER).join(memberOfferUrl(opts.code))
    .split(UNSUBSCRIBE_PLACEHOLDER).join(opts.unsubscribeUrl)
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: opts.subject,
    html,
    headers: {
      "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${token}`

  await sendMailWithFallback({
    from: FROM,
    to: email,
    subject: "Reset your Sample Roll password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Reset your password</h1>
        <p style="color: #555; margin-bottom: 24px;">
          We received a request to reset the password for your Sample Roll account. Click the button below to choose a new password.
        </p>
        <a href="${url}" style="display: inline-block; background: #e63c3c; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
          Reset password
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.
        </p>
        <p style="color: #ccc; font-size: 12px; margin-top: 8px;">
          Or copy this link: ${url}
        </p>
      </div>
    `,
  })
}

/** Sent to the address someone wants to move their account TO. Opening the
    link is the proof they can receive mail there, which is why nothing changes
    until they do. A guest-created account gets the set-password link in the
    same email, so confirming lands them somewhere they can actually sign in
    rather than at a password prompt they have never set. */
export async function sendEmailChangeConfirmEmail(
  newEmail: string,
  opts: { token: string; currentEmail: string; setPasswordUrl?: string | null },
) {
  const url = `${APP_URL}/api/user/email-change/confirm?token=${opts.token}`
  const safeCurrent = escapeHtml(opts.currentEmail)
  const safeNew = escapeHtml(newEmail)

  const passwordBlock = opts.setPasswordUrl
    ? `
        <p style="color: #555; font-size: 14px; margin: 24px 0 8px;">
          This account has no password yet. Once you've confirmed, set one to see
          your downloads and licence keys on My Products.
        </p>
        <a href="${opts.setPasswordUrl}" style="display: inline-block; border: 1px solid #d8d8d8; color: #1a1a1a; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px;">
          Set password
        </a>`
    : ""

  await sendMailWithFallback({
    from: FROM,
    to: newEmail,
    subject: "Confirm your new email address",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Confirm your new email</h1>
        <p style="color: #555; margin-bottom: 24px;">
          Someone asked to move the Sample Roll account currently on
          <strong>${safeCurrent}</strong> to this address, <strong>${safeNew}</strong>.
          Click below to confirm. Nothing changes until you do.
        </p>
        <a href="${url}" style="display: inline-block; background: #e63c3c; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
          Confirm this address
        </a>
        ${passwordBlock}
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          This link expires in 24 hours. If you weren't expecting it, ignore this email - the account stays exactly as it is.
        </p>
        <p style="color: #ccc; font-size: 12px; margin-top: 8px;">
          Or copy this link: ${url}
        </p>
      </div>
    `,
  })
}

/** Sent to the address an account just moved AWAY from. Carries no link and
    offers no action: it exists so that a change the real owner did not make is
    visible to them, and it must not itself be usable to do anything. */
export async function sendEmailChangedNoticeEmail(oldEmail: string, newEmail: string) {
  const safeNew = escapeHtml(newEmail)

  await sendMailWithFallback({
    from: FROM,
    to: oldEmail,
    subject: "Your Sample Roll account email was changed",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Your account email was changed</h1>
        <p style="color: #555; margin-bottom: 16px;">
          The Sample Roll account that used this address now uses
          <strong>${safeNew}</strong>. Your purchases, licence keys and downloads
          moved with it.
        </p>
        <p style="color: #555; margin-bottom: 0;">
          If this wasn't you, reply to this email straight away and we'll put it back.
        </p>
      </div>
    `,
  })
}

/**
 * Tells the site owner a buyer paid again for something they already own.
 *
 * Plain text on purpose: this is an operational alert, not a customer email,
 * and it wants to be skimmable on a phone. Recipients come from ADMIN_EMAILS;
 * with none configured there is nobody to tell, so it is a no-op rather than
 * an error - the webhook must never fail over a notification.
 */
export async function sendDuplicatePurchaseAlert(
  to: string[],
  alert: { subject: string; text: string },
) {
  if (to.length === 0) return

  await sendMailWithFallback({
    from: FROM,
    to: to.join(", "),
    subject: alert.subject,
    text: alert.text,
  })
}
