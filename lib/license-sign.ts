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

/**
 * Reads the signing key and repairs the ways hosting panels mangle a multi-line
 * secret. All three of these are real, not hypothetical:
 *
 *  - literal `\n` escapes instead of newlines (single-line input fields)
 *  - wrapping quotes carried over from a .env file
 *  - the `-----BEGIN/END-----` armour lines silently dropped
 *
 * The third is what actually happened on DigitalOcean: the stored value arrived
 * 1649 chars over 26 lines instead of 1704 over 28, with the header and footer
 * gone, and OpenSSL rejected it with ERR_OSSL_UNSUPPORTED. Re-pasting by hand is
 * a coin flip; reassembling here is deterministic.
 *
 * Nothing here can turn a wrong key into a working one - a genuinely corrupt
 * value still fails to parse, and the caller still reports that.
 */
export function loadSigningKey(): string {
  const raw = process.env.LICENSE_SIGNING_PRIVATE_KEY
  if (!raw) throw new Error("LICENSE_SIGNING_PRIVATE_KEY is not set")

  let pem = raw.trim()

  if (pem.length > 1 && pem.startsWith('"') && pem.endsWith('"')) {
    pem = pem.slice(1, -1).trim()
  }
  if (pem.includes("\\n")) {
    pem = pem.replace(/\\n/g, "\n")
  }

  // No armour: treat whatever is left as the base64 body and rebuild the PEM.
  if (!pem.includes("-----BEGIN")) {
    const body = pem.replace(/\s+/g, "")
    const wrapped = body.match(/.{1,64}/g) ?? []
    pem = ["-----BEGIN PRIVATE KEY-----", ...wrapped, "-----END PRIVATE KEY-----"].join("\n")
  }

  return pem.endsWith("\n") ? pem : pem + "\n"
}

export function todayIssued(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}
