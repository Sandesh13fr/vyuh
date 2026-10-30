"""Generate the Vyuh narration in the user's own voice with the local vgp Chatterbox pipeline.
Run with C:/Projects_v13/vgp/voice/.venv/Scripts/python.exe. Loads the model once, writes seg-<id>.wav,
never overwrites. The reference recording stays in vgp/voice/samples and is never copied here."""
import json, os, random, sys
from pathlib import Path

VGP = Path("C:/Projects_v13/vgp")
os.environ.setdefault("HF_HOME", str(VGP / ".cache" / "huggingface"))
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("PKUSEG_HOME", str(VGP / ".cache" / "pkuseg"))
HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
sample = VGP / "voice" / "samples" / "en.wav"
if not sample.is_file():
    sys.exit(f"Missing reference recording: {sample}")

import numpy as np, soundfile as sf, torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

segs = json.loads((HERE / "segments.json").read_text(encoding="utf-8"))
todo = [s for s in segs if not (OUT / f"seg-{s['id']}.wav").exists()]
if not todo:
    print("all segments exist"); sys.exit(0)
model = ChatterboxMultilingualTTS.from_pretrained(device="cpu", t3_model="v3")
for s in todo:
    random.seed(0); np.random.seed(0); torch.manual_seed(0)
    audio = model.generate(s["text"], language_id="en", audio_prompt_path=str(sample))
    assert audio.numel() > 0 and torch.isfinite(audio).all(), "invalid audio"
    path = OUT / f"seg-{s['id']}.wav"
    with path.open("xb") as fh:
        sf.write(fh, audio.squeeze(0).detach().cpu().numpy(), model.sr, format="WAV")
    print(f"saved {path.name} {audio.shape[-1] / model.sr:.2f}s", flush=True)
