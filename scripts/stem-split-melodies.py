#!/usr/bin/env python3
"""
Run Demucs 6-stem (htdemucs_6s) on the melody stem (other.wav) to get guitar and piano.
Usage: python stem-split-melodies.py <path_to_other.wav> <output_dir>
Output: output_dir/guitar.wav, output_dir/piano.wav (and other.wav from the 6-stem run).
Requires: pip install demucs (same as main stem splitter).
"""
import os
import sys
import shutil
import subprocess
import tempfile

if "SSL_CERT_FILE" not in os.environ:
    try:
        import certifi
        os.environ["SSL_CERT_FILE"] = certifi.where()
    except ImportError:
        pass


def main():
    if len(sys.argv) != 3:
        print("Usage: python stem-split-melodies.py <input_path> <output_dir>", file=sys.stderr)
        sys.exit(1)
    input_path = os.path.abspath(sys.argv[1])
    output_dir = os.path.abspath(sys.argv[2])
    if not os.path.isfile(input_path):
        print(f"Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    melodies_dir = os.path.join(output_dir, "melodies-sep")
    os.makedirs(melodies_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        cmd = [
            sys.executable, "-m", "demucs",
            "-n", "htdemucs_6s",
            "-o", tmp,
            input_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(result.stderr or result.stdout, file=sys.stderr)
            sys.exit(result.returncode)
        htdemucs_dir = os.path.join(tmp, "htdemucs_6s")
        if not os.path.isdir(htdemucs_dir):
            print(f"Expected subdir htdemucs_6s not found in {tmp}", file=sys.stderr)
            sys.exit(1)
        track_dir = None
        for name in os.listdir(htdemucs_dir):
            p = os.path.join(htdemucs_dir, name)
            if os.path.isdir(p) and os.path.isfile(os.path.join(p, "guitar.wav")):
                track_dir = p
                break
        if not track_dir:
            print("Could not find 6-stem outputs in htdemucs_6s subdir", file=sys.stderr)
            sys.exit(1)
        for stem in ("guitar", "piano", "other"):
            src = os.path.join(track_dir, f"{stem}.wav")
            dst = os.path.join(melodies_dir, f"{stem}.wav")
            if os.path.isfile(src):
                shutil.copy2(src, dst)
    print("ok")


if __name__ == "__main__":
    main()
