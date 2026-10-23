// clasico — paper, serif type, printer's ornaments, burgundy and gold.
export * from '../_base/kit.js';
import { T, ra, clamp, ease, text, measure } from '../_base/kit.js';

/** Printer's rule with a central diamond, drawn from the centre outwards. */
export function ornament(ctx, cx, y, w, { p = 1, color = null } = {}) {
  const k = ease.inOutCubic(clamp(p));
  if (k <= 0) return;
  const c = color ?? T.accent;
  ctx.save();
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 1.5;
  const half = (w / 2) * k;
  ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx - 18, y); ctx.moveTo(cx + 18, y); ctx.lineTo(cx + half, y); ctx.stroke();
  ctx.save(); ctx.translate(cx, y); ctx.rotate(Math.PI / 4); ctx.scale(k, k); ctx.fillRect(-7, -7, 14, 14); ctx.restore();
  ctx.beginPath(); ctx.arc(cx - half, y, 3, 0, Math.PI * 2); ctx.arc(cx + half, y, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Drop-cap paragraph opener: big initial in primary + the rest of the first line. */
export function dropCap(ctx, str, x, y, { size = 44, p = 1, maxW = 1100 } = {}) {
  const a = ease.outCubic(clamp(p));
  if (a <= 0) return;
  const cap = str[0], rest = str.slice(1);
  text(ctx, cap, x, y + size * 1.6, { size: size * 3.2, weight: 400, color: T.primary, alpha: a, family: T.fontDisplay });
  const cw = measure(ctx, cap, { size: size * 3.2, weight: 400, family: T.fontDisplay }) + 14;
  text(ctx, rest, x + cw, y + size * 0.4, { size, weight: 400, color: T.text, alpha: a, family: T.fontBody });
  return cw;
}

/** Roman numeral chapter mark: "— II —". */
export function roman(n) { const m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; }
export function chapterMark(ctx, n, cx, y, { p = 1 } = {}) {
  text(ctx, `— ${roman(n)} —`, cx, y, { size: 40, weight: 400, color: T.accent, align: 'center', alpha: clamp(p), family: T.fontDisplay, tracking: 6 });
}

/** Sepia vignette over everything (call before edges()). */
export function vignette(ctx, W, H, { alpha = 1 } = {}) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, ra('deep', 0)); g.addColorStop(1, ra('deep', 0.45 * alpha));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
