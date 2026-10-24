// Base kit — theme-driven "motion graphics" components shared by every style.
// Every helper is a pure function of its arguments and reads colours/fonts from the
// active theme (T, see theme.js) at draw time. Style folders re-export this kit and
// may add signature components (styles/<name>/kit.js).
//
// Look by default: a stage background chosen by the theme (night, clean, mesh, paper,
// grid, blocks, blobs), headlines that rise word by word, the accent colour used only
// as energy — pulses on lines, the active item, the one word that matters.

import { W, H, clamp, lerp, inv, prog, ease as ease0, rng, noise, roundRectPath, cues, edgeFade } from '../../engine/runtime.js';
import { T, BRAND, N, NF, MONO, ra, mixc, headCase } from './theme.js';
export { W, H, clamp, lerp, inv, prog, rng, noise, cues, edgeFade, roundRectPath, T, BRAND, N, NF, MONO, ra, mixc, headCase };
/** runtime easings + a few more; outBack is exactly 0 at p<=0 (no early leak). */
export const ease = {
  ...ease0,
  outBack: (p, s = 1.70158) => (p <= 0 ? 0 : ease0.outBack(p, s)),
  outQuart: (p) => 1 - Math.pow(1 - p, 4),
  inQuart: (p) => p * p * p * p,
  inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
};
/** eased progress, exactly 0 before start and 1 after end */
export const e = (t, start, dur, fn = ease.outCubic) => { const p = prog(t, start, dur); return p <= 0 ? 0 : p >= 1 ? 1 : fn(p); };

// ── Assets ──────────────────────────────────────────────────────────────────
const cache = new Map();
export function loadImage(src) {
  if (cache.has(src)) return cache.get(src);
  const pr = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img ' + src)); im.src = src; });
  cache.set(src, pr);
  return pr;
}
const brandUrl = (p) => (!p ? null : /^(https?:|data:|\/)/.test(p) ? p : '/' + p.replace(/^\.?\//, ''));
const tryImage = async (p) => { const u = brandUrl(p); if (!u) return null; try { return await loadImage(u); } catch { console.warn('brand image not found: ' + p); return null; } };
/**
 * Preload brand images (paths from project.config.json → brand, relative to the repo root)
 * + any UI shots from <video>/assets/ui/. Call in setup: `A = await assets(env, ['01-app.png'])`.
 * Missing logos are fine: logo()/bug()/wordmark() fall back to typography.
 */
export async function assets(env, ui = []) {
  const out = {
    logo: await tryImage(BRAND.logo),                             // for dark stages
    logoOnLight: await tryImage(BRAND.logoOnLight || BRAND.logo), // for light stages
    symbol: await tryImage(BRAND.symbol),                         // brand symbol alone (optional)
    ui: {},
  };
  for (const f of ui) out.ui[f] = await loadImage(`/${env.ep}/assets/ui/${f}`);
  out.boxes = {};
  if (ui.length) try { out.boxes = await (await fetch(`/${env.ep}/assets/ui/boxes.json`)).json(); } catch { /* no boxes.json */ }
  return out;
}

// ── Stage ───────────────────────────────────────────────────────────────────
/** True when the active theme uses a light background (text should be dark). */
export const isLight = () => T.mode === 'light';

function dotGrid(ctx, t, lightX, lightY, amount, color) {
  const s = 48, ox = (t * 4) % s;
  for (let y = s / 2; y < H; y += s) for (let x = -s + ox; x < W + s; x += s) {
    const d = Math.hypot(x - lightX, y - lightY) / (W * 0.7);
    const a = 0.16 * amount * clamp(1 - d) * (0.6 + 0.4 * noise(x * 0.01 + y * 0.013 + t * 0.15, 3));
    if (a < 0.01) continue;
    ctx.fillStyle = ra(color, a);
    ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
  }
}
function motesLayer(ctx, t, amount) {
  const r = rng(77);
  for (let i = 0; i < 46; i++) {
    const bx = r() * W, by = r() * H, sp = 6 + r() * 14, sz = 1 + r() * 2.4, ph = r() * 10;
    const x = (bx + Math.sin(t * 0.2 + ph) * 30) % W, y = ((by - t * sp) % H + H) % H;
    const a = (0.10 + 0.25 * r()) * amount * (0.5 + 0.5 * Math.sin(t * 1.3 + ph));
    ctx.fillStyle = i % 9 === 0 ? ra('accent', a * 1.4) : ra('soft', a);
    ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2); ctx.fill();
  }
}
function radialFill(ctx, x, y, r, c0, c1, c2) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function blob(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, ra(color, a)); g.addColorStop(1, ra(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/**
 * Theme stage (background). kind comes from theme.stage.kind unless overridden:
 *   night  — deep radial light, dot grid, drifting motes (keynote at night)
 *   clean  — flat background with a soft vignette, nothing else (minimal)
 *   mesh   — slow-moving coloured light blobs (creative gradient mesh)
 *   paper  — paper tone, fine grain and a printed frame line (classic)
 *   grid   — dark, perspective neon grid and scanlines (tech)
 *   blocks — flat colour with a big accent block that slides (editorial)
 *   blobs  — light background with soft pastel shapes (friendly)
 */
export function stage(ctx, t, { lightX = W * 0.5, lightY = H * 0.42, grid = T.stage.grid ?? 1, motes = T.stage.motes ?? 1, alpha = 1, kind = T.stage.kind } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = T.bg;
  ctx.fillRect(0, 0, W, H);
  if (kind === 'night') {
    radialFill(ctx, lightX, lightY, W * 0.75, T.bg2, T.bg, T.deep);
    if (grid > 0) dotGrid(ctx, t, lightX, lightY, grid, 'soft');
    if (motes > 0) motesLayer(ctx, t, motes);
  } else if (kind === 'clean') {
    radialFill(ctx, W * 0.5, H * 0.45, W * 0.8, T.bg2, T.bg, mixc('bg', 'deep', 0.25));
  } else if (kind === 'mesh') {
    const s = T.series;
    for (let i = 0; i < 4; i++) {
      const a = t * 0.12 + i * 1.7;
      blob(ctx, W * (0.5 + 0.38 * Math.cos(a)), H * (0.5 + 0.42 * Math.sin(a * 1.3)), W * 0.45, s[i % s.length], 0.55);
    }
    if (motes > 0) motesLayer(ctx, t, motes * 0.6);
  } else if (kind === 'paper') {
    radialFill(ctx, W * 0.5, H * 0.4, W * 0.8, T.bg2, T.bg, mixc('bg', 'deep', 0.15));
    const r = rng(9);
    for (let i = 0; i < 1400; i++) { ctx.fillStyle = ra('deep', 0.025 + r() * 0.04); ctx.fillRect(r() * W, r() * H, 1.5, 1.5); }
    ctx.strokeStyle = ra('primary', 0.35); ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, W - 80, H - 80);
    ctx.lineWidth = 1; ctx.strokeRect(52, 52, W - 104, H - 104);
  } else if (kind === 'grid') {
    radialFill(ctx, W * 0.5, H * 0.35, W * 0.7, T.bg2, T.bg, T.deep);
    const hz = H * 0.62, n = 22;
    ctx.strokeStyle = ra('primary', 0.35 * grid); ctx.lineWidth = 1.5;
    for (let i = -n; i <= n; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 18, hz); ctx.lineTo(W / 2 + i * 260, H); ctx.stroke(); }
    for (let k = 0; k < 12; k++) {
      const u = (k + (t * 0.6) % 1) / 12, y = hz + (H - hz) * u * u;
      ctx.strokeStyle = ra('primary', 0.4 * u * grid); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.fillStyle = ra('deep', 0.18);
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    if (motes > 0) motesLayer(ctx, t, motes * 0.5);
  } else if (kind === 'blocks') {
    // masthead band + accent rule on top, ruled "newsprint" lines, a slow accent block bottom-left
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = T.accent; ctx.fillRect(0, 22, W, 6);
    ctx.fillStyle = ra('ink', 0.06);
    for (let y = 150; y < H - 40; y += 120) ctx.fillRect(60, y, W - 120, 1);
    const bw = W * (0.10 + 0.01 * Math.sin(t * 0.3));
    ctx.fillStyle = ra('accent', 0.9); ctx.fillRect(0, H - 18, bw, 18);
  } else if (kind === 'blobs') {
    radialFill(ctx, W * 0.5, H * 0.4, W * 0.8, T.bg2, T.bg, T.bg);
    const s = T.series, r = rng(5);
    for (let i = 0; i < 7; i++) {
      const bx = r() * W, by = r() * H, br = 120 + r() * 220, ph = r() * 6;
      ctx.fillStyle = ra(s[i % s.length], 0.12);
      ctx.beginPath(); ctx.arc(bx + Math.sin(t * 0.3 + ph) * 30, by + Math.cos(t * 0.25 + ph) * 24, br, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

/** Day stage: off-white with a whisper of primary light and grid (for product screenshots). */
export function dayStage(ctx, t, { alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = T.paper;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, W * 0.8);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, T.paper2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const s = 48, ox = (t * 4) % s;
  ctx.fillStyle = ra('primary', 0.07);
  for (let y = s / 2; y < H; y += s) for (let x = -s + ox; x < W + s; x += s) ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.restore();
}

/** Fade the whole frame from/to the theme's deep colour at segment edges. Call last. */
export function edges(ctx, t, dur, { inDur = 0.4, outDur = 0.4, color = T.deep } = {}) {
  const a = 1 - edgeFade(t, dur, inDur, outDur);
  if (a <= 0.001) return;
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore();
}

/** Corner bug: product/brand name top-left (+ chapter in accent), logo bottom-right if configured. */
export function bug(ctx, A, { alpha = 1, day = false, chapter = '', product = BRAND.product || BRAND.name } = {}) {
  if (!BRAND.showBug) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  const light = day || isLight();
  const img = light ? A?.logoOnLight : A?.logo;
  if (img) { const lw = 150, lh = lw * img.height / img.width; ctx.drawImage(img, W - 64 - lw, H - 52 - lh, lw, lh); }
  const name = (product || '').toUpperCase();
  const lab = { size: 22, weight: T.wLabel, tracking: 6 };
  if (name) text(ctx, name, 64, 64, { ...lab, color: light ? T.primary : T.soft });
  if (chapter) text(ctx, chapter, 64 + (name ? measure(ctx, name, lab) + 22 : 0), 64, { size: 22, weight: 400, color: T.accent, tracking: 4 });
  ctx.restore();
}

// ── Type ────────────────────────────────────────────────────────────────────
export function font(size, weight = T.wHead, family = T.fontDisplay) { return `${weight} ${size}px ${family}`; }

export function measure(ctx, str, { size = 64, weight = T.wText, tracking = 0, family = T.fontBody } = {}) {
  ctx.save(); ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(str).width + tracking * Math.max(0, str.length - 1);
  ctx.restore();
  return w;
}

/** Plain text. align: left|center|right. baseline 'alphabetic' at y. */
export function text(ctx, str, x, y, { size = 64, weight = T.wText, color = T.text, align = 'left', alpha = 1, tracking = 0, family = T.fontBody, baseline = 'alphabetic' } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textBaseline = baseline;
  if (!tracking) { ctx.textAlign = align; ctx.fillText(str, x, y); ctx.restore(); return; }
  const w = measure(ctx, str, { size, weight, tracking, family });
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left';
  for (const ch of str) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + tracking; }
  ctx.restore();
}

/**
 * Headline that rises in word by word behind a mask (the brand-motion signature).
 * words: string or array of {w, color?, weight?}. p: 0→1 reveal; out: 0→1 exit (rise up and fade).
 * maxWidth (default 0.9·W): the size shrinks only if the line would be wider, so 16:9 headlines fit 9:16.
 * Returns the measured width.
 */
export function rise(ctx, words, x, y, { size = 120, weight = T.wHead, family = T.fontDisplay, color = T.text, align = 'left', p = 1, out = 0, stagger = 0.12, accent = [], accentColor = T.accent, maxWidth = W * 0.9 } = {}) {
  const list = (Array.isArray(words) ? words : words.split(' ')).map((w) => (typeof w === 'string' ? { w: headCase(w) } : { ...w, w: headCase(w.w) }));
  ctx.save();
  const measureAll = () => {
    ctx.font = `${weight} ${size}px ${family}`;
    const sp = ctx.measureText(' ').width;
    const ws = list.map((o) => { ctx.font = `${o.weight ?? weight} ${size}px ${family}`; return ctx.measureText(o.w).width; });
    return [sp, ws, ws.reduce((a, b) => a + b, 0) + sp * (list.length - 1)];
  };
  let [space, widths, total] = measureAll();
  // shrink only when the line would leave the frame (e.g. a 16:9 headline rendered at 9:16)
  if (total > maxWidth) { size = Math.floor(size * maxWidth / total); [space, widths, total] = measureAll(); }
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const n = list.length;
  list.forEach((o, i) => {
    // p=1 reveals every word; each word takes 1/(1+stagger·(n−1)) of the range
    const pp = ease.outQuart(clamp(p * (1 + stagger * (n - 1)) - i * stagger));
    const po = ease.inCubic(clamp(out * (1 + stagger * (n - 1)) - i * stagger));
    if (pp > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - 10, y - size * 1.05, widths[i] + 20, size * 1.38);
      ctx.clip();
      ctx.globalAlpha *= clamp(pp * 1.5) * (1 - po);
      ctx.font = `${o.weight ?? weight} ${size}px ${family}`;
      ctx.fillStyle = o.color ?? (accent.includes(i) ? accentColor : color);
      ctx.textAlign = 'left';
      ctx.fillText(o.w, cx, y + (1 - pp) * size * 1.1 - po * size * 0.6);
      ctx.restore();
    }
    cx += widths[i] + space;
  });
  ctx.restore();
  return total;
}

/** Uppercase tracked kicker with a short accent dash before it. */
export function kicker(ctx, str, x, y, { p = 1, color = T.accent, size = 26, align = 'left', dash = true } = {}) {
  const a = ease.outCubic(clamp(p));
  if (a <= 0) return;
  const w = measure(ctx, str.toUpperCase(), { size, weight: T.wLabel, tracking: 5 });
  let x0 = align === 'center' ? x - (w + (dash ? 56 : 0)) / 2 : x;
  ctx.save();
  ctx.globalAlpha *= a;
  if (dash) {
    ctx.fillStyle = T.accent;
    ctx.fillRect(x0, y - size * 0.38, 40 * a, 4);
    x0 += 56;
  }
  text(ctx, str.toUpperCase(), x0 + (1 - a) * 20, y, { size, weight: T.wLabel, color, tracking: 5 });
  ctx.restore();
}

// ── Brand marks ─────────────────────────────────────────────────────────────
/** Brand symbol image (only translated/scaled/rotated, never distorted), centred; size = width in px.
 *  img null → an accent disc, so scenes work before any brand asset is configured. */
export function symbol(ctx, img, x, y, size, { rot = 0, alpha = 1, glow = 0 } = {}) {
  if (alpha <= 0 || size <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.globalAlpha *= alpha;
  if (glow > 0) { ctx.shadowColor = ra('accent', 0.8 * glow * T.glow); ctx.shadowBlur = size * 0.35 * glow; }
  if (img) { const h = size * img.height / img.width; ctx.drawImage(img, -size / 2, -h / 2, size, h); }
  else { ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
/** Full logo centred at x,y with width w. Without a logo file it writes the brand name. */
export function logo(ctx, A, x, y, w, { alpha = 1, day = false } = {}) {
  if (alpha <= 0) return;
  const img = day || isLight() ? A?.logoOnLight : A?.logo;
  if (img) { const h = w * img.height / img.width; ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(img, x - w / 2, y - h / 2, w, h); ctx.restore(); return; }
  const name = BRAND.name || BRAND.product;
  if (name) text(ctx, name, x, y + w * 0.06, { size: w * 0.16, weight: T.wLabel, align: 'center', alpha, color: day || isLight() ? T.primary : T.text, family: T.fontDisplay });
}

// ── Energy ──────────────────────────────────────────────────────────────────
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
export function pointAt(pts, u) {
  const L = polyLen(pts) * clamp(u); let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + s >= L) { const k = s ? (L - acc) / s : 0; return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; }
    acc += s;
  }
  return pts[pts.length - 1];
}
/** Glowing accent dot. */
export function spark(ctx, x, y, r = 6, { alpha = 1, color = T.accent } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, color === T.accent ? ra('accentHi', 0.95) : 'rgba(255,255,255,0.9)');
  g.addColorStop(0.25, color === T.accent ? ra('accent', 0.6) : ra('soft', 0.5));
  g.addColorStop(1, ra('accent', 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff3e6';
  ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/**
 * A network line that draws on (p) and carries accent pulses (t-driven).
 * pts: [[x,y],…]. pulses: count of pulses travelling along (0 = none). speed in px/s.
 */
export function energyLine(ctx, pts, t, { p = 1, width = 2, color = T.line, pulses = 1, speed = 380, pulseLen = 120, alpha = 1, seed = 1, dash = null } = {}) {
  if (p <= 0 || alpha <= 0) return;
  const L = polyLen(pts);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  let acc = 0; const target = L * clamp(p);
  for (let i = 1; i < pts.length; i++) {
    const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + s >= target) { const k = s ? (target - acc) / s : 0; ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)); break; }
    ctx.lineTo(pts[i][0], pts[i][1]); acc += s;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  if (pulses > 0 && p >= 1) {
    const r = rng(seed);
    for (let k = 0; k < pulses; k++) {
      const off = r() * L;
      const head = ((t * speed + off + k * L / pulses) % (L + pulseLen));
      const steps = 14;
      for (let j = 0; j < steps; j++) {
        const d = head - (j / steps) * pulseLen;
        if (d < 0 || d > L) continue;
        const [x, y] = pointAt(pts, d / L);
        const a = (1 - j / steps);
        ctx.fillStyle = `${ra('accentHi', 0.85 * a * T.energy)}`;
        ctx.beginPath(); ctx.arc(x, y, width * 1.6 * (0.4 + a * 0.8), 0, Math.PI * 2); ctx.fill();
      }
      if (head <= L) { const [x, y] = pointAt(pts, head / L); spark(ctx, x, y, width * 1.6); }
    }
  }
  ctx.restore();
}

// ── Shapes and components ───────────────────────────────────────────────────
/** Panel drawn per theme (glass, solid, outline or card); day=true forces a white card. */
export function panel(ctx, x, y, w, h, { r = T.radius, alpha = 1, day = false, stroke = null, glow = 0, fill = null } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRectPath(ctx, x, y, w, h, r);
  const kind = day ? 'card' : T.panel;   // glass | solid | outline | card
  if (kind === 'card') { ctx.shadowColor = ra('deep', 0.16); ctx.shadowBlur = 40; ctx.shadowOffsetY = 14; }
  if (glow > 0) { ctx.shadowColor = `${ra('accent', 0.55 * glow * T.glow)}`; ctx.shadowBlur = 50 * glow; ctx.shadowOffsetY = 0; }
  ctx.fillStyle = fill ?? (kind === 'card' ? (day ? '#ffffff' : T.paper) : kind === 'solid' ? T.bg2 : kind === 'outline' ? 'rgba(0,0,0,0)' : ra('primary', 0.42));
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = kind === 'outline' ? T.lineWidth : 1.5;
  ctx.strokeStyle = stroke ?? (kind === 'card' ? ra('primary', 0.12) : kind === 'outline' ? ra('soft', 0.7) : ra('soft', 0.22));
  ctx.stroke();
  ctx.restore();
}

/** Pill / badge. Returns width. */
export function pill(ctx, str, x, y, { size = 30, color = T.text, bg = ra('soft', 0.14), stroke = null, alpha = 1, align = 'left', weight = 600, padX = 22, h = null, dot = null } = {}) {
  if (alpha <= 0) return 0;
  const hh = h ?? size * 1.75;
  const dotW = dot ? size * 0.9 : 0;
  const w = measure(ctx, str, { size, weight }) + padX * 2 + dotW;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRectPath(ctx, x0, y - hh / 2, w, hh, hh / 2);
  ctx.fillStyle = bg; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  if (dot) { ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x0 + padX + size * 0.25, y, size * 0.22, 0, Math.PI * 2); ctx.fill(); }
  text(ctx, str, x0 + padX + dotW, y + size * 0.36, { size, weight, color });
  ctx.restore();
  return w;
}

/** Big number that counts up + label under it. */
export function kpi(ctx, value, label, x, y, { p = 1, size = 150, color = T.text, labelColor = T.soft, prefix = '', align = 'left', labelSize = 30, maxLabel = 360 } = {}) {
  const a = ease.outCubic(clamp(p * 1.4));
  if (a <= 0) return;
  const v = Math.round(value * ease.outCubic(clamp(p)));
  ctx.save();
  ctx.globalAlpha *= a;
  text(ctx, prefix + v, x, y + (1 - a) * 30, { size, weight: T.wHead, color, align, family: T.fontDisplay });
  const lines = wrapLines(ctx, label, maxLabel, { size: labelSize, weight: 400 });
  lines.forEach((ln, i) => text(ctx, ln, x, y + labelSize * 1.6 + i * labelSize * 1.25, { size: labelSize, weight: 400, color: labelColor, align }));
  ctx.restore();
}

export function wrapLines(ctx, str, maxW, o = {}) {
  const words = str.split(' '); const lines = []; let cur = '';
  for (const w of words) { const nx = cur ? cur + ' ' + w : w; if (measure(ctx, nx, o) > maxW && cur) { lines.push(cur); cur = w; } else cur = nx; }
  if (cur) lines.push(cur);
  return lines;
}

/** Circular node (agent / step). Active = accent ring pulsing. */
export function node(ctx, x, y, r, t, { label = '', sub = '', active = false, done = false, p = 1, color = T.soft, fill = ra('primary', 0.85), labelSize = 30, icon = null } = {}) {
  const a = ease.outBack(clamp(p));
  if (a <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.scale(a, a);
  if (active) {
    const pu = (t * 1.2) % 1;
    ctx.strokeStyle = `${ra('accent', 0.6 * (1 - pu))}`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r * (1 + pu * 0.7), 0, Math.PI * 2); ctx.stroke();
    ctx.shadowColor = ra('accent', 0.7); ctx.shadowBlur = 30;
  }
  ctx.fillStyle = done ? T.accent : fill;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = active || done ? T.accent : color; ctx.lineWidth = 2.5;
  ctx.stroke();
  if (icon) icon(ctx, r);
  ctx.restore();
  const la = clamp(p * 1.5 - 0.3);
  if (label) text(ctx, label, x, y + r + labelSize * 1.3, { size: labelSize, weight: 600, color: T.text, align: 'center', alpha: la });
  if (sub) text(ctx, sub, x, y + r + labelSize * 2.5, { size: labelSize * 0.85, weight: 400, color: T.soft, align: 'center', alpha: la });
}

/** Tiny agent glyph: a dot with an orbit, tinted by model tier. */
export const MODEL = { get opus() { return T.accent; }, get sonnet() { return T.series[1] ?? T.soft; }, get haiku() { return T.ok; } };
export function agentDot(ctx, x, y, t, { tier = 'sonnet', r = 10, alpha = 1, seed = 0, busy = true } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const c = MODEL[tier] ?? T.soft;
  ctx.fillStyle = c;
  ctx.shadowColor = c; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  if (busy) {
    const ang = t * 3 + seed;
    ctx.strokeStyle = c; ctx.globalAlpha *= 0.6; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r * 1.9, ang, ang + 1.6); ctx.stroke();
  }
  ctx.restore();
}

/** Document glyph (the spec): page with folded corner and text lines. */
export function docGlyph(ctx, x, y, w, t, { p = 1, alpha = 1, title = '', glow = 0, lines = 7 } = {}) {
  if (alpha <= 0 || p <= 0) return;
  const h = w * 1.3, f = w * 0.2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  const s = ease.outBack(clamp(p));
  ctx.scale(s, s);
  if (glow) { ctx.shadowColor = `${ra('accent', 0.6 * glow)}`; ctx.shadowBlur = 60 * glow; }
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2 - f, -h / 2); ctx.lineTo(w / 2, -h / 2 + f); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = T.soft;
  ctx.beginPath(); ctx.moveTo(w / 2 - f, -h / 2); ctx.lineTo(w / 2 - f, -h / 2 + f); ctx.lineTo(w / 2, -h / 2 + f); ctx.closePath(); ctx.fill();
  ctx.fillStyle = T.accent; ctx.fillRect(-w / 2 + w * 0.12, -h / 2 + h * 0.12, w * 0.4, h * 0.035);
  for (let i = 0; i < lines; i++) {
    const lw = (0.76 - (i % 3 === 2 ? 0.25 : 0)) * w;
    const fill = clamp((t * 0.8 - i * 0.12) % 3);
    ctx.fillStyle = ra('primary', 0.22);
    ctx.fillRect(-w / 2 + w * 0.12, -h / 2 + h * (0.24 + i * 0.09), lw, h * 0.025);
    ctx.fillStyle = ra('primary', 0.7);
    ctx.fillRect(-w / 2 + w * 0.12, -h / 2 + h * (0.24 + i * 0.09), lw * clamp(fill), h * 0.025);
  }
  ctx.restore();
  if (title) text(ctx, title, x, y + h / 2 * s + 48, { size: 32, weight: 600, align: 'center', alpha });
}

/** Check / cross mark. */
export function mark(ctx, x, y, s, { ok = true, p = 1, color = null, width = 6 } = {}) {
  if (p <= 0) return;
  ctx.save();
  ctx.strokeStyle = color ?? (ok ? T.ok : T.bad); ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (ok) {
    const pts = [[-0.5, 0], [-0.15, 0.35], [0.5, -0.4]].map(([a, b]) => [x + a * s, y + b * s]);
    const L1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), L2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
    const d = (L1 + L2) * clamp(p);
    ctx.moveTo(...pts[0]);
    if (d <= L1) ctx.lineTo(lerp(pts[0][0], pts[1][0], d / L1), lerp(pts[0][1], pts[1][1], d / L1));
    else { ctx.lineTo(...pts[1]); ctx.lineTo(lerp(pts[1][0], pts[2][0], (d - L1) / L2), lerp(pts[1][1], pts[2][1], (d - L1) / L2)); }
  } else {
    const a = clamp(p * 2), b = clamp(p * 2 - 1);
    ctx.moveTo(x - s / 2, y - s / 2); ctx.lineTo(x - s / 2 + s * a, y - s / 2 + s * a);
    if (b > 0) { ctx.moveTo(x + s / 2, y - s / 2); ctx.lineTo(x + s / 2 - s * b, y - s / 2 + s * b); }
  }
  ctx.stroke();
  ctx.restore();
}

// ── UI screenshots ──────────────────────────────────────────────────────────
/**
 * Draw a real UI screenshot (3840×2160 for a 1920×1080 viewport) inside a browser frame.
 * Frame placed at x,y with width w (height from 16:9 + bar).
 * view: {cx, cy, zoom} in screenshot CSS px (1920×1080 space) — the point shown at the centre
 * of the frame and the zoom (1 = whole page). focus: box {x,y,w,h} in CSS px → dims the rest
 * and draws an accent ring (focusP 0→1). tilt: small affine skew for depth (−0.06…0.06).
 */
export function browser(ctx, img, x, y, w, { view = null, focus = null, focusP = 0, url = 'app.example.com', alpha = 1, tilt = 0, scale = 1, shadow = true, bar = true } = {}) {
  if (alpha <= 0 || !img) return;
  const barH = bar ? Math.round(w * 0.028) : 0;
  const h = w * 9 / 16;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x + w / 2, y + (h + barH) / 2);
  ctx.scale(scale, scale);
  if (tilt) ctx.transform(1, tilt * 0.5, 0, 1, 0, 0);
  ctx.translate(-w / 2, -(h + barH) / 2);
  // frame
  roundRectPath(ctx, 0, 0, w, h + barH, 14);
  if (shadow) { ctx.shadowColor = ra('deep', 0.55); ctx.shadowBlur = 70; ctx.shadowOffsetY = 30; }
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.shadowColor = 'transparent';
  if (bar) {
    ctx.save(); roundRectPath(ctx, 0, 0, w, h + barH, 14); ctx.clip();
    ctx.fillStyle = '#e9eef2'; ctx.fillRect(0, 0, w, barH);
    ['#f26b5e', '#f6be4f', '#5ec457'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(barH * 0.7 + i * barH * 0.62, barH / 2, barH * 0.17, 0, Math.PI * 2); ctx.fill(); });
    roundRectPath(ctx, w * 0.32, barH * 0.2, w * 0.36, barH * 0.6, barH * 0.3); ctx.fillStyle = '#ffffff'; ctx.fill();
    text(ctx, url, w / 2, barH * 0.66, { size: Math.max(10, barH * 0.38), weight: 400, color: '#6b7a86', align: 'center' });
    ctx.restore();
  }
  // page
  ctx.save();
  ctx.beginPath(); ctx.rect(0, barH, w, h); ctx.clip();
  const v = view ?? { cx: 960, cy: 540, zoom: 1 };
  const k = (w / 1920) * v.zoom;             // CSS px → frame px
  const ox = w / 2 - v.cx * k, oy = barH + h / 2 - v.cy * k;
  ctx.drawImage(img, ox, oy, img.width / (img.width / 1920) * k, img.height / (img.width / 1920) * k);
  if (focus && focusP > 0) {
    const fx = ox + focus.x * k, fy = oy + focus.y * k, fw = focus.w * k, fh = focus.h * k;
    ctx.fillStyle = `${ra('deep', 0.45 * clamp(focusP))}`;
    ctx.beginPath(); ctx.rect(0, barH, w, h); roundRectPath(ctx, fx - 8, fy - 8, fw + 16, fh + 16, 12); ctx.fill('evenodd');
    ctx.strokeStyle = T.accent; ctx.lineWidth = 4;
    ctx.globalAlpha *= clamp(focusP);
    roundRectPath(ctx, fx - 8, fy - 8, fw + 16, fh + 16, 12); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  return { h: h + barH, barH };
}

/** Interpolate two views {cx,cy,zoom} with eased p (zoom interpolated in log space). */
export function viewLerp(a, b, p) {
  return { cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p), zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), p)) };
}
/** View that frames a CSS box with some margin, for a frame of aspect 16:9. */
export function viewFor(box, margin = 1.25) {
  const zoom = Math.min(1920 / (box.w * margin), 1080 / (box.h * margin));
  return { cx: box.x + box.w / 2, cy: box.y + box.h / 2, zoom: Math.max(1, zoom) };
}

/** Accent sweep transition: a diagonal band crossing the frame. p 0→1. */
export function sweep(ctx, p, { color = T.accent, width = 0.35 } = {}) {
  if (p <= 0 || p >= 1) return;
  const x = lerp(-W * (width + 0.4), W * 1.2, ease.inOutCubic(p));
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, 0); ctx.lineTo(x + W * width, 0); ctx.lineTo(x + W * width - H * 0.4, H); ctx.lineTo(x - H * 0.4, H); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Cues (accent-insensitive, any language) ──────────────────────────────
/**
 * Like runtime cues() but normalises accents/ñ, so q.word('empezó') or q.word('empezo') both work.
 *   q.s(i) / q.e(i) sentence start/end · q.word(w, nth) first/nth word start · q.wordEnd(w, nth)
 *   q.wordIn(i, w) word start inside sentence i (safer for repeated words) · q.at(t)
 *   q.mark('x') time of <mark name="x"/> in narration.md (start of the word after it)
 * Returns null for a miss — scenes should guard with `?? fallback`.
 */
export function cuesFor(env) {
  const S = env.timing.sentences;
  const norm = (w) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const words = S.flatMap((s, si) => s.words.map((w) => ({ ...w, si })));
  const find = (m, nth, list) => { let k = 0; for (const w of list) if (norm(w.w) === norm(m) && ++k === nth) return w; return null; };
  return {
    list: S,
    s: (i) => S[Math.min(i, S.length - 1)].start,
    e: (i) => S[Math.min(i, S.length - 1)].end,
    word: (m, nth = 1) => find(m, nth, words)?.start ?? null,
    wordEnd: (m, nth = 1) => find(m, nth, words)?.end ?? null,
    wordIn: (i, m, nth = 1) => find(m, nth, words.filter((w) => w.si === i))?.start ?? null,
    mark: (name) => env.timing.marks?.[name] ?? null,
    at(t) { let idx = 0; S.forEach((s, i) => { if (t >= s.start) idx = i; }); return idx; },
  };
}

/** Alias kept for scenes written for the original harness. */
export const cuesEs = cuesFor;

// ── Kinetic captions ────────────────────────────────────────────────────────
/**
 * Karaoke captions from the word timings: the current line (≤ maxChars, never across
 * sentences, same split as the .srt) on a dark band, spoken words full, the word being
 * said in the accent colour. frame.html draws them over every scene when
 * outputs.kineticCaptions is true; a scene can also call it directly.
 */
export function captions(ctx, t, env, { size = Math.round(Math.min(W, H) * 0.05), maxChars = W < H ? 24 : 42, y = H - Math.round(H * (W < H ? 0.2 : 0.09)), hold = 0.25 } = {}) {
  let line = null;
  for (const s of env.timing.sentences) {
    if (t < s.start - 0.1 || t > s.end + hold) continue;
    // balanced lines: as many as maxChars requires, each close to the same length (no orphan word)
    const len = s.words.map((w) => w.w).join(' ').length;
    const target = len / Math.ceil(len / maxChars);
    let cur = [];
    const groups = [];
    for (const w of s.words) { if (cur.length && [...cur, w].map((x) => x.w).join(' ').length > target + 4) { groups.push(cur); cur = []; } cur.push(w); }
    if (cur.length) groups.push(cur);
    line = groups.find((g, i) => t < (groups[i + 1]?.[0].start ?? s.end + hold)) ?? null;
    if (line) break;
  }
  if (!line) return;
  const a = line[0].start, b = line[line.length - 1].end;
  const alpha = Math.min(e(t, a - 0.1, 0.12), 1 - e(t, b + hold - 0.12, 0.12));
  if (alpha <= 0) return;
  const weight = Math.max(500, T.wLabel ?? 600), gap = size * 0.3;
  const ws = line.map((w) => measure(ctx, w.w, { size, weight }));
  const total = ws.reduce((s, x) => s + x, 0) + gap * (line.length - 1);
  const padX = size * 0.55, padY = size * 0.4;
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRectPath(ctx, W / 2 - total / 2 - padX, y - size - padY * 0.6, total + padX * 2, size + padY * 2, size * 0.35);
  ctx.fillStyle = isLight() ? ra('text', 0.88) : ra('deep', 0.78);   // always a dark band: light themes' deep is pale
  ctx.fill();
  let x = W / 2 - total / 2;
  line.forEach((w, i) => {
    const now = t >= w.start && t < (line[i + 1]?.start ?? b + hold);
    const said = t >= w.start;
    const pop = now ? 1 + 0.08 * (1 - e(t, w.start, 0.18)) : 1;
    ctx.save();
    ctx.translate(x + ws[i] / 2, y - size * 0.35);
    ctx.scale(pop, pop);
    text(ctx, w.w, 0, size * 0.35, { size, weight, align: 'center', color: now ? T.accent : '#ffffff', alpha: said ? 1 : 0.45 });
    ctx.restore();
    x += ws[i] + gap;
  });
  ctx.restore();
}

// ── Wordmark ────────────────────────────────────────────────────────────────
/**
 * Product wordmark: symbol + name, first word light / rest semibold, wide tracking.
 * Centred at x,y; size = type size. p 0→1 builds it (symbol pops, letters rise).
 * name defaults to brand.product (or brand.name) from the config.
 */
export function wordmark(ctx, A, x, y, size = 120, { name = BRAND.product || BRAND.name || 'PRODUCT', p = 1, alpha = 1, glow = 0.6, t = 0, maxWidth = W * 0.9 } = {}) {
  if (p <= 0 || alpha <= 0) return;
  const parts = name.toUpperCase().split(/\s+/);
  const a = parts[0], b = parts.slice(1).join(' ');
  const fam = T.fontDisplay;
  const fit = (sz) => {
    const tr = sz * 0.12;
    const wA = measure(ctx, a, { size: sz, weight: 300, tracking: tr, family: fam });
    const wB = b ? measure(ctx, b, { size: sz, weight: 600, tracking: tr, family: fam }) : 0;
    return [tr, wA, sz * 1.15, sz * 0.45, sz * 1.15 + sz * 0.45 + wA + (b ? tr * 4 + wB : 0)];
  };
  let [tr, wA, bs, gap, total] = fit(size);
  // shrink only when it would leave the frame (vertical formats)
  if (total > maxWidth) { size = Math.floor(size * maxWidth / total); [tr, wA, bs, gap, total] = fit(size); }
  const x0 = x - total / 2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const pb = ease.outBack(clamp(p * 1.6));
  symbol(ctx, A?.symbol, x0 + bs / 2, y - size * 0.36, bs * pb, { glow: glow * (0.8 + 0.2 * Math.sin(t * 2)), rot: (1 - pb) * -0.4 });
  const pl = clamp(p * 1.4 - 0.3);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 + bs + gap - 10, y - size * 1.1, total, size * 1.4); ctx.clip();
  const dy = (1 - ease.outQuart(pl)) * size * 1.1;
  text(ctx, a, x0 + bs + gap, y + dy, { size, weight: 300, tracking: tr, alpha: clamp(pl * 2), family: fam });
  if (b) {
    const dy2 = (1 - ease.outQuart(clamp(pl * 1.2 - 0.15))) * size * 1.1;
    text(ctx, b, x0 + bs + gap + wA + tr * 4, y + dy2, { size, weight: 600, tracking: tr, alpha: clamp(pl * 2 - 0.2), family: fam });
  }
  ctx.restore();
  ctx.restore();
  return total;
}
