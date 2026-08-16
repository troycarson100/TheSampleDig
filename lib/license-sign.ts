import { createSign, createPrivateKey } from "node:crypto"

export interface LicensePayload {
  /** Format version. Bump only if the plugin's parser must change. */
  v: 1
  /** Matches purchases.product. A future paid 2.0 would be a different value. */
  product: string
  key: string
  email: string
  /** The whole machine-id set. Valid while ANY one of these still matches. */
  machines: string[]
  /** YYYY-MM-DD. Informational — there is deliberately no expiry. */
  issued: string
}

/**
 * `<base64 of the JSON>.<base64 of the RSA-SHA256 signature over those bytes>`.
 *
 * createSign defaults to PKCS#1 v1.5 padding for RSA keys, which is what the
 * plugin's verifier unwraps by hand. Do not switch this to PSS without changing
 * the plugin in the same release — every issued licence would stop verifying.
 *
 * The blob ships the base64 of exactly the bytes that were signed, and the
 * plugin verifies those decoded bytes without ever re-serialising the JSON.
 * A single byte of difference in key order or spacing would break every licence.
 */
export function signLicense(payload: LicensePayload, privateKeyPem: string): string {
  const json = Buffer.from(JSON.stringify(payload), "utf8")
  const signature = createSign("sha256").update(json).sign(createPrivateKey(privateKeyPem))
  return `${json.toString("base64")}.${signature.toString("base64")}`
}

export function loadSigningKey(): string {
  const pem = process.env.LICENSE_SIGNING_PRIVATE_KEY
  if (!pem) throw new Error("LICENSE_SIGNING_PRIVATE_KEY is not set")
  // Hosting panels commonly store multi-line values with literal \n.
  return pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem
}

export function todayIssued(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}
