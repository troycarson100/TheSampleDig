#!/bin/bash
# Start the dev server with Node 20 (required for Next.js 16).
# Run from project root:  bash scripts/start-dev.sh

set -e
cd "$(dirname "$0")/.."

# Free port 3000 if something is stuck on it (e.g. old Next.js)
if lsof -ti :3000 >/dev/null 2>&1; then
  echo "Killing process on port 3000 so we can start fresh..."
  lsof -ti :3000 | xargs kill -9 2>/dev/null || true
  sleep 2
fi

# Use Node 20 if available (nvm)
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  . "$NVM_DIR/nvm.sh"
  nvm use 20 2>/dev/null || nvm use default
fi

echo "Node: $(node -v)"
echo "Starting dev server at http://localhost:3000 ..."
exec npm run dev
