#!/usr/bin/env node
/**
 * Ensures node-releases JSON files are valid and properly formatted.
 * Fixes "Unexpected end of JSON input" errors in Turbopack/build when
 * these files are read by browserslist.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const nodeReleases = path.join(root, 'node_modules', 'node-releases', 'data');

const files = [
  path.join(nodeReleases, 'processed', 'envs.json'),
  path.join(nodeReleases, 'release-schedule', 'release-schedule.json'),
];

for (const file of files) {
  try {
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    const normalized = JSON.stringify(data) + '\n';
    if (Buffer.byteLength(normalized, 'utf8') !== Buffer.byteLength(raw, 'utf8') || !raw.endsWith('\n')) {
      fs.writeFileSync(file, normalized, 'utf8');
      console.log('[fix-node-releases-json] Normalized', path.relative(root, file));
    }
  } catch (e) {
    console.warn('[fix-node-releases-json] Skip', path.relative(root, file), e.message);
  }
}
