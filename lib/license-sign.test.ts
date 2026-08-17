import { test } from "node:test"
import assert from "node:assert/strict"
import { generateKeyPairSync, createVerify } from "node:crypto"
import { createPrivateKey } from "node:crypto"
import { signLicense, loadSigningKey, type LicensePayload } from "./license-sign"

const pair = () =>
  generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  })

const payload = (over: Partial<LicensePayload> = {}): LicensePayload => ({
  v: 1,
  product: "shft",
  key: "SHFT-0000-0000-0000",
  email: "buyer@example.com",
  machines: ["M1A2B3C4D", "M9F8E7D6C"],
  issued: "2026-08-16",
  ...over,
})

test("signLicense produces two base64 parts split by a dot", () => {
  const { privateKey } = pair()
  const blob = signLicense(payload(), privateKey)
  const parts = blob.split(".")
  assert.equal(parts.length, 2)
  assert.ok(parts[0].length > 0 && parts[1].length > 0)
})

test("the signed bytes are exactly what the first part decodes to", () => {
  const { privateKey, publicKey } = pair()
  const blob = signLicense(payload(), privateKey)
  const [b64Payload, b64Sig] = blob.split(".")
  const signedBytes = Buffer.from(b64Payload, "base64")

  const ok = createVerify("sha256")
    .update(signedBytes)
    .verify(publicKey, Buffer.from(b64Sig, "base64"))
  assert.equal(ok, true, "the plugin verifies the decoded bytes, so these must match")
})

test("the decoded payload is readable JSON with the fields the plugin expects", () => {
  const { privateKey } = pair()
  const blob = signLicense(payload(), privateKey)
  const decoded = JSON.parse(Buffer.from(blob.split(".")[0], "base64").toString("utf8"))
  assert.equal(decoded.v, 1)
  assert.equal(decoded.product, "shft")
  assert.deepEqual(decoded.machines, ["M1A2B3C4D", "M9F8E7D6C"])
})

test("a tampered payload no longer verifies", () => {
  const { privateKey, publicKey } = pair()
  const blob = signLicense(payload(), privateKey)
  const [b64Payload, b64Sig] = blob.split(".")

  const tampered = JSON.parse(Buffer.from(b64Payload, "base64").toString("utf8"))
  tampered.machines.push("MDEADBEEF")
  const bytes = Buffer.from(JSON.stringify(tampered), "utf8")

  const ok = createVerify("sha256").update(bytes).verify(publicKey, Buffer.from(b64Sig, "base64"))
  assert.equal(ok, false)
})

test("a signature from a different key does not verify", () => {
  const a = pair()
  const b = pair()
  const blob = signLicense(payload(), a.privateKey)
  const [b64Payload, b64Sig] = blob.split(".")

  const ok = createVerify("sha256")
    .update(Buffer.from(b64Payload, "base64"))
    .verify(b.publicKey, Buffer.from(b64Sig, "base64"))
  assert.equal(ok, false)
})

// --- loadSigningKey: the shapes a hosting panel actually delivers ------------
// Every case below is one a real deploy produced or plausibly produces. The
// third is the one that broke production: DigitalOcean stored the key with its
// -----BEGIN/END----- armour stripped, and OpenSSL answered ERR_OSSL_UNSUPPORTED.

const withEnv = (value: string | undefined, fn: () => void) => {
  const prev = process.env.LICENSE_SIGNING_PRIVATE_KEY
  if (value === undefined) delete process.env.LICENSE_SIGNING_PRIVATE_KEY
  else process.env.LICENSE_SIGNING_PRIVATE_KEY = value
  try {
    fn()
  } finally {
    if (prev === undefined) delete process.env.LICENSE_SIGNING_PRIVATE_KEY
    else process.env.LICENSE_SIGNING_PRIVATE_KEY = prev
  }
}

const goodPem = pair().privateKey.trim()

test("loadSigningKey accepts a normal multi-line PEM", () => {
  withEnv(goodPem, () => {
    assert.doesNotThrow(() => createPrivateKey(loadSigningKey()))
  })
})

test("loadSigningKey repairs literal \\n escapes", () => {
  withEnv(goodPem.replace(/\n/g, "\\n"), () => {
    assert.doesNotThrow(() => createPrivateKey(loadSigningKey()))
  })
})

test("loadSigningKey repairs a key whose BEGIN/END armour was stripped", () => {
  // Exactly what DigitalOcean stored: body only, real newlines, no header.
  const body = goodPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .trim()
  withEnv(body, () => {
    assert.doesNotThrow(() => createPrivateKey(loadSigningKey()))
  })
})

test("loadSigningKey repairs surrounding quotes", () => {
  withEnv(`"${goodPem}"`, () => {
    assert.doesNotThrow(() => createPrivateKey(loadSigningKey()))
  })
})

test("loadSigningKey repairs armour-stripped AND escaped together", () => {
  const body = goodPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .trim()
    .replace(/\n/g, "\\n")
  withEnv(body, () => {
    assert.doesNotThrow(() => createPrivateKey(loadSigningKey()))
  })
})

test("loadSigningKey still fails loudly on a genuinely bad value", () => {
  withEnv("not a key at all", () => {
    assert.throws(() => createPrivateKey(loadSigningKey()))
  })
})

test("loadSigningKey throws when unset", () => {
  withEnv(undefined, () => {
    assert.throws(() => loadSigningKey(), /not set/)
  })
})
