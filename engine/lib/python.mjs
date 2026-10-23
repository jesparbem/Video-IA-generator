// Path to the project's virtualenv Python (falls back to the system one).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../config.mjs';

export function python() {
  for (const p of [path.join(ROOT, '.venv', 'Scripts', 'python.exe'), path.join(ROOT, '.venv', 'bin', 'python')]) if (fs.existsSync(p)) return p;
  return process.platform === 'win32' ? 'python' : 'python3';
}
