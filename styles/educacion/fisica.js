// Physics kit for study-review videos . Builds on the base
// kit (night stage, rise, kicker…) but without corporate marks. Pure functions of their args.
//
//   formula(ctx, spec, x, y, {size, p, align, color})  — typeset maths: fractions, roots, vectors
//   planet / mass / arrow / fieldArrows / orbitPath    — gravitation vocabulary
//   quad(ctx, x, y, s, t, {show, hl})                  — the "field square" F→g / Ep→V memory hook
//   tag(ctx, chapter) · progress(ctx, i)               — corner chrome (replaces the brand bug)

import { ra, W, H, N, NF, clamp, lerp, ease, e, rng, text, measure, spark } from '../_base/kit.js';

// ── Formula typesetting ───────────────────────────────────────────────────────
// spec: string | array (row) | { frac:[num,den] } | { sqrt:x } | { vec:x } | { sub:[base,sub] }
//       | { sup:[base,sup] } | { c:x, color } (coloured group) | { box:x } (orange highlight box)
// In strings, latin letters are italic variables; digits, operators and greek are upright.
// Use "'" for prime, "−" for minus, "·" for product, "Σ" for sum, "∞" infinity.
// A word in [brackets] is upright (units, words: "[si]").

const OPS = new Set(['=', '+', '−', '·', '→', '≈', '<', '>', '÷']);

function runLayout(str, size, o) {
  const items = [];
  const re = /\[([^\]]*)\]|./gu;
  let m;
  while ((m = re.exec(str))) {
    if (m[1] !== undefined) { items.push({ ch: m[1], it: false }); continue; }
    const ch = m[0];
    if (ch === ' ') { items.push({ sp: size * 0.18 }); continue; }
    const it = /[A-Za-z]/.test(ch);
    items.push({ ch, it, op: OPS.has(ch) });
  }
  return items;
}

function lay(ctx, spec, size, st) {
  if (spec == null) return { w: 0, a: 0, d: 0, draw() {} };
  if (typeof spec === 'string') {
    const parts = runLayout(spec, size).map((it) => {
      if (it.sp) return { w: it.sp, draw() {} };
      const f = `${it.it ? 'italic ' : ''}${it.it ? 400 : 300} ${size}px ${NF}`;
      ctx.save(); ctx.font = f; let w = ctx.measureText(it.ch).width; ctx.restore();
      const pad = it.op ? (it.ch === '−' ? size * 0.08 : size * 0.2) : it.it ? size * 0.03 : 0;
      const idx = st.n++;
      return { w: w + pad * 2, draw(x, y, c) {
        const a = st.alpha(idx);
        if (a <= 0) return;
        ctx.save(); ctx.globalAlpha *= a; ctx.font = f; ctx.fillStyle = c; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(it.ch, x + pad, y + (1 - a) * size * 0.25); ctx.restore();
      } };
    });
    const w = parts.reduce((s, p) => s + p.w, 0);
    return { w, a: size * 0.74, d: size * 0.22, draw(x, y, c) { let cx = x; for (const p of parts) { p.draw(cx, y, c); cx += p.w; } } };
  }
  if (Array.isArray(spec)) {
    const kids = spec.map((k) => lay(ctx, k, size, st));
    return { w: kids.reduce((s, k) => s + k.w, 0), a: Math.max(0, ...kids.map((k) => k.a)), d: Math.max(0, ...kids.map((k) => k.d)),
      draw(x, y, c) { let cx = x; for (const k of kids) { k.draw(cx, y, c); cx += k.w; } } };
  }
  if (spec.frac) {
    const s2 = size * 0.82;
    const nu = lay(ctx, spec.frac[0], s2, st), de = lay(ctx, spec.frac[1], s2, st);
    const idx = st.n++;
    const bw = Math.max(nu.w, de.w) + size * 0.24, axis = size * 0.30, gap = size * 0.14, lw = Math.max(2, size * 0.045);
    return { w: bw + size * 0.12, a: axis + gap + nu.d + nu.a, d: -axis + gap + de.a + de.d + lw,
      draw(x, y, c) {
        const x0 = x + size * 0.06, ay = y - axis;
        nu.draw(x0 + (bw - nu.w) / 2, ay - gap - nu.d, c);
        de.draw(x0 + (bw - de.w) / 2, ay + gap + de.a, c);
        const a = st.alpha(idx);
        if (a > 0) { ctx.save(); ctx.fillStyle = c; ctx.globalAlpha *= a; ctx.fillRect(x0, ay - lw / 2, bw * a, lw); ctx.restore(); }
      } };
  }
  if (spec.sqrt !== undefined) {
    const b = lay(ctx, spec.sqrt, size, st);
    const idx = st.n++;
    const lw = Math.max(2, size * 0.05), padT = size * 0.14, hook = size * 0.5;
    const top = b.a + padT, bot = b.d + size * 0.04;
    return { w: b.w + hook + size * 0.12, a: top + lw, d: bot,
      draw(x, y, c) {
        const a = st.alpha(idx);
        if (a > 0) {
          ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.globalAlpha *= clamp(a * 2);
          const pts = [[x, y - size * 0.25], [x + hook * 0.25, y - size * 0.34], [x + hook * 0.55, y + bot], [x + hook, y - top], [x + hook + b.w + size * 0.08, y - top]];
          // draw progressively along the radical
          const L = []; let tot = 0;
          for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(l); tot += l; }
          let left = tot * a;
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length && left > 0; i++) {
            const k = Math.min(1, left / L[i - 1]);
            ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k));
            left -= L[i - 1];
          }
          ctx.stroke(); ctx.restore();
        }
        b.draw(x + hook + size * 0.04, y, c);
      } };
  }
  if (spec.vec !== undefined) {
    const b = lay(ctx, spec.vec, size, st);
    const idx = st.n++;
    const lift = size * 0.16, lw = Math.max(2, size * 0.04);
    return { w: b.w, a: b.a + lift + size * 0.08, d: b.d,
      draw(x, y, c) {
        b.draw(x, y, c);
        const a = st.alpha(idx);
        if (a <= 0) return;
        const ay = y - b.a - lift * 0.7, x0 = x + b.w * 0.12, x1 = x0 + (b.w * 0.86) * a, hh = size * 0.08;
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.globalAlpha *= a;
        ctx.beginPath(); ctx.moveTo(x0, ay); ctx.lineTo(x1, ay); ctx.moveTo(x1 - hh * 1.2, ay - hh); ctx.lineTo(x1, ay); ctx.lineTo(x1 - hh * 1.2, ay + hh); ctx.stroke();
        ctx.restore();
      } };
  }
  if (spec.sub || spec.sup) {
    const [bs, ss] = spec.sub || spec.sup;
    const b = lay(ctx, bs, size, st), s = lay(ctx, ss, size * 0.6, st);
    const dy = spec.sub ? size * 0.22 : -size * 0.42;
    return { w: b.w + s.w + size * 0.02, a: Math.max(b.a, s.a - dy), d: Math.max(b.d, s.d + dy),
      draw(x, y, c) { b.draw(x, y, c); s.draw(x + b.w + size * 0.02, y + dy, c); } };
  }
  if (spec.c !== undefined) {
    const b = lay(ctx, spec.c, size, st);
    return { ...b, draw(x, y) { b.draw(x, y, spec.color || N.naranja); } };
  }
  if (spec.box !== undefined) {
    const b = lay(ctx, spec.box, size, st);
    const pad = size * 0.16;
    return { w: b.w + pad * 2, a: b.a + pad, d: b.d + pad, draw(x, y, c) {
      const k = spec.p ?? 1;
      if (k > 0) {
        ctx.save(); ctx.globalAlpha *= k; ctx.strokeStyle = N.naranja; ctx.lineWidth = Math.max(3, size * 0.05);
        ctx.shadowColor = ra('accent', 0.6); ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.roundRect(x, y - b.a - pad, b.w + pad * 2, b.a + b.d + pad * 2, size * 0.18); ctx.stroke(); ctx.restore();
      }
      b.draw(x + pad, y, c);
    } };
  }
  return lay(ctx, String(spec), size, st);
}

/** Measure a formula: {w, a, d} at a given size (no drawing). */
export function formulaSize(ctx, spec, size = 90) {
  const st = { n: 0, alpha: () => 1 };
  const b = lay(ctx, spec, size, st);
  return { w: b.w, a: b.a, d: b.d };
}

/**
 * Draw a formula with its baseline at y. p 0→1 writes it glyph by glyph (left to right);
 * alpha fades the whole thing. align: left|center|right. Returns {w, a, d}.
 */
export function formula(ctx, spec, x, y, { size = 90, p = 1, align = 'left', color = N.white, alpha = 1, glow = 0 } = {}) {
  if (alpha <= 0 || p <= 0) return formulaSize(ctx, spec, size);
  const st0 = { n: 0, alpha: () => 1 };
  lay(ctx, spec, size, st0);
  const n = Math.max(1, st0.n), soft = 2.5;
  const st = { n: 0, alpha: (i) => (p >= 1 ? 1 : ease.outCubic(clamp((p * (n + soft) - i) / soft))) };
  const b = lay(ctx, spec, size, st);
  const x0 = align === 'center' ? x - b.w / 2 : align === 'right' ? x - b.w : x;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (glow > 0) { ctx.shadowColor = `${ra('accent', 0.7 * glow)}`; ctx.shadowBlur = size * 0.35 * glow; }
  b.draw(x0, y, color);
  ctx.restore();
  return { w: b.w, a: b.a, d: b.d };
}

// Ready-made specs (same symbol order as the textbook)
export const F = {
  newton: [{ vec: 'F' }, ' = −G ', { frac: [[{ sub: ['m', '1'] }, ' ', { sub: ['m', '2'] }], { sup: ['r', '2'] }] }, ' ', { vec: 'u' }],
  gDef: [{ vec: 'g' }, ' = ', { frac: [{ vec: 'F' }, "m'"] }],
  gPunt: [{ vec: 'g' }, ' = −G ', { frac: ['m', { sup: ['r', '2'] }] }, ' ', { vec: 'u' }],
  gSum: [{ vec: 'g' }, ' = Σ ', { sub: [{ vec: 'g' }, 'i'] }],
  gAlt: [{ frac: ['g', { sub: ['g', '0'] }] }, ' = ', { frac: [{ sup: [{ sub: ['R', 'T'] }, '2'] }, { sup: ['r', '2'] }] }, ' = ', { frac: [{ sup: [{ sub: ['R', 'T'] }, '2'] }, { sup: [['(', { sub: ['R', 'T'] }, ' + h)'], '2'] }] }],
  pes: [{ vec: 'p' }, ' = m', { vec: 'g' }],
  V: ['V = −G ', { frac: ['m', 'r'] }],
  Ep: [{ sub: ['E', 'p'] }, ' = −G ', { frac: ["m m'", 'r'] }],
  VSum: ['V = Σ ', { sub: ['V', 'i'] }],
  gdV: ['g = −', { frac: ['dV', 'dx'] }],
  dEpW: ['Δ', { sub: ['E', 'p'] }, ' = −W'],
  vOrb: ['v = ', { sqrt: { frac: ['GM', 'r'] } }],
  EOrb: ['E = −', { frac: ['1', '2'] }, ' ', { frac: ['GMm', 'r'] }],
  cons: ['Δ', { sub: ['E', 'c'] }, ' + Δ', { sub: ['E', 'p'] }, ' = 0'],
  vEsc: [{ sub: ['v', '0'] }, ' = ', { sqrt: { frac: [['2G', { sub: ['M', 'T'] }], { sub: ['R', 'T'] }] } }],
};

// ── Gravitation vocabulary ───────────────────────────────────────────────────
/** Planet sphere with soft light from top-left, atmosphere rim and slow bands. */
export function planet(ctx, x, y, r, t, { hue = 'earth', alpha = 1, glow = 0.5, label = '' } = {}) {
  if (alpha <= 0 || r <= 0) return;
  const pal = { earth: ['#4fa3d9', '#1f5f8f', '#0a2a45'], sun: ['#ffd27a', N.naranja, '#7a2c00'], moon: ['#e9eef2', '#9aa9b5', '#3d4b57'], mass: ['#7fb2d6', '#2f6f9e', '#0b2f4c'] }[hue] || hue;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (glow > 0) {
    const gg = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 1.9);
    gg.addColorStop(0, hue === 'sun' ? `${ra('accent', 0.45 * glow)}` : `rgba(127,178,214,${0.32 * glow})`); gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, Math.PI * 2); ctx.fill();
  }
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
  g.addColorStop(0, pal[0]); g.addColorStop(0.6, pal[1]); g.addColorStop(1, pal[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  if (hue === 'earth') {   // drifting continents-ish blobs, clipped to the disc
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    const R = rng(11);
    for (let i = 0; i < 7; i++) {
      const bx = ((R() * 2.4 + t * 0.03) % 2.4 - 1.2) * r * 1.4, by = (R() - 0.5) * r * 1.5, br = r * (0.18 + R() * 0.25);
      ctx.fillStyle = 'rgba(120,190,120,0.35)'; ctx.beginPath(); ctx.ellipse(x + bx, y + by, br, br * 0.6, R() * 3, 0, Math.PI * 2); ctx.fill();
    }
    const sh = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.3, x, y, r * 1.05);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,10,25,0.55)');
    ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  ctx.strokeStyle = hue === 'sun' ? 'rgba(255,200,120,0.5)' : ra('soft', 0.35); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  if (label) text(ctx, label, x, y + 14, { size: Math.max(30, r * 0.42), weight: 400, align: 'center', color: N.white, alpha, family: NF });
}

/** "Mass m": glowing orange-cored sphere (the source of everything). */
export function mass(ctx, x, y, r, t, { alpha = 1, label = 'm', pulse = 1 } = {}) {
  if (alpha <= 0 || r <= 0) return;
  const k = 1 + 0.04 * pulse * Math.sin(t * 2.4);
  ctx.save(); ctx.globalAlpha *= alpha;
  const gg = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4 * k);
  gg.addColorStop(0, ra('accent', 0.38)); gg.addColorStop(1, ra('accent', 0));
  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r * 2.4 * k, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  g.addColorStop(0, '#ffb35c'); g.addColorStop(0.55, N.naranja); g.addColorStop(1, '#8a3a00');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * k, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (label) formula(ctx, label, x, y + r * 0.25, { size: Math.max(30, r * 0.75), align: 'center', alpha });
}

/** Straight arrow from (x1,y1) to (x2,y2); p grows it from the tail. */
export function arrow(ctx, x1, y1, x2, y2, { color = N.soft, width = 4, head = 18, p = 1, alpha = 1, dash = null } = {}) {
  if (p <= 0 || alpha <= 0) return;
  const x = lerp(x1, x2, p), y = lerp(y1, y2, p), ang = Math.atan2(y2 - y1, x2 - x1);
  const L = Math.hypot(x - x1, y - y1); const hd = Math.min(head, L * 0.6);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x - Math.cos(ang) * hd * 0.6, y - Math.sin(ang) * hd * 0.6); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(ang - 0.45) * hd, y - Math.sin(ang - 0.45) * hd);
  ctx.lineTo(x - Math.cos(ang + 0.45) * hd, y - Math.sin(ang + 0.45) * hd);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/**
 * Radial field arrows pointing INTO a mass at (cx,cy). Length ∝ 1/r² (clamped), so near arrows are long.
 * rings: radii list; per: arrows per ring; p reveals ring by ring; flow animates a little inward drift.
 */
export function fieldArrows(ctx, cx, cy, t, { rings = [200, 300, 420], per = 12, p = 1, k = 1, color = N.soft, alpha = 1, rot = 0, maxLen = 110, minLen = 22 } = {}) {
  if (p <= 0 || alpha <= 0) return;
  const r0 = rings[0];
  rings.forEach((R, ri) => {
    const pr = clamp(p * rings.length - ri);
    if (pr <= 0) return;
    const len = clamp(maxLen * k * (r0 * r0) / (R * R), minLen, maxLen * 1.4);
    for (let i = 0; i < per; i++) {
      const a = rot + (i + (ri % 2) * 0.5) / per * Math.PI * 2;
      const wob = 4 * Math.sin(t * 2 + i + ri);
      const ox = cx + Math.cos(a) * (R + wob), oy = cy + Math.sin(a) * (R + wob);
      arrow(ctx, ox, oy, ox - Math.cos(a) * len, oy - Math.sin(a) * len, { color, width: 3, head: 14, p: ease.outCubic(pr), alpha: alpha * (0.55 + 0.45 * (1 - ri / rings.length)) });
    }
  });
}

/** Ellipse/circle orbit path (dashed), drawn on with p. */
export function orbitPath(ctx, cx, cy, rx, ry, { p = 1, color = ra('soft', 0.45), width = 2, rot = 0, dash = [8, 10] } = {}) {
  if (p <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke(); ctx.restore();
}

// ── The field square (memory hook) ───────────────────────────────────────────
//    F ──÷m'──▶ g        top row:    vectors (arrows), fall as 1/r²
//    ▲            ▲
//  −d/dr        −d/dr
//    Ep ─÷m'──▶ V        bottom row: scalars (numbers), fall as 1/r
// show: { F, g, Ep, V, div, der, rows } each 0..1 · hl: key to highlight orange ('F'|'g'|'Ep'|'V'|'top'|'bottom'|'div'|'der')
export const QUAD_SPECS = {
  F: { spec: [{ vec: 'F' }], name: 'Força' },
  g: { spec: [{ vec: 'g' }], name: 'Intensitat de camp' },
  Ep: { spec: [{ sub: ['E', 'p'] }], name: 'Energia potencial' },
  V: { spec: ['V'], name: 'Potencial' },
};
export function quad(ctx, x, y, s, t, { show = {}, hl = null, alpha = 1, names = true, formulas = false } = {}) {
  if (alpha <= 0) return;
  const g = (k) => clamp(show[k] ?? 0);
  const w = s * 1.25, h = s * 0.78;               // corner-to-corner span
  const pos = { F: [x - w / 2, y - h / 2], g: [x + w / 2, y - h / 2], Ep: [x - w / 2, y + h / 2], V: [x + w / 2, y + h / 2] };
  const fs = s * 0.2;
  ctx.save(); ctx.globalAlpha *= alpha;
  // row bands
  const rows = g('rows');
  if (rows > 0) {
    [['top', y - h / 2, 'VECTORS · fletxes', '1/r²'], ['bottom', y + h / 2, 'ESCALARS · números', '1/r']].forEach(([key, ry, lbl, dep], i) => {
      const a = clamp(rows * 2 - i);
      if (a <= 0) return;
      const on = hl === key;
      ctx.save(); ctx.globalAlpha *= a * (on ? 1 : 0.85);
      ctx.fillStyle = on ? ra('accent', 0.13) : ra('soft', 0.07);
      ctx.strokeStyle = on ? ra('accent', 0.7) : ra('soft', 0.18); ctx.lineWidth = 2;
      const bx = x - w / 2 - s * 0.42, bw = w + s * 0.84, bh = s * 0.5;
      ctx.beginPath(); ctx.roundRect(bx, ry - bh / 2, bw * ease.outCubic(a), bh, bh / 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      const [l1, l2] = lbl.split(' · ');
      const lx = bx - 28, ls = Math.max(30, s * 0.075);
      text(ctx, l1, lx, ry - 4, { size: ls, weight: 600, color: on ? N.naranja : N.soft, tracking: 4, align: 'right', alpha: a });
      text(ctx, l2, lx, ry + ls + 2, { size: ls, weight: 400, color: on ? N.naranja : N.soft, align: 'right', alpha: a * 0.85 });
      text(ctx, dep, bx + bw + 28, ry + s * 0.04, { size: Math.max(36, s * 0.12), weight: 400, color: on ? N.naranja : N.soft, alpha: a });
    });
  }
  // edges
  const dv = g('div'), dr = g('der');
  const ac = (k) => (hl === k ? N.naranja : ra('soft', 0.8));
  const gapX = s * 0.26, gapY = s * 0.2;
  if (dv > 0) {
    [y - h / 2, y + h / 2].forEach((ry, i) => {
      const a = clamp(dv * 2 - i * 0.6);
      arrow(ctx, x - w / 2 + gapX, ry, x + w / 2 - gapX, ry, { color: ac('div'), width: 4, head: 20, p: ease.outCubic(a) });
      text(ctx, "÷ m'", x, ry - 22, { size: Math.max(30, s * 0.1), weight: 400, align: 'center', color: ac('div'), alpha: a });
    });
  }
  if (dr > 0) {
    [x - w / 2, x + w / 2].forEach((rx, i) => {
      const a = clamp(dr * 2 - i * 0.6);
      arrow(ctx, rx, y + h / 2 - gapY, rx, y - h / 2 + gapY, { color: ac('der'), width: 4, head: 20, p: ease.outCubic(a) });
      formula(ctx, ['−', { frac: ['d', 'dr'] }], rx + (i ? -22 : 22), y + s * 0.03, { size: Math.max(34, s * 0.11), align: i ? 'right' : 'left', color: ac('der'), alpha: a });
    });
  }
  // corners
  for (const k of ['F', 'g', 'Ep', 'V']) {
    const a = g(k);
    if (a <= 0) continue;
    const [cx, cy] = pos[k];
    const on = hl === k;
    const pop = ease.outBack(clamp(a));
    ctx.save(); ctx.translate(cx, cy); ctx.scale(pop, pop);
    ctx.fillStyle = on ? ra('accent', 0.22) : ra('bg2', 0.9);
    ctx.strokeStyle = on ? N.naranja : ra('soft', 0.45); ctx.lineWidth = on ? 4 : 2;
    if (on) { ctx.shadowColor = ra('accent', 0.7); ctx.shadowBlur = 24; }
    ctx.beginPath(); ctx.arc(0, 0, s * 0.17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    formula(ctx, QUAD_SPECS[k].spec, cx, cy + fs * 0.32, { size: fs, align: 'center', alpha: clamp(a * 1.5), color: on ? N.white : N.white });
    if (names) {
      const below = k === 'Ep' || k === 'V';
      text(ctx, QUAD_SPECS[k].name, cx, below ? cy + s * 0.17 + 82 : cy - s * 0.17 - 62, { size: Math.max(30, s * 0.085), weight: 600, align: 'center', color: on ? N.naranja : N.soft, alpha: clamp(a * 1.5) });
    }
  }
  ctx.restore();
}

// ── Corner chrome ────────────────────────────────────────────────────────────
/** Top-left subject tag: "FÍSICA · CAMP GRAVITATORI" + orange chapter. */
export function tag(ctx, chapter = '', { alpha = 1 } = {}) {
  if (alpha <= 0) return;
  const base = 'FÍSICA · CAMP GRAVITATORI';
  ctx.save(); ctx.globalAlpha *= alpha * 0.9;
  text(ctx, base, 64, 64, { size: 22, weight: 600, color: N.soft, tracking: 6 });
  if (chapter) text(ctx, chapter, 64 + measure(ctx, base, { size: 22, weight: 600, tracking: 6 }) + 22, 64, { size: 22, weight: 400, color: N.naranja, tracking: 4 });
  ctx.restore();
}
/** Bottom-right progress: 9 dots, current one orange. i is 1-based. */
export function progress(ctx, i, { total = 9, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha * 0.85;
  const gap = 22, x0 = W - 64 - (total - 1) * gap, y = H - 64;
  for (let k = 1; k <= total; k++) {
    ctx.fillStyle = k === i ? N.naranja : k < i ? ra('soft', 0.7) : ra('soft', 0.25);
    ctx.beginPath(); ctx.arc(x0 + (k - 1) * gap, y, k === i ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export { spark };
