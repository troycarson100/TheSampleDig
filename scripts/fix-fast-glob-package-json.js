#!/usr/bin/env node
/**
 * Normalize all package.json under tailwindcss/node_modules so Node's package_json_reader
 * can parse them (avoids "Unexpected end of JSON input" during Next.js compile).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const tailwindNodeModules = path.join(root, "node_modules", "tailwindcss", "node_modules");

if (!fs.existsSync(tailwindNodeModules)) process.exit(0);

let fixed = 0;
function normalizePackageJson(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      normalizePackageJson(full);
      const pkgPath = path.join(full, "package.json");
      if (fs.existsSync(pkgPath)) {
        try {
          const raw = fs.readFileSync(pkgPath, "utf8");
          const data = JSON.parse(raw);
          const normalized = JSON.stringify(data, null, 2) + "\n";
          if (normalized !== raw) {
            fs.writeFileSync(pkgPath, normalized, "utf8");
            fixed++;
            console.log("[fix-fast-glob-package-json] Normalized", path.relative(root, pkgPath));
          }
        } catch (err) {
          console.warn("[fix-fast-glob-package-json] Skip", path.relative(root, pkgPath), err.message);
        }
      }
      continue;
    }
  }
}
normalizePackageJson(tailwindNodeModules);
if (fixed > 0) {
  console.log("[fix-fast-glob-package-json] Normalized", fixed, "package.json file(s) under tailwindcss/node_modules");
}
