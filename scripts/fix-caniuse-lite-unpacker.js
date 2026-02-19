#!/usr/bin/env node
/**
 * Harden caniuse-lite unpacker so it doesn't throw when packed data is null/undefined
 * (e.g. when required via Next's require-hook). Survives npm install when run in postinstall.
 */
const fs = require("fs");
const path = require("path");

const featurePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "caniuse-lite",
  "dist",
  "unpacker",
  "feature.js"
);

if (!fs.existsSync(featurePath)) process.exit(0);

let code = fs.readFileSync(featurePath, "utf8");

const guard =
  "  if (!packed || typeof packed.A !== 'object' || packed.A === null) {\n" +
  "    return { status: undefined, title: '', shown: false, stats: {} }\n" +
  "  }\n  ";

const alreadyPatched =
  code.includes("return { status: undefined, title: '', shown: false, stats: {} }") &&
  code.includes("if (!browser || typeof browser !== 'object') return browserStats");
if (alreadyPatched) process.exit(0);

// Insert guard at start of unpackFeature
if (!code.includes("return { status: undefined, title: '', shown: false, stats: {} }")) {
  code = code.replace(
    "function unpackFeature(packed) {\n  let unpacked = {",
    "function unpackFeature(packed) {\n" + guard + "let unpacked = {"
  );
}
// Guard browser in reduce
if (!code.includes("if (!browser || typeof browser !== 'object') return browserStats")) {
  code = code.replace(
    "let browser = packed.A[key]\n    browserStats[browsers[key]]",
    "let browser = packed.A[key]\n    if (!browser || typeof browser !== 'object') return browserStats\n    browserStats[browsers[key]]"
  );
}

fs.writeFileSync(featurePath, code, "utf8");
console.log("[fix-caniuse-lite-unpacker] Patched dist/unpacker/feature.js");
