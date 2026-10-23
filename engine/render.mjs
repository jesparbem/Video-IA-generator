#!/usr/bin/env node
// Render scenes to video, or stills for review.
//
//   node engine/render.mjs <episode-dir> <seg>                 -> <ep>/render/NN-seg.mp4 (with audio)
//   node engine/render.mjs <episode-dir> <seg> --stills 12     -> <ep>/review/<seg>/*.png + contact.png
//   node engine/render.mjs <episode-dir> <seg> --at 1.5,4,9.2  -> stills at exact times
//   node engine/render.mjs <episode-dir> all                   -> every segment
//   node engine/render.mjs <episode-dir> <seg> --serve         -> print live-preview URL and keep serving
//   --style <name>   render with another style (stills go to review/<seg>@<name>/)
//   --workers N      parallel browser pages (default: render.workers in the config)
//
// Size, fps, quality and browser come from project.config.json + <ep>/video.json. Frames are pure functions of time, so workers render
// disjoint frame ranges in parallel and the chunks are concatenated.

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { loadConfig } from './config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1] ?? true; };
const [epArg, segArg] = args;
if (!epArg || !segArg) { console.error('usage: render.mjs <episode-dir> <seg|all> [--stills N | --at t1,t2 | --serve] [--workers N]'); process.exit(1); }
const EP = path.relative(ROOT, path.resolve(epArg)).split(path.sep).join('/');
const timings = JSON.parse(fs.readFileSync(path.join(ROOT, EP, 'audio/timings.json'), 'utf8'));
const CFG = loadConfig(path.join(ROOT, EP));
const FPS = CFG.video?.fps ?? 30, VW = CFG.video?.width ?? 1920, VH = CFG.video?.height ?? 1080;
const WORKERS = +flag('--workers', CFG.render?.workers ?? 6);
const STYLE = flag('--style', null);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const url = (seg, extra = '') => `http://127.0.0.1:${PORT}/engine/frame.html?ep=${encodeURIComponent(EP)}&seg=${seg}${STYLE ? `&style=${encodeURIComponent(STYLE)}` : ''}${extra}`;

if (args.includes('--serve')) {
  console.log(`preview: ${url(segArg, '&play=1')}`);
  await new Promise(() => {});
}

// PW_CHANNEL=msedge|chrome uses an installed browser when Playwright's Chromium can't be downloaded
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || CFG.render?.browserChannel || undefined, args:['--force-color-profile=srgb', '--disable-lcd-text'] });

async function openPage(seg) {
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error(`[${seg}] page error: ${e.message}`); process.exitCode = 1; });
  page.on('console', (m) => { if (m.type() === 'error') console.error(`[${seg}] ${m.text()}`); });
  await page.goto(url(seg));
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  return page;
}

const grab = (page, t) => page.evaluate((t) => { window.__draw(t); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t);

async function stills(seg, times) {
  const dir = path.join(ROOT, EP, 'review', STYLE ? `${seg}@${STYLE}` : seg);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const page = await openPage(seg);
  const files = [];
  for (const t of times) {
    const f = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
    fs.writeFileSync(f, Buffer.from(await grab(page, t), 'base64'));
    files.push(f);
  }
  // contact sheet (4 columns, timestamp labels) composed in the page — no ffmpeg drawtext dependency
  const sheet = await page.evaluate(async ({ imgs, times }) => {
    const cols = 4, w = 480, h = Math.round(480 * innerHeight / innerWidth), rows = Math.ceil(imgs.length / cols);
    const cv = document.createElement('canvas');
    cv.width = cols * w; cv.height = rows * h;
    const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < imgs.length; i++) {
      const im = new Image();
      im.src = 'data:image/png;base64,' + imgs[i];
      await im.decode();
      const x = (i % cols) * w, y = Math.floor(i / cols) * h;
      g.drawImage(im, x, y, w, h);
      g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(x + 6, y + 6, 92, 28);
      g.fillStyle = '#fff'; g.font = '600 18px ui-monospace, monospace'; g.fillText(times[i].toFixed(2) + 's', x + 12, y + 26);
    }
    return cv.toDataURL('image/png').split(',')[1];
  }, { imgs: files.map((f) => fs.readFileSync(f).toString('base64')), times });
  fs.writeFileSync(path.join(dir, 'contact.png'), Buffer.from(sheet, 'base64'));
  await page.close();
  console.log(`[${seg}] ${files.length} stills -> ${path.relative(ROOT, dir)}/contact.png`);
}

async function video(seg) {
  const i = timings.segments.findIndex((s) => s.name === seg);
  const timing = timings.segments[i];
  const dur = timing.duration + timings.tail;
  const N = Math.ceil(dur * FPS);
  const outDir = path.join(ROOT, EP, 'render');
  const tmp = path.join(outDir, `.tmp-${seg}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const per = Math.ceil(N / WORKERS);
  const t0 = Date.now();
  let done = 0;
  const chunks = await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const a = w * per, b = Math.min(N, a + per);
    if (a >= b) return null;
    const file = path.join(tmp, `chunk-${String(w).padStart(2, '0')}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', String(CFG.render?.preset ?? 'medium'), '-crf', String(CFG.render?.crf ?? 16), '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', file]);
    const page = await openPage(seg);
    for (let f = a; f < b; f++) {
      const buf = Buffer.from(await grab(page, f / FPS), 'base64');
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (++done % 150 === 0) process.stdout.write(`\r[${seg}] ${done}/${N} frames`);
    }
    await page.close();
    ff.stdin.end();
    await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg chunk ${w} exited ${c}`)))));
    return file;
  }));
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, chunks.filter(Boolean).map((f) => `file '${f}'`).join('\n'));
  const out = path.join(outDir, `${String(i + 1).padStart(2, '0')}-${seg}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', path.join(ROOT, EP, 'audio', timing.file),
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-af', `apad=whole_dur=${(N / FPS).toFixed(3)}`, '-t', (N / FPS).toFixed(3), out]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\r[${seg}] ${N} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${path.relative(ROOT, out)}`);
}

try {
  const segs = segArg === 'all' ? timings.segments.map((s) => s.name) : [segArg];
  for (const seg of segs) {
    const timing = timings.segments.find((s) => s.name === seg);
    if (!timing) throw new Error(`no segment "${seg}" in timings.json`);
    const dur = timing.duration + timings.tail;
    if (flag('--at')) await stills(seg, String(flag('--at')).split(',').map(Number));
    else if (flag('--stills')) { const n = +flag('--stills'); await stills(seg, Array.from({ length: n }, (_, k) => +(((k + 0.5) / n) * dur).toFixed(2))); }
    else await video(seg);
  }
} finally {
  await browser.close();
  server.close();
}
