// Theme tokens shared by every style kit. A style is data (styles/<name>/theme.json);
// frame.html calls applyTheme() before importing the scene, and every kit helper reads
// T.* at draw time — so the same scene renders in any style.
//
// Defaults below = the neutral "corporate" look (navy night stage, amber energy).

export const T = {
  name: 'corporate',
  mode: 'dark',
  // colours
  bg: '#0b1f33', bg2: '#123a5c', deep: '#06121f',
  primary: '#1d5c8f', accent: '#f29a2e', accentHi: '#ffb85c',
  text: '#ffffff', soft: '#c9d6e2', line: 'rgba(201,214,226,0.22)',
  paper: '#f5f6f7', paper2: '#e5ebf0', ink: '#0b1f33',
  ok: '#7cc576', bad: '#e5484d', warn: '#ffd33d',
  series: ['#f29a2e', '#5aa9e6', '#7cc576', '#c58af9', '#ff6f91'],
  // type
  fontDisplay: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  fontBody: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  fontMono: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
  wHead: 300, wText: 300, wLabel: 600, headCase: 'none', headTracking: 0,
  // shape
  radius: 18, panel: 'glass', lineWidth: 2,
  // stage + motion
  stage: { kind: 'night', grid: 1, motes: 1 },
  glow: 1, energy: 1,
};

/** Effective config (project.config.json + video.json), set by frame.html before scenes load. */
export const CFG = {};

/** Brand comes from project.config.json → brand (no logos shipped with the repo). */
export const BRAND = { name: '', product: '', logo: '', logoOnLight: '', symbol: '', showBug: true };

/** Display font family string (live binding, kept for older kits that import NF). */
export let NF = T.fontDisplay;
/** Monospace family string (live binding). */
export let MONO = T.fontMono;

const FLAT = { colors: true, fonts: true, type: true, shape: true, motion: true };
const RENAME = { display: 'fontDisplay', body: 'fontBody', mono: 'fontMono', headWeight: 'wHead', textWeight: 'wText', labelWeight: 'wLabel' };

/** theme: parsed theme.json. Nested groups (colors, fonts, type, shape, motion) are flattened into T. */
export function applyTheme(theme = {}, brand = {}, cfg = null) {
  if (cfg) Object.assign(CFG, cfg);
  for (const [k, v] of Object.entries(theme)) {
    if (FLAT[k] && v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) { if (kk !== 'files') T[RENAME[kk] ?? kk] = vv; }
    else if (k === 'stage') T.stage = { ...T.stage, ...v };
    else if (!(k in FLAT)) T[k] = v;
  }
  Object.assign(BRAND, brand || {});
  NF = T.fontDisplay;
  MONO = T.fontMono;
}

/** Load font files declared in theme.fonts.files ([{family, src, weight, style}]) relative to the style folder. */
export async function loadThemeFonts(theme, styleUrl) {
  for (const f of theme?.fonts?.files ?? []) {
    try {
      const ff = new FontFace(f.family, `url(${styleUrl}/${f.src})`, { weight: String(f.weight ?? 400), style: f.style ?? 'normal' });
      document.fonts.add(await ff.load());
    } catch (err) { console.warn(`font ${f.src}: ${err.message}`); }
  }
}

/** rgba() from a token name or a hex colour: ra('accent', 0.5) · ra('#ff0000', 0.2). */
export function ra(c, a = 1) {
  const hex = (T[c] ?? c).trim();
  if (hex.startsWith('rgb')) return hex.replace(/rgba?\(([^)]+)\)/, (_, body) => `rgba(${body.split(',').slice(0, 3).join(',')},${a})`);
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Mix two colours (tokens or hex) → hex. */
export function mixc(a, b, k) {
  const p = (c) => { const m = ra(c, 1).match(/[\d.]+/g).map(Number); return m; };
  const x = p(a), y = p(b);
  return '#' + [0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * k).toString(16).padStart(2, '0')).join('');
}

/** Apply the theme's headline case. */
export const headCase = (s) => (T.headCase === 'upper' ? s.toUpperCase() : T.headCase === 'lower' ? s.toLowerCase() : s);

/** Legacy alias: older kits read N.azul / N.naranja… — mapped onto the active theme. */
const ALIAS = { azul: 'primary', azulHover: 'primary', night: 'bg', night2: 'bg2', deep: 'deep', naranja: 'accent', naranjaHi: 'accentHi',
  soft: 'soft', line: 'line', white: 'text', gris: 'soft', grisCalido: 'soft', verde: 'ok', verdeLima: 'ok', rojo: 'bad', amarillo: 'warn', paper: 'paper' };
export const N = new Proxy({}, { get: (_, k) => T[ALIAS[k] ?? k] });
