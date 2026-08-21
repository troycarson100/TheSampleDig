#!/usr/bin/env node
// Upload the current drft release (installer .pkg + manual .pdf) to the storage
// bucket so /products can serve signed download URLs. Objects are private.
//
// Usage (upload any subset — macOS installer, Windows installer, and/or manual):
//   SPACES_ENDPOINT="https://sfo3.digitaloceanspaces.com" SPACES_REGION="sfo3" \
//   SPACES_BUCKET="drftdownload" SPACES_KEY="..." SPACES_SECRET="..." \
//     node scripts/upload-drft-release.mjs \
//       [--installer <installer.pkg>] [--installer-win <setup.exe>] [--manual <manual.pdf>]
//
// The object keys must match lib/products.ts (DRFT_INSTALLER_KEY / DRFT_INSTALLER_WIN_KEY /
// DRFT_MANUAL_KEY override the defaults below).
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { readFileSync, existsSync } from "node:fs"
import { basename } from "node:path"

const { SPACES_ENDPOINT, SPACES_REGION = "us-east-1", SPACES_BUCKET, SPACES_KEY, SPACES_SECRET } = process.env
if (!SPACES_ENDPOINT || !SPACES_BUCKET || !SPACES_KEY || !SPACES_SECRET) {
  console.error("Missing SPACES_ENDPOINT / SPACES_BUCKET / SPACES_KEY / SPACES_SECRET in the environment.")
  process.exit(1)
}

// Flag-based args, so you can (re)upload just one file. Back-compat: two bare
// positional args are still read as <installer.pkg> <manual.pdf>.
const argv = process.argv.slice(2)
const opts = {}
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--installer") opts.installer = argv[++i]
  else if (argv[i] === "--installer-win") opts.installerWin = argv[++i]
  else if (argv[i] === "--manual") opts.manual = argv[++i]
}
if (!opts.installer && !opts.installerWin && !opts.manual && argv.length >= 2 && !argv[0].startsWith("--")) {
  opts.installer = argv[0]
  opts.manual = argv[1]
}

const uploads = []
if (opts.installer)    uploads.push({ path: opts.installer,    key: process.env.DRFT_INSTALLER_KEY     || "drft/drft-1.0.0.pkg",       type: "application/octet-stream" })
if (opts.installerWin) uploads.push({ path: opts.installerWin, key: process.env.DRFT_INSTALLER_WIN_KEY || "drft/drft-1.0.0-setup.exe",  type: "application/octet-stream" })
if (opts.manual)       uploads.push({ path: opts.manual,       key: process.env.DRFT_MANUAL_KEY        || "drft/drft-manual-v1.0.pdf",  type: "application/pdf" })

if (uploads.length === 0) {
  console.error("Usage: node scripts/upload-drft-release.mjs [--installer <pkg>] [--installer-win <exe>] [--manual <pdf>]")
  process.exit(1)
}

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
