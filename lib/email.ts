import nodemailer from "nodemailer"

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
}

/** Purchase receipt for one or more plugins (a bundle purchase sends one email
    covering both keys). Key blocks are omitted when a key is missing rather
    than printing an empty box — /products always shows the real one. */
export async function sendPluginPurchaseEmail(
  email: string,
  items: { product: "shft" | "drft"; licenseKey: string | null }[]
) {
  const url = `${APP_URL}/products`
  const names = items.map((i) => i.product).join(" + ")

  const keyBlocks = items
    .filter((i) => i.licenseKey)
    .map(
      (i) => `
        <p style="color: #555; margin-bottom: 8px; font-size: 14px;">Your ${i.product} licence key</p>
        <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 18px;
                  letter-spacing: 1px; background: #f4f4f4; border: 1px solid #e4e4e4;
                  border-radius: 8px; padding: 12px 16px; margin: 0 0 16px;">
          ${i.licenseKey}
        </p>
        <p style="color: #555; margin-bottom: 24px; font-size: 14px;">
          Paste it into ${i.product} the first time you open it. It activates up to 3 machines,
          and you can free one any time from My Products.
        </p>`
    )
    .join("")

  const downloadLines = items
    .map((i) => `<strong>${i.product}</strong> for ${PLUGIN_EMAIL_COPY[i.product]?.formats ?? "macOS & Windows"}`)
    .join(" and ")

  await sendMailWithFallback({
    from: FROM,
    to: email,
    subject: `Your ${names} download is ready`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Thanks for buying ${names}</h1>
        <p style="color: #555; margin-bottom: 24px;">
          Your purchase is complete. Head to <strong>My Products</strong> to download ${downloadLines},
          plus the user manual — any time, as many times as you need.
        </p>
        ${keyBlocks}
        <a href="${url}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
          Go to My Products
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          Sign in with this email address to see your download. Reply here if you hit any trouble and we'll sort you out.
        </p>
        <p style="color: #ccc; font-size: 12px; margin-top: 8px;">
          Or copy this link: ${url}
        </p>
      </div>
    `,
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

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

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
