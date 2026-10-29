// Renders player.html to MP4: seek(i/FPS) per frame -> PNG -> ffmpeg; effects via SOUND.renderOffline.
// Usage: node render.mjs [--voice path/to/voice.wav] [--out ../vyuh-explainer.mp4] [--from 0 --to 46 (preview)]
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = 30;
const out = resolve(here, arg('--out', '../vyuh-explainer.mp4'));
const voice = arg('--voice', null);
const browserPath = process.env.BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);

const run = (args) => new Promise((ok, bad) => { const p = spawn('ffmpeg', args, { stdio: 'inherit' }); p.on('exit', (c) => (c ? bad(new Error('ffmpeg ' + c)) : ok())); });

// Prefer puppeteer's cached chrome-headless-shell (Edge refuses remote debugging on this machine); BROWSER_PATH overrides.
const shellDir = resolve(process.env.USERPROFILE || '', '.cache/puppeteer/chrome-headless-shell');
const shell = existsSync(shellDir) ? readdirSync(shellDir).map((v) => resolve(shellDir, v, 'chrome-headless-shell-win64/chrome-headless-shell.exe')).find(existsSync) : null;
const exe = process.env.BROWSER_PATH || shell || browserPath;
const browser = await puppeteer.launch({ executablePath: exe, headless: 'shell', userDataDir: resolve(here, '.profile'),
  args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', '--no-first-run'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto(pathToFileURL(resolve(here, '../player.html')).href, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 60000 });
const DURATION = await page.evaluate(() => window.DURATION);
const t0 = Number(arg('--from', 0)), t1 = Math.min(DURATION, Number(arg('--to', DURATION)));
const n = Math.round((t1 - t0) * FPS);

// ---- video: frames piped into ffmpeg
const silent = resolve(here, 'video.mp4');
const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), silent], { stdio: ['pipe', 'ignore', 'inherit'] });
const started = Date.now();
for (let i = 0; i < n; i++) {
  const b64 = await page.evaluate((tt) => { window.seek(tt); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t0 + i / FPS);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 60 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on('exit', r));

// ---- effects: offline render (voiceover mode only when narration is supplied)
const fxB64 = await page.evaluate(async (vo, from, to) => {
  const r = await SOUND.renderOffline(window.scoreSound, window.DURATION, 48000, { voiceover: vo });
  const s0 = Math.round(from * r.sr), s1 = Math.round(to * r.sr), pcm = new Int16Array((s1 - s0) * 2);
  const norm = r.peak > 0.98 ? 0.98 / r.peak : 1;
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(r.inter[s0 * 2 + i] * norm * 32767)));
  const u8 = new Uint8Array(pcm.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}, !!voice, t0, t1);
await browser.close();
const pcm = Buffer.from(fxB64, 'base64');
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16);
hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(48000, 24); hdr.writeUInt32LE(48000 * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
const fx = resolve(here, 'effects.wav');
writeFileSync(fx, Buffer.concat([hdr, pcm]));

// ---- mux
if (voice) {
  await run(['-y', '-i', silent, '-i', resolve(voice), '-i', fx, '-filter_complex',
    '[1:a]loudnorm=I=-17:TP=-2,asplit=2[v1][v2];[2:a]loudnorm=I=-26:TP=-4:LRA=20[fx0];[fx0][v1]sidechaincompress=threshold=0.05:ratio=3:attack=10:release=250[fx];[v2][fx]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', out]);
} else {
  await run(['-y', '-i', silent, '-i', fx, '-filter_complex', '[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]', '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', out]);
}
console.log('done', out, `${n} frames in ${((Date.now() - started) / 1000).toFixed(0)}s`);
