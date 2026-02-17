#!/usr/bin/env bash
# Run BPM/key backfill daily (e.g. after Google CSE quota resets).
# Logs to logs/backfill-bpm-key.log in the project root.
#
# To run every day at 8:00 AM UTC (midnight Pacific):
#   crontab -e
#   Add: 0 8 * * * /Users/troycarson/Documents/Cursor\ Projects/thesampledig/scripts/run-backfill-bpm-key-daily.sh
#
# Or at 1:00 AM your local time (adjust the hour):
#   0 1 * * * /full/path/to/scripts/run-backfill-bpm-key-daily.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/backfill-bpm-key.log"

mkdir -p "$LOG_DIR"
cd "$PROJECT_ROOT"
echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] Starting daily BPM/key backfill" >> "$LOG_FILE"
npm run backfill-bpm-key >> "$LOG_FILE" 2>&1
echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] Finished" >> "$LOG_FILE"
