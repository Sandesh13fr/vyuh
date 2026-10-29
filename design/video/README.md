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
| `vyuh-explainer.mp4` | The rendered video (effects + music, no voiceover yet) |

## Adding the voiceover
1. Record the script in `SCRIPT.md`; export the SRT or word timestamps.
2. Update `BEATS` and `T` in `vyuh-vw.js` (every animation and sound reads its times from there).
3. Preview in `player.html` with **Load voiceover**.
4. Render with the voice mixed in (effects ducked under it):

```bash
cd design/video/render && npm install && node render.mjs --voice ../voice.wav --out ../vyuh-explainer-vo.mp4
```

`--from 20 --to 25` renders a short preview. The script uses puppeteer's cached `chrome-headless-shell` (Edge refuses remote debugging on this machine); set `BROWSER_PATH` to use another browser.
