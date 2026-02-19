#!/usr/bin/env node
/**
 * Ensures Next.js compiled package.json files have a "version" field and valid format.
 * Node 22's native package_json_reader can throw ERR_INVALID_PACKAGE_CONFIG for
 * minimal package.json files (e.g. next/dist/compiled/semver, client-only).
 * Adding "version" and normalizing the file often fixes this.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const compiledDir = path.join(root, "node_modules", "next", "dist", "compiled");

if (!fs.existsSync(compiledDir)) {
  process.exit(0);
}

let fixed = 0;
function fixPackageJson(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      fixPackageJson(full);
      continue;
    }
    if (e.name !== "package.json") continue;
    try {
      const raw = fs.readFileSync(full, "utf8");
      const data = JSON.parse(raw);
      if (data.version != null) continue;
      data.version = "0.0.0";
      const normalized = JSON.stringify(data) + "\n";
      fs.writeFileSync(full, normalized, "utf8");
      fixed++;
      console.log("[fix-next-compiled-package-json] Added version to", path.relative(root, full));
    } catch (err) {
      console.warn("[fix-next-compiled-package-json] Skip", path.relative(root, full), err.message);
    }
  }
}

fixPackageJson(compiledDir);

// Also fix client-only (used by styled-jsx) - ensure valid exports for Node 22
const clientOnlyPkg = path.join(root, "node_modules", "client-only", "package.json");
if (fs.existsSync(clientOnlyPkg)) {
  try {
    const raw = fs.readFileSync(clientOnlyPkg, "utf8");
    const data = JSON.parse(raw);
    const out = JSON.stringify(data) + "\n";
    if (!raw.endsWith("\n")) {
      fs.writeFileSync(clientOnlyPkg, out, "utf8");
      console.log("[fix-next-compiled-package-json] Normalized client-only/package.json");
    }
  } catch (e) {
    console.warn("[fix-next-compiled-package-json] Skip client-only", e.message);
  }
}

if (fixed > 0) {
  console.log("[fix-next-compiled-package-json] Fixed", fixed, "package.json file(s) for Node 22.");
}
