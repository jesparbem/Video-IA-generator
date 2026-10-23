// Philosophy kit for study-review videos . Builds on the base kit
// (night stage, rise, kicker…) without corporate marks. Pure functions of their args.
//
//   worlds(ctx, t, {...})            — the "two worlds" memory hook: sensible (below) / intel·ligible (above)
//   form(ctx, kind, x, y, r, t, {...}) — a perfect Idea-form (circle/triangle/square) or its imperfect copy
//   figure(ctx, x, y, h, t, {...})   — minimal human pictogram (optionally chained / walking / glowing)
//   column / temple                  — Greek architecture glyphs
//   term(ctx, greek, word, gloss, …) — Greek term card: δόξα · doxa · opinió
//   triad(ctx, x, y, {...})          — the "table of three" (ànima · virtut · classe · metall)
//   examCard(ctx, question, …)       — "PREGUNTA DE EXAMEN" callout
//   tag(ctx, chapter) · progress(ctx, i) — corner chrome (replaces the brand bug)

import { ra, W, H, N, NF, clamp, lerp, ease, e, rng, text, measure, panel, wrapLines, roundRectPath } from '../_base/kit.js';

// Metal palette for the three parts (gold = reason/rulers, silver = spirit/guards, iron = appetite/workers)
export const METAL = { or: '#f2c14e', plata: '#dfe6ec', ferro: '#8d9aa8' };
export const IDEA = '#fff3d6';           // warm light of the intelligible world
export const SHADOW = 'rgba(0,10,20,0.55)';

// ── Two worlds ───────────────────────────────────────────────────────────────
/**
 * Horizontal split of the frame (or of box {x,y,w,h}): above = món intel·ligible (warm light, perfect forms),
 * below = món sensible (cool, drifting imperfect copies). p 0→1 reveals; hl 'top'|'bottom'|null.
 * forms: show the shapes (0..1). labels: draw the two captions at the left edge.
 */
export function worlds(ctx, t, { x = 0, y = 0, w = W, h = H, split = 0.5, p = 1, alpha = 1, hl = null, forms = 1, labels = true, labelSize = 34 } = {}) {
  if (p <= 0 || alpha <= 0) return;
  const sy = y + h * split;
  const a = ease.outCubic(clamp(p));
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  // upper light
  const hiTop = hl === 'top' ? 1 : hl === 'bottom' ? 0.45 : 0.75;
  const g = ctx.createLinearGradient(0, y, 0, sy);
  g.addColorStop(0, `rgba(255,236,190,${0.20 * a * hiTop})`); g.addColorStop(1, `rgba(255,236,190,${0.04 * a * hiTop})`);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, (sy - y) * a + 1);
  // lower dusk
  const hiBot = hl === 'bottom' ? 1 : hl === 'top' ? 0.5 : 0.8;
  const g2 = ctx.createLinearGradient(0, sy, 0, y + h);
  g2.addColorStop(0, `rgba(0,12,24,${0.15 * a * hiBot})`); g2.addColorStop(1, `rgba(0,8,16,${0.5 * a * hiBot})`);
  ctx.fillStyle = g2; ctx.fillRect(x, sy, w, (y + h - sy) * a + 1);
  // the divide: a bright line drawn from the centre outwards
  const half = (w / 2) * a;
  const lg = ctx.createLinearGradient(x + w / 2 - half, 0, x + w / 2 + half, 0);
  lg.addColorStop(0, 'rgba(255,236,190,0)'); lg.addColorStop(0.5, 'rgba(255,236,190,0.9)'); lg.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.fillStyle = lg; ctx.fillRect(x + w / 2 - half, sy - 1.5, half * 2, 3);
  // forms: perfect above, imperfect copies below (same three kinds, drifting)
  const fa = clamp(forms) * a;
  if (fa > 0) {
    const kinds = ['circle', 'triangle', 'square'];
    const r = Math.min(w, h) * 0.06;
    kinds.forEach((k, i) => {
      const fx = x + w * (0.52 + i * 0.16);
      const pa = clamp(fa * 3 - i * 0.6);
      form(ctx, k, fx, y + (sy - y) * 0.5 + Math.sin(t * 0.8 + i) * 4, r, t, { alpha: pa * (hl === 'bottom' ? 0.5 : 1), glow: hl === 'top' ? 1 : 0.6 });
      for (let j = 0; j < 2; j++) {
        const dx = (j ? 1 : -1) * r * 0.55 + Math.sin(t * 0.6 + i * 2 + j) * r * 0.25;
        form(ctx, k, fx + dx, sy + (y + h - sy) * (0.42 + j * 0.2), r * (0.72 - j * 0.12), t, { imperfect: 1, seed: i * 7 + j, alpha: pa * 0.8 * (hl === 'top' ? 0.5 : 1) });
      }
    });
  }
  ctx.restore();
  if (labels) {
    const la = clamp(p * 1.4 - 0.3) * alpha;
    const lx = x + 110;
    text(ctx, 'MÓN INTEL·LIGIBLE', lx, sy - 70, { size: labelSize, weight: 600, tracking: 5, color: hl === 'top' ? METAL.or : IDEA, alpha: la });
    text(ctx, 'idees · eternes · perfectes', lx, sy - 70 + labelSize * 1.35, { size: labelSize * 0.9, weight: 300, color: N.soft, alpha: la * 0.9 });
    text(ctx, 'MÓN SENSIBLE', lx, sy + 80, { size: labelSize, weight: 600, tracking: 5, color: hl === 'bottom' ? N.naranja : N.soft, alpha: la });
    text(ctx, 'coses · canvien · imperfectes', lx, sy + 80 + labelSize * 1.35, { size: labelSize * 0.9, weight: 300, color: N.soft, alpha: la * 0.9 });
  }
}

/**
 * A geometric "Idea": crisp, glowing, slowly turning. imperfect=1 draws a wobbly, dimmer, jittering copy
 * (the sensible thing that only participates in the Idea).
 */
export function form(ctx, kind, x, y, r, t, { alpha = 1, imperfect = 0, seed = 0, glow = 0.6, color = null, rot = null, width = null } = {}) {
  if (alpha <= 0 || r <= 0) return;
  const R = rng(seed + 3);
  const jit = imperfect;
  const ang = rot ?? (imperfect ? Math.sin(t * 0.7 + seed) * 0.25 : t * 0.12);
  const pts = [];
  const n = kind === 'circle' ? 48 : kind === 'triangle' ? 3 : 4;
  const off = kind === 'triangle' ? -Math.PI / 2 : kind === 'square' ? Math.PI / 4 : 0;
  const rad = kind === 'square' ? r * 1.15 : r;
  const ph = Array.from({ length: 6 }, () => R() * 6.28);
  for (let i = 0; i < n; i++) {
    const a = off + ang + (i / n) * Math.PI * 2;
    const wob = jit ? 1 + 0.11 * Math.sin(a * 3 + ph[0] + t * 0.9) + 0.06 * Math.sin(a * 5 + ph[1]) : 1;
    pts.push([x + Math.cos(a) * rad * wob, y + Math.sin(a) * rad * wob]);
  }
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'circle' || !jit) { pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); }
  else {   // imperfect polygon: bulging, slightly broken edges
    for (let i = 0; i < n; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
      const mx = (ax + bx) / 2 + (R() - 0.5) * r * 0.25, my = (ay + by) / 2 + (R() - 0.5) * r * 0.25;
      if (!i) ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(mx, my, bx, by);
    }
  }
  ctx.closePath();
  if (jit) {
    ctx.fillStyle = 'rgba(127,160,190,0.10)'; ctx.fill();
    ctx.strokeStyle = color ?? 'rgba(160,185,205,0.55)'; ctx.lineWidth = width ?? Math.max(2, r * 0.05);
    ctx.setLineDash([r * 0.3, r * 0.08]);
    ctx.stroke();
  } else {
    if (glow > 0) { ctx.shadowColor = `rgba(255,220,150,${0.8 * glow})`; ctx.shadowBlur = r * 0.6 * glow; }
    ctx.fillStyle = 'rgba(255,236,190,0.10)'; ctx.fill();
    ctx.strokeStyle = color ?? IDEA; ctx.lineWidth = width ?? Math.max(2.5, r * 0.07);
    ctx.stroke();
  }
  ctx.restore();
}

// ── People and places ────────────────────────────────────────────────────────
/**
 * Minimal human pictogram standing on (x, y) (feet), height h. Pure shapes: head + rounded body + legs.
 * chained: draws a shackle bar at the ankles. walk: 0..1 phase drives a stride. glow: warm rim (enlightened).
 * dir: 1 faces right, -1 left (only affects the stride lean). arm: 0..1 raises one arm (pointing up/out).
 */
export function figure(ctx, x, y, h, t, { alpha = 1, color = N.soft, chained = false, walk = 0, glow = 0, dir = 1, arm = 0, lean = 0 } = {}) {
  if (alpha <= 0 || h <= 0) return;
  const s = h / 100;
  const stride = walk ? Math.sin(walk * Math.PI * 2) : 0;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.translate(x, y); ctx.rotate(lean * dir);
  if (glow > 0) { ctx.shadowColor = `rgba(255,220,150,${0.9 * glow})`; ctx.shadowBlur = 30 * s * glow; }
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = 9 * s;
  // legs
  ctx.beginPath(); ctx.moveTo(-6 * s, -38 * s); ctx.lineTo(-6 * s + stride * 10 * s * dir, -2 * s);
  ctx.moveTo(6 * s, -38 * s); ctx.lineTo(6 * s - stride * 10 * s * dir, -2 * s); ctx.stroke();
  // body
  roundRectPath(ctx, -15 * s, -74 * s, 30 * s, 42 * s, 13 * s); ctx.fill();
  // arms
  ctx.lineWidth = 8 * s;
  ctx.beginPath(); ctx.moveTo(-13 * s, -66 * s); ctx.lineTo(-18 * s - stride * 6 * s * dir, -40 * s);
  const ax = lerp(18, 30, arm) * s * dir, ay = lerp(-40, -96, arm) * s;
  ctx.moveTo(13 * s * dir, -66 * s); ctx.lineTo(ax, ay); ctx.stroke();
  // head
  ctx.beginPath(); ctx.arc(0, -87 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  if (chained) {
    ctx.strokeStyle = 'rgba(180,190,200,0.9)'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(-26 * s, -8 * s); ctx.lineTo(26 * s, -8 * s); ctx.stroke();
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(i * 10 * s, -8 * s, 4.5 * s, 3 * s, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.restore();
}

/** Doric-ish column standing on (x, y), height h. p draws it bottom-up. */
export function column(ctx, x, y, h, { p = 1, alpha = 1, color = N.soft, w = null } = {}) {
  if (p <= 0 || alpha <= 0) return;
  const cw = w ?? h * 0.14, hh = h * ease.outCubic(clamp(p));
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  ctx.fillRect(x - cw * 0.75, y - h * 0.05, cw * 1.5, h * 0.05);                    // base
  ctx.globalAlpha *= 0.9;
  ctx.fillRect(x - cw / 2, y - hh, cw, hh);                                          // shaft
  ctx.globalAlpha /= 0.9;
  ctx.strokeStyle = 'rgba(0,33,55,0.35)'; ctx.lineWidth = Math.max(1, cw * 0.06);
  for (let i = 1; i < 4; i++) { const fx = x - cw / 2 + (cw * i) / 4; ctx.beginPath(); ctx.moveTo(fx, y - hh + 4); ctx.lineTo(fx, y - h * 0.05); ctx.stroke(); }
  if (p >= 0.98) ctx.fillRect(x - cw * 0.8, y - h - h * 0.05, cw * 1.6, h * 0.06); // capital
  ctx.restore();
}

/** Greek temple: steps, n columns, architrave and pediment. Centred at cx, base at y, width w. p builds it. */
export function temple(ctx, cx, y, w, { p = 1, alpha = 1, color = N.soft, cols = 6, glow = 0 } = {}) {
  if (p <= 0 || alpha <= 0) return;
  const h = w * 0.62, colH = h * 0.62;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (glow > 0) { ctx.shadowColor = `rgba(255,220,150,${glow})`; ctx.shadowBlur = 40 * glow; }
  ctx.fillStyle = color;
  const ps = clamp(p * 4);
  ctx.fillRect(cx - w / 2, y - h * 0.04, w * ps, h * 0.04);
  ctx.fillRect(cx - w * 0.46, y - h * 0.08, w * 0.92 * ps, h * 0.04);
  ctx.shadowColor = 'transparent';
  for (let i = 0; i < cols; i++) {
    const fx = cx - w * 0.4 + (w * 0.8 * i) / (cols - 1);
    column(ctx, fx, y - h * 0.08, colH, { p: clamp(p * 3 - 0.6 - i * 0.12), color, w: w * 0.055 });
  }
  const pt = clamp(p * 2.5 - 1.5);
  if (pt > 0) {
    ctx.globalAlpha *= pt;
    const ty = y - h * 0.08 - colH - h * 0.05;
    ctx.fillRect(cx - w * 0.47, ty - h * 0.03, w * 0.94, h * 0.08);
    ctx.beginPath(); ctx.moveTo(cx - w * 0.5, ty - h * 0.03); ctx.lineTo(cx, ty - h * 0.03 - h * 0.24); ctx.lineTo(cx + w * 0.5, ty - h * 0.03); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ── Words ────────────────────────────────────────────────────────────────────
/**
 * Greek term card: big Greek word, its transliteration and a Catalan gloss below.
 * term(ctx, 'δόξα', 'doxa', 'opinió', x, y, {p, size, align, hl})
 */
export function term(ctx, greek, word, gloss, x, y, { p = 1, size = 96, align = 'center', hl = false, alpha = 1, color = null } = {}) {
  const a = ease.outCubic(clamp(p));
  if (a <= 0 || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha * a;
  const dy = (1 - a) * 30;
  const c = color ?? (hl ? METAL.or : N.white);
  if (greek) text(ctx, greek, x, y + dy, { size, weight: 300, align, color: c });
  if (word) text(ctx, word, x, y + size * 0.62 + dy, { size: Math.max(30, size * 0.4), weight: 600, align, color: hl ? N.naranja : N.soft, tracking: 3 });
  if (gloss) text(ctx, gloss, x, y + size * 0.62 + Math.max(30, size * 0.4) * 1.3 + dy, { size: Math.max(30, size * 0.36), weight: 300, align, color: N.soft });
  ctx.restore();
}

/** "PREGUNTA DE EXAMEN" callout: glass panel, orange kicker, wrapped question (≥ 40 px). Returns height. */
export function examCard(ctx, question, x, y, { p = 1, w = 900, size = 48, align = 'left', alpha = 1, label = 'PREGUNTA DE EXAMEN', answer = '', ap = 0 } = {}) {
  const a = ease.outBack(clamp(p));
  if (a <= 0 || alpha <= 0) return 0;
  const lines = wrapLines(ctx, question, w - 100, { size, weight: 400 });
  const alines = answer ? wrapLines(ctx, answer, w - 100, { size: size * 0.9, weight: 600 }) : [];
  const hh = 120 + lines.length * size * 1.25 + (alines.length ? 30 + alines.length * size * 1.15 * clamp(ap * 1.5) : 0);
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save(); ctx.globalAlpha *= alpha * clamp(p * 2);
  ctx.translate(x0 + w / 2, y + hh / 2); ctx.scale(lerp(0.9, 1, a), lerp(0.9, 1, a)); ctx.translate(-(x0 + w / 2), -(y + hh / 2));
  panel(ctx, x0, y, w, hh, { r: 24, stroke: ra('accent', 0.75), glow: 0.35, fill: ra('deep', 0.82) });
  ctx.fillStyle = N.naranja; ctx.fillRect(x0 + 50, y + 48, 40, 4);
  text(ctx, label, x0 + 106, y + 60, { size: 26, weight: 600, color: N.naranja, tracking: 5 });
  lines.forEach((ln, i) => text(ctx, ln, x0 + 50, y + 120 + i * size * 1.25, { size, weight: 400, color: N.white }));
  if (alines.length) {
    const aa = clamp(ap * 1.5);
    alines.forEach((ln, i) => text(ctx, ln, x0 + 50, y + 120 + lines.length * size * 1.25 + 20 + i * size * 1.15, { size: size * 0.9, weight: 600, color: METAL.or, alpha: aa }));
  }
  ctx.restore();
  return hh;
}

// ── The table of three ───────────────────────────────────────────────────────
export const TRIAD = {
  cols: [
    { key: 'racional', color: METAL.or },
    { key: 'irascible', color: METAL.plata },
    { key: 'concupiscible', color: METAL.ferro },
  ],
  rows: {
    anima:  { label: 'Ànima',  cells: ['Racional', 'Irascible', 'Concupiscible'] },
    carro:  { label: 'Carro',  cells: ['Auriga', 'Cavall blanc', 'Cavall negre'] },
    lloc:   { label: 'Lloc',   cells: ['Cap', 'Pit', 'Ventre'] },
    virtut: { label: 'Virtut', cells: ['Saviesa', 'Fortalesa', 'Temprança'] },
    classe: { label: 'Classe', cells: ['Governants', 'Militars', 'Treballadors'] },
    metall: { label: 'Metall', cells: ['Or', 'Plata', 'Ferro'] },
  },
};
/**
 * Draws a grid: one row per key in `rows` (keys of TRIAD.rows), three metal-coloured columns.
 * show: {rowKey: 0..1} reveals each row (cells pop left→right). hlCol: 0|1|2 highlights a column;
 * hlRow: key highlights a row. Row label on the left (≥ 30 px). Returns {x0, colX[], rowY{}} for anchoring.
 */
export function triad(ctx, x, y, { rows = ['anima', 'virtut', 'classe'], show = {}, colW = 380, rowH = 108, labelW = 220, size = 44, hlCol = null, hlRow = null, alpha = 1 } = {}) {
  const colX = [0, 1, 2].map((i) => x + labelW + colW * i + colW / 2);
  const rowY = {};
  if (alpha <= 0) return { colX, rowY };
  ctx.save(); ctx.globalAlpha *= alpha;
  // column glows
  TRIAD.cols.forEach((c, i) => {
    const on = hlCol === i;
    if (hlCol != null && !on) return;
    const any = Math.max(0, ...rows.map((k) => clamp(show[k] ?? 0)));
    if (any <= 0) return;
    ctx.save(); ctx.globalAlpha *= any * (on ? 0.22 : 0.06);
    ctx.fillStyle = c.color; roundRectPath(ctx, colX[i] - colW / 2 + 10, y - rowH * 0.62, colW - 20, rowH * rows.length + 10, 22); ctx.fill();
    ctx.restore();
  });
  rows.forEach((k, ri) => {
    const r = TRIAD.rows[k];
    const ry = y + ri * rowH;
    rowY[k] = ry;
    const a = clamp(show[k] ?? 0);
    if (a <= 0) return;
    const rowOn = hlRow === k;
    text(ctx, r.label.toUpperCase(), x + labelW - 30, ry + size * 0.33, { size: 30, weight: 600, align: 'right', tracking: 4, color: rowOn ? N.naranja : N.soft, alpha: clamp(a * 2) });
    r.cells.forEach((cell, ci) => {
      const ca = ease.outBack(clamp(a * 3 - ci * 0.7));
      if (ca <= 0) return;
      const dim = hlCol != null && hlCol !== ci ? 0.35 : 1;
      ctx.save(); ctx.globalAlpha *= clamp(ca) * dim;
      ctx.translate(colX[ci], ry); ctx.scale(ca, ca);
      text(ctx, cell, 0, size * 0.33, { size, weight: rowOn || hlCol === ci ? 400 : 300, align: 'center', color: TRIAD.cols[ci].color });
      ctx.restore();
    });
  });
  ctx.restore();
  return { colX, rowY };
}

// ── Corner chrome ────────────────────────────────────────────────────────────
/** Top-left subject tag: "FILOSOFIA · SÒCRATES I PLATÓ" + orange chapter. */
export function tag(ctx, chapter = '', { alpha = 1 } = {}) {
  if (alpha <= 0) return;
  const base = 'FILOSOFIA · SÒCRATES I PLATÓ';
  ctx.save(); ctx.globalAlpha *= alpha * 0.9;
  text(ctx, base, 64, 64, { size: 22, weight: 600, color: N.soft, tracking: 6 });
  if (chapter) text(ctx, chapter, 64 + measure(ctx, base, { size: 22, weight: 600, tracking: 6 }) + 22, 64, { size: 22, weight: 400, color: N.naranja, tracking: 4 });
  ctx.restore();
}
/** Bottom-right progress: 14 dots, current one orange. i is 1-based. */
export function progress(ctx, i, { total = 14, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha * 0.85;
  const gap = 22, x0 = W - 64 - (total - 1) * gap, y = H - 64;
  for (let k = 1; k <= total; k++) {
    ctx.fillStyle = k === i ? N.naranja : k < i ? ra('soft', 0.7) : ra('soft', 0.25);
    ctx.beginPath(); ctx.arc(x0 + (k - 1) * gap, y, k === i ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
