#!/usr/bin/env node
// Style creator: writes styles/<name>/{theme.json, kit.js, estilo.md} and renders preview.png.
// Only 3 colours are required (background, primary, accent); the rest of the palette is derived.
//
//   npm run new-style                                   interactive wizard
//   npm run new-style -- --yes --name marca-x --from minimal --mode dark \
//        --bg "#101418" --primary "#3a7bd5" --accent "#ffb703" --display "Georgia, serif" \
//        --stage mesh --panel glass --radius 20 --head-weight 600 --case none --glow 1 \
//        --label "Marca X" --tone "sobrio" --description "…" --best-for "ventas,eventos"
//   npm run new-style -- --json mi-tema.json --name marca-x    (any theme.json fields, merged over --from)
//
// Agents: use the flags (non-interactive) — e.g. derive colours/fonts from a brand guide or a
// website the user names, then run this and look at styles/<name>/preview.png.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, readJson, listStyles, deepMerge } from './config.mjs';
import { text, number, choose, color, title, note, close, slugify, YES } from './lib/ask.mjs';

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };

// ── colour maths ──────────────────────────────────────────────────────────────
const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgb2hex = (r) => '#' + r.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, k) => rgb2hex(hex2rgb(a).map((v, i) => v + (hex2rgb(b)[i] - v) * k));
const lum = (h) => { const [r, g, b] = hex2rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgba = (h, a) => `rgba(${hex2rgb(h).join(',')},${a})`;
const rot = (h, deg) => {   // hue rotation in HSL, for the chart series
  let [r, g, b] = hex2rgb(h).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let hh = 0, s = 0;
  if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; }
  hh = (hh + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = l - c / 2;
  const [a, bb, cc] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return rgb2hex([(a + m) * 255, (bb + m) * 255, (cc + m) * 255]);
};

/** Full palette from bg / primary / accent (+ optional text). */
export function derivePalette({ mode, bg, primary, accent, text: tx }) {
  const dark = mode !== 'light';
  const text = tx ?? (dark ? '#ffffff' : mix(bg, '#000000', 0.86));
  const soft = mix(text, bg, 0.32);
  return {
    bg, bg2: dark ? mix(bg, primary, 0.28) : mix(bg, '#ffffff', 0.6), deep: dark ? mix(bg, '#000000', 0.5) : mix(bg, '#000000', 0.08),
    primary, accent, accentHi: mix(accent, '#ffffff', 0.3), text, soft, line: rgba(soft, dark ? 0.24 : 0.3),
    paper: dark ? '#f6f7f8' : mix(bg, '#ffffff', 0.7), paper2: dark ? mix('#f6f7f8', primary, 0.08) : mix(bg, primary, 0.06), ink: dark ? bg : text,
    ok: '#3fb67a', bad: '#e5484d', warn: '#f4b740',
    series: [accent, primary === bg ? rot(accent, 150) : primary, rot(accent, 120), rot(accent, 200), rot(accent, 280)],
  };
}

const FONT_PRESETS = [
  { value: '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif', label: 'Sans neutra del sistema' },
  { value: '"SF Pro Display", "Segoe UI Variable Display", "Segoe UI", Arial, sans-serif', label: 'Sans de producto (estilo keynote)' },
  { value: '"Palatino Linotype", Palatino, Georgia, serif', label: 'Serif clásica' },
  { value: '"Didot", "Bodoni MT", "Playfair Display", Georgia, serif', label: 'Serif de alto contraste (revista)' },
  { value: '"Nunito", "Segoe UI Rounded", "Arial Rounded MT Bold", sans-serif', label: 'Redondeada amable' },
  { value: '"Bahnschrift", "Eurostile", "Segoe UI", sans-serif', label: 'Técnica / condensada' },
  { value: '"Poppins", "Segoe UI Black", "Arial Black", sans-serif', label: 'Geométrica gruesa' },
  { value: '__custom', label: 'Otra (escribe la pila CSS; añade los ficheros en styles/<nombre>/fonts/)' },
];
const STAGES = [
  { value: 'night', label: 'night', hint: 'luz radial, retícula de puntos, partículas' },
  { value: 'clean', label: 'clean', hint: 'plano con viñeta suave, mucho aire' },
  { value: 'mesh', label: 'mesh', hint: 'manchas de color en movimiento' },
  { value: 'paper', label: 'paper', hint: 'papel con grano y filete impreso' },
  { value: 'grid', label: 'grid', hint: 'rejilla en perspectiva y scanlines' },
  { value: 'blocks', label: 'blocks', hint: 'cabecera de revista y rayado' },
  { value: 'blobs', label: 'blobs', hint: 'formas suaves de colores' },
];

// ── questions (or flags) ─────────────────────────────────────────────────────
const styles = listStyles();
console.log('\nCreador de estilos');
note('Solo hacen falta tres colores; el resto de la paleta se calcula. Puedes retocar theme.json después.');
title('Identidad');
const label = flag('--label') ?? await text('Nombre del estilo (p. ej. "Marca X oscuro")', flag('--name') ?? 'Mi estilo');
const name = slugify(flag('--name') ?? await text('Carpeta (slug)', slugify(label)));
if (!name) { console.error('nombre vacío'); process.exit(1); }
const dir = path.join(ROOT, 'styles', name);
if (fs.existsSync(path.join(dir, 'theme.json')) && !args.includes('--force')) { console.error(`styles/${name} ya existe (usa --force para sobrescribir)`); process.exit(1); }
const from = flag('--from') ?? await choose('Partir de un estilo existente (estructura, tipografía y movimiento)', styles.filter((s) => s.name !== 'islas').map((s) => ({ value: s.name, label: s.label ?? s.name, hint: s.tone })), 'corporate');
const base = readJson(path.join(ROOT, 'styles', from, 'theme.json'));
const description = flag('--description') ?? await text('Descripción en una frase', base.description ?? '');
const tone = flag('--tone') ?? await text('Tono (3 adjetivos)', base.tone ?? '');
const bestFor = (flag('--best-for') ?? await text('Va bien para (separado por comas)', (base.bestFor ?? []).join(', '))).split(',').map((s) => s.trim()).filter(Boolean);

title('Color');
const mode = flag('--mode') ?? await choose('Fondo', [{ value: 'dark', label: 'Oscuro' }, { value: 'light', label: 'Claro' }], base.mode ?? 'dark');
const bc = base.colors ?? {};
const sameMode = (base.mode ?? 'dark') === mode;
const bg = flag('--bg') ?? await color('Color de fondo #rrggbb', sameMode ? bc.bg : mode === 'dark' ? '#0e1726' : '#f7f5f0');
const primary = flag('--primary') ?? await color('Color principal (marca, nodos, líneas) #rrggbb', bc.primary ?? '#1d5c8f');
const accent = flag('--accent') ?? await color('Color de acento (la palabra que importa, energía) #rrggbb', bc.accent ?? '#f29a2e');
const txFlag = flag('--text');
const colors = derivePalette({ mode, bg, primary, accent, text: txFlag });
const c1 = contrast(colors.text, bg), c2 = contrast(accent, bg);
note(`  contraste texto/fondo ${c1.toFixed(1)}:1 ${c1 < 4.5 ? '⚠ bajo (mínimo 4.5)' : '✔'} · acento/fondo ${c2.toFixed(1)}:1 ${c2 < 3 ? '⚠ bajo para texto grande' : '✔'}`);

title('Tipografía');
const bf = base.fonts ?? {};
let display = flag('--display') ?? await choose('Fuente de titulares', FONT_PRESETS, FONT_PRESETS.find((f) => f.value === bf.display)?.value ?? FONT_PRESETS[0].value);
if (display === '__custom') display = await text('Pila CSS de titulares', bf.display ?? FONT_PRESETS[0].value);
let body = flag('--body') ?? await choose('Fuente de texto', [{ value: display, label: 'La misma que titulares' }, ...FONT_PRESETS], display);
if (body === '__custom') body = await text('Pila CSS de texto', bf.body ?? display);
const bt = base.type ?? {};
const headWeight = Number(flag('--head-weight') ?? await choose('Peso de titulares', [300, 400, 600, 700, 900].map((v) => ({ value: v, label: String(v), hint: { 300: 'ligero', 400: 'normal', 600: 'seminegrita', 700: 'negrita', 900: 'black' }[v] })), bt.headWeight ?? 300));
const headCase = flag('--case') ?? await choose('Caja de titulares', [{ value: 'none', label: 'Como se escriba' }, { value: 'upper', label: 'MAYÚSCULAS' }, { value: 'lower', label: 'minúsculas' }], bt.headCase ?? 'none');

title('Forma y movimiento');
const bs = base.shape ?? {}, bm = base.motion ?? {};
const radius = Number(flag('--radius') ?? await number('Radio de esquinas (px, 0 = recto)', bs.radius ?? 18, { min: 0, max: 60 }));
const panel = flag('--panel') ?? await choose('Paneles', [{ value: 'glass', label: 'Cristal translúcido' }, { value: 'solid', label: 'Sólido' }, { value: 'outline', label: 'Solo contorno' }, { value: 'card', label: 'Tarjeta con sombra' }], bs.panel ?? 'glass');
const stageKind = flag('--stage') ?? await choose('Fondo animado', STAGES, base.stage?.kind ?? 'night');
const glow = Number(flag('--glow') ?? await number('Brillo / glow (0 = plano, 1 = normal, 2 = neón)', bm.glow ?? 1, { min: 0, max: 3 }));
close();

// ── write ─────────────────────────────────────────────────────────────────────
let theme = deepMerge(base, {
  name, label, description, tone, bestFor, mode, colors,
  fonts: { display, body, mono: bf.mono ?? 'Consolas, monospace' },
  type: { ...bt, headWeight, headCase },
  shape: { ...bs, radius, panel },
  stage: { kind: stageKind, grid: ['night', 'grid'].includes(stageKind) ? 1 : 0, motes: ['night', 'mesh', 'grid'].includes(stageKind) ? 1 : 0 },
  motion: { ...bm, glow },
});
if (flag('--json')) theme = deepMerge(theme, readJson(path.resolve(flag('--json'))));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify(theme, null, 2) + '\n');
const baseKit = fs.existsSync(path.join(ROOT, 'styles', from, 'kit.js')) && from !== 'educacion' && from !== 'islas' ? from : '_base';
fs.writeFileSync(path.join(dir, 'kit.js'), `// ${label} — created with npm run new-style (base: ${from}).
// Re-exports the base kit${baseKit !== '_base' ? ` and the signature components of "${from}"` : ''}; add this style's own pieces below.
export * from '../${baseKit}/kit.js';
`);
fs.writeFileSync(path.join(dir, 'estilo.md'), `# Estilo ${label}

${description}

- **Tono**: ${tone || '—'}
- **Va bien para**: ${bestFor.join(', ') || '—'}
- **Base**: \`${from}\` · tokens en \`theme.json\` · componentes en \`kit.js\`
- **Fondo**: ${mode === 'dark' ? 'oscuro' : 'claro'} (\`stage.kind: ${stageKind}\`), paneles \`${panel}\`, radio ${radius}px, glow ${glow}
- **Color**: fondo \`${bg}\`, principal \`${primary}\`, acento \`${accent}\` (solo para la palabra que importa y la energía)
- **Tipografía**: titulares ${headWeight} ${headCase === 'upper' ? 'en mayúsculas' : ''} — \`${display}\`

## Reglas

- Usa los componentes del kit base (\`styles/_base/kit.js\`): \`stage\`, \`rise\`, \`kicker\`, \`panel\`, \`pill\`, \`kpi\`, \`node\`, \`energyLine\`, \`wordmark\`, \`bug\`, \`edges\`. Leen este tema solos.
- El acento \`${accent}\` es escaso: si todo es acento, nada lo es.
- Texto ≥ 30 px, ≤ 8 palabras en pantalla, nada quieto más de 1 s.
- Vista previa: \`styles/${name}/preview.png\` (\`npm run style:preview -- ${name}\`).
`);
console.log(`\n✔ styles/${name}/theme.json · kit.js · estilo.md`);

if (!args.includes('--no-preview') && fs.existsSync(path.join(ROOT, 'videos/demo/audio/timings.json'))) {
  console.log('Renderizando vista previa…');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'engine/style-preview.mjs'), name], { stdio: 'inherit' });
  if (r.status === 0) console.log(`Abre styles/${name}/preview.png para verlo.`);
} else if (!args.includes('--no-preview')) note('Para ver la vista previa: npm run demo:audio y después npm run style:preview -- ' + name);
if (args.includes('--print-name')) console.log(`STYLE=${name}`);
