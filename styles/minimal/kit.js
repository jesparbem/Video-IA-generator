// minimal — product keynote minimalism: lots of air, big semibold type, one accent.
export * from '../_base/kit.js';
import { T, W, ra, clamp, ease, text, measure } from '../_base/kit.js';

/** Hairline that draws from the centre outwards. */
export function hairline(ctx, cx, y, w, { p = 1, color = null, alpha = 1 } = {}) {
  const k = ease.inOutCubic(clamp(p));
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.fillStyle = color ?? ra('soft', 0.5);
  ctx.fillRect(cx - (w / 2) * k, y, w * k, 1.5);
  ctx.restore();
}

/** Gradient headline word (accent → series[1]) — the one "wow" word of a minimal frame. Centred. */
export function gradientWord(ctx, str, cx, y, { size = 180, p = 1, weight = T.wHead } = {}) {
  const a = ease.outCubic(clamp(p));
  if (a <= 0) return;
  const w = measure(ctx, str, { size, weight, family: T.fontDisplay });
  ctx.save();
  ctx.globalAlpha *= a;
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, T.accent); g.addColorStop(1, T.series?.[1] ?? T.accentHi);
  ctx.font = `${weight} ${size}px ${T.fontDisplay}`;
  ctx.fillStyle = g; ctx.textAlign = 'center';
  ctx.fillText(str, cx, y + (1 - a) * 40);
  ctx.restore();
}

/** Slow product-shot spotlight behind an object at (x, y). */
export function spotlight(ctx, x, y, r = W * 0.35, { alpha = 1 } = {}) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, ra('text', 0.10 * alpha)); g.addColorStop(1, ra('text', 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

