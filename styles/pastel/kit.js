// pastel — friendly: cream background, soft shapes, rounded type, gentle bounce.
export * from '../_base/kit.js';
import { T, ra, clamp, ease, text, measure, roundRectPath, wrapLines } from '../_base/kit.js';

/** Speech bubble with a tail, pops in with a spring. Returns its height. */
export function bubble(ctx, str, x, y, { maxW = 700, size = 40, p = 1, side = 'left', bg = null } = {}) {
  const k = ease.spring(clamp(p), 9, 0.5);
  if (k <= 0) return 0;
  const lines = wrapLines(ctx, str, maxW - 60, { size, weight: 600 });
  const w = Math.min(maxW, Math.max(...lines.map((l) => measure(ctx, l, { size, weight: 600 }))) + 60), h = lines.length * size * 1.3 + 44;
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = bg ?? T.paper;
  ctx.shadowColor = ra('primary', 0.18); ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  roundRectPath(ctx, 0, 0, w, h, Math.min(36, h / 2)); ctx.fill();
  ctx.beginPath();
  const tx = side === 'left' ? 50 : w - 50;
  ctx.moveTo(tx - 18, h - 2); ctx.lineTo(tx + (side === 'left' ? -10 : 10), h + 30); ctx.lineTo(tx + 18, h - 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  lines.forEach((ln, i) => text(ctx, ln, 30, 22 + size + i * size * 1.3 - size * 0.15, { size, weight: 600, color: T.text }));
  ctx.restore();
  return h;
}

/** Soft rounded step badge "1", "2"… in the series colours. */
export function stepBadge(ctx, n, x, y, { r = 46, p = 1, t = 0 } = {}) {
  const k = ease.outBack(clamp(p));
  if (k <= 0) return;
  const c = T.series[(n - 1) % T.series.length];
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2 + n) * 4); ctx.scale(k, k);
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  text(ctx, String(n), 0, r * 0.36, { size: r, weight: 800, color: T.text, align: 'center', family: T.fontDisplay });
  ctx.restore();
}

/** Smiley-ish friendly blob character (pure in t). mood: 'happy' | 'think'. */
export function buddy(ctx, x, y, s, t, { color = null, mood = 'happy', p = 1 } = {}) {
  const k = ease.outBack(clamp(p));
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2.2) * s * 0.04); ctx.scale(k, k * (1 + Math.sin(t * 4.4) * 0.02));
  ctx.fillStyle = color ?? T.primary;
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.46, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  const blink = Math.sin(t * 1.3) > 0.97 ? 0.15 : 1;
  for (const dx of [-0.15, 0.15]) { ctx.beginPath(); ctx.ellipse(dx * s, -0.06 * s, 0.07 * s, 0.09 * s * blink, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * 0.035; ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'happy') ctx.arc(0, 0.08 * s, 0.14 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  else { ctx.moveTo(-0.1 * s, 0.16 * s); ctx.lineTo(0.1 * s, 0.13 * s); }
  ctx.stroke();
  ctx.restore();
}
