// neon — synthwave grid, scanlines, glowing cyan/magenta, uppercase heads.
export * from '../_base/kit.js';
import { T, W, H, ra, clamp, ease, text, measure, rng } from '../_base/kit.js';

/** Text with a neon tube glow (two passes). */
export function glowText(ctx, str, x, y, { size = 96, color = null, align = 'left', p = 1, flicker = 0, t = 0, weight = T.wHead } = {}) {
  let a = ease.outCubic(clamp(p));
  if (flicker > 0) a *= 1 - flicker * (Math.sin(t * 47) > 0.92 ? 0.7 : 0);
  if (a <= 0) return;
  const c = color ?? T.primary;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.shadowColor = c; ctx.shadowBlur = 30 * T.glow;
  text(ctx, str, x, y, { size, color: c, align, weight, family: T.fontDisplay, tracking: size * 0.04 });
  ctx.shadowBlur = 8;
  text(ctx, str, x, y, { size, color: '#ffffff', align, weight, family: T.fontDisplay, tracking: size * 0.04, alpha: 0.55 });
  ctx.restore();
}

/** Corner brackets (HUD frame) around a box. */
export function hudFrame(ctx, x, y, w, h, { p = 1, color = null, len = 40 } = {}) {
  const k = ease.outCubic(clamp(p));
  if (k <= 0) return;
  ctx.save();
  ctx.strokeStyle = color ?? T.primary; ctx.lineWidth = 3; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14 * T.glow;
  const L = len * k;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx + sx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * L); ctx.stroke();
  }
  ctx.restore();
}

/** Digital glitch slices for a short moment around t0 (pure in t). */
export function glitch(ctx, t, t0, { dur = 0.25, seed = 1 } = {}) {
  if (t < t0 || t > t0 + dur) return;
  const r = rng(seed + Math.floor(t * 30));
  for (let i = 0; i < 6; i++) {
    const y = r() * H, h = 6 + r() * 40, dx = (r() - 0.5) * 80;
    ctx.drawImage(ctx.canvas, 0, y, W, h, dx, y, W, h);
  }
  ctx.fillStyle = ra('accent', 0.08); ctx.fillRect(0, 0, W, H);
}

/** Monospace "terminal" line that types itself. */
export function typeLine(ctx, str, x, y, { p = 1, size = 34, color = null, cursor = true, t = 0 } = {}) {
  const n = Math.floor(str.length * clamp(p));
  const s = str.slice(0, n) + (cursor && Math.sin(t * 8) > 0 ? '▌' : '');
  text(ctx, s, x, y, { size, color: color ?? T.ok, family: T.fontMono, weight: 400 });
  return measure(ctx, str, { size, family: T.fontMono, weight: 400 });
}
