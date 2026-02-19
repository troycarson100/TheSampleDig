#!/bin/bash
# Kill anything on 3000, start dev server, then open browser after delay.
# Does NOT clear .next — clearing it causes 500s until the first compile finishes.
# For a clean restart when needed: rm -rf .next && npm run dev
cd "$(dirname "$0")/.."
echo "Cleaning port 3000..."
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 2
echo "Starting Next.js (wait for 'Ready' in this terminal)..."
echo "Browser will open in 20 seconds at http://127.0.0.1:3000"
(sleep 20 && open "http://127.0.0.1:3000") &
npm run dev
