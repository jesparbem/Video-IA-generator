#!/usr/bin/env node
// Concatenate rendered segments (render/NN-seg.mp4, each already carrying its audio)
// into out/<slug>.mp4, then write the side outputs the config asks for:
//   out/<slug>.srt + .vtt      subtitles from audio/timings.json      (outputs.subtitles)
//   out/<slug>-subs.mp4        same video with burnt-in subtitles      (outputs.burnSubtitles)
//   out/chapters.txt           YouTube-style chapter list              (outputs.chapters)
// Audio: optional background music (audio.music) ducked under the voice with
// sidechaincompress (audio.ducking), loudness-normalised to audio.loudness LUFS.
//
//   node engine/assemble.mjs videos/<slug>

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadConfig, ROOT } from './config.mjs';

const ep = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(path.join(ep, 'audio/timings.json'))) { console.error('usage: assemble.mjs videos/<slug>'); process.exit(1); }
const cfg = loadConfig(ep);
const timings = JSON.parse(fs.readFileSync(path.join(ep, 'audio/timings.json'), 'utf8'));
const segs = timings.segments.map((s, i) => path.join(ep, 'render', `${String(i + 1).padStart(2, '0')}-${s.name}.mp4`));
const missing = segs.filter((f) => !fs.existsSync(f));
if (missing.length) { console.error(`missing renders:\n  ${missing.join('\n  ')}`); process.exit(1); }

const slug = path.basename(ep);
const outDir = path.join(ep, 'out');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${slug}.mp4`);
const list = path.join(ep, 'render', '.concat.txt');
fs.writeFileSync(list, segs.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));

// ── audio graph ───────────────────────────────────────────────────────────────
const A = cfg.audio ?? {};
const lufs = A.loudness ?? -16;
const norm = `loudnorm=I=${lufs}:TP=-1.5:LRA=11`;
const music = A.music ? path.resolve(ROOT, A.music) : null;
if (music && !fs.existsSync(music)) console.warn(`music not found, skipping: ${A.music}`);
const useMusic = music && fs.existsSync(music);
const args = ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list];
if (useMusic) {
  args.push('-stream_loop', '-1', '-i', music);
  const vol = A.musicVolume ?? 0.25;
  const graph = A.ducking === false
    ? `[1:a]volume=${vol}[m];[0:a][m]amix=inputs=2:duration=first:normalize=0,${norm}[a]`
    : `[1:a]volume=${vol}[m];[0:a]asplit=2[v1][v2];[m][v1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[d];[v2][d]amix=inputs=2:duration=first:normalize=0,${norm}[a]`;
  args.push('-filter_complex', graph, '-map', '0:v', '-map', '[a]');
} else {
  args.push('-af', norm);
}
args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out);
execFileSync('ffmpeg', args);
fs.rmSync(list);

// ── subtitles + chapters (global times = segment offset + local time) ─────────
const O = cfg.outputs ?? {};
const ts = (s, sep) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, x = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`; };
const cuesOut = [];
const chapters = [];
let acc = 0;
for (const s of timings.segments) {
  chapters.push(`${String(Math.floor(acc / 60)).padStart(2, '0')}:${String(Math.floor(acc % 60)).padStart(2, '0')} ${s.name}`);
  for (const sent of s.sentences) {
    // ≤ 42 characters per cue, never across sentences
    let cur = [];
    const flush = () => { if (cur.length) cuesOut.push({ a: acc + cur[0].start, b: acc + cur[cur.length - 1].end, text: cur.map((w) => w.w).join(' ').replace(/\s+([.,;:!?…»)])/g, '$1') }); cur = []; };
    for (const w of sent.words) { if (cur.length && [...cur, w].map((x) => x.w).join(' ').length > 42) flush(); cur.push(w); }
    flush();
  }
  acc += s.duration + timings.tail;
}
const written = [out];
if (O.subtitles !== false) {
  const srt = cuesOut.map((c, i) => `${i + 1}\n${ts(c.a, ',')} --> ${ts(c.b, ',')}\n${c.text}\n`).join('\n');
  const vtt = 'WEBVTT\n\n' + cuesOut.map((c) => `${ts(c.a, '.')} --> ${ts(c.b, '.')}\n${c.text}\n`).join('\n');
  fs.writeFileSync(path.join(outDir, `${slug}.srt`), srt);
  fs.writeFileSync(path.join(outDir, `${slug}.vtt`), vtt);
  written.push(path.join(outDir, `${slug}.srt`), path.join(outDir, `${slug}.vtt`));
  if (O.burnSubtitles) {
    // run inside out/ so the subtitles filter gets a plain relative path (no Windows drive escaping)
    const subbed = `${slug}-subs.mp4`;
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', `${slug}.mp4`, '-vf', `subtitles=${slug}.srt:force_style='FontSize=20,Outline=2,MarginV=40'`,
      '-c:v', 'libx264', '-crf', String(cfg.render?.crf ?? 16), '-preset', 'medium', '-c:a', 'copy', '-movflags', '+faststart', subbed], { cwd: outDir });
    written.push(path.join(outDir, subbed));
  }
}
if (O.chapters !== false) { fs.writeFileSync(path.join(outDir, 'chapters.txt'), chapters.join('\n') + '\n'); written.push(path.join(outDir, 'chapters.txt')); }

const dur = execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
const mb = (fs.statSync(out).size / 1e6).toFixed(1);
console.log(`${path.relative(process.cwd(), out)}  ${Math.floor(+dur / 60)}:${String(Math.round(+dur % 60)).padStart(2, '0')}  ${mb} MB${useMusic ? '  + music' : ''}`);
for (const f of written.slice(1)) console.log(`  ${path.relative(process.cwd(), f)}`);
console.log(chapters.join('\n'));
