import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
const FROM = `Sample Roll <${process.env.SMTP_FROM || process.env.SMTP_USER}>`

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${APP_URL}/verify-email?token=${token}`

  await transporter.sendMail({
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

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${token}`

  await transporter.sendMail({
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
