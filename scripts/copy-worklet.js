// Copy SoundTouch worklet to public so Next can serve it (addModule from same origin).
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "../node_modules/@soundtouchjs/audio-worklet/dist/soundtouch-worklet.js");
const destDir = path.join(__dirname, "../public/worklets");
const dest = path.join(destDir, "soundtouch-worklet.js");

try {
  if (!fs.existsSync(src)) {
    console.warn("[copy-worklet] Package not installed, skipping copy. Run npm install.");
    process.exit(0);
  }
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  // Patch for smoother time-stretch (larger sequence/seek/overlap = less grain)
  let code = fs.readFileSync(dest, "utf8");
  let patched = code.replace(
    /_this3\.setParameters\(44100,\s*DEFAULT_SEQUENCE_MS,\s*DEFAULT_SEEKWINDOW_MS,\s*DEFAULT_OVERLAP_MS\)/,
    "_this3.setParameters(44100, 100, 35, 15)"
  );
  if (patched !== code) {
    fs.writeFileSync(dest, patched);
    console.log("[copy-worklet] Applied quality patch (100/35/15 ms)");
  }
  console.log("[copy-worklet] Copied soundtouch-worklet.js to public/worklets/");
} catch (err) {
  console.warn("[copy-worklet] Failed:", err.message);
  process.exit(0);
}
