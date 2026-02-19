#!/usr/bin/env node
/**
 * Start the Next.js dev server after clearing port 3000.
 * Kills any process on port 3000, waits for the OS to release it, then runs next dev.
 */
const { execSync, spawn } = require("child_process")
const path = require("path")
const fs = require("fs")

const PORT = 3000
const WAIT_MS = 5000
const MAX_PORT_WAIT_MS = 15000
const rootDir = path.join(__dirname, "..")
const devLockPath = path.join(rootDir, ".next", "dev", "lock")

// Next.js 16 does not run reliably on Node 22 (ERR_INVALID_PACKAGE_CONFIG, etc). Use Node 20.
const nodeMajor = parseInt(process.versions.node.split(".")[0], 10)
const NODE20_PATHS = [
  "/opt/homebrew/opt/node@20/bin/node",
  "/usr/local/opt/node@20/bin/node",
]
function getNodeBinary() {
  if (nodeMajor < 22) return process.execPath
  for (const p of NODE20_PATHS) {
    try {
      if (fs.existsSync(p)) {
        console.log("[start-dev] Using Node 20 at", p, "(current is Node " + process.versions.node + ")")
        return p
      }
    } catch (_) {}
  }
  console.warn(
    "[start-dev] Node " + process.versions.node + " may crash. Install Node 20: brew install node@20 (then re-run npm run dev)"
  )
  return process.execPath
}
const nodeBinary = getNodeBinary()

function killPort(port) {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8" })
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    if (pids.length > 0) {
      console.log(`[start-dev] Killing process(es) on port ${port}: ${pids.join(", ")}`)
      execSync(`kill -9 ${pids.join(" ")}`, { stdio: "inherit" })
    }
  } catch (e) {
    if (e.status !== 1) throw e
    // lsof exits 1 when no matching process; that's fine
  }
}

function isPortFree(port) {
  try {
    execSync(`lsof -ti :${port}`, { encoding: "utf8" })
    return false
  } catch (e) {
    return e.status === 1
  }
}

killPort(PORT)
try {
  if (fs.existsSync(devLockPath)) {
    fs.unlinkSync(devLockPath)
    console.log("[start-dev] Removed stale .next/dev/lock")
  }
} catch (e) {
  // ignore
}

function waitForPortThenStart() {
  const start = Date.now()
  function check() {
    if (isPortFree(PORT)) {
      console.log("[start-dev] Port", PORT, "is free, starting Next.js...")
      // Run next via node to avoid ENOEXEC when project path has spaces or .bin/next isn't executable
      const nextCli = path.join(rootDir, "node_modules", "next", "dist", "bin", "next")
      const child = spawn(
        nodeBinary,
        [nextCli, "dev", "-p", String(PORT), "-H", "127.0.0.1", "--webpack"],
        { stdio: "inherit", cwd: rootDir, env: { ...process.env, FORCE_COLOR: "1" } }
      )
      child.on("exit", (code) => process.exit(code != null ? code : 0))
      return
    }
    if (Date.now() - start >= MAX_PORT_WAIT_MS) {
      console.error("[start-dev] Port", PORT, "still in use after", MAX_PORT_WAIT_MS / 1000, "s. Run: npm run dev:3001 (port 3001) or npm run dev:direct (after killing the process on 3000)")
      process.exit(1)
    }
    setTimeout(check, 500)
  }
  console.log("[start-dev] Waiting for port", PORT, "to be released...")
  setTimeout(check, WAIT_MS)
}

waitForPortThenStart()
