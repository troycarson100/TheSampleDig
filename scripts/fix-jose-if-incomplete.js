#!/usr/bin/env node
/**
 * If jose (next-auth dependency) was installed incomplete (missing jwe/compact/decrypt.js),
 * remove jose + @auth/core + next-auth and reinstall so npm fetches a complete copy.
 * Prevents "Module not found: Can't resolve './jwe/compact/decrypt.js'" after npm install.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const joseDecryptPath = path.join(
  root,
  "node_modules",
  "jose",
  "dist",
  "webapi",
  "jwe",
  "compact",
  "decrypt.js"
);

if (fs.existsSync(joseDecryptPath)) {
  process.exit(0);
}

const nodeModules = path.join(root, "node_modules");
const dirsToRemove = ["jose", "next-auth", "@auth/core"].map((d) =>
  path.join(nodeModules, d)
);

let removed = false;
for (const dir of dirsToRemove) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    removed = true;
    console.log("[fix-jose-if-incomplete] Removed", path.relative(root, dir));
  }
}

if (removed) {
  console.log("[fix-jose-if-incomplete] Reinstalling next-auth to get complete jose...");
  execSync("npm install", { cwd: root, stdio: "inherit" });
}
