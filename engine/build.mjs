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
  if (r.status !== 0) {
    // name the failing step: the engine scripts exit 1 on their own errors, so any other code
    // (or a signal) means the process was killed from outside (memory, antivirus, closed terminal)
    const why = r.error ? r.error.message : r.signal ? `signal ${r.signal}` : `exit ${r.status}`;
    console.error(`\nbuild: ${script} ${args.join(' ')} failed (${why})${r.status > 1 || r.signal ? ' — killed from outside the engine? retry the step on its own' : ''}`);
    process.exit(r.status || 1);
  }
};
run('render.mjs', [ep, 'all', ...rest]);
run('assemble.mjs', [ep]);
if (loadConfig(path.resolve(ep)).outputs?.infographic !== false) run('infographic.mjs', [ep, ...rest]);
