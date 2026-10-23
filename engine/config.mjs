// Config loader shared by the Node tools (render, assemble, infographic, init).
// Effective config = project.config.json  ⟵ deep-merged with ⟵  videos/<slug>/video.json.
// The browser side (frame.html) does the same merge with its own copy of deepMerge.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function deepMerge(a, b) {
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return b === undefined ? a : b;
  const out = { ...(a && typeof a === 'object' ? a : {}) };
  for (const [k, v] of Object.entries(b)) out[k] = deepMerge(out[k], v);
  return out;
}

export function readJson(p, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

/** epDir: absolute or relative path to videos/<slug> (optional). */
export function loadConfig(epDir) {
  const base = readJson(path.join(ROOT, 'project.config.json'));
  const vid = epDir ? readJson(path.join(path.resolve(epDir), 'video.json')) : {};
  return deepMerge(base, vid);
}

export function loadTheme(style) {
  const p = path.join(ROOT, 'styles', style, 'theme.json');
  if (!fs.existsSync(p)) throw new Error(`style "${style}" not found (missing ${path.relative(ROOT, p)})`);
  return readJson(p);
}

export function listStyles() {
  return fs.readdirSync(path.join(ROOT, 'styles'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && fs.existsSync(path.join(ROOT, 'styles', d.name, 'theme.json')))
    .map((d) => ({ name: d.name, ...readJson(path.join(ROOT, 'styles', d.name, 'theme.json')) }));
}
