#!/usr/bin/env node
/**
 * Unified populate script with mode-aware routing.
 * Default: channels first (1 unit/50 videos), then playlists, then search (100 units/page).
 *
 * Usage: node scripts/populate.js [--mode=channels|playlists|search] [secret]
 * Env: POPULATE_SECRET, NEXTAUTH_URL or BASE_URL
 *      MODE - channels | playlists | search (default: channels)
 *      When mode=channels: uses discover-from-channels (seed from Sample)
 *      When mode=playlists: uses collect-10k-videos (candidate pipeline)
 *      When mode=search: uses populate-until-10k (search API)
 */
"use strict"

require("dotenv").config()

const args = process.argv.slice(2)
let mode = process.env.MODE || "channels"
const secretArg = args.find((a) => !a.startsWith("--mode="))
const modeArg = args.find((a) => a.startsWith("--mode="))
if (modeArg) {
  mode = modeArg.split("=")[1] || mode
}

const validModes = ["channels", "playlists", "search"]
if (!validModes.includes(mode)) {
  console.error("[Populate] Invalid mode:", mode, "| Use: channels | playlists | search")
  process.exit(1)
}

console.log("[Populate] Mode:", mode)

async function main() {
  const { spawn } = require("child_process")
  const scriptMap = {
    channels: "scripts/discover-from-channels.js",
    playlists: "scripts/collect-10k-videos.js",
    search: "scripts/populate-until-10k.js",
  }
  const script = scriptMap[mode]
  const proc = spawn("node", [script, ...(secretArg ? [secretArg] : [])], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, MODE: mode },
  })
  proc.on("close", (code) => process.exit(code ?? 0))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
