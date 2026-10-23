// editorial — magazine: high-contrast serif heads, flat colour blocks, giant numerals, pull quotes.
export * from '../_base/kit.js';
import { T, ra, clamp, ease, text, measure, wrapLines } from '../_base/kit.js';

/** Giant numeral (e.g. "01", "73%") that slides up behind a mask. */
export function bigNumeral(ctx, str, x, y, { size = 320, p = 1, color = null, align = 'left' } = {}) {
  const k = ease.outQuart(clamp(p));
  if (k <= 0) return;
  const w = measure(ctx, str, { size, weight: 700, family: T.fontDisplay });
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 - 10, y - size, w + 20, size * 1.15); ctx.clip();
  text(ctx, str, x0, y + (1 - k) * size, { size, weight: 700, color: color ?? T.accent, family: T.fontDisplay });
  ctx.restore();
  return w;
}

/** Pull quote: accent bar on the left + italic serif lines. Returns height. */
export function pullQuote(ctx, str, x, y, { maxW = 1000, size = 56, p = 1, cite = '' } = {}) {
  const a = ease.outCubic(clamp(p));
  if (a <= 0) return 0;
  const lines = wrapLines(ctx, str, maxW, { size, weight: 400, family: T.fontDisplay });
  const h = lines.length * size * 1.25 + (cite ? size : 0);
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = T.accent; ctx.fillRect(x, y - size, 10, h * a);
  lines.forEach((ln, i) => text(ctx, ln, x + 44, y + i * size * 1.25, { size, weight: 'italic 400', color: T.text, family: T.fontDisplay }));
  if (cite) text(ctx, '— ' + cite, x + 44, y + lines.length * size * 1.25 + 10, { size: 30, weight: T.wLabel, color: T.soft, family: T.fontBody });
  ctx.restore();
  return h;
}

/** Section label: small caps in a black box ("ANÁLISIS"). */
export function rubric(ctx, str, x, y, { p = 1 } = {}) {
  const a = ease.outCubic(clamp(p));
  if (a <= 0) return;
  const s = str.toUpperCase(), size = 26;
  const w = measure(ctx, s, { size, weight: 700, tracking: 4, family: T.fontBody }) + 32;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.fillStyle = T.primary; ctx.fillRect(x, y - size - 10, w * a, size + 22);
  text(ctx, s, x + 16, y, { size, weight: 700, tracking: 4, color: T.paper, family: T.fontBody });
  ctx.restore();
}

/** Column rule (thin vertical line) drawn top→bottom. */
export function columnRule(ctx, x, y, h, { p = 1 } = {}) {
  ctx.fillStyle = ra('text', 0.25); ctx.fillRect(x, y, 1.5, h * ease.outCubic(clamp(p)));
}
