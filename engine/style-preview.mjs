#!/usr/bin/env node
// Render the demo video with a style and compose styles/<name>/preview.png (2×2 frames).
//
//   node engine/style-preview.mjs <style|all> [--ep videos/demo]
//
// Needs videos/demo/audio/timings.json (run `npm run demo:audio` once; `tts none` works offline).
// Used by `npm run new-style` to show the new style right after creating it.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { ROOT, listStyles, loadConfig } from './config.mjs';

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const which = args[0];
if (!which) { console.error('usage: style-preview.mjs <style|all> [--ep videos/demo]'); process.exit(1); }
const EP = path.resolve(ROOT, flag('--ep', 'videos/demo'));
const tpath = path.join(EP, 'audio', 'timings.json');
if (!fs.existsSync(tpath)) { console.error(`missing ${path.relative(ROOT, tpath)} — run: npm run demo:audio`); process.exit(1); }
const timings = JSON.parse(fs.readFileSync(tpath, 'utf8'));
const seg = (n) => timings.segments.find((s) => s.name === n);
const dur = (n) => seg(n).duration + timings.tail;
// four representative instants: headline, pipeline, KPI, wordmark
const SHOTS = [['apertura', dur('apertura') * 0.9], ['flujo', dur('flujo') * 0.5], ['flujo', dur('flujo') * 0.93], ['cierre', dur('cierre') * 0.85]];
const styles = which === 'all' ? listStyles().map((s) => s.name).filter((n) => n !== 'islas') : [which];
const cfg = loadConfig(EP);
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || cfg.render?.browserChannel || undefined });

for (const style of styles) {
  const frames = [];
  for (const name of [...new Set(SHOTS.map((s) => s[0]))]) {
    const at = SHOTS.filter((s) => s[0] === name).map((s) => s[1].toFixed(2));
    execFileSync(process.execPath, [path.join(ROOT, 'engine/render.mjs'), EP, name, '--at', at.join(','), '--style', style], { stdio: ['ignore', 'ignore', 'inherit'] });
    const dir = path.join(EP, 'review', `${name}@${style}`);
    for (const a of at) frames.push(path.join(dir, `t${Number(a).toFixed(2).padStart(6, '0')}.png`));
  }
  const page = await browser.newPage();
  const png = await page.evaluate(async ({ imgs, label }) => {
    const w = 960, h = 540, cv = document.createElement('canvas');
    cv.width = w * 2; cv.height = h * 2 + 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < imgs.length; i++) {
      const im = new Image(); im.src = 'data:image/png;base64,' + imgs[i]; await im.decode();
      g.drawImage(im, (i % 2) * w, 64 + Math.floor(i / 2) * h, w, h);
    }
    g.fillStyle = '#fff'; g.font = '600 30px system-ui, sans-serif'; g.fillText(label, 24, 44);
    return cv.toDataURL('image/png').split(',')[1];
  }, { imgs: frames.map((f) => fs.readFileSync(f).toString('base64')), label: `estilo: ${style}` });
  await page.close();
  const out = path.join(ROOT, 'styles', style, 'preview.png');
  fs.writeFileSync(out, Buffer.from(png, 'base64'));
  console.log(`[${style}] -> ${path.relative(ROOT, out)}`);
}
await browser.close();
