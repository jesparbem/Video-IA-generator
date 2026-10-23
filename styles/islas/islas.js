// islas.js — "archipelago" adapter over engine/iso.js (isometric diorama).
// One shared geography for every scene: a central island (the platform workshop) and
// business areas around it (named islands + unnamed islets). Apps are small houses that
// grow on their area's island. Colours and type come from the active theme (styles/islas/theme.json
// or any other theme), the workshop sign and corner bug from brand.* in the config.
//
// Scenes import the iso kit directly for primitives AND this file for the shared world:
//   import { sky, isoCam, camera, toScreen, sortDraw, agentBot, tag, … } from '../../../engine/iso.js';
//   import { AREAS, CENTRAL, drawWorld, … } from '../../../styles/islas/islas.js';
// To reuse for another map: edit RING (names, app counts, positions) — everything else follows.

import {
  D, U, ZK, iso, FONT_ISO, island, sortDraw, box, prism, tree, pine, bush, rock, person, agentBot, lamp, flag,
  beacon, ping, glow, tone, mix, rgba, cast, timeOf, nightK,
} from '../../engine/iso.js';
import { clamp, lerp, ease, rng } from '../../engine/runtime.js';
import { T, BRAND, CFG, ra } from '../_base/theme.js';

// ── Brand ───────────────────────────────────────────────────────────────────
// tags, titles and signs use the theme's display font (live: follows applyTheme)
Object.defineProperty(FONT_ISO, 'sans', { get: () => T.fontDisplay, configurable: true });
/** theme colours, read at draw time */
export const NG = {
  get azul() { return T.primary; }, get azulSoft() { return T.soft; }, get naranja() { return T.accent; },
  get naranjaHi() { return T.accentHi; }, get verde() { return T.ok; }, get lima() { return T.warn; },
};
/** agent glow colour = theme accent (pass as agentBot({ color: AGENT })) */
export const AGENT = T.accent;   // module is imported after applyTheme(), so this is the themed accent
const ROOFS = [T.primary, T.accent, ...(T.series ?? []).slice(2, 5), '#7a7256'];

/** e(): eased progress, exactly 0 before start and 1 after. */
export const e = (t, s, d, fn = ease.outCubic) => { const p = (t - s) / d; return p <= 0 ? 0 : p >= 1 ? 1 : fn(p); };

// ── Geography ───────────────────────────────────────────────────────────────
// world from a desired screen position (zoom 1, relative to the central island centre)
const fromScreen = (sx, sy) => { const a = sx / U, b = (2 * sy) / U; return [(a + b) / 2, (b - a) / 2]; };

export const CENTRAL = { key: 'central', x: -4.5, y: -4.5, w: 9, d: 9, T: 2.1, seed: 11 };
/** workshop (taller) footprint on the central island — back corner */
export const TALLER = { x: -1.6, y: -2.2, w: 3.4, d: 2.6 };
export const TALLER_DOOR = [TALLER.x + TALLER.w / 2, TALLER.y + TALLER.d + 0.15];

// slot angles on a screen ellipse (deg, 0 = right, clockwise because screen y grows down).
// Override per video in video.json → "islas": { "areas": [ { "name", "short"?, "apps", "ang", "size", "islets"? } ] }
const DEFAULT_RING = [
  { name: 'Ventas', apps: 5, ang: 200, size: 6 },
  { name: 'Operaciones', apps: 5, ang: 245, size: 6 },
  { name: 'Finanzas', apps: 5, ang: 295, size: 6 },
  { name: 'Tecnología y Comunicaciones', short: 'Tecnología', apps: 4, ang: 340, size: 5.4 },
  { name: 'Personas', apps: 4, ang: 25, size: 5.4 },
  { name: 'Logística', apps: 2, ang: 75, size: 4.6 },
  { name: 'Proyectos transversales', apps: 2, ang: 120, size: 4.6 },
  { name: 'Otras áreas', apps: 5, ang: 160, size: 0, islets: true },
];
const RING = CFG.islas?.areas ?? DEFAULT_RING;
const RX = 1180, RY = 560;
export const AREAS = RING.map((r, i) => {
  const a = (r.ang * Math.PI) / 180;
  const [cx, cy] = fromScreen(Math.cos(a) * RX, Math.sin(a) * RY);
  const base = { ...r, i, cx, cy, key: `area${i}`, seed: 30 + i * 7 };
  if (!r.islets) {
    const s = r.size;
    return { ...base, x: cx - s / 2, y: cy - s / 2, w: s, d: s, T: 1.4, isles: null };
  }
  // four islets in a small cluster around (cx, cy); 5 apps spread 2-1-1-1
  const off = [[-1.9, -1.6], [1.6, -1.9], [-1.5, 1.8], [1.9, 1.5]];
  const isles = off.map(([dx, dy], k) => ({ key: `islet${k}`, x: cx + dx - 1.4, y: cy + dy - 1.4, w: 2.8, d: 2.8, T: 1.0, seed: 90 + k }));
  return { ...base, x: cx - 3.4, y: cy - 3.4, w: 6.8, d: 6.8, isles };
});
export const area = (name) => AREAS.find((a) => a.name === name || a.short === name);
/** total apps = 32 */
export const TOTAL_APPS = AREAS.reduce((s, a) => s + a.apps, 0);

// app house slots per area (deterministic)
AREAS.forEach((a) => {
  const R = rng(a.seed + 5);
  if (a.isles) {
    const per = [2, 1, 1, 1];
    a.slots = [];
    a.isles.forEach((is, k) => { for (let j = 0; j < per[k]; j++) a.slots.push(houseAt(is.x + 0.5 + j * 1.25, is.y + 0.7, R)); });
    a.decor = a.isles.map((is, k) => ({ kind: 'tree', x: is.x + 2.2, y: is.y + 2.2, seed: k + 3 }));
  } else {
    const n = a.apps, cols = n <= 2 ? 2 : 3;
    a.slots = Array.from({ length: n }, (_, k) => houseAt(a.x + 0.7 + (k % cols) * 1.65, a.y + 0.7 + Math.floor(k / cols) * 1.9, R));
    // pre-existing life: trees + a couple of people (the "gente con ideas")
    a.decor = [
      { kind: 'tree', x: a.x + a.w - 0.8, y: a.y + a.d - 0.9, seed: a.seed },
      { kind: 'pine', x: a.x + a.w - 1.6, y: a.y + 0.8, seed: a.seed + 1 },
      { kind: 'bush', x: a.x + 0.6, y: a.y + a.d - 0.6, seed: a.seed + 2 },
      { kind: 'person', x: a.x + a.w - 1.9, y: a.y + a.d - 1.2, seed: a.seed + 3 },
    ];
  }
});
function houseAt(x, y, R) {
  const floors = 1 + Math.floor(R() * 3);
  return { x, y, w: 1.15, d: 1.05, floors, h: 0.3 + floors * 0.38, wall: D.walls[Math.floor(R() * 4)], roof: ROOFS[Math.floor(R() * ROOFS.length)], gable: R() < 0.55, seed: Math.floor(R() * 1000) };
}

// ── Pieces ──────────────────────────────────────────────────────────────────
/** +y face transform helper (faces toward the viewer-left) */
function faceY(ctx, x, yFace, zTop) { const [ox, oy] = iso(x, yFace, zTop); ctx.transform(U, U / 2, 0, ZK, ox, oy); }

/**
 * App house: cheap, readable building that grows out of the ground (p 0→1, spring) and lights
 * its windows at dusk/night. Optional glow ring when it lands (fresh 0→1→0).
 */
export function appHouse(ctx, h, t, { p = 1, lit = null, fresh = 0, chaos = 0 } = {}) {
  if (p <= 0.001) return;
  const r = ease.spring(clamp(p), 9, 0.45);
  const hh = h.h * Math.max(0.02, r);
  ctx.save();
  // chaos: crooked, mismatched (used in "chispa" when every island builds its own way)
  const wall = chaos > 0 ? mix(h.wall, ['#E07A5F', '#8A7BC0', '#D9A93A', '#5B7DB1'][h.seed % 4], chaos * 0.7) : h.wall;
  box(ctx, h.x, h.y, 0, h.w, h.d, hh, wall, { ao: 0.16, edge: 0.4 });
  if (r > 0.6) {
    const rh = 0.36 * clamp((r - 0.6) / 0.4);
    if (h.gable) prism(ctx, h.x, h.y, hh, h.w, h.d, rh, h.roof, { axis: h.seed % 2 ? 'x' : 'y' });
    else box(ctx, h.x + 0.06, h.y + 0.06, hh, h.w - 0.12, h.d - 0.12, 0.07, h.roof, { ao: 0, edge: 0.3 });
  }
  // windows on the +y face
  const L = lit ?? clamp((timeOf() - 0.7) / 0.6);
  ctx.save();
  faceY(ctx, h.x, h.y + h.d, hh);
  for (let f = 0; f < h.floors; f++) for (let c = 0; c < 2; c++) {
    const wy = 0.12 + f * 0.38;
    if (wy + 0.2 > hh) continue;
    const on = L > ((h.seed + f * 3 + c) % 7) / 8;
    ctx.fillStyle = on ? '#FFD27A' : tone(D.glassD);
    ctx.fillRect(0.14 + c * (h.w / 2), wy, h.w / 2 - 0.28, 0.2);
  }
  ctx.restore();
  ctx.restore();
  if (fresh > 0) {
    const [sx, sy] = iso(h.x + h.w / 2, h.y + h.d / 2, 0);
    glow(ctx, sx, sy, 90 * fresh, NG.naranja, 0.55 * fresh, { sy: 0.5 });
  }
}
export const houseShadow = (h, p = 1) => (g) => cast.box(g, h.x, h.y, h.w, h.d, h.h * clamp(p) + 0.3);

/**
 * The platform workshop (sign = brand.product): blue-walled hall with an orange sawtooth roof, a sign, a big door and a
 * glowing butterfly-orange beacon on top. rise 0→1 grows it out of the island. Centre the camera
 * on (0, 0) to frame the central island.
 */
export function taller(ctx, t, { rise = 1, sign = (BRAND.product || BRAND.name || 'STUDIO').toUpperCase(), beam = 0, open = 1 } = {}) {
  if (rise <= 0.001) return;
  const { x, y, w, d } = TALLER;
  const r = ease.spring(clamp(rise), 8, 0.5);
  const H0 = 1.9 * Math.max(0.02, r);
  box(ctx, x, y, 0, w, d, H0, '#E9EEF2', { ao: 0.2, edge: 0.5 });
  // blue band + sign on the +y face
  ctx.save();
  faceY(ctx, x, y + d, H0);
  ctx.fillStyle = tone(NG.azul); ctx.fillRect(0, 0.12, w, 0.42);
  if (r > 0.7) {
    ctx.save(); ctx.scale(1 / 40, 1 / 40);
    ctx.font = `700 ${Math.round(13)}px ${FONT_ISO.sans}`; ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.letterSpacing = '2px';
    ctx.fillText(sign, (w / 2) * 40, 0.34 * 40);
    ctx.letterSpacing = '0px';
    ctx.restore();
  }
  // big door (glows warm when open)
  const dw = 1.0, dh = Math.min(1.0, H0 - 0.65);
  if (dh > 0) {
    ctx.fillStyle = open > 0 ? mix(tone('#2B3142'), '#FFB15C', 0.6 * open) : tone('#2B3142');
    ctx.fillRect(w / 2 - dw / 2, H0 - dh, dw, dh);
    // side windows
    ctx.fillStyle = nightK() > 0.2 ? '#FFD27A' : tone(D.glass);
    for (let k = 0; k < 2; k++) { ctx.fillRect(0.25 + k * 0.55, H0 - 0.95, 0.4, 0.45); ctx.fillRect(w - 0.65 - k * 0.55, H0 - 0.95, 0.4, 0.45); }
  }
  ctx.restore();
  // sawtooth roof in orange
  if (r > 0.75) {
    const k = clamp((r - 0.75) / 0.25);
    for (let i = 0; i < 3; i++) prism(ctx, x + (i * w) / 3, y, H0, w / 3, d, 0.55 * k, NG.naranja, { axis: 'y' });
    // chimney / antenna mast with an orange beacon light
    box(ctx, x + w - 0.5, y + 0.2, H0, 0.24, 0.24, 0.9 * k, '#C9D3DB', { ao: 0, edge: 0.3 });
    const [bx, by] = iso(x + w - 0.38, y + 0.32, H0 + 0.95 * k);
    glow(ctx, bx, by, 26 + 6 * Math.sin(t * 4), NG.naranja, 0.9 * k);
  }
  if (beam > 0) beacon(ctx, x + w / 2, y + d / 2, H0 + 0.5, { color: NG.naranja, t, h: 9, p: beam });
}
export const tallerShadow = (rise = 1) => (g) => cast.box(g, TALLER.x, TALLER.y, TALLER.w, TALLER.d, 2.4 * clamp(rise));

/**
 * Light bridge between two world points: an arc in the air made of travelling orange dots.
 * Draw INSIDE camera(). p draws it on (0→1); flow keeps pulses moving.
 */
export function lightBridge(ctx, t, a, b, { p = 1, hgt = 3.2, color = NG.naranja, alpha = 1, flow = 1, n = 26 } = {}) {
  if (p <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const pt = (u) => iso(lerp(a[0], b[0], u), lerp(a[1], b[1], u), (a[2] || 0.2) + Math.sin(Math.PI * u) * hgt);
  ctx.strokeStyle = rgba(color, 0.35); ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 40 * p; i++) { const [x, y] = pt(i / 40); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const u = ((i / n + t * 0.25 * flow) % 1);
    if (u > p) continue;
    const [x, y] = pt(u);
    const s = 3 + 2 * Math.sin(u * Math.PI);
    ctx.fillStyle = i % 5 === 0 ? '#FFF1D6' : color;
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** A floating spec "blueprint" (glowing paper) at a world point — for flights and the build site. */
export function specSheet(ctx, x, y, z, t, { s = 1, alpha = 1, glowK = 1 } = {}) {
  if (alpha <= 0) return;
  const [sx, sy] = iso(x, y, z + Math.sin(t * 2.2) * 0.08);
  ctx.save();
  ctx.globalAlpha *= alpha;
  glow(ctx, sx, sy, 60 * s * glowK, NG.naranja, 0.6 * glowK);
  ctx.translate(sx, sy); ctx.scale(s, s); ctx.rotate(-0.12);
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(-22, -28, 44, 56, 4); ctx.fill();
  ctx.fillStyle = NG.naranja; ctx.fillRect(-15, -20, 18, 4);
  ctx.fillStyle = ra('primary', 0.55);
  for (let i = 0; i < 5; i++) ctx.fillRect(-15, -10 + i * 7, i === 4 ? 18 : 30, 3);
  ctx.restore();
}

// ── World ───────────────────────────────────────────────────────────────────
/**
 * Draw the whole archipelago inside camera(). Every visual state is a function you pass:
 *   apps(areaIndex, slotIndex) → p (0 hidden → 1 built)      default: all built
 *   fresh(areaIndex, slotIndex) → 0..1 glow ring              default: none
 *   areaAlpha(areaIndex) → 0..1 island visibility               default: 1
 *   chaos(areaIndex) → 0..1 mismatched colours                 default: 0
 *   central → { show 0..1, rise 0..1, beam, open }             default: hidden
 *   extra(areaIndex) → [sortDraw items] added on that island   (agents, signs, …)
 *   extraCentral → [items] on the central island
 *   people → 1 show the decor people, 0 hide
 * Islands are drawn back to front. Off-screen islands still cost a drawImage only.
 */
export function drawWorld(ctx, t, o = {}) {
  const { apps = () => 1, fresh = () => 0, areaAlpha = () => 1, chaos = () => 0, central = null, extra = () => [], extraCentral = [], people = 1 } = o;
  const groups = [];
  AREAS.forEach((a) => groups.push({ a, k: a.cx + a.cy }));
  if (central && central.show > 0) groups.push({ c: true, k: 0 });
  groups.sort((p, q) => p.k - q.k);
  for (const g of groups) {
    if (g.c) {
      ctx.save(); ctx.globalAlpha *= central.show;
      const lift = (1 - ease.outCubic(clamp(central.show))) * 3;
      ctx.translate(0, lift * ZK);
      const clip = island(ctx, { ...CENTRAL, ground: (gg) => { pavingC(gg); } });
      const items = [
        { x: TALLER.x + TALLER.w / 2, y: TALLER.y + TALLER.d / 2, draw: (c) => taller(c, t, { rise: central.rise ?? 1, beam: central.beam ?? 0, open: central.open ?? 1 }), shadow: tallerShadow(central.rise ?? 1) },
        { x: -3.4, y: 3.2, draw: (c) => tree(c, -3.4, 3.2, { kind: 'green', seed: 4, t }) },
        { x: 3.3, y: -3.3, draw: (c) => pine(c, 3.3, -3.3, { seed: 5, t }) },
        { x: 3.4, y: 3.0, draw: (c) => lamp(c, 3.4, 3.0, { t }) },
        { x: -3.3, y: -3.0, draw: (c) => lamp(c, -3.3, -3.0, { t }) },
        ...extraCentral,
      ];
      sortDraw(ctx, items, { clip });
      ctx.restore();
      continue;
    }
    const a = g.a;
    const al = areaAlpha(a.i);
    if (al <= 0.001) continue;
    ctx.save(); ctx.globalAlpha *= al;
    ctx.translate(0, (1 - ease.outCubic(clamp(al))) * 2 * ZK);
    const clips = a.isles ? a.isles.map((is) => island(ctx, { ...is, ground: null })) : [island(ctx, { key: a.key, x: a.x, y: a.y, w: a.w, d: a.d, T: a.T, seed: a.seed, ground: (gg) => pavingA(gg, a) })];
    const items = [];
    a.slots.forEach((h, k) => {
      const p = apps(a.i, k);
      if (p <= 0) return;
      items.push({ x: h.x + h.w / 2, y: h.y + h.d / 2, draw: (c) => appHouse(c, h, t, { p, fresh: fresh(a.i, k), chaos: chaos(a.i) }), shadow: houseShadow(h, p) });
    });
    a.decor.forEach((d) => {
      if (d.kind === 'tree') items.push({ x: d.x, y: d.y, draw: (c) => tree(c, d.x, d.y, { kind: 'green', seed: d.seed, t, s: 0.9 }), shadow: (gg) => cast.blob(gg, d.x, d.y, 0.4, 1.4) });
      if (d.kind === 'pine') items.push({ x: d.x, y: d.y, draw: (c) => pine(c, d.x, d.y, { seed: d.seed, t, s: 0.9 }) });
      if (d.kind === 'bush') items.push({ x: d.x, y: d.y, draw: (c) => bush(c, d.x, d.y, { seed: d.seed }) });
      if (d.kind === 'person' && people > 0) items.push({ x: d.x, y: d.y, draw: (c) => person(c, d.x, d.y, { t, color: D.shirts[d.seed % 8], skin: D.skins[d.seed % 5], s: 1.1 }) });
    });
    items.push(...extra(a.i));
    sortDraw(ctx, items, { clip: clips });
    ctx.restore();
  }
}
function pavingC(g) {
  g.fillStyle = '#DCD5C8';
  g.fillRect(TALLER.x - 0.5, TALLER.y + TALLER.d, TALLER.w + 1, 2.4);
  g.fillStyle = ra('accent', 0.35);
  g.fillRect(TALLER.x - 0.5, TALLER.y + TALLER.d + 2.25, TALLER.w + 1, 0.15);
}
function pavingA(g, a) {
  // a footpath ring around the house rows (reads as a village, not as empty plots)
  g.strokeStyle = '#E6DFD2'; g.lineWidth = 0.28; g.lineCap = 'round';
  g.beginPath(); g.moveTo(a.x + 0.4, a.y + a.d - 0.45); g.lineTo(a.x + a.w - 0.45, a.y + a.d - 0.45); g.lineTo(a.x + a.w - 0.45, a.y + 0.4); g.stroke();
}

/** world point of an area's "dock" (edge facing the central island) for bridges and flights */
export function dock(a) {
  const dx = -a.cx, dy = -a.cy, L = Math.hypot(dx, dy) || 1;
  const r = a.isles ? 3 : a.w / 2;
  return [a.cx + (dx / L) * r, a.cy + (dy / L) * r, 0.2];
}
export const centralDock = (a) => { const dx = a.cx, dy = a.cy, L = Math.hypot(dx, dy) || 1; return [(dx / L) * 4.4, (dy / L) * 4.4, 0.2]; };
/** label anchor (world) above an area */
export const areaLabelAt = (a) => [a.cx, a.cy, a.isles ? 1.5 : 2.2];

// ── Screen-space brand ──────────────────────────────────────────────────────
/** Brand bug: white pill top-left "<product> · chapter" with an accent dot; brand logo bottom-right if configured. */
export function brandBug(ctx, t, A, { chapter = '', alpha = 1 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  if (!BRAND.showBug) { ctx.restore(); return; }
  const a = (BRAND.product || BRAND.name || '').toUpperCase();
  ctx.font = `700 24px ${FONT_ISO.sans}`; ctx.letterSpacing = '3px';
  const wa = ctx.measureText(a).width;
  ctx.letterSpacing = '0px'; ctx.font = `400 22px ${FONT_ISO.sans}`;
  const wb = chapter ? ctx.measureText(chapter).width : 0;
  const w = 30 + 16 + wa + (chapter ? 18 + wb : 0) + 26, h = 50, x = 52, y = 40;
  ctx.shadowColor = 'rgba(0,30,60,0.22)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = NG.naranja; ctx.beginPath(); ctx.arc(x + 30, y + h / 2, 8 * (0.8 + 0.2 * Math.sin(t * 3)) + 2, 0, Math.PI * 2); ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.font = `700 24px ${FONT_ISO.sans}`; ctx.letterSpacing = '3px'; ctx.fillStyle = NG.azul; ctx.fillText(a, x + 52, y + h / 2 + 1);
  ctx.letterSpacing = '0px';
  if (chapter) { ctx.font = `400 22px ${FONT_ISO.sans}`; ctx.fillStyle = '#5B6B78'; ctx.fillText(chapter, x + 52 + wa + 18, y + h / 2 + 1); }
  const img = nightK() > 0.5 ? A?.logo : A?.logoOnLight;
  if (img) {
    const lw = 150, lh = lw * img.height / img.width;
    ctx.globalAlpha = alpha * 0.9;
    ctx.drawImage(img, 1920 - 64 - lw, 1080 - 52 - lh, lw, lh);
  }
  ctx.restore();
}

/** Segment edges: fly through clouds — fully covered at t=0 and t=dur, clear by 0.7 s in/out.
 *  Every scene calls this last, so cuts between segments hide inside the cloud bank. */
import { cloudWipe } from '../../engine/iso.js';
export function cloudEdges(ctx, t, dur, { inDur = 0.7, outDur = 0.7, first = false, last = false } = {}) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!first && t < inDur) cloudWipe(ctx, 0.5 + 0.5 * clamp(t / inDur));
  if (!last && t > dur - outDur) cloudWipe(ctx, 0.5 * clamp((t - (dur - outDur)) / outDur));
  ctx.restore();
}
