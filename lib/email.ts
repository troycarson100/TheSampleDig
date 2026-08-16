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

export async function sendShftPurchaseEmail(email: string, licenseKey: string | null = null) {
  const url = `${APP_URL}/products`

  // Omitted entirely when there is no key, rather than printing an empty box a
  // buyer would try to activate with. /products always shows the real one.
  const keyBlock = licenseKey
    ? `
        <p style="color: #555; margin-bottom: 8px; font-size: 14px;">Your licence key</p>
        <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 18px;
                  letter-spacing: 1px; background: #f4f4f4; border: 1px solid #e4e4e4;
                  border-radius: 8px; padding: 12px 16px; margin: 0 0 16px;">
          ${licenseKey}
        </p>
        <p style="color: #555; margin-bottom: 24px; font-size: 14px;">
          Paste it into shft the first time you open it. It activates up to 3 machines,
          and you can free one any time from My Products.
        </p>`
    : ""

  await sendMailWithFallback({
    from: FROM,
    to: email,
    subject: "Your shft download is ready",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Thanks for buying shft</h1>
        <p style="color: #555; margin-bottom: 24px;">
          Your purchase is complete. Head to <strong>My Products</strong> to download shft for
          macOS (VST3 / AU / Standalone) or Windows (VST3 / Standalone), plus the user manual —
          any time, as many times as you need.
        </p>
        ${keyBlock}
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
