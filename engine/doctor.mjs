#!/usr/bin/env node
// Installation check. Prints ✔ / ✖ per requirement and how to fix it. Never prints secrets.
//   npm run doctor [-- --voice]     (--voice also synthesises one test sentence)

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT, loadConfig, listStyles } from './config.mjs';
import { python } from './lib/python.mjs';

let bad = 0;
const ok = (m) => console.log(`✔ ${m}`);
const ko = (m, fix) => { bad++; console.log(`✖ ${m}\n    → ${fix}`); };
const ver = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0]; } catch { return null; } };

const [maj] = process.versions.node.split('.').map(Number);
maj >= 20 ? ok(`Node ${process.versions.node}`) : ko(`Node ${process.versions.node} (< 20)`, 'instala Node 20 o superior');
const ff = ver('ffmpeg', ['-version']);
ff ? ok(ff.split(' Copyright')[0]) : ko('ffmpeg no encontrado', 'Windows: winget install Gyan.FFmpeg · macOS: brew install ffmpeg · Linux: apt install ffmpeg');
const py = python();
const pv = ver(py, ['--version']);
pv ? ok(`${pv} (${path.relative(ROOT, py) || py})`) : ko('Python no encontrado', 'instala Python 3.10+ y crea el entorno: python -m venv .venv');
if (pv) {
  const r = spawnSync(py, ['-c', 'import numpy, soundfile, edge_tts; print("ok")'], { encoding: 'utf8' });
  r.stdout?.includes('ok') ? ok('dependencias Python (numpy, soundfile, edge-tts)') : ko('faltan dependencias Python', `${path.relative(ROOT, py) || py} -m pip install -r requirements.txt`);
}
fs.existsSync(path.join(ROOT, 'node_modules', 'playwright')) ? ok('Playwright (npm)') : ko('Playwright no instalado', 'npm install');
const cfg = loadConfig();
try {
  const { chromium } = await import('playwright');
  const b = await chromium.launch({ channel: process.env.PW_CHANNEL || cfg.render?.browserChannel || undefined });
  ok(`navegador para render (${cfg.render?.browserChannel || 'chromium de Playwright'} ${b.version()})`);
  await b.close();
} catch (err) { ko(`no arranca el navegador: ${err.message.split('\n')[0]}`, 'npx playwright install chromium · o en npm run init elige "Microsoft Edge instalado"'); }

const styles = listStyles().map((s) => s.name);
styles.includes(cfg.style) ? ok(`estilo por defecto "${cfg.style}" (${styles.length} disponibles: ${styles.join(', ')})`) : ko(`estilo "${cfg.style}" no existe`, 'npm run init');
for (const k of ['logo', 'logoOnLight', 'symbol']) if (cfg.brand?.[k] && !fs.existsSync(path.join(ROOT, cfg.brand[k]))) ko(`brand.${k} no existe: ${cfg.brand[k]}`, 'copia el fichero o corrige la ruta con npm run init');
if (cfg.audio?.music && !fs.existsSync(path.join(ROOT, cfg.audio.music))) ko(`audio.music no existe: ${cfg.audio.music}`, 'corrige la ruta o déjala vacía');
const env = fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8') : '';
if (cfg.tts?.engine === 'elevenlabs') /ELEVENLABS_API_KEY=\S+/.test(env) || process.env.ELEVENLABS_API_KEY ? ok('ELEVENLABS_API_KEY presente (no se muestra)') : ko('falta ELEVENLABS_API_KEY', 'añádela a .env (nunca a project.config.json)');
ok(`voz: ${cfg.tts?.engine}${cfg.tts?.engine === 'edge' ? ` · ${cfg.tts.edge?.voice}` : ''}`);
if (process.argv.includes('--voice')) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'engine', 'py.mjs'), '--check'], { stdio: 'inherit' });
  if (r.status !== 0) ko('la prueba de voz ha fallado', 'revisa la red/proxy o usa tts.engine "none" para previsualizar');
}
console.log(bad ? `\n${bad} problema(s). Corrígelos y repite npm run doctor.` : '\nTodo listo. Prueba: npm run demo');
process.exit(bad ? 1 : 0);
