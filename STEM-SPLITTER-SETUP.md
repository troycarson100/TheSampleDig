# Stem Splitter setup

The Stem Splitter feature uses [Demucs](https://github.com/facebookresearch/demucs) to separate audio into four stems (vocals, drums, bass, other). The Next.js API spawns a Python script that runs Demucs; Python and Demucs must be installed on the machine where the app runs.

## Prerequisites

- **Python 3.8–3.12** recommended. Python 3.13 may work but PyTorch/Demucs sometimes lag on the newest version; if `pip install demucs` fails, use 3.10–3.12.
- The Stem Splitter does **not** run on serverless (e.g. Vercel); it needs a server or local process where you can run Python and the Demucs model.

## Install

Install Demucs for the **same** Python that will be used when the app runs (the one on your PATH when you start the dev server, or the one set in `PYTHON`):

```bash
python3 -m pip install -r requirements-stem.txt
```

Or with an explicit path to your Python:

```bash
/path/to/python3 -m pip install -r requirements-stem.txt
```

Demucs will download the `htdemucs` model on first use (one-time, large download).

## Optional: virtualenv and PYTHON

To keep stem dependencies isolated and to pin a specific Python version:

1. Create a virtualenv (e.g. Python 3.11):

   ```bash
   python3.11 -m venv .venv-stem
   .venv-stem/bin/pip install -r requirements-stem.txt
   ```

2. Run the app with that interpreter used for stem splitting:

   ```bash
   PYTHON=.venv-stem/bin/python npm run dev
   ```

3. `.venv-stem` is in `.gitignore` so the venv is not committed.

The API reads `process.env.PYTHON`; if set, it uses that path instead of `python3`.

## First run

No extra step. The first time you split a track, Demucs will download the model; subsequent runs use the cached model.

**macOS / Python.org:** If you see `SSL: CERTIFICATE_VERIFY_FAILED` when the model downloads, the stem-split script uses the `certifi` package so HTTPS works without installing the "Install Certificates.command" from the Python installer. Ensure `certifi` is installed (`pip install -r requirements-stem.txt`).

## BPM and key

After splitting, the app can show detected **BPM** and **musical key** for the track. This uses the same analysis as the rest of the site (Python + librosa). If you don’t have `librosa` installed (`pip install librosa numpy`), or analysis times out, the UI will show "— BPM" and "Key: —". Stem splitting still works; BPM/key are optional.

## Optional: More Stems (DrumSep, Melodies)

After splitting into four stems, you can run **More Stems** to sub-separate:

- **Separate Drums** — uses [DrumSep](https://github.com/inagoy/drumsep) to split the drums stem into kick, snare, cymbals, and toms.
- **Separate Melodies** — uses Demucs 6-stem (`htdemucs_6s`) on the melody stem to get guitar, piano, and other. No extra install beyond Demucs.
- **Separate Vocals** — uses [audio-separator](https://github.com/karaokenerds/python-audio-separator) (MelBand Roformer Karaoke model) to split the vocals stem into lead and backing vocals. Requires `audio-separator` (see below).

### DrumSep install (for Separate Drums)

1. Clone the repo next to your project (or set `DRUMSEP_DIR` to point to it):

   ```bash
   cd /path/to/your/project
   git clone https://github.com/inagoy/drumsep.git
   cd drumsep
   bash drumsepInstall
   ```

2. The app looks for DrumSep at `drumsep/` in the project root by default. If you installed it elsewhere, set `DRUMSEP_DIR` environment variable when starting the app:

   ```bash
   DRUMSEP_DIR=/path/to/drumsep npm run dev
   ```

If DrumSep is not installed, choosing **Separate Drums** in the UI will return a clear error; stem splitting and **Separate Melodies** still work.

### Lead/Backing Vocals install (for Separate Vocals)

Install [audio-separator](https://github.com/karaokenerds/python-audio-separator) for the same Python used by the app (e.g. the one in `PYTHON` or `python3`):

```bash
python3 -m pip install "audio-separator[cpu]"
```

For Apple Silicon (M1/M2) with CoreML acceleration, the `[cpu]` extra is sufficient. For Nvidia GPU use `"audio-separator[gpu]"` and ensure CUDA is set up.

The first time you run **Separate Vocals**, the MelBand Roformer Karaoke model (~1.7GB) will be downloaded. Audio under about 10 seconds is padded automatically; very short clips may still fail with some models.

## Deploy

The Stem Splitter needs a server with Python and Demucs installed (not a serverless function). For example:

- Run the app on a VPS or VM, install Python and `pip install -r requirements-stem.txt`, and set `PYTHON` if you use a venv.
- Ensure the process that runs the Next.js app (e.g. `npm run start` or `node .next/standalone/server.js`) has access to the same Python and that Demucs is installed for that Python.
- For **Separate Drums**, install DrumSep as above and set `DRUMSEP_DIR` if needed.
