# Vyuh explainer video

Vaporwave (Retro UI & Neon) explainer, told on a worn VHS tape. 1280x720, 30 fps, 46 s.

| File | What |
|---|---|
| `SCRIPT.md` | Voiceover script and beat table |
| `vyuh-vw.js` | The style's drawing code, `BEATS`/`T` timing, `explainer(ctx, W, H, t)` and `scoreSound(k)` |
| `lib/harness.js`, `lib/sound.js` | H helper library and the synthesized SOUND kit (unchanged) |
| `player.html` | Player: play/pause, scrub, sound and loop toggles, Load voiceover (file or drag-drop; the audio becomes the clock) |
| `storyboard.html` | Eight key frames with timing, text, transitions and sounds |
| `frame.html?t=12.3` | Draws one frame (debugging) |
| `render/render.mjs` | Renders the MP4: `window.seek(i/30)` per frame into ffmpeg, effects via `SOUND.renderOffline` |
| `vyuh-explainer.mp4` | Effects + music, no narration |
| `vyuh-explainer-vo.mp4` | Narrated in Sandesh's cloned voice, effects ducked under it |
| `voice/` | Narration segments, generator and timing assembly (audio outputs are gitignored) |
| `timing.js` | Generated from the voiceover's word timings; overrides the scratch timing |

## Voiceover (your cloned voice)
Uses the local `C:/Projects_v13/vgp` pipeline (Chatterbox voice clone from `vgp/voice/samples/en.wav`, faster-whisper for word timings). Nothing leaves the machine; the reference recording is never copied here.

```bash
VENV=/c/Projects_v13/vgp/voice/.venv/Scripts/python.exe
cd design/video/voice
$VENV gen_segments.py    # one WAV per beat from segments.json (skips ones that exist)
$VENV assemble.py        # voice.wav + word timings -> ../timing.js
cd ../render && node render.mjs --voice ../voice/out/voice.wav --out ../vyuh-explainer-vo-master.mp4
```

To change a line: edit `segments.json`, delete that `out/seg-<id>.wav`, rerun both scripts and the render. The name is spelled "Vyoo" in the narration text so the voice says it as one syllable.

`--from 20 --to 25` renders a short preview. The script uses puppeteer's cached `chrome-headless-shell` (Edge refuses remote debugging on this machine); set `BROWSER_PATH` to use another browser.
