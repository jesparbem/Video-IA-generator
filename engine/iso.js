// Isometric diorama kit — floating miniature-world islands (docs/style-diorama.md).
// Pure functions of t. World units: x → down-right, y → down-left, z → up; one tile = 1 unit.
// Light comes from the upper-left: top faces lightest, left (+y) faces mid, right (+x) darkest,
// shadows fall to the lower-right. Time of day (0 day · 1 dusk · 2 night) is a frame-wide light
// state set by sky() (or setTime()) before anything else is drawn; every colour goes through tone().
import { W, H, clamp, lerp, ease, prog, noise, rng, camera } from './runtime.js';

export { camera };

// ── Projection ──────────────────────────────────────────────────────────────
export const U = 56;   // px per world unit along a tile half-width (tile = 2U × U on screen)
export const ZK = 63;  // px per world unit of height
const SS = 2;          // supersampling of cached sprites / island bakes (camera zooms up to ~2.5)

/** world (x, y, z) → iso screen px (before the camera) */
export const iso = (x, y, z = 0) => [(x - y) * U, ((x + y) * U) / 2 - z * ZK];
/** set ctx so that drawing in world (x, y) units lands on the ground plane at height z */
export function plane(ctx, z = 0) { ctx.transform(U, U / 2, -U, U / 2, 0, -z * ZK); }
/** face-local frame: u along the face (world units), v downward from the top edge (world units) */
function faceT(ctx, side, x, y, z, w, d, h) {
  if (side === 'L') { const [ox, oy] = iso(x, y + d, z + h); ctx.transform(U, U / 2, 0, ZK, ox, oy); return w; }
  const [ox, oy] = iso(x + w, y + d, z + h); ctx.transform(U, -U / 2, 0, ZK, ox, oy); return d;
}

// ── Tokens ──────────────────────────────────────────────────────────────────
export const D = {
  SKY_DAY: ['#9FD2F0', '#BFE3F5', '#F4FAFC'],
  SKY_DUSK: ['#C49BCB', '#F6B48A', '#FBE3C6'],
  SKY_NIGHT: ['#0C1230', '#141A3A', '#2B3366'],
  grass: '#8CCB6E', grassL: '#6FB257', grassR: '#5A9A47', grassHi: '#A6DA84', grassLo: '#78B85C',
  soil1: '#A97A52', soil2: '#8A5E3E', soil3: '#6B4630', rock: '#9AA0A6', rockD: '#6E727A',
  water: '#5BB8E8', waterHi: '#A4DDF5', sand: '#EBD9A5', road: '#5E6470', roadLine: '#F2F2F2', walk: '#DCD5C8', pave: '#E6DFD2',
  walls: ['#F3EDE2', '#E8D8C4', '#D6E4F0', '#F0D9D4'],
  roofs: ['#E07A5F', '#5B7DB1', '#3FA27A', '#D9A93A', '#8A7BC0'],
  glass: '#CFE7F4', glassD: '#8FBDD9', warm: '#FFD27A', warmHi: '#FFF1C6', dark: '#26304F',
  leaf: '#6DBE5A', leafL: '#9AD976', leafD: '#4A9644', pine: '#3F9A62', pineL: '#58B577', pineD: '#2B7449', trunk: '#8E5F3C',
  ink: '#1F2433', white: '#FFFFFF', cream: '#F6F3EA',
  red: '#E5484D', amber: '#F5A524', green: '#3DBE6B', blue: '#3B82F6', clay: '#D97757', teal: '#10A37F',
  meta: '#0866FF', nvidia: '#76B900', apple: '#E8E8ED',
  shirts: ['#E5484D', '#3B82F6', '#F5A524', '#3DBE6B', '#8B5CF6', '#F7F4EE', '#2B3142', '#EC7FA8'],
  skins: ['#F3CDAE', '#D9A27A', '#A8714C', '#7A4E33', '#FBE0CA'],
};
export const FONT_ISO = { sans: '"Avenir Next", Avenir, system-ui, sans-serif', mono: 'Menlo, ui-monospace, monospace' };

// ── Colour + light ──────────────────────────────────────────────────────────
const _hx = new Map();
const hex = (c) => { let v = _hx.get(c); if (!v) { const n = parseInt(c.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; _hx.set(c, v); } return v; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export function mix(a, b, p) { const A = hex(a), B = hex(b); return toHex(lerp(A[0], B[0], p), lerp(A[1], B[1], p), lerp(A[2], B[2], p)); }
export function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; }
/** k > 0 lightens toward warm white, k < 0 darkens toward cool violet (illustration shading) */
export const shade = (c, k) => (k >= 0 ? mix(c, '#FFF8EE', k) : mix(c, '#2A2448', -k));

const TOD = { day: 0, dusk: 1, night: 2 };
export const todOf = (v) => (typeof v === 'string' ? TOD[v] : v);
let LT = 0;
/** set the frame's light: 'day' | 'dusk' | 'night' or 0..2 (sky() calls this) */
export function setTime(v) { LT = clamp(todOf(v) ?? 0, 0, 2); }
export const timeOf = () => LT;
/** 0 by day → 1 at full night (for lights) */
export const nightK = () => clamp((LT - 0.75) / 1.05);

const toneAt = (c, k) => {
  if (k === 0) return mix(c, '#FFF4DC', 0.04);
  if (k === 1) return mix(mix(c, '#FF9A55', 0.27), '#5A2E5E', 0.1);
  return mix(mix(c, '#18204D', 0.6), '#4A5BA0', 0.07);
};
const _tone = new Map();
/** colour under the current light */
export function tone(c) {
  const q = Math.round(LT * 40) / 40;
  const key = c + q;
  let v = _tone.get(key);
  if (!v) {
    const i = Math.min(1, Math.floor(q)), f = q - i;
    v = f > 0 ? mix(toneAt(c, i), toneAt(c, i + 1), f) : toneAt(c, i);
    if (_tone.size > 20000) _tone.clear();
    _tone.set(key, v);
  }
  return v;
}
/** three-tone face colours [top, left, right] under the current light */
export function shade3(c) { return [tone(shade(c, 0.2)), tone(c), tone(shade(c, -0.2))]; }

// shadow direction (world units of ground offset per unit of height) + strength, by time of day
const SHK = [{ v: [0.62, 0.16], a: 0.2, c: '#3A2F70' }, { v: [1.55, 0.32], a: 0.27, c: '#4B2A5C' }, { v: [0.42, 0.22], a: 0.2, c: '#070A20' }];
const shv = () => { const i = Math.min(1, Math.floor(LT)), f = LT - i; return [lerp(SHK[i].v[0], SHK[i + 1].v[0], f), lerp(SHK[i].v[1], SHK[i + 1].v[1], f)]; };

// ── Small helpers ───────────────────────────────────────────────────────────
function path(ctx, pts, close = true) { ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); if (close) ctx.closePath(); }
function poly(ctx, pts, fill, seam = 0.8) { path(ctx, pts); ctx.fillStyle = fill; ctx.fill(); if (seam) { ctx.strokeStyle = fill; ctx.lineWidth = seam; ctx.lineJoin = 'round'; ctx.stroke(); } }
const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

// cached sprites, baked per integer time-of-day level and cross-faded between levels
const _spr = new Map();
function spriteAt(key, w, h, ax, ay, fn, level) {
  const k = key + '|' + level;
  let c = _spr.get(k);
  if (!c) {
    const prev = LT; LT = level;
    c = new OffscreenCanvas(Math.max(1, Math.ceil(w * SS)), Math.max(1, Math.ceil(h * SS)));
    const g = c.getContext('2d');
    g.scale(SS, SS); g.translate(ax, ay);
    fn(g);
    LT = prev;
    if (_spr.size > 700) _spr.delete(_spr.keys().next().value);
    _spr.set(k, c);
  }
  return c;
}
function sprite(ctx, key, w, h, ax, ay, fn, x, y, { rot = 0, sc = 1, alpha = 1 } = {}) {
  const i = Math.min(1, Math.floor(LT)), f = LT - i;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sc !== 1) ctx.scale(sc, sc);
  ctx.globalAlpha *= alpha;
  if (f < 0.995) ctx.drawImage(spriteAt(key, w, h, ax, ay, fn, i), -ax, -ay, w, h);
  if (f > 0.005) { if (f < 0.995) ctx.globalAlpha *= f; ctx.drawImage(spriteAt(key, w, h, ax, ay, fn, i + 1), -ax, -ay, w, h); }
  ctx.restore();
}

const _glow = new Map();
function glowSprite(color) {
  let c = _glow.get(color);
  if (!c) {
    c = new OffscreenCanvas(128, 128);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, rgba(color, 1)); gr.addColorStop(0.25, rgba(color, 0.55)); gr.addColorStop(0.6, rgba(color, 0.14)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    _glow.set(color, c);
  }
  return c;
}
/** soft additive glow (screen px under the current transform) */
export function glow(ctx, x, y, r, color, a = 1, { sy = 1 } = {}) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.globalCompositeOperation = LT > 1.15 ? 'lighter' : 'source-over';
  ctx.drawImage(glowSprite(color), x - r, y - r * sy, 2 * r, 2 * r * sy);
  ctx.restore();
}

// ── Camera ──────────────────────────────────────────────────────────────────
/**
 * isoCam(t, keys) — eased keyframes [{ t, x, y, z?, zoom, ease? }], x/y/z = WORLD point to centre on.
 * Zoom interpolates geometrically; a gentle bob + drift keep the frame alive. Returns a runtime camera().
 */
export function isoCam(t, keys, { bob = 1, seed = 0 } = {}) {
  let i0 = 0;
  for (let i = 0; i < keys.length; i++) if (keys[i].t <= t) i0 = i;
  const k0 = keys[i0], k1 = keys[Math.min(i0 + 1, keys.length - 1)];
  const p = k1 === k0 ? 0 : (k1.ease || ease.inOutCubic)(clamp((t - k0.t) / (k1.t - k0.t)));
  const [sx, sy] = iso(lerp(k0.x, k1.x, p), lerp(k0.y, k1.y, p), lerp(k0.z || 0, k1.z || 0, p));
  const zoom = k0.zoom * Math.pow(k1.zoom / k0.zoom, p);
  return { x: sx + noise(t * 0.3, seed) * 5 * bob, y: sy + Math.sin(t * 0.85) * 4 * bob + noise(t * 0.27, seed + 7) * 3 * bob, zoom, rot: 0 };
}
/** world point → final screen px under cam (anchor tags/titles here, outside camera()) */
export function toScreen(cam, x, y, z = 0) {
  const [sx, sy] = iso(x, y, z);
  return [W / 2 + (sx - cam.x) * cam.zoom, H / 2 + (sy - cam.y) * cam.zoom];
}

// ── Sky ─────────────────────────────────────────────────────────────────────
const SKIES = [D.SKY_DAY, D.SKY_DUSK, D.SKY_NIGHT];
let _stars = null;
function stars() {
  if (_stars) return _stars;
  _stars = new OffscreenCanvas(W, H);
  const g = _stars.getContext('2d');
  const r = rng(77);
  for (let i = 0; i < 420; i++) {
    const x = r() * W, y = Math.pow(r(), 1.4) * H * 0.95, s = r() < 0.08 ? 2.2 : r() * 1.4 + 0.5;
    g.fillStyle = `rgba(255,${235 + r() * 20 | 0},${200 + r() * 55 | 0},${0.35 + r() * 0.6})`;
    g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
  }
  return _stars;
}
/**
 * sky(ctx, t, tod) — full-frame background for 'day' | 'dusk' | 'night' or 0..2 (use dayShift()).
 * Sets the frame light (setTime). Draws gradient, sun glow / low sun / moon + stars, far clouds.
 */
export function sky(ctx, t, tod = 'day', { clouds = true, seed = 1 } = {}) {
  setTime(tod);
  const i = Math.min(1, Math.floor(LT)), f = LT - i;
  const st = SKIES[i].map((c, k) => mix(c, SKIES[i + 1][k], f));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, st[0]); gr.addColorStop(0.55, st[1]); gr.addColorStop(1, st[2]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  const day = clamp(1 - LT), dusk = clamp(1 - Math.abs(LT - 1)), nt = clamp(LT - 1);
  // sun: high and soft by day, big and low by dusk
  const sunX = lerp(W * 0.16, W * 0.12, dusk), sunY = lerp(H * 0.1, H * 0.66, dusk);
  if (day + dusk > 0.02) {
    const r = lerp(760, 980, dusk);
    const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, r);
    const sc = dusk > day ? '#FFC68C' : '#FFFBE8';
    sg.addColorStop(0, rgba(sc, 0.75 * (day + dusk))); sg.addColorStop(0.35, rgba(sc, 0.25 * (day + dusk))); sg.addColorStop(1, rgba(sc, 0));
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    if (dusk > 0.05) { ctx.fillStyle = rgba('#FFE7C2', 0.9 * dusk); ctx.beginPath(); ctx.arc(sunX, sunY, 70, 0, Math.PI * 2); ctx.fill(); }
  }
  if (nt > 0.01) {
    ctx.globalAlpha = nt;
    ctx.drawImage(stars(), 0, 0);
    const r = rng(seed + 31);
    for (let k = 0; k < 18; k++) {
      const x = r() * W, y = r() * H * 0.6, tw = 0.5 + 0.5 * Math.sin(t * (1.5 + r() * 2) + k * 2.1);
      ctx.fillStyle = rgba('#FFF6DD', 0.9 * tw);
      ctx.beginPath(); ctx.arc(x, y, 1.6 + tw * 1.4, 0, Math.PI * 2); ctx.fill();
    }
    const mx = W * 0.83, my = H * 0.17;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 300);
    mg.addColorStop(0, 'rgba(220,230,255,0.4)'); mg.addColorStop(1, 'rgba(220,230,255,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - 300, my - 300, 600, 600);
    ctx.fillStyle = '#F4F1E4'; ctx.beginPath(); ctx.arc(mx, my, 48, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba('#C9C3B0', 0.5);
    [[-14, -10, 9], [12, 8, 7], [-4, 18, 5]].forEach(([a, b, rr]) => { ctx.beginPath(); ctx.arc(mx + a, my + b, rr, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
  }
  if (clouds) {
    const r = rng(seed + 5);
    for (let k = 0; k < 6; k++) {
      const s = 0.55 + r() * 0.6, y = H * (0.12 + r() * 0.75), sp = 6 + r() * 10;
      const x = ((r() * (W + 800) + t * sp) % (W + 800)) - 400;
      cloud(ctx, x, y, s, { seed: seed * 10 + k, alpha: 0.55 });
    }
  }
  ctx.restore();
}
/** interpolated time-of-day value for sky(): dayShift(p, 'dusk', 'night') */
export const dayShift = (p, from = 'day', to = 'dusk') => lerp(todOf(from), todOf(to), ease.inOutQuad(clamp(p)));

/** puffy cumulus; x, y = centre of the flat base (px in the current space); s = 1 ≈ 340 px wide */
export function cloud(ctx, x, y, s = 1, { seed = 1, alpha = 1, t = 0, drift = 0 } = {}) {
  sprite(ctx, `cloud${seed}`, 400, 200, 200, 150, (g) => {
    const r = rng(seed * 13 + 1);
    const puffs = [];
    const n = 5 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const rad = 34 + Math.sin(u * Math.PI) * 52 + r() * 18;
      puffs.push([lerp(-150, 150, u) + (r() - 0.5) * 20, -rad * 0.55 - Math.sin(u * Math.PI) * 18, rad]);
    }
    puffs.push([(r() - 0.5) * 60, -95 - r() * 20, 52]);
    g.save();
    g.beginPath(); g.rect(-200, -150, 400, 150); g.clip();
    const base = tone('#FFFFFF'), mid = tone('#EAF0F8'), low = tone('#C9D2EA');
    g.fillStyle = low; puffs.forEach(([a, b, rr]) => { g.beginPath(); g.arc(a + 6, b + 4, rr, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = mid; puffs.forEach(([a, b, rr]) => { g.beginPath(); g.arc(a + 2, b + 1, rr * 0.97, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = base; puffs.forEach(([a, b, rr]) => { g.beginPath(); g.arc(a - rr * 0.12, b - rr * 0.14, rr * 0.86, 0, Math.PI * 2); g.fill(); });
    g.restore();
    g.fillStyle = low; g.beginPath(); g.ellipse(0, -2, 170, 6, 0, 0, Math.PI * 2); g.fill();
  }, x + drift * t, y, { sc: s, alpha });
}

// ── Island ──────────────────────────────────────────────────────────────────
const _isl = new Map();
function bakeIsland(o, level) {
  const prev = LT; LT = level;
  const { x, y, w, d, T, seed, ground, belly, flowers } = o;
  const R = rng(seed);
  const A = iso(x, y), B = iso(x + w, y), C = iso(x + w, y + d), L = iso(x, y + d);
  const bellyD = belly * (0.34 * Math.min(w, d) + 1.4);
  const pad = 40;
  const bx0 = L[0] - pad, bx1 = B[0] + pad, by0 = A[1] - pad, by1 = C[1] + (T + bellyD + 0.8) * ZK + pad;
  const S = o.res;
  const cv = new OffscreenCanvas(Math.ceil((bx1 - bx0) * S), Math.ceil((by1 - by0) * S));
  const g = cv.getContext('2d');
  g.scale(S, S); g.translate(-bx0, -by0);
  g.lineJoin = 'round';

  // rim along the slab's bottom front edges (L' → C' → B')
  const tot = w + d, N = Math.round(tot * 2.2);
  const rimW = (s) => { const q = s * tot; return q <= w ? [x + q, y + d] : [x + w, y + d - (q - w)]; };
  const rim = [], mid = [], bot = [];
  const cx = C[0];
  for (let i = 0; i <= N; i++) {
    const s = i / N, [wx, wy] = rimW(s);
    const p = iso(wx, wy, -T);
    const taper = Math.pow(Math.sin(Math.PI * s), 0.75);
    const dep = bellyD * taper * (0.82 + 0.3 * R()) * ZK;
    rim.push(p);
    mid.push([p[0] + (cx - p[0]) * 0.2, p[1] + dep * 0.42 + 0.05 * ZK]);
    bot.push([p[0] + (cx - p[0]) * 0.5, p[1] + dep * (i % 2 ? 0.78 : 0.95)]);
  }
  const tip = [cx + (R() - 0.5) * 30, C[1] + (T + bellyD * 1.08) * ZK];
  const facet = (pts, c, k) => poly(g, pts, tone(shade(c, k)), 1);
  for (let i = 0; i < N; i++) {
    const side = (rim[i][0] + rim[i + 1][0]) / 2 < cx ? 0.05 : -0.2;
    facet([rim[i], rim[i + 1], mid[i + 1], mid[i]], D.soil3, side + (R() - 0.5) * 0.1);
    facet([mid[i], mid[i + 1], bot[i + 1], bot[i]], mix(D.soil3, '#5D5660', 0.55), side - 0.04 + (R() - 0.5) * 0.12);
    facet([bot[i], bot[i + 1], tip], mix('#5D5660', '#3E3946', 0.4), side - 0.08 + (R() - 0.5) * 0.12);
  }
  // underside dissolves into the sky toward the tip
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const hz = g.createLinearGradient(0, C[1] + (T + bellyD * 0.35) * ZK, 0, tip[1] + 10);
  hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(1, 'rgba(0,0,0,0.8)');
  g.fillStyle = hz; g.fillRect(bx0, C[1], bx1 - bx0, by1 - C[1]);
  g.restore();
  // hanging roots
  g.lineCap = 'round';
  for (let i = 0; i < Math.round(tot * 0.9); i++) {
    const k = 1 + Math.floor(R() * (N - 1)), [px, py] = mid[k], len = (0.25 + R() * 0.7) * ZK;
    g.strokeStyle = tone(shade(D.soil3, -0.25)); g.lineWidth = 1.6 + R() * 1.4;
    g.beginPath(); g.moveTo(px, py - 6); g.bezierCurveTo(px + 6, py + len * 0.4, px - 8, py + len * 0.7, px + (R() - 0.5) * 10, py + len); g.stroke();
  }
  // small floating rocks under the island
  for (let i = 0; i < 3; i++) {
    const rx = cx + (R() - 0.5) * (B[0] - L[0]) * 0.55, ry = tip[1] - bellyD * ZK * (0.1 + R() * 0.25) + 50, rs = 10 + R() * 12;
    poly(g, [[rx - rs, ry], [rx - rs * 0.3, ry - rs * 0.7], [rx + rs * 0.8, ry - rs * 0.4], [rx + rs * 0.2, ry + rs * 0.2]], tone(shade('#7A7480', 0.05)), 1);
    poly(g, [[rx - rs, ry], [rx + rs * 0.2, ry + rs * 0.2], [rx + rs * 0.1, ry + rs * 1.1]], tone(shade('#5D5660', -0.15)), 1);
    poly(g, [[rx + rs * 0.2, ry + rs * 0.2], [rx + rs * 0.8, ry - rs * 0.4], [rx + rs * 0.1, ry + rs * 1.1]], tone(shade('#5D5660', -0.35)), 1);
  }

  // slab faces with strata
  const bands = [[0, D.soil1], [0.6, D.soil2], [1.02, D.soil3]];
  const face = (side) => {
    const len = side === 'L' ? w : d, k = side === 'L' ? 0 : -0.2, sd = side === 'L' ? 1 : 2;
    const at = (s, z) => (side === 'L' ? iso(x + s, y + d, z) : iso(x + w, y + d - s, z));
    const steps = Math.max(8, Math.round(len * 5));
    bands.forEach(([b0, col], bi) => {
      const pts = [];
      for (let i = 0; i <= steps; i++) { const s = (i / steps) * len; pts.push(at(s, -(b0 + (bi ? 0.07 * noise(s * 1.4, seed + bi * 9 + sd) : 0)))); }
      pts.push(at(len, -T), at(0, -T));
      poly(g, pts, tone(shade(col, k)), 1);
    });
    // sediment dashes + pebbles
    for (let i = 0; i < len * 3.2; i++) {
      const s = R() * len, z = 0.35 + R() * (T - 0.45), [px, py] = at(s, -z);
      if (R() < 0.62) { g.strokeStyle = tone(shade(D.soil2, k - 0.18)); g.lineWidth = 1.4; const [qx, qy] = at(Math.min(len, s + 0.2 + R() * 0.3), -z); g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.stroke(); }
      else {
        const r = 2 + R() * 3;
        g.fillStyle = tone(shade(mix(D.rock, D.soil2, 0.35), k - 0.12)); g.beginPath(); g.ellipse(px, py, r * 1.5, r * 0.85, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = tone(shade(mix(D.rock, D.soil2, 0.35), k + 0.08)); g.beginPath(); g.ellipse(px - r * 0.2, py - r * 0.25, r * 0.9, r * 0.45, 0, 0, Math.PI * 2); g.fill();
      }
    }
    // grass skin with drips
    const top = [];
    for (let i = 0; i <= steps * 2; i++) { const s = (i / (steps * 2)) * len; top.push(at(s, 0)); }
    const drip = [];
    for (let i = steps * 2; i >= 0; i--) {
      const s = (i / (steps * 2)) * len;
      const dd = 0.2 + 0.05 * Math.abs(Math.sin(s * 3.3 + seed)) + 0.1 * Math.max(0, noise(s * 1.7, seed + sd * 3) - 0.35);
      drip.push(at(s, -dd));
    }
    poly(g, [...top, ...drip], tone(side === 'L' ? D.grassL : D.grassR), 1);
    // ambient occlusion down the face
    g.save();
    faceT(g, side, x, y, -T, w, d, T);
    const ao = g.createLinearGradient(0, 0.2, 0, T);
    ao.addColorStop(0, 'rgba(30,20,45,0)'); ao.addColorStop(1, `rgba(30,20,45,${side === 'L' ? 0.22 : 0.3})`);
    g.fillStyle = ao; g.fillRect(0, 0.2, len, T - 0.2);
    g.restore();
  };
  face('L'); face('R');

  // top
  const tg = g.createLinearGradient(A[0], A[1], C[0], C[1]);
  tg.addColorStop(0, tone(shade(D.grass, 0.1))); tg.addColorStop(1, tone(shade(D.grass, -0.06)));
  poly(g, [A, B, C, L], tg, 0);
  g.save();
  path(g, [A, B, C, L]); g.clip();
  g.save();
  plane(g);
  for (let i = 0; i < w * d * 0.5; i++) {
    const px = x + R() * w, py = y + R() * d, r = 0.4 + R() * 1.3;
    g.fillStyle = rgba(tone(R() < 0.5 ? D.grassHi : D.grassLo), 0.35);
    g.beginPath(); g.ellipse(px, py, r, r * (0.6 + R() * 0.5), R() * 3, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  // tufts and flowers (screen space so they stand up)
  for (let i = 0; i < w * d * 2.2; i++) {
    const [px, py] = iso(x + R() * w, y + R() * d);
    g.strokeStyle = tone(R() < 0.5 ? D.grassLo : shade(D.grassL, -0.1)); g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(px - 3, py); g.lineTo(px - 4, py - 5); g.moveTo(px, py); g.lineTo(px, py - 7); g.moveTo(px + 3, py); g.lineTo(px + 4.5, py - 5); g.stroke();
  }
  if (flowers) {
    const fc = ['#FFFFFF', '#FFE27A', '#F7A8C4', '#C9B6F2'];
    for (let i = 0; i < w * d * 0.9; i++) {
      const [px, py] = iso(x + R() * w, y + R() * d);
      g.fillStyle = tone(fc[Math.floor(R() * fc.length)]);
      g.beginPath(); g.arc(px, py - 2, 2.1, 0, Math.PI * 2); g.fill();
    }
  }
  if (ground) { g.save(); plane(g); ground(g); g.restore(); }
  g.restore();
  // lip highlight on the front edges, faint rim on the back edges
  g.lineCap = 'round';
  g.strokeStyle = tone(shade(D.grassHi, 0.25)); g.lineWidth = 2.4;
  path(g, [L, C, B], false); g.stroke();
  g.strokeStyle = rgba(tone('#FFFFFF'), 0.35); g.lineWidth = 1.5;
  path(g, [L, A, B], false); g.stroke();
  LT = prev;
  return { cv, x0: bx0, y0: by0, w: bx1 - bx0, h: by1 - by0 };
}

/**
 * island(ctx, { x, y, w, d, T, key, seed, ground, belly, flowers, res })
 * Floating land chunk occupying world [x, x+w] × [y, y+d], top at z = 0, slab T deep with strata,
 * low-poly rocky underside, hanging roots. `ground(g)` paints static decals in plane coords
 * (road / river / paving / patch). Baked once per time-of-day level and cached under `key`.
 * Returns { x, y, w, d } for sortDraw's shadow clip.
 */
export function island(ctx, o = {}) {
  const opt = { x: 0, y: 0, w: 12, d: 12, T: 1.5, seed: 3, ground: null, belly: 1, flowers: true, res: 1.6, key: 'island', ...o };
  const i = Math.min(1, Math.floor(LT)), f = LT - i;
  const get = (lv) => {
    const k = `${opt.key}|${opt.x},${opt.y},${opt.w},${opt.d}|${lv}`;
    let c = _isl.get(k);
    if (!c) { c = bakeIsland(opt, lv); if (_isl.size > 48) _isl.delete(_isl.keys().next().value); _isl.set(k, c); }
    return c;
  };
  ctx.save();
  if (f < 0.995) { const c = get(i); ctx.drawImage(c.cv, c.x0, c.y0, c.w, c.h); }
  if (f > 0.005) { const c = get(i + 1); if (f < 0.995) ctx.globalAlpha *= f; ctx.drawImage(c.cv, c.x0, c.y0, c.w, c.h); }
  ctx.restore();
  return { x: opt.x, y: opt.y, w: opt.w, d: opt.d };
}

// ── Ground decals (call inside island({ ground(g) {…} }) or under plane()) ──
const smooth = (g, pts) => {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
  const l = pts[pts.length - 1]; g.lineTo(l[0], l[1]);
};
/** road along a polyline of world points; w in world units */
export function road(g, pts, { w = 0.9, walk = true, dash = true } = {}) {
  g.save(); g.lineJoin = 'miter'; g.lineCap = 'square';
  if (walk) { path(g, pts, false); g.strokeStyle = tone(D.walk); g.lineWidth = w + 0.36; g.stroke(); }
  path(g, pts, false); g.strokeStyle = tone(D.road); g.lineWidth = w; g.stroke();
  path(g, pts, false); g.strokeStyle = rgba('#000000', 0.08); g.lineWidth = w * 0.62; g.stroke();
  if (dash) { g.lineCap = 'butt'; path(g, pts, false); g.setLineDash([0.32, 0.3]); g.strokeStyle = tone(D.roadLine); g.lineWidth = 0.055; g.stroke(); }
  g.restore();
}
/** zebra crossing centred at (x, y) across a road running along `dir` ('x' or 'y'), road width w */
export function crosswalk(g, x, y, { dir = 'x', w = 0.9, n = 6, len = 0.42 } = {}) {
  g.fillStyle = tone('#F4F2EC');
  const gap = w / n;
  for (let i = 0; i < n; i++) {
    const o = -w / 2 + gap * (i + 0.25);
    if (dir === 'x') g.fillRect(x - len / 2, y + o, len, gap * 0.5); else g.fillRect(x + o, y - len / 2, gap * 0.5, len);
  }
}
/** river along a (smoothed) polyline; animate with flow() */
export function river(g, pts, { w = 0.9 } = {}) {
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  smooth(g, pts); g.strokeStyle = tone(D.sand); g.lineWidth = w + 0.42; g.stroke();
  smooth(g, pts); g.strokeStyle = tone(shade(D.water, -0.12)); g.lineWidth = w; g.stroke();
  smooth(g, pts); g.strokeStyle = tone(D.water); g.lineWidth = w * 0.72; g.stroke();
  smooth(g, pts); g.strokeStyle = rgba(tone(D.waterHi), 0.55); g.lineWidth = w * 0.25; g.stroke();
  g.restore();
}
/** live ripples along a river path (under camera) */
export function flow(ctx, t, pts, { w = 0.9, speed = 0.5 } = {}) {
  ctx.save(); plane(ctx); ctx.lineCap = 'round';
  [[-0.2, 0, 0.9], [0.18, 0.37, 0.6]].forEach(([off, ph, a]) => {
    const sh = pts.map(([px, py], i) => {
      const n = pts[Math.min(i + 1, pts.length - 1)], p0 = pts[Math.max(0, i - 1)];
      const dx = n[0] - p0[0], dy = n[1] - p0[1], l = Math.hypot(dx, dy) || 1;
      return [px - (dy / l) * off * w, py + (dx / l) * off * w];
    });
    smooth(ctx, sh);
    ctx.setLineDash([0.22, 0.9]); ctx.lineDashOffset = -(t * speed + ph) * 2.2;
    ctx.strokeStyle = rgba(tone('#FFFFFF'), 0.75 * a); ctx.lineWidth = 0.055; ctx.stroke();
  });
  ctx.restore();
}
/** waterfall pouring off an island edge. side 'L': spans x..x+w at y = island front edge; 'R': spans y-w..y at x = island right edge */
export function waterfall(ctx, t, x, y, { w = 0.8, side = 'L', T = 1.5, fall = 3.2 } = {}) {
  ctx.save();
  if (side === 'L') faceT(ctx, 'L', x, y, 0, w, 0, 0); else faceT(ctx, 'R', x, y - w, 0, 0, w, 0);
  const len = T + fall;
  const gr = ctx.createLinearGradient(0, 0, 0, len);
  gr.addColorStop(0, tone(D.water)); gr.addColorStop(0.45, rgba(tone(D.waterHi), 0.85)); gr.addColorStop(1, rgba(tone('#FFFFFF'), 0));
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w + 0.12, len); ctx.lineTo(-0.12, len); ctx.closePath(); ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const u = 0.08 + (i / 6) * (w - 0.16);
    ctx.setLineDash([0.35 + (i % 3) * 0.15, 0.5]); ctx.lineDashOffset = -t * (2.2 + (i % 2) * 0.6) - i * 0.3;
    ctx.strokeStyle = rgba(tone('#FFFFFF'), 0.6); ctx.lineWidth = 0.035;
    ctx.beginPath(); ctx.moveTo(u, 0.05); ctx.lineTo(u + (u - w / 2) * 0.1, len * 0.85); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = rgba(tone('#FFFFFF'), 0.85);
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse((i + 0.5) * (w / 5), 0.02 + Math.sin(t * 6 + i) * 0.02, w / 7, 0.05, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
/** paved plaza tile grid (plane coords) */
export function paving(g, x, y, w, d, { color = D.pave, grid = 0.5 } = {}) {
  g.fillStyle = tone(color); g.fillRect(x, y, w, d);
  g.strokeStyle = tone(shade(color, -0.1)); g.lineWidth = 0.025;
  g.beginPath();
  for (let u = grid; u < w; u += grid) { g.moveTo(x + u, y); g.lineTo(x + u, y + d); }
  for (let v = grid; v < d; v += grid) { g.moveTo(x, y + v); g.lineTo(x + w, y + v); }
  g.stroke();
}
/** flat patch (sand, field, pond…); rows = crop lines along x */
export function patch(g, x, y, w, d, { color = D.sand, rows = 0, r = 0.25 } = {}) {
  g.fillStyle = tone(color); g.beginPath(); g.roundRect(x, y, w, d, r); g.fill();
  if (rows) { g.strokeStyle = tone(shade(color, -0.15)); g.lineWidth = 0.06; g.beginPath(); for (let i = 1; i < rows; i++) { const v = y + (i / rows) * d; g.moveTo(x + 0.1, v); g.lineTo(x + w - 0.1, v); } g.stroke(); }
}

// ── Paths ───────────────────────────────────────────────────────────────────
/** position along a world polyline at p 0..1 (by length) → { x, y, dx, dy } */
export function along(pts, p) {
  let tot = 0; const seg = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
  let q = clamp(p) * tot;
  for (let i = 0; i < seg.length; i++) {
    if (q <= seg[i] || i === seg.length - 1) {
      const f = seg[i] ? clamp(q / seg[i]) : 0, a = pts[i], b = pts[i + 1];
      return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), dx: (b[0] - a[0]) / (seg[i] || 1), dy: (b[1] - a[1]) / (seg[i] || 1), len: tot };
    }
    q -= seg[i];
  }
  return { x: pts[0][0], y: pts[0][1], dx: 1, dy: 0, len: tot };
}

// ── Shadows + depth sorting ─────────────────────────────────────────────────
let _sh = null;
/** shadow casters, drawn in plane coords into sortDraw's shadow layer (opaque fills; the layer sets colour/alpha) */
export const cast = {
  box(g, x, y, w, d, h) {
    const [lx, ly] = shv(); const ox = h * lx, oy = h * ly;
    path(g, [[x, y], [x + w, y], [x + w + ox, y + oy], [x + w + ox, y + d + oy], [x + ox, y + d + oy], [x, y + d]]); g.fill();
  },
  blob(g, x, y, r, h) {
    const [lx, ly] = shv(); const ox = h * lx, oy = h * ly;
    g.beginPath(); g.ellipse(x + ox * 0.62, y + oy * 0.62, r + Math.hypot(ox, oy) * 0.32, r * 0.95, Math.atan2(oy, ox), 0, Math.PI * 2); g.fill();
    g.lineWidth = 0.1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + ox * 0.4, y + oy * 0.4); g.stroke();
  },
  pole(g, x, y, h, r = 0.05) {
    const [lx, ly] = shv(); g.lineWidth = r * 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + h * lx, y + h * ly); g.stroke();
  },
};
/**
 * sortDraw(ctx, items, { clip }) — items [{ x, y, z?, draw(ctx), shadow?(g) }] with x, y = footprint centre.
 * Draws every shadow first into one soft layer (no double-darkening, clipped to the island top `clip`
 * = island() return value or array of them), then items back-to-front by (x + y), then z.
 */
export function sortDraw(ctx, items, { clip = null } = {}) {
  const list = items.filter(Boolean).sort((a, b) => (a.x + a.y + (a.z || 0) * 0.01) - (b.x + b.y + (b.z || 0) * 0.01));
  const casters = list.filter((i) => i.shadow);
  if (casters.length) {
    if (!_sh) _sh = new OffscreenCanvas(W / 2, H / 2);
    const g = _sh.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W / 2, H / 2);
    const m = ctx.getTransform();
    g.setTransform(m.a / 2, m.b / 2, m.c / 2, m.d / 2, m.e / 2, m.f / 2);
    plane(g);
    g.fillStyle = '#000'; g.strokeStyle = '#000';
    for (const i of casters) i.shadow(g);
    if (clip) {
      g.globalCompositeOperation = 'destination-in';
      g.beginPath();
      (Array.isArray(clip) ? clip : [clip]).forEach((c) => g.rect(c.x, c.y, c.w, c.d));
      g.fill();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const i0 = Math.min(1, Math.floor(LT)), f = LT - i0;
    g.globalCompositeOperation = 'source-in'; g.fillStyle = mix(SHK[i0].c, SHK[i0 + 1].c, f); g.fillRect(0, 0, W / 2, H / 2);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha *= lerp(SHK[i0].a, SHK[i0 + 1].a, f);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(_sh, 0, 0, W, H);
    ctx.restore();
  }
  for (const i of list) i.draw(ctx);
}

// ── Solids ──────────────────────────────────────────────────────────────────
/**
 * box(ctx, x, y, z, w, d, h, color, { ao, edge, faces }) — shaded cuboid: top lightest, left (+y) mid,
 * right (+x) darkest, ambient occlusion at the wall bases, crisp highlight on the front top edges.
 */
export function box(ctx, x, y, z, w, d, h, color, { ao = 0.2, edge = 0.5, faces = null } = {}) {
  const [ct, cl, cr] = faces || shade3(color);
  const p = iso;
  poly(ctx, [p(x, y + d, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x, y + d, z)], cl);
  poly(ctx, [p(x + w, y + d, z + h), p(x + w, y, z + h), p(x + w, y, z), p(x + w, y + d, z)], cr);
  poly(ctx, [p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)], ct);
  if (ao && h > 0.12) {
    for (const side of ['L', 'R']) {
      ctx.save();
      const len = faceT(ctx, side, x, y, z, w, d, h);
      const a = Math.max(0, h - 0.5);
      const gr = ctx.createLinearGradient(0, a, 0, h);
      gr.addColorStop(0, 'rgba(28,20,50,0)'); gr.addColorStop(1, `rgba(28,20,50,${ao})`);
      ctx.fillStyle = gr; ctx.fillRect(0, a, len, h - a);
      ctx.restore();
    }
  }
  if (edge) {
    ctx.strokeStyle = rgba(tone('#FFFFFF'), edge); ctx.lineWidth = 1.1; ctx.lineJoin = 'round';
    path(ctx, [p(x, y + d, z + h), p(x + w, y + d, z + h), p(x + w, y, z + h)], false); ctx.stroke();
  }
}
/** pitched roof / wedge on footprint w × d at height z, ridge h above; axis 'x' or 'y' = ridge direction */
export function prism(ctx, x, y, z, w, d, h, color, { axis = 'x', over = 0.08 } = {}) {
  const [ct, cl, cr] = shade3(color);
  const p = iso;
  x -= over; y -= over; w += 2 * over; d += 2 * over;
  if (axis === 'x') {
    const ry = y + d / 2;
    poly(ctx, [p(x, y, z), p(x + w, y, z), p(x + w, ry, z + h), p(x, ry, z + h)], tone(shade(color, 0.28)));   // back slope (sun side)
    poly(ctx, [p(x, ry, z + h), p(x + w, ry, z + h), p(x + w, y + d, z), p(x, y + d, z)], cl);                // front slope
    poly(ctx, [p(x + w, y + d, z), p(x + w, y, z), p(x + w, ry, z + h)], cr);                                  // gable
    ctx.strokeStyle = rgba(tone('#FFFFFF'), 0.45); ctx.lineWidth = 1.2;
    path(ctx, [p(x, ry, z + h), p(x + w, ry, z + h)], false); ctx.stroke();
  } else {
    const rx = x + w / 2;
    poly(ctx, [p(x, y, z), p(rx, y, z + h), p(rx, y + d, z + h), p(x, y + d, z)], ct);                       // back-left slope
    poly(ctx, [p(x, y + d, z), p(rx, y + d, z + h), p(x + w, y + d, z)], cl);                                 // gable (front)
    poly(ctx, [p(rx, y, z + h), p(x + w, y, z), p(x + w, y + d, z), p(rx, y + d, z + h)], cr);               // right slope
    ctx.strokeStyle = rgba(tone('#FFFFFF'), 0.45); ctx.lineWidth = 1.2;
    path(ctx, [p(rx, y, z + h), p(rx, y + d, z + h)], false); ctx.stroke();
  }
}

// ── Buildings ───────────────────────────────────────────────────────────────
function windowRanks(n, seed, rows) {
  const r = rng(seed);
  const lit = Array.from({ length: n }, (_, i) => [i, r()]).sort((a, b) => a[1] - b[1]).map((a) => a[0]);
  const litRank = new Array(n); lit.forEach((wi, k) => (litRank[wi] = k));
  const inf = Array.from({ length: n }, (_, i) => [i, rows[i] + r() * 1.3]).sort((a, b) => a[1] - b[1]).map((a) => a[0]);
  const infRank = new Array(n); inf.forEach((wi, k) => (infRank[wi] = k));
  return { litRank, infRank };
}
/**
 * building(ctx, x, y, { w, d, floors, color, roof, roofColor, windows, sign, signColor, signFace, door,
 *                       awning, lit, infected, rise, t, seed, props })
 * x, y = back corner of the footprint (world). roof: 'flat' | 'gable' | 'gableY' | 'none'.
 * lit 0..1 switches windows on one by one (warm at dusk/night); infected 0..1 turns them red one by one
 * from the ground up and tints the walls; rise 0..1 grows it out of the ground (feed a spring).
 * sign = short flat text on a board along the top of the front-left face (or signFace 'R').
 * Returns anchor points { top: [x, y, z] roof centre, door: [x, y, 0], h }.
 */
export function building(ctx, x, y, o = {}) {
  const { w = 2, d = 2, floors = 3, color = D.walls[0], roof = 'flat', roofColor = D.roofs[0], windows = true, sign = '', signColor = D.ink, signFace = 'L',
    door = true, awning = null, lit = 0, infected = 0, rise = 1, t = 0, seed = 1, props = true, fh = 0.62, windowStyle = 'grid' } = o;
  const strip = windowStyle === 'strip';
  const zone = sign ? 0.5 : 0.18;
  const h = zone + floors * fh + 0.08;
  const roofH = roof === 'gable' || roof === 'gableY' ? Math.min(w, d) * 0.42 : 0;
  const r = clamp(rise);
  if (r <= 0) return { top: [x + w / 2, y + d / 2, 0], door: [x + w / 2, y + d, 0], h: 0 };
  const sink = -(1 - r) * (h + roofH + 0.2);
  const inf = clamp(infected), nk = nightK();
  ctx.save();
  if (r < 1) {
    const L = iso(x - 0.2, y + d + 0.2, 0), F = iso(x + w + 0.2, y + d + 0.2, 0), R = iso(x + w + 0.2, y - 0.2, 0);
    path(ctx, [[L[0], -1e5], [R[0], -1e5], R, F, L]); ctx.clip();
  }
  const z = sink;
  const wall = mix(color, '#F2B2AE', inf * 0.35);
  // plinth
  box(ctx, x - 0.06, y - 0.06, z, w + 0.12, d + 0.12, 0.1, '#C9C2B6', { ao: 0, edge: 0.3 });
  box(ctx, x, y, z + 0.1, w, d, h, wall, { ao: 0.24, edge: 0.55 });
  const top = z + 0.1 + h;
  const glows = [];
  // windows + door + sign, per face
  const faceDraw = (side) => {
    const len = side === 'L' ? w : d;
    const cols = Math.max(1, Math.floor(len / (strip ? 0.42 : 0.58)));
    const n = cols * floors;
    const rows = Array.from({ length: n }, (_, i) => floors - 1 - Math.floor(i / cols));
    const { litRank, infRank } = windowRanks(n, seed * 7 + (side === 'L' ? 1 : 2), rows);
    ctx.save();
    faceT(ctx, side, x, y, z + 0.1, w, d, h);
    const kd = side === 'L' ? 0 : -0.2;
    const frame = tone(shade(wall, kd + 0.12)), sill = tone(shade(wall, kd - 0.18));
    const sp = len / cols, ww = strip ? sp - 0.045 : 0.28, wh = strip ? 0.42 : 0.36;
    if (strip) for (let f = 0; f < floors - (door && side === 'L' ? 1 : 0); f++) { ctx.fillStyle = tone(shade(wall, kd - 0.1)); ctx.fillRect(0.06, zone + f * fh + 0.08, len - 0.12, wh + 0.08); }
    const dayGlass = [tone(shade(D.glass, kd)), tone(shade(D.glassD, kd))];
    for (let i = 0; i < n; i++) {
      const c = i % cols, f = Math.floor(i / cols);
      const isDoor = door && side === 'L' && f === floors - 1 && c === Math.floor((cols - 1) / 2);
      const u = sp * (c + 0.5) - ww / 2, v = zone + f * fh + (strip ? 0.12 : 0.12);
      if (isDoor) {
        const dw = 0.34, dh = fh - 0.08, du = sp * (c + 0.5) - dw / 2, dv = zone + f * fh + 0.08 + 0.02;
        ctx.fillStyle = frame; ctx.fillRect(du - 0.04, dv - 0.04, dw + 0.08, dh + 0.04);
        ctx.fillStyle = tone(shade('#5B4636', kd)); ctx.fillRect(du, dv, dw, dh);
        ctx.fillStyle = rgba(tone(D.warm), 0.25 + nk * 0.6); ctx.fillRect(du + 0.04, dv + 0.05, dw - 0.08, dh * 0.4);
        if (awning) {
          ctx.fillStyle = tone(awning); ctx.beginPath(); ctx.moveTo(du - 0.1, dv - 0.08); ctx.lineTo(du + dw + 0.1, dv - 0.08); ctx.lineTo(du + dw + 0.16, dv + 0.06); ctx.lineTo(du - 0.16, dv + 0.06); ctx.closePath(); ctx.fill();
          ctx.fillStyle = tone(shade(awning, 0.45)); for (let s = 0; s < 4; s++) ctx.fillRect(du - 0.14 + s * ((dw + 0.28) / 4), dv - 0.02, (dw + 0.28) / 8, 0.08);
        }
        continue;
      }
      if (!windows) continue;
      const on = clamp(lit * n - litRank[i]) * nk;
      const red = clamp(inf * n * 1.05 - infRank[i]);
      if (!strip) { ctx.fillStyle = frame; ctx.fillRect(u - 0.035, v - 0.035, ww + 0.07, wh + 0.07); }
      const pulse = 0.85 + 0.15 * Math.sin(t * 5 + i * 1.3);
      let g0 = dayGlass[0], g1 = dayGlass[1];
      if (nk > 0) { const dk = tone(D.dark); g0 = mix(g0, dk, nk * 0.7); g1 = mix(g1, dk, nk * 0.8); }
      if (on > 0) { g0 = mix(g0, D.warmHi, on); g1 = mix(g1, D.warm, on); }
      if (red > 0) { g0 = mix(g0, '#FF9A8F', red * pulse); g1 = mix(g1, D.red, red); }
      const gr = ctx.createLinearGradient(0, v, 0, v + wh);
      gr.addColorStop(0, g0); gr.addColorStop(1, g1);
      ctx.fillStyle = gr; ctx.fillRect(u, v, ww, wh);
      if (on < 0.5 && red < 0.5) {
        ctx.fillStyle = rgba('#FFFFFF', 0.5 * (1 - nk));
        ctx.beginPath(); ctx.moveTo(u + 0.05, v + wh); ctx.lineTo(u + 0.13, v + wh); ctx.lineTo(u + ww, v + 0.1); ctx.lineTo(u + ww, v); ctx.lineTo(u + ww - 0.06, v); ctx.closePath(); ctx.fill();
      }
      if (!strip) { ctx.fillStyle = frame; ctx.fillRect(u + ww / 2 - 0.012, v, 0.024, wh); ctx.fillStyle = sill; ctx.fillRect(u - 0.05, v + wh + 0.02, ww + 0.1, 0.04); }
      if (on > 0.05 || red > 0.05) {
        const [gx, gy] = side === 'L' ? iso(x + u + ww / 2, y + d, z + 0.1 + h - v - wh / 2) : iso(x + w, y + d - u - ww / 2, z + 0.1 + h - v - wh / 2);
        glows.push([gx, gy, red > on ? D.red : D.warm, Math.max(on * 0.55, red * pulse * 0.75)]);
      }
    }
    if (sign && side === signFace) {
      const bw = len * 0.8, bu = (len - bw) / 2, bv = 0.1, bh = 0.32;
      ctx.fillStyle = tone(shade(signColor, -0.3)); ctx.fillRect(bu + 0.03, bv + 0.04, bw, bh);
      ctx.fillStyle = tone(shade(signColor, kd * 0.5)); ctx.fillRect(bu, bv, bw, bh);
      ctx.save();
      ctx.translate(bu + bw / 2, bv + bh / 2 + 0.01); ctx.scale(0.01, 0.01);
      let fs = 22;
      ctx.font = `800 ${fs}px ${FONT_ISO.sans}`;
      const tw = ctx.measureText(sign).width;
      if (tw > bw * 86) fs *= (bw * 86) / tw;
      ctx.font = `800 ${fs}px ${FONT_ISO.sans}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = mix('#FFFFFF', '#FFF2C8', nk);
      ctx.fillText(sign, 0, 0);
      ctx.restore();
      if (nk > 0.2) { const [sx, sy] = side === 'L' ? iso(x + bu + bw / 2, y + d, z + 0.1 + h - bv - bh / 2) : iso(x + w, y + d - bu - bw / 2, z + 0.1 + h - bv - bh / 2); glows.push([sx, sy, '#FFF2C8', 0.25 * nk, 1.6]); }
    }
    ctx.restore();
  };
  faceDraw('L'); faceDraw('R');
  // roof
  if (roof === 'flat') {
    const [ct] = shade3(wall);
    poly(ctx, [iso(x + 0.1, y + 0.1, top), iso(x + w - 0.1, y + 0.1, top), iso(x + w - 0.1, y + d - 0.1, top), iso(x + 0.1, y + d - 0.1, top)], tone(shade(mix(wall, '#B9B2A6', 0.5), 0.05)));
    ctx.strokeStyle = ct; ctx.lineWidth = 1;
    if (props) {
      const R = rng(seed * 3 + 5);
      box(ctx, x + w * (0.2 + R() * 0.2), y + d * (0.2 + R() * 0.2), top, 0.42, 0.34, 0.24, '#D5D8DC', { ao: 0, edge: 0.4 });
      if (R() < 0.6 && w * d > 3) {
        const px = x + w * 0.62, py = y + d * 0.55;
        box(ctx, px, py, top + 0.02, 0.5, 0.5, 0.05, '#3E5A86', { ao: 0, edge: 0.6 });
        poly(ctx, [iso(px, py + 0.5, top + 0.07), iso(px + 0.5, py + 0.5, top + 0.07), iso(px + 0.5, py, top + 0.07)], rgba('#FFFFFF', 0.15 * (1 - nk)), 0);
      }
    }
  } else if (roof === 'gable' || roof === 'gableY') {
    prism(ctx, x, y, top, w, d, roofH, mix(roofColor, '#8A3A3A', inf * 0.3), { axis: roof === 'gable' ? 'x' : 'y' });
  }
  // emissive window glows
  for (const [gx, gy, c, a, k = 1] of glows) glow(ctx, gx, gy, 26 * k, c, a);
  if (inf > 0) glow(ctx, ...iso(x + w / 2, y + d / 2, top), 90, D.red, inf * (0.35 + 0.15 * Math.sin(t * 4)));
  ctx.restore();
  return { top: [x + w / 2, y + d / 2, top + roofH], door: [x + w / 2, y + d, 0], h: h + 0.1 + roofH };
}
/** shadow caster matching building() */
export function buildingShadow(g, x, y, { w = 2, d = 2, floors = 3, sign = '', roof = 'flat', rise = 1, fh = 0.62 } = {}) {
  const h = ((sign ? 0.5 : 0.18) + floors * fh + 0.18 + (roof === 'gable' || roof === 'gableY' ? Math.min(w, d) * 0.3 : 0)) * clamp(rise);
  if (h > 0.02) cast.box(g, x, y, w, d, h);
}

// ── Nature ──────────────────────────────────────────────────────────────────
const TREE_COL = { green: [D.leafL, D.leaf, D.leafD], lime: ['#C2E07A', '#9CC955', '#73A43E'], autumn: ['#F7C66B', '#EE9A4B', '#C96E3A'], blossom: ['#FBD3DF', '#F3A9C0', '#D982A0'] };
/** round deciduous tree at ground point (x, y). kind: green | lime | autumn | blossom */
export function tree(ctx, x, y, { s = 1, kind = 'green', seed = 1, t = 0, sway = 1 } = {}) {
  const [px, py] = iso(x, y);
  const col = TREE_COL[kind] || TREE_COL.green;
  sprite(ctx, `tree${kind}${seed}`, 130, 150, 65, 140, (g) => {
    const R = rng(seed * 17 + 3);
    poly(g, [[-4, 0], [-4, -42], [0, -44], [0, 2]], tone(shade(D.trunk, 0.15)), 0.5);
    poly(g, [[0, 2], [0, -44], [5, -42], [5, 0]], tone(shade(D.trunk, -0.2)), 0.5);
    const blobs = [[0, -70, 30], [-20, -56, 22], [20, -57, 21], [3, -92, 21], [-12, -82, 18], [15, -80, 17]].map(([a, b, r]) => [a + (R() - 0.5) * 6, b + (R() - 0.5) * 6, r * (0.9 + R() * 0.2)]);
    g.fillStyle = tone(col[2]); blobs.forEach(([a, b, r]) => { g.beginPath(); g.arc(a + 3, b + 3, r, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = tone(col[1]); blobs.forEach(([a, b, r]) => { g.beginPath(); g.arc(a - 1, b - 1, r * 0.9, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = tone(col[0]); blobs.forEach(([a, b, r]) => { g.beginPath(); g.arc(a - r * 0.28, b - r * 0.3, r * 0.55, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = rgba(tone('#FFFFFF'), 0.35);
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-18 + R() * 30, -96 + R() * 40, 1.8, 0, Math.PI * 2); g.fill(); }
  }, px, py, { sc: s, rot: Math.sin(t * 1.3 + seed) * 0.018 * sway });
}
/** conifer: stacked two-tone cones */
export function pine(ctx, x, y, { s = 1, seed = 1, t = 0, snow = false } = {}) {
  const [px, py] = iso(x, y);
  sprite(ctx, `pine${seed}${snow}`, 100, 170, 50, 160, (g) => {
    const R = rng(seed * 11 + 7);
    poly(g, [[-3, 0], [-3, -22], [3, -22], [3, 0]], tone(D.trunk), 0.5);
    const tiers = [[-18, 34, 40], [-48, 27, 38], [-76, 20, 36]];
    tiers.forEach(([b, hw, th], i) => {
      const jw = hw * (0.95 + R() * 0.1), tip = b - th - 12;
      poly(g, [[0, tip], [-jw, b], [0, b + 5]], tone(D.pineL), 0.6);
      poly(g, [[0, tip], [jw, b], [0, b + 5]], tone(D.pineD), 0.6);
      if (snow) poly(g, [[0, tip], [-jw * 0.35, tip + th * 0.35], [0, tip + th * 0.3], [jw * 0.35, tip + th * 0.35]], tone('#F4F7FA'), 0);
      if (i === 0) { g.strokeStyle = tone(shade(D.pine, -0.35)); g.lineWidth = 1; g.beginPath(); g.moveTo(0, tip + 4); g.lineTo(0, b + 4); g.stroke(); }
    });
  }, px, py, { sc: s, rot: Math.sin(t * 1.1 + seed) * 0.012 });
}
/** low round bush */
export function bush(ctx, x, y, { s = 1, seed = 1, kind = 'green', flowers = false } = {}) {
  const [px, py] = iso(x, y);
  const col = TREE_COL[kind] || TREE_COL.green;
  sprite(ctx, `bush${kind}${seed}${flowers}`, 70, 50, 35, 42, (g) => {
    const R = rng(seed * 5 + 2);
    const b = [[-10, -10, 11], [8, -10, 11], [-1, -17, 12]];
    g.fillStyle = tone(col[2]); b.forEach(([a, c, r]) => { g.beginPath(); g.arc(a + 2, c + 2, r, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = tone(col[1]); b.forEach(([a, c, r]) => { g.beginPath(); g.arc(a - 1, c - 1, r * 0.88, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = tone(col[0]); b.forEach(([a, c, r]) => { g.beginPath(); g.arc(a - r * 0.3, c - r * 0.35, r * 0.45, 0, Math.PI * 2); g.fill(); });
    if (flowers) { g.fillStyle = tone(['#F7A8C4', '#FFFFFF', '#FFE27A'][seed % 3]); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-16 + R() * 30, -24 + R() * 16, 2, 0, Math.PI * 2); g.fill(); } }
  }, px, py, { sc: s });
}
/** low-poly rock */
export function rock(ctx, x, y, { s = 1, seed = 1, color = D.rock } = {}) {
  const [px, py] = iso(x, y);
  sprite(ctx, `rock${seed}${color}`, 70, 50, 35, 40, (g) => {
    const R = rng(seed * 9 + 4), a = 16 + R() * 6, b = 12 + R() * 6;
    const T = [-2 + R() * 4, -b - 6];
    poly(g, [[-a, -2], T, [a * 0.2, -b * 0.4], [a * 0.1, 3]], tone(shade(color, 0.1)), 0.6);
    poly(g, [T, [a, -4], [a * 0.8, 2], [a * 0.1, 3], [a * 0.2, -b * 0.4]], tone(shade(color, -0.22)), 0.6);
    poly(g, [[-a, -2], [-a * 0.4, -b * 0.85], T], tone(shade(color, 0.3)), 0.6);
  }, px, py, { sc: s });
}
/** drifting bird (screen px in the current space) */
export function bird(ctx, x, y, { t = 0, s = 1, color = '#2B3142', seed = 0 } = {}) {
  const f = Math.sin(t * 9 + seed * 2) * 6 * s;
  ctx.save(); ctx.strokeStyle = tone(color); ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - 10 * s, y - f); ctx.quadraticCurveTo(x - 4 * s, y - 2 * s, x, y + 1); ctx.quadraticCurveTo(x + 4 * s, y - 2 * s, x + 10 * s, y - f); ctx.stroke();
  ctx.restore();
}

// ── Street furniture ────────────────────────────────────────────────────────
/** street lamp; glows (with a light pool) at dusk/night */
export function lamp(ctx, x, y, { h = 1.2, t = 0, on = 1 } = {}) {
  const [bx, by] = iso(x, y), [tx, ty] = iso(x, y, h);
  const nk = nightK() * on;
  if (nk > 0.02) { ctx.save(); plane(ctx); const g = ctx.createRadialGradient(x, y, 0, x, y, 1.1); g.addColorStop(0, rgba(D.warm, 0.45 * nk)); g.addColorStop(1, rgba(D.warm, 0)); ctx.fillStyle = g; ctx.globalCompositeOperation = LT > 1.15 ? 'lighter' : 'source-over'; ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); ctx.restore(); }
  ctx.strokeStyle = tone('#3A3F4C'); ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.fillStyle = tone('#3A3F4C'); ctx.beginPath(); ctx.roundRect(tx - 6, ty - 8, 12, 7, 2); ctx.fill();
  ctx.fillStyle = mix(tone('#E8E2CF'), D.warmHi, nk); ctx.beginPath(); ctx.ellipse(tx, ty - 1, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  glow(ctx, tx, ty, 40, D.warm, nk * (0.9 + 0.05 * Math.sin(t * 7)));
}
/** bench along x (dir 'x') or y */
export function bench(ctx, x, y, { dir = 'x', color = '#B07A4F' } = {}) {
  const [w, d] = dir === 'x' ? [0.6, 0.2] : [0.2, 0.6];
  box(ctx, x, y, 0, w, d, 0.04, '#4A4E58', { ao: 0, edge: 0 });
  box(ctx, x, y, 0.12, w, d, 0.05, color, { ao: 0, edge: 0.4 });
  if (dir === 'x') box(ctx, x, y, 0.12, w, 0.05, 0.2, color, { ao: 0, edge: 0.3 }); else box(ctx, x, y, 0.12, 0.05, d, 0.2, color, { ao: 0, edge: 0.3 });
}
/** fence along a world polyline */
export function fence(ctx, pts, { color = '#F2EBDD', h = 0.32, step = 0.4 } = {}) {
  ctx.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / step));
    [h * 0.45, h * 0.85].forEach((hh) => { ctx.strokeStyle = tone(shade(color, -0.12)); ctx.lineWidth = 2; path(ctx, [iso(ax, ay, hh), iso(bx, by, hh)], false); ctx.stroke(); });
    for (let k = 0; k <= n; k++) { const px = lerp(ax, bx, k / n), py = lerp(ay, by, k / n); box(ctx, px - 0.03, py - 0.03, 0, 0.06, 0.06, h, color, { ao: 0, edge: 0 }); }
  }
}
/** flag on a pole; cloth waves */
export function flag(ctx, x, y, { t = 0, color = D.red, h = 1.6, w = 0.6 } = {}) {
  const [bx, by] = iso(x, y), [tx, ty] = iso(x, y, h);
  ctx.strokeStyle = tone('#D8DADF'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
  const pts = [], fw = w * U, fhh = 0.36 * ZK, n = 10;
  for (let i = 0; i <= n; i++) { const u = i / n; pts.push([tx + u * fw, ty + 2 + u * fw * 0.5 + Math.sin(t * 6 - u * 5) * 4 * u]); }
  for (let i = n; i >= 0; i--) { const u = i / n; pts.push([tx + u * fw, ty + 2 + fhh + u * fw * 0.5 + Math.sin(t * 6 - u * 5) * 4 * u]); }
  poly(ctx, pts, tone(color), 0.5);
  ctx.fillStyle = tone('#F2F2F2'); ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fill();
}
/** lattice antenna mast with a blinking red light; z = base height (e.g. a roof) */
export function antenna(ctx, x, y, z = 0, { t = 0, h = 1.6 } = {}) {
  const [bx, by] = iso(x, y, z), [tx, ty] = iso(x, y, z + h);
  ctx.strokeStyle = tone('#5A606E'); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(bx - 9, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + 9, by);
  for (let k = 1; k < 5; k++) { const yy = lerp(by, ty, k / 5), hw = 9 * (1 - k / 5); ctx.moveTo(bx - hw, yy); ctx.lineTo(bx + hw, yy); }
  ctx.stroke();
  const bl = (Math.sin(t * 4) > 0.2) ? 1 : 0.25;
  ctx.fillStyle = mix('#7A1F22', D.red, bl); ctx.beginPath(); ctx.arc(tx, ty - 2, 3.5, 0, Math.PI * 2); ctx.fill();
  glow(ctx, tx, ty - 2, 22, D.red, bl * (0.4 + nightK() * 0.6));
}
/** data-centre rack cabinet with blinking LEDs on its front-left face */
export function serverRack(ctx, x, y, { t = 0, w = 0.7, d = 0.5, h = 1.2, seed = 1, color = '#2E3446', led = D.green, alert = 0 } = {}) {
  box(ctx, x, y, 0, w, d, h, color, { ao: 0.15, edge: 0.35 });
  ctx.save();
  faceT(ctx, 'L', x, y, 0, w, d, h);
  const R = rng(seed);
  for (let r = 0; r < 6; r++) {
    const v = 0.12 + r * (h - 0.24) / 6;
    ctx.fillStyle = tone(shade(color, 0.12)); ctx.fillRect(0.06, v, w - 0.12, 0.1);
    for (let k = 0; k < 4; k++) {
      const on = Math.sin(t * (3 + R() * 6) + R() * 9) > -0.2;
      const c = alert > R() ? D.red : (k === 3 ? D.amber : led);
      ctx.fillStyle = on ? c : tone(shade(color, -0.3));
      ctx.fillRect(w - 0.12 - k * 0.07, v + 0.035, 0.035, 0.035);
    }
  }
  ctx.restore();
}
/** canvas tent (ridge along x, opening on the right gable) */
export function tent(ctx, x, y, { w = 1.1, d = 0.9, h = 0.75, color = '#F5A524' } = {}) {
  const [, cl, cr] = shade3(color), ry = y + d / 2;
  poly(ctx, [iso(x, y, 0), iso(x + w, y, 0), iso(x + w, ry, h), iso(x, ry, h)], tone(shade(color, 0.25)));
  poly(ctx, [iso(x, ry, h), iso(x + w, ry, h), iso(x + w, y + d, 0), iso(x, y + d, 0)], cl);
  poly(ctx, [iso(x + w, y + d, 0), iso(x + w, y, 0), iso(x + w, ry, h)], cr);
  poly(ctx, [iso(x + w, y + d * 0.68, 0), iso(x + w, y + d * 0.32, 0), iso(x + w, ry, h * 0.62)], tone('#3A2A2A'), 0);
  ctx.strokeStyle = tone(shade(color, 0.4)); ctx.lineWidth = 1.2; path(ctx, [iso(x - 0.05, ry, h + 0.03), iso(x + w + 0.08, ry, h + 0.03)], false); ctx.stroke();
}
/** stylised flames on logs; intensity 0..1+ (scale + glow). campfire() adds a stone ring */
export function fire(ctx, x, y, { t = 0, intensity = 1, s = 1, stones = false } = {}) {
  const [px, py] = iso(x, y);
  if (stones) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const [sx, sy] = iso(x + Math.cos(a) * 0.32 * s, y + Math.sin(a) * 0.32 * s); ctx.fillStyle = tone(k % 2 ? '#9AA0A6' : '#80868E'); ctx.beginPath(); ctx.ellipse(sx, sy - 2, 6 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.save(); ctx.translate(px, py);
  ctx.strokeStyle = tone('#6B4630'); ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12 * s, 2 * s); ctx.lineTo(12 * s, -4 * s); ctx.moveTo(-10 * s, -4 * s); ctx.lineTo(12 * s, 3 * s); ctx.stroke();
  const k = s * clamp(intensity, 0, 2);
  glow(ctx, 0, -14 * k, 90 * k, '#FF9A3C', 0.55 + 0.1 * Math.sin(t * 13));
  const flame = (sc, col, ph) => {
    const fl = 1 + 0.12 * Math.sin(t * 11 + ph) + 0.08 * noise(t * 7, ph);
    const hh = 34 * sc * fl * k, ww = 13 * sc * k, sw = Math.sin(t * 6 + ph) * 3 * k;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-ww, -2); ctx.bezierCurveTo(-ww * 1.1, -hh * 0.5, sw - ww * 0.2, -hh * 0.7, sw, -hh);
    ctx.bezierCurveTo(sw + ww * 0.3, -hh * 0.6, ww * 1.1, -hh * 0.45, ww, -2); ctx.quadraticCurveTo(0, 4, -ww, -2); ctx.fill();
  };
  flame(1, '#E8502E', 0); flame(0.75, '#F59A2C', 1.7); flame(0.45, '#FFE17A', 3.1);
  for (let i = 0; i < 4; i++) { const a = ((t * 0.9 + i * 0.27) % 1); ctx.fillStyle = rgba('#FFD27A', 1 - a); ctx.beginPath(); ctx.arc(Math.sin(i * 3 + t * 2) * 10 * k, -30 * k - a * 50 * k, 2 * s, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
export const campfire = (ctx, x, y, o = {}) => fire(ctx, x, y, { stones: true, ...o });

/** small car on a road. dir: 'x' | '-x' | 'y' | '-y' (direction of travel); x, y = centre */
export function car(ctx, x, y, { color = D.red, dir = 'x', t = 0 } = {}) {
  const alongX = dir === 'x' || dir === '-x';
  const L = 0.82, Wd = 0.44;
  const [w, d] = alongX ? [L, Wd] : [Wd, L];
  const x0 = x - w / 2, y0 = y - d / 2;
  const nk = nightK();
  // wheels
  ctx.fillStyle = tone('#22252D');
  const wheels = alongX ? [[x0 + 0.18, y0 + d], [x0 + w - 0.18, y0 + d]] : [[x0 + w, y0 + 0.18], [x0 + w, y0 + d - 0.18]];
  box(ctx, x0, y0, 0.08, w, d, 0.2, color, { ao: 0, edge: 0.5 });
  wheels.forEach(([a, b]) => { const [px, py] = iso(a, b, 0.07); ctx.fillStyle = tone('#22252D'); ctx.beginPath(); ctx.ellipse(px, py, 5.5, 5.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = tone('#9AA0A6'); ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill(); });
  const cw = alongX ? w * 0.55 : w * 0.86, cd = alongX ? d * 0.86 : d * 0.55;
  const cx0 = x0 + (w - cw) / 2 + (dir === 'x' ? -0.04 : dir === '-x' ? 0.04 : 0), cy0 = y0 + (d - cd) / 2 + (dir === 'y' ? -0.04 : dir === '-y' ? 0.04 : 0);
  box(ctx, cx0, cy0, 0.28, cw, cd, 0.17, '#DDEBF5', { ao: 0, edge: 0.5, faces: [tone(shade(color, 0.25)), tone(mix('#A9CBE3', '#1E2A4A', nk * 0.6)), tone(mix('#84AACA', '#1E2A4A', nk * 0.6))] });
  // headlights
  const front = dir === 'x' ? [[x0 + w, y0 + d * 0.25], [x0 + w, y0 + d * 0.75]] : dir === 'y' ? [[x0 + w * 0.25, y0 + d], [x0 + w * 0.75, y0 + d]] : null;
  if (front) front.forEach(([a, b]) => { const [px, py] = iso(a, b, 0.17); ctx.fillStyle = mix('#FFF7D6', D.warmHi, nk); ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2); ctx.fill(); glow(ctx, px, py, 16, D.warm, nk * 0.9); });
}

// ── People ──────────────────────────────────────────────────────────────────
/** tiny capsule person at ground (x, y). walk 0..1, wave 0..1, s scale; dir ±1 faces right/left */
export function person(ctx, x, y, { t = 0, color = D.blue, skin = D.skins[0], hair = '#3B2A20', pants = '#3A3F55', walk = 0, wave = 0, s = 1, z = 0, seed = 0, alpha = 1, dir = 1 } = {}) {
  const [px, py] = iso(x, y, z);
  const k = 0.62 * s;
  const ph = t * 11 + seed * 1.7;
  const bob = walk ? Math.abs(Math.sin(ph)) * 1.6 * k : 0;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(px, py);
  ctx.scale(dir, 1);
  ctx.fillStyle = 'rgba(30,25,60,0.22)'; ctx.beginPath(); ctx.ellipse(1.5 * k, 0, 9 * k, 3.6 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = tone(pants); ctx.lineWidth = 3.4 * k; ctx.lineCap = 'round';
  [-2.6, 2.6].forEach((lx, i) => { const sw = walk ? Math.sin(ph + i * Math.PI) * 3.5 * k : 0; ctx.beginPath(); ctx.moveTo(lx * k, -13 * k - bob); ctx.lineTo(lx * k + sw, -1.5 * k); ctx.stroke(); });
  ctx.translate(0, -bob);
  // arms
  ctx.strokeStyle = tone(shade(color, -0.1)); ctx.lineWidth = 3 * k;
  const asw = walk ? Math.sin(ph) * 3 * k : 0;
  ctx.beginPath(); ctx.moveTo(-6 * k, -26 * k); ctx.lineTo(-7.5 * k - asw, -16 * k); ctx.stroke();
  if (wave > 0) { const a = Math.sin(t * 12) * 3 * k; ctx.beginPath(); ctx.moveTo(6 * k, -26 * k); ctx.lineTo(11 * k + a, -38 * k * clamp(wave) - 16 * k * (1 - clamp(wave))); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(6 * k, -26 * k); ctx.lineTo(7.5 * k + asw, -16 * k); ctx.stroke(); }
  // body
  ctx.fillStyle = tone(color); ctx.beginPath(); ctx.roundRect(-6.5 * k, -31 * k, 13 * k, 19 * k, 5.5 * k); ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = tone(shade(color, -0.22)); ctx.fillRect(1.5 * k, -32 * k, 6 * k, 21 * k); ctx.fillStyle = rgba('#FFFFFF', 0.18); ctx.fillRect(-6.5 * k, -31 * k, 3 * k, 19 * k); ctx.restore();
  // head
  ctx.fillStyle = tone(skin); ctx.beginPath(); ctx.arc(0, -37.5 * k, 6.2 * k, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = tone(shade(skin, -0.18)); ctx.beginPath(); ctx.arc(0, -37.5 * k, 6.2 * k, -0.9, 1.2); ctx.fill();
  ctx.fillStyle = tone(hair); ctx.beginPath(); ctx.arc(0, -38.5 * k, 6.4 * k, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  if (s >= 1.6) { ctx.fillStyle = '#2B2230'; [-2.2, 2.2].forEach((ex) => { ctx.beginPath(); ctx.arc(ex * k + 1.2 * k, -36.5 * k, 0.9 * k, 0, Math.PI * 2); ctx.fill(); }); }
  ctx.restore();
}
/** cluster of n people around (x, y) radius r, idling/chatting; depth-sorted among themselves */
export function crowd(ctx, x, y, { n = 6, r = 0.6, t = 0, seed = 1, s = 1, wave = 0 } = {}) {
  const R = rng(seed);
  const ppl = Array.from({ length: n }, (_, i) => ({ x: x + (R() - 0.5) * 2 * r, y: y + (R() - 0.5) * 2 * r, color: D.shirts[Math.floor(R() * D.shirts.length)], skin: D.skins[Math.floor(R() * D.skins.length)], hair: ['#3B2A20', '#1E1A1A', '#A0662E', '#D9B26A'][Math.floor(R() * 4)], dir: R() < 0.5 ? -1 : 1, w: R() < wave ? 1 : 0, i }));
  ppl.sort((a, b) => a.x + a.y - (b.x + b.y)).forEach((p) => person(ctx, p.x, p.y, { t, color: p.color, skin: p.skin, hair: p.hair, dir: p.dir, s, seed: p.i, wave: p.w, z: Math.abs(Math.sin(t * 2 + p.i)) * 0.02 }));
}

// ── The agent ───────────────────────────────────────────────────────────────
const ARROW = [[0, 0], [0, 17], [4, 13.2], [7, 20], [9.4, 19], [6.4, 12.2], [12, 12]];
/**
 * agentBot(ctx, x, y, { t, walk, glow, color, s, z, alpha, enter }) — the cursor-with-legs agent as a
 * small extruded white token with a coloured glow; color = brand glow (islas videos pass AGENT = theme accent). enter 0..1 shrinks
 * it into a doorway (slip-in).
 */
export function agentBot(ctx, x, y, { t = 0, walk = 0, glow: gl = 1, color = D.teal, s = 1, z = 0, alpha = 1, enter = 0, seed = 0 } = {}) {
  if (alpha <= 0 || enter >= 1) return;
  const [px, py] = iso(x, y, z);
  const k = 2.1 * s * (1 - ease.inCubic(clamp(enter)));
  const ph = t * 10 + seed;
  const bob = walk ? Math.abs(Math.sin(ph)) * 2.2 * s : Math.sin(t * 2.4 + seed) * 1.2 * s;
  const hover = 4 * s;
  ctx.save();
  ctx.globalAlpha *= alpha * (1 - clamp(enter) * 0.6);
  ctx.translate(px, py);
  // ground ring + shadow
  ctx.fillStyle = 'rgba(30,25,60,0.22)'; ctx.beginPath(); ctx.ellipse(2 * s, 0, 11 * s, 4.5 * s, 0, 0, Math.PI * 2); ctx.fill();
  if (gl > 0) {
    ctx.strokeStyle = rgba(color, 0.55 * gl); ctx.lineWidth = 2 * s;
    const pr = (t * 1.4 + seed) % 1;
    ctx.save(); ctx.globalAlpha *= 1 - pr * 0.8;
    ctx.beginPath(); ctx.ellipse(0, 0, (8 + pr * 14) * s, (3.5 + pr * 6) * s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    glow(ctx, 0, -22 * s, 46 * s, color, 0.55 * gl);
  }
  // legs
  ctx.strokeStyle = '#2B3142'; ctx.lineWidth = 2.6 * s; ctx.lineCap = 'round';
  [-3.2, 3.2].forEach((lx, i) => { const sw = walk ? Math.sin(ph + i * Math.PI) * 4 * s : 0; ctx.beginPath(); ctx.moveTo(lx * s, -10 * s - bob); ctx.lineTo(lx * s + sw, -1 * s); ctx.stroke(); });
  // body: extruded arrow
  ctx.translate(-5 * k, -10 * s - bob - hover - 17 * k);
  const draw = (dx, dy) => { ctx.beginPath(); ARROW.forEach(([a, b], i) => (i ? ctx.lineTo(a * k + dx, b * k + dy) : ctx.moveTo(a * k + dx, b * k + dy))); ctx.closePath(); };
  ctx.lineJoin = 'round';
  for (let i = 4; i >= 1; i--) { draw(i * 0.8 * s, i * 0.6 * s); ctx.fillStyle = mix('#AEB8C6', '#7D879A', i / 4); ctx.fill(); }
  draw(0, 0);
  const bg = ctx.createLinearGradient(0, 0, 12 * k, 20 * k);
  bg.addColorStop(0, '#FFFFFF'); bg.addColorStop(1, '#E3E9F0');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = rgba(color, 0.9); ctx.lineWidth = 1.4 * s; ctx.stroke();
  // face
  const blink = (Math.floor(t * 8 + seed * 5) % 31) === 0;
  ctx.fillStyle = '#2B3142';
  [3.0, 5.6].forEach((ex) => { ctx.beginPath(); ctx.ellipse(ex * k, 10 * k, 0.75 * k, blink ? 0.15 * k : 1.05 * k, 0, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
}
/** glowing footprints behind an agent along a world path, up to progress p */
export function trail(ctx, pts, { p = 1, t = 0, color = D.teal, step = 0.26, fade = 3.5, alpha = 1 } = {}) {
  const head = along(pts, p), tot = head.len, upto = clamp(p) * tot;
  ctx.save(); plane(ctx);
  ctx.globalCompositeOperation = LT > 1.15 ? 'lighter' : 'source-over';
  let i = 0;
  for (let q = upto - 0.3; q > Math.max(0, upto - fade); q -= step, i++) {
    const a = along(pts, q / tot), side = i % 2 ? 1 : -1;
    const ox = -a.dy * 0.07 * side, oy = a.dx * 0.07 * side;
    ctx.fillStyle = rgba(color, alpha * 0.55 * (1 - (upto - q) / fade));
    ctx.beginPath(); ctx.ellipse(a.x + ox, a.y + oy, 0.07, 0.045, Math.atan2(a.dy, a.dx), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}


// ── Labels + overlays (SCREEN space: anchor with toScreen()) ────────────────
/**
 * tag(ctx, sx, sy, text, { color, size, lift, p, alpha, sub, pin }) — map-pin label: white rounded card
 * with a colour dot, leader line down to the anchor (sx, sy). size = text px on screen (≥ 30).
 */
export function tag(ctx, sx, sy, text, { color = D.red, size = 36, lift = 86, p = 1, alpha = 1, sub = '', pin = true, mono = false } = {}) {
  if (p <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha * clamp(p * 3);
  const pop = ease.outBack(clamp(p));
  const font = `700 ${size}px ${mono ? FONT_ISO.mono : FONT_ISO.sans}`;
  ctx.font = font;
  const tw = ctx.measureText(text).width;
  let sw = 0; const subSize = Math.max(28, Math.round(size * 0.72));
  if (sub) { ctx.font = `600 ${subSize}px ${FONT_ISO.sans}`; sw = ctx.measureText(sub).width; }
  const padX = size * 0.62, dot = size * 0.3, gap = size * 0.34;
  const cw = padX * 2 + dot + gap + Math.max(tw, sw), ch = sub ? size * 1.2 + subSize * 1.35 : size * 1.6;
  const cx = sx, cy = sy - lift * pop;
  if (pin) {
    ctx.strokeStyle = rgba('#1F2433', 0.75); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, cy); ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx, sy, 4.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.translate(cx, cy - ch / 2);
  ctx.scale(pop, pop);
  ctx.shadowColor = 'rgba(25,20,60,0.28)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, ch * 0.32); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-cw / 2 + padX + dot / 2, sub ? -ch / 2 + size * 0.78 : 0, dot / 2, 0, Math.PI * 2); ctx.fill();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = font; ctx.fillStyle = '#1F2433';
  const ty = sub ? -ch / 2 + size * 0.78 : size * 0.04;
  ctx.fillText(text, -cw / 2 + padX + dot + gap, ty);
  if (sub) { ctx.font = `600 ${subSize}px ${FONT_ISO.sans}`; ctx.fillStyle = '#6A6F80'; ctx.fillText(sub, -cw / 2 + padX + dot + gap, ch / 2 - subSize * 0.82); }
  ctx.restore();
}
/** segment kicker title (screen space): optional small pill kicker above a big friendly headline */
export function bigTitle(ctx, text, { kicker = '', x = W / 2, y = 150, size = 78, p = 1, color = null, kickerColor = D.clay, align = 'center', alpha = 1 } = {}) {
  if (p <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const a = ease.outCubic(clamp(p));
  ctx.globalAlpha *= alpha * clamp(p * 2);
  const dark = LT > 1.35;
  const col = color || (dark ? '#F8F5EC' : '#1F2433');
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (kicker) {
    const ks = Math.round(size * 0.36);
    ctx.font = `700 ${ks}px ${FONT_ISO.sans}`;
    const kw = ctx.measureText(kicker.toUpperCase()).width + ks * 1.4 + kicker.length * ks * 0.08;
    const kx = align === 'center' ? x - kw / 2 : x, ky = y - size * 0.98 + (1 - a) * 16;
    ctx.fillStyle = kickerColor; ctx.beginPath(); ctx.roundRect(kx, ky - ks * 0.8, kw, ks * 1.6, ks * 0.8); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
    ctx.letterSpacing = `${ks * 0.08}px`;
    ctx.fillText(kicker.toUpperCase(), kx + kw / 2, ky + 1);
    ctx.letterSpacing = '0px';
    ctx.textAlign = align;
  }
  ctx.font = `800 ${size}px ${FONT_ISO.sans}`;
  const yy = y + (1 - a) * 26;
  ctx.shadowColor = dark ? 'rgba(0,0,20,0.5)' : 'rgba(255,255,255,0.45)'; ctx.shadowBlur = 18;
  ctx.fillStyle = col; ctx.fillText(text, x, yy);
  ctx.restore();
}
/** big rolling number on a floating card (odometer digits). value may be fractional while rolling */
export function counterTag(ctx, sx, sy, { value = 0, label = '', color = D.red, size = 72, p = 1, prefix = '', suffix = '', alpha = 1 } = {}) {
  if (p <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha * clamp(p * 3);
  const pop = ease.outBack(clamp(p));
  const v = Math.max(0, value);
  const nd = Math.max(1, Math.floor(Math.log10(Math.max(1, v))) + 1);
  ctx.font = `700 ${size}px ${FONT_ISO.mono}`;
  const dw = ctx.measureText('0').width, cw2 = dw * 0.55;
  const groups = Math.floor((nd - 1) / 3);
  ctx.font = `700 ${size * 0.8}px ${FONT_ISO.mono}`;
  const pw = prefix ? ctx.measureText(prefix).width + 6 : 0, sfw = suffix ? ctx.measureText(suffix).width + 8 : 0;
  const numW = nd * dw + groups * cw2 + pw + sfw;
  const ls = Math.max(28, Math.round(size * 0.4));
  ctx.font = `700 ${ls}px ${FONT_ISO.sans}`;
  const lw = label ? ctx.measureText(label.toUpperCase()).width + label.length * ls * 0.08 : 0;
  const cw = Math.max(numW, lw) + size * 0.9, ch = size * 1.25 + (label ? ls * 1.7 : 0);
  ctx.translate(sx, sy); ctx.scale(pop, pop);
  ctx.shadowColor = 'rgba(25,20,60,0.3)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 22); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, 10, ch, [22, 0, 0, 22]); ctx.fill();
  let y0 = -ch / 2 + size * 0.2;
  if (label) {
    ctx.fillStyle = '#6A6F80'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.letterSpacing = `${ls * 0.08}px`; ctx.fillText(label.toUpperCase(), 0, y0 + 2); ctx.letterSpacing = '0px';
    y0 += ls * 1.5;
  }
  const midY = y0 + size * 0.55;
  let cx = -numW / 2;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  if (prefix) { ctx.font = `700 ${size * 0.8}px ${FONT_ISO.mono}`; ctx.fillStyle = color; ctx.fillText(prefix, cx, midY); cx += pw; }
  ctx.font = `700 ${size}px ${FONT_ISO.mono}`;
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - 4, midY - size * 0.52, numW + 8, size * 1.04); ctx.clip();
  for (let i = nd - 1; i >= 0; i--) {
    const pl = Math.pow(10, i);
    const base = Math.floor(v / pl) % 10;
    const rem = v - Math.floor(v / pl) * pl;
    const f = i === 0 ? 0 : clamp(rem - (pl - 1));
    ctx.fillStyle = '#1F2433';
    ctx.fillText(String(base), cx, midY - f * size);
    if (f > 0) ctx.fillText(String((base + 1) % 10), cx, midY + (1 - f) * size);
    cx += dw;
    if (i > 0 && i % 3 === 0) { ctx.fillStyle = '#9AA0AE'; ctx.fillText(',', cx - dw * 0.2, midY); cx += cw2; }
  }
  ctx.restore();
  if (suffix) { ctx.font = `700 ${size * 0.8}px ${FONT_ISO.mono}`; ctx.fillStyle = color; ctx.fillText(suffix, cx + 8, midY); }
  ctx.restore();
}

// ── World-space overlays (under camera) ─────────────────────────────────────
/** vertical light beam rising from world (x, y, z); p 0..1 grows it */
export function beacon(ctx, x, y, z = 0, { color = D.red, t = 0, h = 7, w = 0.36, p = 1, alpha = 1 } = {}) {
  if (p <= 0) return;
  const [bx, by] = iso(x, y, z), top = by - h * ZK * ease.outCubic(clamp(p));
  const hw = w * U;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.globalCompositeOperation = LT > 1.15 ? 'lighter' : 'source-over';
  const fl = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.3);
  const g = ctx.createLinearGradient(0, by, 0, top);
  g.addColorStop(0, rgba(color, 0.55 * fl)); g.addColorStop(0.6, rgba(color, 0.22 * fl)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(bx - hw, by); ctx.lineTo(bx - hw * 0.55, top); ctx.lineTo(bx + hw * 0.55, top); ctx.lineTo(bx + hw, by); ctx.closePath(); ctx.fill();
  const g2 = ctx.createLinearGradient(0, by, 0, top);
  g2.addColorStop(0, rgba('#FFFFFF', 0.85)); g2.addColorStop(0.5, rgba(mix(color, '#FFFFFF', 0.5), 0.35)); g2.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g2; ctx.fillRect(bx - hw * 0.16, top, hw * 0.32, by - top);
  ctx.restore();
  glow(ctx, bx, by, 60, color, 0.7 * fl * alpha * clamp(p * 2));
  ctx.save(); plane(ctx, z);
  for (let k = 0; k < 2; k++) { const q = (t * 0.8 + k * 0.5) % 1; ctx.strokeStyle = rgba(color, (1 - q) * 0.8 * alpha); ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(x, y, 0.3 + q * 1.1, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
/** ripple rings on the ground at (x, y). Looping by default; pass p for a one-shot 0..1 */
export function ping(ctx, x, y, { t = 0, color = D.red, r = 1.6, n = 3, p = null, z = 0, alpha = 1 } = {}) {
  ctx.save(); plane(ctx, z);
  for (let k = 0; k < n; k++) {
    const q = p == null ? (t * 0.7 + k / n) % 1 : clamp(p * 1.3 - k * 0.15);
    if (q <= 0 || q >= 1) continue;
    ctx.strokeStyle = rgba(color, (1 - q) * 0.9 * alpha); ctx.lineWidth = 0.07 * (1 - q) + 0.02;
    ctx.beginPath(); ctx.arc(x, y, 0.2 + q * r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// ── Transitions + finish (screen space) ────────────────────────────────────
/** fly through a bank of clouds: p 0..1, fully covered around p = 0.5 (switch scenes there) */
export function cloudWipe(ctx, p, { seed = 4 } = {}) {
  if (p <= 0 || p >= 1) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const R = rng(seed);
  const items = Array.from({ length: 44 }, () => ({ a: R() * Math.PI * 2, d: Math.sqrt(R()), s: 0.7 + R() * 0.7, sd: R() * 100 }));
  items.sort((a, b) => a.s - b.s);
  const lo = tone('#D6DDEE'), mid = tone('#EEF2F9'), hi = tone('#FFFFFF');
  const puff = (x, y, r, sd) => {
    const rr = rng(Math.floor(sd) + 1);
    const cs = Array.from({ length: 6 }, (_, k) => { const an = (k / 6) * Math.PI * 2 + rr(); return [x + Math.cos(an) * r * 0.55, y + Math.sin(an) * r * 0.35, r * (0.55 + rr() * 0.25)]; });
    cs.push([x, y - r * 0.15, r * 0.75]);
    ctx.fillStyle = lo; cs.forEach(([a, b, q]) => { ctx.beginPath(); ctx.arc(a + q * 0.08, b + q * 0.12, q, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = mid; cs.forEach(([a, b, q]) => { ctx.beginPath(); ctx.arc(a, b, q * 0.94, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = hi; cs.forEach(([a, b, q]) => { ctx.beginPath(); ctx.arc(a - q * 0.18, b - q * 0.2, q * 0.66, 0, Math.PI * 2); ctx.fill(); });
  };
  const R1 = Math.hypot(W, H) * 0.5;
  for (const c of items) {
    let x, y, r, al = 1;
    if (p < 0.5) {
      const q = p / 0.5, k = Math.pow(q, 1.4);
      const dist = c.d * R1 * lerp(1.5, 0.75, k);
      x = W / 2 + Math.cos(c.a) * dist; y = H / 2 + Math.sin(c.a) * dist * 0.7;
      r = c.s * lerp(30, 360, k); al = clamp(q * 4);
    } else {
      const q = (p - 0.5) / 0.5, k = Math.pow(q, 0.8);
      const dist = c.d * R1 * 0.75 + k * R1 * 2.6;
      x = W / 2 + Math.cos(c.a) * dist; y = H / 2 + Math.sin(c.a) * dist * 0.7;
      r = c.s * 360 * (1 + k * 1.6);
    }
    ctx.globalAlpha = al;
    puff(x, y, r, c.sd);
  }
  ctx.globalAlpha = 1;
  const cover = clamp(1 - Math.abs(p - 0.5) / 0.08);
  if (cover > 0) { ctx.fillStyle = rgba(mid, ease.inOutQuad(cover)); ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
let _grain = null;
/** subtle film grain + soft vignette over the whole frame (call last) */
export function grain(ctx, t, { alpha = 0.022, vignette = 0.16 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (vignette > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, 'rgba(30,20,50,0)'); g.addColorStop(1, `rgba(30,20,50,${vignette})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (!_grain) {
    _grain = new OffscreenCanvas(256, 256);
    const g = _grain.getContext('2d'), img = g.createImageData(256, 256), r = rng(9);
    for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
  }
  const f = Math.floor(t * 12);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(_grain, 'repeat');
  ctx.translate((f * 97) % 256, (f * 53) % 256);
  ctx.fillRect(-256, -256, W + 512, H + 512);
  ctx.restore();
}
/** generic bug: small rounded white pill top-left — "<brand> · label · date". Islas videos use brandBug() from styles/islas. */
export function bug(ctx, t, { label = '', date = '', alpha = 1, brand = '' } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.font = `800 24px ${FONT_ISO.sans}`;
  const a = brand, wa = ctx.measureText(a).width;
  ctx.font = `600 22px ${FONT_ISO.sans}`;
  const b = [label, date].filter(Boolean).join('  ·  '), wb = b ? ctx.measureText(b).width : 0;
  const w = 30 + 16 + wa + (b ? 18 + wb : 0) + 26, h = 50, x = 52, y = 40;
  ctx.shadowColor = 'rgba(25,20,60,0.2)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
  ctx.fillStyle = 'rgba(255,255,255,0.94)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  const pulse = 0.8 + 0.2 * Math.sin(t * 3);
  ctx.fillStyle = D.clay; ctx.beginPath(); ctx.arc(x + 30, y + h / 2, 8 * pulse + 2, 0, Math.PI * 2); ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.font = `800 24px ${FONT_ISO.sans}`; ctx.fillStyle = '#1F2433'; ctx.fillText(a, x + 52, y + h / 2 + 1);
  if (b) { ctx.font = `600 22px ${FONT_ISO.sans}`; ctx.fillStyle = '#6A6F80'; ctx.fillText(b, x + 52 + wa + 18, y + h / 2 + 1); }
  ctx.restore();
}
