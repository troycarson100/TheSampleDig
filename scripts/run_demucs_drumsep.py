#!/usr/bin/env python3
"""
Run demucs with DrumSep model (49469ca8), patching torch.load so the checkpoint
loads under PyTorch 2.6+ (weights_only=True would block the model class).
Usage: run_demucs_drumsep.py <same args as demucs>, e.g.:
  --repo model -o /tmp/out -n 49469ca8 /path/to/drums.wav
Run from the drumsep repo root so --repo model resolves to ./model.
"""
import sys

# Patch torch.load before demucs is imported
import torch
_orig_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _orig_load(*args, **kwargs)
torch.load = _patched_load

# Now run demucs separate
from demucs.separate import main
main()
