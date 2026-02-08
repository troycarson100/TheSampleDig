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

## Deploy

The Stem Splitter needs a server with Python and Demucs installed (not a serverless function). For example:

- Run the app on a VPS or VM, install Python and `pip install -r requirements-stem.txt`, and set `PYTHON` if you use a venv.
- Ensure the process that runs the Next.js app (e.g. `npm run start` or `node .next/standalone/server.js`) has access to the same Python and that Demucs is installed for that Python.
