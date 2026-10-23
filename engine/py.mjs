#!/usr/bin/env node
// Run engine/audio.py with the project's virtualenv Python on any OS.
//   node engine/py.mjs videos/<slug> [seg ...] [--tts edge|elevenlabs|kokoro|none] [--check]

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './config.mjs';
import { python } from './lib/python.mjs';

const r = spawnSync(python(), ['-X', 'utf8', path.join(ROOT, 'engine', 'audio.py'), ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
