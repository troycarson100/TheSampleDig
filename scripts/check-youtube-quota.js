/**
 * Check if any YouTube API key has quota available.
 * Run before populate to fail fast with a clear message.
 *
 * Usage: node scripts/check-youtube-quota.js
 * Exit 0 if at least one key works, 1 if all quota exceeded.
 */

require("dotenv").config()

const keys = (process.env.YOUTUBE_API_KEYS || process.env.YOUTUBE_API_KEY || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean)

async function testKey(key) {
  const q = encodeURIComponent("vinyl rip")
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${q}&maxResults=2&key=${key}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.error?.code === 403 && /quota|exceeded/i.test(data.error.message || "")) {
    return { ok: false, reason: "quota exceeded" }
  }
  if (data.error) return { ok: false, reason: data.error.message?.slice(0, 80) || "API error" }
  return { ok: true, results: data.items?.length || 0 }
}

async function main() {
  if (keys.length === 0) {
    console.error("[Check] No YOUTUBE_API_KEY or YOUTUBE_API_KEYS in .env")
    process.exit(1)
  }
  console.log(`[Check] Testing ${keys.length} YouTube API key(s)...`)
  for (let i = 0; i < keys.length; i++) {
    const result = await testKey(keys[i])
    console.log(`  Key ${i + 1}: ${result.ok ? `OK (${result.results} results)` : result.reason}`)
    if (result.ok) {
      console.log("[Check] At least one key has quota. You can run populate.")
      process.exit(0)
    }
  }
  console.error("\n[Check] All keys have exceeded quota. YouTube resets quota daily (midnight PT).")
  console.error("        Options: wait for reset, or add new API keys from new GCP projects.")
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
