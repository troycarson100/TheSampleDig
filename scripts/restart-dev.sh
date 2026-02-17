#!/bin/bash
# Reinstall dependencies and start the dev server.
# Run from project root: ./scripts/restart-dev.sh
# Or: bash scripts/restart-dev.sh

set -e
cd "$(dirname "$0")/.."

# Next.js 16 has issues on Node 22; use Node 20 LTS
NODE_VER=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -n "$NODE_VER" ] && [ "$NODE_VER" -ge 22 ]; then
  echo "Node $NODE_VER detected. Next.js 16 works best with Node 20 LTS."
  echo "Run: nvm use 20   (if using nvm) or install Node 20 from nodejs.org"
  echo ""
  read -p "Continue anyway? [y/N] " -n 1 -r; echo
  if [[ ! $REPLY =~ ^[yY]$ ]]; then exit 1; fi
fi

echo "Removing node_modules..."
chmod -R u+wx node_modules 2>/dev/null || true
rm -rf node_modules
echo "Installing dependencies..."
npm install
echo "Starting dev server..."
npm run dev
