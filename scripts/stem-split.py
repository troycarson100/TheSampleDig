#!/usr/bin/env python3
"""
Run Demucs to split an audio file into 4 stems: vocals, drums, bass, other.
Usage: python stem-split.py <input_path> <output_dir>
Output: output_dir/htdemucs/<basename>/vocals.wav, drums.wav, bass.wav, other.wav
Then copies those to output_dir/vocals.wav, etc. for easy serving.
Requires: pip install demucs
"""
# Use certifi's CA bundle for HTTPS (avoids SSL errors on macOS with Python.org build)
import os
if "SSL_CERT_FILE" not in os.environ:
    try:
        import certifi
        os.environ["SSL_CERT_FILE"] = certifi.where()
    except ImportError:
        pass

import sys
import shutil
import subprocess


def main():
    if len(sys.argv) != 3:
        print("Usage: python stem-split.py <input_path> <output_dir>", file=sys.stderr)
        sys.exit(1)
    input_path = os.path.abspath(sys.argv[1])
    output_dir = os.path.abspath(sys.argv[2])
    if not os.path.isfile(input_path):
        print(f"Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    os.makedirs(output_dir, exist_ok=True)
    # Run demucs: -n htdemucs (4 stems), -o output_dir, input_path
    # Output: output_dir/htdemucs/<track_name>/vocals.wav, drums.wav, bass.wav, other.wav
    cmd = [
        sys.executable, "-m", "demucs",
        "-n", "htdemucs",
        "-o", output_dir,
        input_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr or result.stdout, file=sys.stderr)
        sys.exit(result.returncode)
    # Demucs creates output_dir/htdemucs/<basename>/...
    basename = os.path.splitext(os.path.basename(input_path))[0]
    # Handle spaces in basename - demucs may replace with underscores
    htdemucs_dir = os.path.join(output_dir, "htdemucs")
    if not os.path.isdir(htdemucs_dir):
        print(f"Expected subdir htdemucs not found in {output_dir}", file=sys.stderr)
        sys.exit(1)
    # Find the track folder (may be basename or with underscores)
    track_dir = None
    for name in os.listdir(htdemucs_dir):
        p = os.path.join(htdemucs_dir, name)
        if os.path.isdir(p) and os.path.isfile(os.path.join(p, "vocals.wav")):
            track_dir = p
            break
    if not track_dir:
        print("Could not find stem outputs in htdemucs subdir", file=sys.stderr)
        sys.exit(1)
    # Copy stems to output_dir for flat serving
    for stem in ("vocals", "drums", "bass", "other"):
        src = os.path.join(track_dir, f"{stem}.wav")
        dst = os.path.join(output_dir, f"{stem}.wav")
        if os.path.isfile(src):
            shutil.copy2(src, dst)
    print("ok")


if __name__ == "__main__":
    main()
