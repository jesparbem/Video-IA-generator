#!/usr/bin/env node
// .agents/skills/ is the source of truth (read natively by OpenAI Codex and OpenClaw).
// Claude Code reads .claude/skills/, so this copies them there (copies, not symlinks:
// symlinks need admin rights on Windows).   npm run sync-skills [-- --check]

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.mjs';

const src = path.join(ROOT, '.agents', 'skills');
const dst = path.join(ROOT, '.claude', 'skills');
const check = process.argv.includes('--check');
let diff = 0;
for (const name of fs.readdirSync(src)) {
  const a = path.join(src, name, 'SKILL.md'), b = path.join(dst, name, 'SKILL.md');
  if (!fs.existsSync(a)) continue;
  const same = fs.existsSync(b) && fs.readFileSync(a, 'utf8') === fs.readFileSync(b, 'utf8');
  if (same) continue;
  diff++;
  if (check) { console.log(`out of sync: ${name}`); continue; }
  fs.mkdirSync(path.dirname(b), { recursive: true });
  fs.copyFileSync(a, b);
  console.log(`synced ${name}`);
}
for (const name of fs.existsSync(dst) ? fs.readdirSync(dst) : []) {
  if (!fs.existsSync(path.join(src, name))) { diff++; if (!check) { fs.rmSync(path.join(dst, name), { recursive: true }); console.log(`removed ${name}`); } else console.log(`extra in .claude: ${name}`); }
}
if (!diff) console.log('skills in sync');
process.exit(check && diff ? 1 : 0);
