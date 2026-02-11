#!/usr/bin/env python3
"""
Run Demucs 6-stem (htdemucs_6s) to get guitar, piano, and other stems.
A second-pass refinement runs Demucs again on the initial "other" stem,
extracts guitar that wrongly landed there, merges it into the main guitar stem,
and subtracts it from other so more guitar appears in Guitar and less in Other.
Usage: python stem-split-melodies.py <path_to_audio> <output_dir>
Input: Prefer the original full mix (e.g. input.mp3) so the model gets the full song;
  fallback to other.wav (melody stem) if no full mix is available.
Output: output_dir/melodies-sep/guitar.wav, piano.wav, other.wav.
Requires: pip install demucs (same as main stem splitter).
"""
import os
import sys
import shutil
import struct
import subprocess
import tempfile
import wave

if "SSL_CERT_FILE" not in os.environ:
    try:
        import certifi
        os.environ["SSL_CERT_FILE"] = certifi.where()
    except ImportError:
        pass


def _load_wav_samples(path):
    """Load 16-bit PCM WAV as (nchannels, sample_rate, samples list)."""
    with wave.open(path, "rb") as w:
        nch = w.getnchannels()
        sr = w.getframerate()
        sampw = w.getsampwidth()
        nframes = w.getnframes()
        if sampw != 2:
            raise ValueError(f"Unsupported sample width {sampw}")
        data = w.readframes(nframes)
    n = len(data) // 2
    samples = list(struct.unpack("<" + "h" * n, data))
    return (nch, sr, samples)


def _write_wav_samples(path, nch, sr, samples):
    """Write 16-bit PCM WAV from samples list."""
    data = struct.pack("<" + "h" * len(samples), *samples)
    with wave.open(path, "wb") as w:
        w.setnchannels(nch)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(data)


def _normalize_16bit(samples):
    """Scale samples so max absolute value is 32767; clamp to int16 range."""
    if not samples:
        return samples
    max_abs = max(abs(s) for s in samples)
    if max_abs <= 0:
        return samples
    scale = 32767.0 / max_abs
    return [max(-32768, min(32767, int(round(s * scale)))) for s in samples]


def main():
    if len(sys.argv) != 3:
        print("Usage: python stem-split-melodies.py <input_path> <output_dir>", file=sys.stderr)
        sys.exit(1)
    input_path = os.path.abspath(sys.argv[1])
    output_dir = os.path.abspath(sys.argv[2])
    if not os.path.isfile(input_path):
        print(f"Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    shifts = os.environ.get("DEMUCS_SHIFTS", "2").strip() or "2"
    overlap = os.environ.get("DEMUCS_OVERLAP", "0.25").strip() or "0.25"
    melodies_dir = os.path.join(output_dir, "melodies-sep")
    os.makedirs(melodies_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        cmd = [
            sys.executable, "-m", "demucs",
            "-n", "htdemucs_6s",
            "--overlap", overlap,
            "--shifts", shifts,
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
        # Second-pass refinement: pull guitar out of "other" into "guitar"
        try:
            other_path = os.path.join(melodies_dir, "other.wav")
            guitar_path = os.path.join(melodies_dir, "guitar.wav")
            if not os.path.isfile(other_path) or not os.path.isfile(guitar_path):
                pass
            else:
                with tempfile.TemporaryDirectory() as tmp2:
                    cmd2 = [
                        sys.executable, "-m", "demucs",
                        "-n", "htdemucs_6s",
                        "--overlap", overlap,
                        "--shifts", shifts,
                        "-o", tmp2,
                        other_path,
                    ]
                    result2 = subprocess.run(cmd2, capture_output=True, text=True)
                    if result2.returncode != 0:
                        print("Warning: guitar refinement skipped (second demucs run failed)", file=sys.stderr)
                    else:
                        htdemucs_dir2 = os.path.join(tmp2, "htdemucs_6s")
                        track_dir2 = None
                        if os.path.isdir(htdemucs_dir2):
                            for name in os.listdir(htdemucs_dir2):
                                p = os.path.join(htdemucs_dir2, name)
                                if os.path.isdir(p) and os.path.isfile(os.path.join(p, "guitar.wav")):
                                    track_dir2 = p
                                    break
                        if track_dir2:
                            guitar2_path = os.path.join(track_dir2, "guitar.wav")
                            nch1, sr1, g1 = _load_wav_samples(guitar_path)
                            nch2, sr2, o1 = _load_wav_samples(other_path)
                            nch3, sr3, g2 = _load_wav_samples(guitar2_path)
                            if (nch1, sr1) == (nch2, sr2) == (nch3, sr3):
                                min_len = min(len(g1), len(o1), len(g2))
                                g1 = g1[:min_len]
                                o1 = o1[:min_len]
                                g2 = g2[:min_len]
                                guitar_new = _normalize_16bit([a + b for a, b in zip(g1, g2)])
                                other_new = _normalize_16bit([a - b for a, b in zip(o1, g2)])
                                _write_wav_samples(guitar_path, nch1, sr1, guitar_new)
                                _write_wav_samples(other_path, nch1, sr1, other_new)
                            else:
                                print("Warning: guitar refinement skipped (format mismatch)", file=sys.stderr)
        except Exception as e:
            print(f"Warning: guitar refinement skipped: {e}", file=sys.stderr)
    # Optional: guitar cleanup — subtract leaked piano/other from guitar to reduce synth/keyboard bleed
    cleanup_enabled = os.environ.get("DEMUCS_GUITAR_CLEANUP", "").strip().lower() in ("1", "true", "yes")
    try:
        alpha = float(os.environ.get("DEMUCS_GUITAR_CLEANUP_ALPHA", "0.6"))
    except (TypeError, ValueError):
        alpha = 0.6
    if cleanup_enabled:
        guitar_path = os.path.join(melodies_dir, "guitar.wav")
        if os.path.isfile(guitar_path):
            try:
                with tempfile.TemporaryDirectory() as tmp_clean:
                    cmd_clean = [
                        sys.executable, "-m", "demucs",
                        "-n", "htdemucs_6s",
                        "--overlap", overlap,
                        "--shifts", shifts,
                        "-o", tmp_clean,
                        guitar_path,
                    ]
                    result_clean = subprocess.run(cmd_clean, capture_output=True, text=True)
                    if result_clean.returncode != 0:
                        print("Warning: guitar cleanup skipped (demucs run failed)", file=sys.stderr)
                    else:
                        htdemucs_clean = os.path.join(tmp_clean, "htdemucs_6s")
                        track_clean = None
                        if os.path.isdir(htdemucs_clean):
                            for name in os.listdir(htdemucs_clean):
                                p = os.path.join(htdemucs_clean, name)
                                if os.path.isdir(p) and os.path.isfile(os.path.join(p, "guitar.wav")):
                                    track_clean = p
                                    break
                        if track_clean:
                            nch_g, sr_g, g_orig = _load_wav_samples(guitar_path)
                            _, _, p_extra = _load_wav_samples(os.path.join(track_clean, "piano.wav"))
                            _, _, o_extra = _load_wav_samples(os.path.join(track_clean, "other.wav"))
                            min_len = min(len(g_orig), len(p_extra), len(o_extra))
                            g_orig = g_orig[:min_len]
                            p_extra = p_extra[:min_len]
                            o_extra = o_extra[:min_len]
                            # guitar_clean = guitar - alpha * (piano' + other'); clamp then normalize
                            cleaned = [
                                max(-32768, min(32767, int(round(a - alpha * (b + c)))))
                                for a, b, c in zip(g_orig, p_extra, o_extra)
                            ]
                            guitar_final = _normalize_16bit(cleaned)
                            _write_wav_samples(guitar_path, nch_g, sr_g, guitar_final)
            except Exception as e:
                print(f"Warning: guitar cleanup skipped: {e}", file=sys.stderr)
    # Ensure all three melody stems exist so the API never 404s (copy first available to missing)
    melody_stems = ("guitar", "piano", "other")
    fill_src = None
    for stem in melody_stems:
        p = os.path.join(melodies_dir, f"{stem}.wav")
        if os.path.isfile(p):
            fill_src = p
            break
    for stem in melody_stems:
        p = os.path.join(melodies_dir, f"{stem}.wav")
        if not os.path.isfile(p) and fill_src:
            shutil.copy2(fill_src, p)
    print("ok")


if __name__ == "__main__":
    main()
