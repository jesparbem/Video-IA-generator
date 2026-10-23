// corporate — keynote at night. Everything lives in the base kit; this file exists so
// scenes import a stable path (styles/corporate/kit.js) and the style can grow its own pieces.
export * from '../_base/kit.js';
import { T, ra, clamp, ease, text } from '../_base/kit.js';

/** Thin horizontal progress rail with chapter ticks (bottom of frame). i = current chapter 0-based. */
export function chapterRail(ctx, i, total, x, y, w, { p = 1, alpha = 1 } = {}) {
  if (alpha <= 0 || p <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = ra('soft', 0.25); ctx.fillRect(x, y, w * ease.outCubic(clamp(p)), 2);
  for (let k = 0; k < total; k++) {
    const cx = x + (w * k) / Math.max(1, total - 1);
    ctx.fillStyle = k === i ? T.accent : k < i ? ra('soft', 0.8) : ra('soft', 0.3);
    ctx.beginPath(); ctx.arc(cx, y + 1, k === i ? 7 : 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Small caption under a figure: "Fuente: …" in soft colour, ≥ 22 px (legal / source line). */
export function source(ctx, str, x, y, { alpha = 1, align = 'left' } = {}) {
  text(ctx, str, x, y, { size: 22, weight: 400, color: T.soft, alpha: 0.8 * alpha, align });
}
