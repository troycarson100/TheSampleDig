#!/bin/bash
# Start the dev server, then open the app in your browser.
# Run from project root:  bash scripts/run-and-open.sh

set -e
cd "$(dirname "$0")/.."

# Free port 3000
if lsof -ti :3000 >/dev/null 2>&1; then
  echo "Stopping whatever is on port 3000..."
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
echo ""
echo "Starting dev server..."
echo "  → In 25 seconds your browser will open http://localhost:3000"
echo "  → Or open it yourself: http://localhost:3000"
echo "  → Keep this window open. Press Ctrl+C to stop."
echo ""

# Open browser after 25 seconds (give Next.js time to compile)
(sleep 25 && open "http://localhost:3000" 2>/dev/null || true) &

exec npm run dev
