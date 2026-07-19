#!/usr/bin/env node
// Upload the current shft release (installer .pkg + manual .pdf) to the storage
// bucket so /products can serve signed download URLs. Objects are private.
//
// Usage:
//   SPACES_ENDPOINT="https://nyc3.digitaloceanspaces.com" SPACES_REGION="nyc3" \
//   SPACES_BUCKET="sample-roll-releases" SPACES_KEY="..." SPACES_SECRET="..." \
//     node scripts/upload-shft-release.mjs <installer.pkg> <manual.pdf>
//
// The object keys must match lib/products.ts (SHFT_INSTALLER_KEY / SHFT_MANUAL_KEY
// override the defaults below).
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { readFileSync, existsSync } from "node:fs"
import { basename } from "node:path"

const { SPACES_ENDPOINT, SPACES_REGION = "us-east-1", SPACES_BUCKET, SPACES_KEY, SPACES_SECRET } = process.env
if (!SPACES_ENDPOINT || !SPACES_BUCKET || !SPACES_KEY || !SPACES_SECRET) {
  console.error("Missing SPACES_ENDPOINT / SPACES_BUCKET / SPACES_KEY / SPACES_SECRET in the environment.")
  process.exit(1)
}

const [installerPath, manualPath] = process.argv.slice(2)
if (!installerPath || !manualPath) {
  console.error("Usage: node scripts/upload-shft-release.mjs <installer.pkg> <manual.pdf>")
  process.exit(1)
}

const uploads = [
  { path: installerPath, key: process.env.SHFT_INSTALLER_KEY || "shft/shft-1.0.11.pkg", type: "application/octet-stream" },
  { path: manualPath, key: process.env.SHFT_MANUAL_KEY || "shft/shft-manual-v1.3.pdf", type: "application/pdf" },
]

const s3 = new S3Client({
  region: SPACES_REGION,
  endpoint: SPACES_ENDPOINT,
  credentials: { accessKeyId: SPACES_KEY, secretAccessKey: SPACES_SECRET },
})

for (const u of uploads) {
  if (!existsSync(u.path)) {
    console.error(`✗ file not found: ${u.path}`)
    process.exit(1)
  }
  const Body = readFileSync(u.path)
  await s3.send(
    new PutObjectCommand({ Bucket: SPACES_BUCKET, Key: u.key, Body, ContentType: u.type, ACL: "private" }),
  )
  console.log(`✓ ${basename(u.path)} → ${SPACES_BUCKET}/${u.key} (${(Body.length / 1e6).toFixed(1)} MB)`)
}
console.log("Done. Objects are private; the site serves them via short-lived signed URLs.")
