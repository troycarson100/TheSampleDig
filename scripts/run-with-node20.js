#!/usr/bin/env node
/**
 * Run Next.js dev server with Node 20 (avoids Node 22 issues).
 * Use: npm run dev:node20
 * If Node 20 is not installed: brew install node@20
 */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const rootDir = path.join(__dirname, "..");
const NODE20_PATHS = [
  "/opt/homebrew/opt/node@20/bin/node",
  "/usr/local/opt/node@20/bin/node",
];

let node20 = process.env.NODE20_PATH;
if (!node20) {
  for (const p of NODE20_PATHS) {
    if (fs.existsSync(p)) {
      node20 = p;
      break;
    }
  }
}

if (!node20) {
  console.error(
    "[run-with-node20] Node 20 not found. Install with: brew install node@20\n" +
      "Then run: npm run dev:node20"
  );
  process.exit(1);
}

const nextCli = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const child = spawn(node20, [nextCli, "dev", "-p", "3000", "-H", "127.0.0.1", "--webpack"], {
  stdio: "inherit",
  cwd: rootDir,
});
child.on("exit", (code) => process.exit(code != null ? code : 0));
