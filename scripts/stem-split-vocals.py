#!/usr/bin/env python3
"""
Run lead/backing vocal separation on the vocals stem using audio-separator
(MelBand Roformer Karaoke model). Outputs lead.wav and backing.wav to vocals-sep/.
Usage: python stem-split-vocals.py <path_to_vocals.wav> <output_dir>
Requires: pip install "audio-separator[cpu]" (or [gpu]). First run may download the model.
"""
import os
import sys
import shutil
import wave
import struct
import tempfile

# Optional: pad short audio to avoid model tensor size errors (many models need ~10s+)
MIN_DURATION_SEC = 10.0
TARGET_SR = 44100


def pad_audio_if_needed(wav_path: str, out_path: str) -> str:
    """If wav is shorter than MIN_DURATION_SEC, pad with silence and return path to use."""
    with wave.open(wav_path, "rb") as w:
        nch = w.getnchannels()
        sampw = w.getsampwidth()
        sr = w.getframerate()
        nframes = w.getnframes()
    duration = nframes / float(sr) if sr else 0
    if duration >= MIN_DURATION_SEC:
        return wav_path
    need_frames = int(MIN_DURATION_SEC * sr) - nframes
    if need_frames <= 0:
        return wav_path
    with wave.open(wav_path, "rb") as r:
        data = r.readframes(nframes)
    with wave.open(out_path, "wb") as w:
        w.setnchannels(nch)
        w.setsampwidth(sampw)
        w.setframerate(sr)
        w.writeframes(data)
        pad = b"\x00" * (need_frames * nch * sampw)
        w.writeframes(pad)
    return out_path


def main():
    if len(sys.argv) != 3:
        print("Usage: python stem-split-vocals.py <path_to_vocals.wav> <output_dir>", file=sys.stderr)
        sys.exit(1)
    input_path = os.path.abspath(sys.argv[1])
    output_dir = os.path.abspath(sys.argv[2])
    if not os.path.isfile(input_path):
        print(f"Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    vocals_sep_dir = os.path.join(output_dir, "vocals-sep")
    os.makedirs(vocals_sep_dir, exist_ok=True)
    try:
        from audio_separator.separator import Separator
    except ImportError:
        print(
            "audio-separator not installed. Install with: pip install \"audio-separator[cpu]\" (see STEM-SPLITTER-SETUP.md)",
            file=sys.stderr,
        )
        sys.exit(1)
    with tempfile.TemporaryDirectory() as tmp:
        to_process = input_path
        padded = os.path.join(tmp, "padded.wav")
        try:
            to_process = pad_audio_if_needed(input_path, padded)
        except Exception as e:
            print(f"Warning: could not pad audio: {e}", file=sys.stderr)
        sep_out = os.path.join(tmp, "sep")
        os.makedirs(sep_out, exist_ok=True)
        separator = Separator(
            model_file_dir=os.environ.get("AUDIO_SEPARATOR_MODEL_DIR", "/tmp/audio-separator-models"),
            output_dir=sep_out,
            output_format="WAV",
        )
        try:
            separator.load_model(model_filename="mel_band_roformer_karaoke_becruily.ckpt")
        except Exception as e:
            print(f"Failed to load model: {e}", file=sys.stderr)
            sys.exit(1)
        try:
            output_files = separator.separate(to_process)
        except Exception as e:
            print(f"Separation failed: {e}", file=sys.stderr)
            sys.exit(1)
        if not output_files:
            print("No output files produced", file=sys.stderr)
            sys.exit(1)
        # separate() returns filenames; full paths are under sep_out
        output_files = [os.path.join(sep_out, f) if not os.path.isabs(f) else f for f in output_files]
        output_files = [f for f in output_files if os.path.isfile(f)]
        lead_path = os.path.join(vocals_sep_dir, "lead.wav")
        backing_path = os.path.join(vocals_sep_dir, "backing.wav")
        for f in output_files:
            base = os.path.basename(f).lower()
            if "(vocals)" in base or "vocal" in base:
                shutil.copy2(f, lead_path)
            elif "(instrumental)" in base or "(other)" in base or "instrumental" in base:
                shutil.copy2(f, backing_path)
        # Guarantee both files exist so the API always returns two stems
        if not os.path.isfile(lead_path) and output_files:
            shutil.copy2(output_files[0], lead_path)
        if not os.path.isfile(backing_path) and len(output_files) >= 2:
            shutil.copy2(output_files[1], backing_path)
        elif not os.path.isfile(backing_path) and output_files:
            shutil.copy2(output_files[0], backing_path)
    # Ensure both outputs exist for API contract
    if not os.path.isfile(lead_path) and os.path.isfile(backing_path):
        shutil.copy2(backing_path, lead_path)
    if not os.path.isfile(backing_path) and os.path.isfile(lead_path):
        shutil.copy2(lead_path, backing_path)
    print("ok")


if __name__ == "__main__":
    main()
