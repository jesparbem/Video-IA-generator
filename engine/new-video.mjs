#!/usr/bin/env node
// Scaffold a new video: videos/<slug>/ from templates/video/, with its own video.json.
//
//   npm run new-video -- <slug> [--style name] [--title "Título"] [--minutes 2] [--format 1920x1080]

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig, listStyles } from './config.mjs';
import { slugify } from './lib/ask.mjs';

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const slug = slugify(args[0] ?? '');
if (!slug) { console.error('usage: new-video.mjs <slug> [--style name] [--title "…"] [--minutes N] [--format WxH]'); process.exit(1); }
const ep = path.join(ROOT, 'videos', slug);
if (fs.existsSync(ep)) { console.error(`videos/${slug} ya existe`); process.exit(1); }
const cfg = loadConfig();
const style = flag('--style', cfg.style);
if (!listStyles().some((s) => s.name === style)) { console.error(`estilo desconocido: ${style}`); process.exit(1); }

fs.cpSync(path.join(ROOT, 'templates', 'video'), ep, { recursive: true });
for (const d of ['fuente', 'scenes', 'assets/ui', 'audio']) fs.mkdirSync(path.join(ep, d), { recursive: true });
const title = flag('--title', slug);
for (const f of ['briefing.md', 'narration.md', 'prompts/_common.md', 'infographic.json']) {
  const p = path.join(ep, f);
  if (!fs.existsSync(p)) continue;
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('<slug>', slug).replaceAll('<título>', title).replaceAll('<TÍTULO DEL VÍDEO>', title).replaceAll('<estilo>', style));
}
const video = { style };
if (flag('--minutes')) video.video = { targetMinutes: Number(flag('--minutes')) };
if (flag('--format')) { const [w, h] = flag('--format').split('x').map(Number); video.video = { ...(video.video ?? {}), width: w, height: h }; }
fs.writeFileSync(path.join(ep, 'video.json'), JSON.stringify({ $comment: 'Overrides for this video only (deep-merged over project.config.json).', ...video }, null, 2) + '\n');
console.log(`✔ videos/${slug}/ (estilo ${style})
  1. Copia el material fuente en videos/${slug}/fuente/
  2. Pide al agente: "usa la skill crear-video con videos/${slug}"`);
