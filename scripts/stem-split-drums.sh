#!/usr/bin/env bash
# Run DrumSep on a drums.wav file and normalize outputs to kick, snare, cymbals, toms.
# Usage: stem-split-drums.sh <path_to_drums.wav> <output_dir>
# Requires: DrumSep installed (clone github.com/inagoy/drumsep, run bash drumsepInstall).
# Set DRUMSEP_DIR to the drumsep repo root if not in a fixed location.

set -e
if [ $# -ne 2 ]; then
  echo "Usage: $0 <path_to_drums.wav> <output_dir>" >&2
  exit 1
fi
INPUT_PATH="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
OUTPUT_DIR="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
DRUMSEP_DIR="${DRUMSEP_DIR:-}"
if [ -z "$DRUMSEP_DIR" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  DRUMSEP_DIR="${SCRIPT_DIR}/../drumsep"
fi
if [ ! -f "${DRUMSEP_DIR}/drumsep" ]; then
  echo "DrumSep not found at ${DRUMSEP_DIR}. Clone github.com/inagoy/drumsep and run: bash drumsepInstall. Set DRUMSEP_DIR if installed elsewhere." >&2
  exit 1
fi
TMP_OUT="$(mktemp -d)"
trap "rm -rf \"$TMP_OUT\"" EXIT
# Use project script so torch.load works with DrumSep model on PyTorch 2.6+
RUN_DEMUCS="${SCRIPT_DIR}/run_demucs_drumsep.py"
if [ -f "$RUN_DEMUCS" ]; then
  (cd "$DRUMSEP_DIR" && python3 "$RUN_DEMUCS" --repo model -o "$TMP_OUT" -n 49469ca8 "$INPUT_PATH")
else
  (cd "$DRUMSEP_DIR" && bash drumsep "$INPUT_PATH" "$TMP_OUT")
fi
# Demucs writes to TMP_OUT/49469ca8/<basename>/*.wav
MODEL_DIR="$TMP_OUT/49469ca8"
if [ ! -d "$MODEL_DIR" ]; then
  echo "DrumSep output dir 49469ca8 not found in $TMP_OUT" >&2
  exit 1
fi
TRACK_DIR=""
for d in "$MODEL_DIR"/*; do
  if [ -d "$d" ] && [ -f "$d/bombo.wav" ] 2>/dev/null; then
    TRACK_DIR="$d"
    break
  fi
  if [ -d "$d" ] && [ -f "$d/kick.wav" ] 2>/dev/null; then
    TRACK_DIR="$d"
    break
  fi
done
if [ -z "$TRACK_DIR" ]; then
  TRACK_DIR="$(ls -d "$MODEL_DIR"/*/ 2>/dev/null | head -n1)"
fi
if [ -z "$TRACK_DIR" ] || [ ! -d "$TRACK_DIR" ]; then
  echo "Could not find DrumSep track output under $MODEL_DIR" >&2
  exit 1
fi
mkdir -p "$OUTPUT_DIR/drums-sep"
# Map DrumSep names to our names (Bombo->kick, Redoblante->snare, Platillos->cymbals, Toms->toms)
for wav in "$TRACK_DIR"/*.wav; do
  [ -f "$wav" ] || continue
  base="$(basename "$wav" .wav | tr '[:upper:]' '[:lower:]')"
  case "$base" in
    bombo|kick) cp "$wav" "$OUTPUT_DIR/drums-sep/kick.wav" ;;
    redoblante|snare) cp "$wav" "$OUTPUT_DIR/drums-sep/snare.wav" ;;
    platillos|cymbals) cp "$wav" "$OUTPUT_DIR/drums-sep/cymbals.wav" ;;
    toms) cp "$wav" "$OUTPUT_DIR/drums-sep/toms.wav" ;;
  esac
done
# Ensure all four stems exist so the API and playback never 404 or go silent (copy first available to missing)
FILL_SRC=""
for stem in kick snare cymbals toms; do
  if [ -f "$OUTPUT_DIR/drums-sep/$stem.wav" ]; then
    FILL_SRC="$OUTPUT_DIR/drums-sep/$stem.wav"
    break
  fi
done
for stem in kick snare cymbals toms; do
  if [ ! -f "$OUTPUT_DIR/drums-sep/$stem.wav" ] && [ -n "$FILL_SRC" ]; then
    cp "$FILL_SRC" "$OUTPUT_DIR/drums-sep/$stem.wav"
  fi
done
echo "ok"
