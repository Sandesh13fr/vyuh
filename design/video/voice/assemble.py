"""Assemble the narration segments into voice.wav, transcribe word timings, and write ../timing.js
(BEATS + T landmarks) so every animation and sound lands on the spoken word.
Run with C:/Projects_v13/vgp/voice/.venv/Scripts/python.exe after gen_segments.py."""
import json, os, re, subprocess, sys
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
VGP = Path("C:/Projects_v13/vgp")
SEGS = json.loads((HERE / "segments.json").read_text(encoding="utf-8"))
LEAD = 0.30          # silence before the first word
GAP = 0.45           # pause between beats in one scene
CUT_GAP = 0.75       # pause across a tape cut (the cut itself takes ~0.5 s)
CUT_BEFORE = {"vyuh", "arena", "end"}


def trim(x, sr, thr=0.012, pad=0.04):
    env = np.abs(x)
    idx = np.where(env > thr)[0]
    if idx.size == 0:
        return x
    a = max(0, idx[0] - int(pad * sr)); b = min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]


# ---- 1. lay the segments on one track
pieces, beats, t, sr0 = [], [], LEAD, None
for i, s in enumerate(SEGS):
    x, sr = sf.read(OUT / f"seg-{s['id']}.wav", dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    sr0 = sr0 or sr
    assert sr == sr0, "segments must share a sample rate"
    if i > 0:
        gap = CUT_GAP if s["id"] in CUT_BEFORE else GAP
        pieces.append(np.zeros(int(gap * sr), dtype="float32")); t += gap
    x = trim(x, sr)
    beats.append({"id": s["id"], "t0": round(t, 3), "t1": round(t + len(x) / sr, 3), "words": s["text"]})
    pieces.append(x); t += len(x) / sr
pieces.append(np.zeros(int(1.0 * sr0), dtype="float32"))
voice = np.concatenate([np.zeros(int(LEAD * sr0), dtype="float32")] + pieces)
peak = float(np.max(np.abs(voice))) or 1.0
voice = voice * min(1.0, 0.89 / peak)
for f in ["voice.wav", "words.json", "words.srt"]:
    (OUT / f).unlink(missing_ok=True)  # our own generated files from a previous run
sf.write(OUT / "voice.wav", voice, sr0)
print(f"voice.wav {len(voice) / sr0:.2f}s")

# ---- 2. word timings with the vgp faster-whisper captions tool
subprocess.run([sys.executable, str(VGP / "scripts" / "vgp.py"), "captions", str(OUT / "voice.wav"), str(OUT / "words.json"), "--language", "en"], check=True)
words = json.loads((OUT / "words.json").read_text(encoding="utf-8"))
W = [{"w": re.sub(r"[^a-z0-9']", "", w["text"].lower()), "s": w["startMs"] / 1000, "e": w["endMs"] / 1000} for w in words]
B = {b["id"]: b for b in beats}


def find(beat, pattern, which="first", frac=None, end=False):
    b = B[beat]
    hits = [w for w in W if b["t0"] - 0.25 <= w["s"] <= b["t1"] + 0.25 and re.fullmatch(pattern, w["w"])]
    if hits:
        w = hits[0] if which == "first" else hits[-1]
        return round(w["e"] if end else w["s"], 3)
    # not transcribed as expected: estimate from the word's position in the script
    pos = frac if frac is not None else 0.5
    print(f"  ! '{pattern}' not found in {beat}; estimating at {pos:.2f} of the beat")
    return round(b["t0"] + (b["t1"] - b["t0"]) * pos, 3)


T = {}
T["hookType"] = round(B["hook"]["t0"] + 0.05, 3)
T["agents"] = find("hook", r"agents?", frac=0.15)
T["bustRise"] = round(T["hookType"] + 0.35, 3)
T["money"] = round(find("hook", r"money", frac=0.85) - 0.15, 3)

T["prompt"] = find("risk", r"prompt", frac=0.3)
T["trick"] = find("risk", r"trick", frac=0.45)
T["typeEnd"] = round(min(T["prompt"] + 1.6, T["trick"] + 0.6), 3)
T["drain0"] = round(find("risk", r"draining|drain", frac=0.75) - 0.1, 3)
T["drain1"] = round(max(T["drain0"] + 1.0, B["risk"]["t1"] - 0.1), 3)

T["vyuhName"] = round(B["vyuh"]["t0"] + 0.05, 3)
T["ringDraw"] = round(T["vyuhName"] + 0.8, 3)
T["outOfPrompt"] = find("vyuh", r"out", frac=0.4)
T["contract"] = find("vyuh", r"contract", frac=0.85)

T["ringsSaid"] = find("rings", r"seven|7", frac=0.25)
names = [r"spend", r"allow.*", r"oracle", r"slippage", r"daily", r"k|kyc|kay", r"cooldown|cool"]
fr = [0.42, 0.5, 0.58, 0.66, 0.74, 0.84, 0.94]
named, after = [], B["rings"]["t0"]
for pat, f in zip(names, fr):
    hit = next((w for w in W if w["s"] >= after - 0.05 and w["s"] <= B["rings"]["t1"] + 0.25 and re.fullmatch(pat, w["w"])), None)
    v = round(hit["s"], 3) if hit else round(B["rings"]["t0"] + (B["rings"]["t1"] - B["rings"]["t0"]) * f, 3)
    if not hit:
        print(f"  ! ring '{pat}' not found; estimating")
    named.append(max(v, named[-1] + 0.3) if named else v)
    after = named[-1] + 0.05
T["ringNamed"] = named

fooled_end = find("block", r"fooled", end=True, frac=0.45)
T["fooled"] = find("block", r"fooled", frac=0.35)
T["hit2"] = round(fooled_end + 0.12, 3)
T["hit1"] = round(T["hit2"] - 0.5, 3)
T["attack"] = round(max(B["block"]["t0"], T["hit1"] - 0.6), 3)
T["cant"] = find("block", r"can'?t|cannot", which="last", frac=0.85)

T["pass0"] = round(B["pass"]["t0"] + 0.1, 3)
T["swap"] = find("pass", r"swap", frac=0.4)
T["pass1"] = round(max(T["pass0"] + 1.2, T["swap"]), 3)  # the dot reaches the core as "swap" is said
T["receipt"] = find("pass", r"receipt", frac=0.9)

T["arena"] = find("arena", r"arena", frac=0.1)
T["attempts0"] = find("arena", r"anyone", frac=0.2)
T["attempts1"] = round(find("arena", r"break", end=True, frac=0.4) + 0.4, 3)
T["bounty"] = find("arena", r"bounty", frac=0.62)
T["pot"] = find("arena", r"pot", which="last", frac=0.95)

T["name"] = round(B["end"]["t0"] + 0.05, 3)
T["line1"] = find("end", r"agents?", frac=0.35)
T["line2"] = round(max(T["line1"] + 0.6, find("end", r"vyoo|vyooh|vyuh|view|vue|via|vio|viol", which="last", frac=0.7)), 3)

js = ("// Generated by design/video/voice/assemble.py from the voiceover's word timings. Do not edit by hand.\n"
      f"window.VYUH_TIMING = {json.dumps({'BEATS': beats, 'T': T}, indent=2)};\n")
(HERE.parent / "timing.js").write_text(js, encoding="utf-8")
print(json.dumps({"beats": [(b['id'], b['t0'], b['t1']) for b in beats], "duration": round(beats[-1]['t1'] + 1, 2)}))
