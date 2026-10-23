#!/usr/bin/env node
// Final outputs for a video in one go: render every segment → assemble MP4 (+ subtitles,
// chapters, music) → infographic (if outputs.infographic). Audio must already exist.
//
//   npm run build -- videos/<slug> [--style name]

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, loadConfig } from './config.mjs';

const [ep, ...rest] = process.argv.slice(2);
if (!ep) { console.error('usage: build.mjs videos/<slug> [--style name]'); process.exit(1); }
const run = (script, args) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'engine', script), ...args], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run('render.mjs', [ep, 'all', ...rest]);
run('assemble.mjs', [ep]);
if (loadConfig(path.resolve(ep)).outputs?.infographic !== false) run('infographic.mjs', [ep, ...rest]);
