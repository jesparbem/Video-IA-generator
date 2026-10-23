// creativo — colour mesh, heavy type, stickers and doodles.
export * from '../_base/kit.js';
import { T, ra, clamp, ease, text, measure, roundRectPath } from '../_base/kit.js';

/** Tilted sticker label that pops in with a spring. Returns its width. */
export function sticker(ctx, str, x, y, { p = 1, rot = -0.06, size = 44, bg = null, color = null, align = 'left' } = {}) {
  const k = ease.spring(clamp(p), 10, 0.45);
  if (k <= 0) return 0;
  const w = measure(ctx, str, { size, weight: T.wLabel, family: T.fontDisplay }) + size * 1.1, h = size * 1.7;
  const x0 = align === 'center' ? x - w / 2 : x;
  ctx.save();
  ctx.translate(x0 + w / 2, y);
  ctx.rotate(rot * k);
  ctx.scale(k, k);
  ctx.shadowColor = ra('deep', 0.45); ctx.shadowBlur = 0; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 8;
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.3);
  ctx.fillStyle = bg ?? T.accent; ctx.fill();
  ctx.shadowColor = 'transparent';
  text(ctx, str, 0, size * 0.36, { size, weight: T.wLabel, color: color ?? T.ink, align: 'center', family: T.fontDisplay });
  ctx.restore();
  return w;
}

/** Hand-drawn squiggle underline (draws on with p). */
export function squiggle(ctx, x, y, w, { p = 1, color = null, width = 8, amp = 10, waves = 6 } = {}) {
  const k = clamp(p);
  if (k <= 0) return;
  ctx.save();
  ctx.strokeStyle = color ?? T.accent; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath();
  const n = 80;
  for (let i = 0; i <= n * k; i++) { const u = i / n; const px = x + u * w, py = y + Math.sin(u * Math.PI * 2 * waves) * amp; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.stroke();
  ctx.restore();
}

/** Bouncy confetti burst around (x, y), seeded and pure in t. */
export function burst(ctx, x, y, t, t0, { n = 26, r = 260, seed = 3 } = {}) {
  const dt = t - t0;
  if (dt < 0 || dt > 1.6) return;
  const s = T.series;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed, d = r * ease.outCubic(clamp(dt / 0.9)) * (0.6 + ((i * 37) % 10) / 25);
    ctx.save();
    ctx.globalAlpha = clamp(1.6 - dt);
    ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d + dt * dt * 120);
    ctx.rotate(a + dt * 6);
    ctx.fillStyle = s[i % s.length];
    ctx.fillRect(-9, -4, 18, 8);
    ctx.restore();
  }
}
