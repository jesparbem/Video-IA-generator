// ai-videos runtime — shared drawing kit for scenes.
// Contract: every scene is a pure function of time. No state survives between
// draw() calls; all randomness is seeded. See docs/playbook.md.

// Output format. Live bindings: frame.html calls setFormat() from the project/video config
// BEFORE importing any style kit or scene, so every importer sees the configured size.
export let W = 1920;
export let H = 1080;
export let FPS = 30;
export function setFormat(w, h, fps = 30) { W = w; H = h; FPS = fps; }

// ── Tokens ──────────────────────────────────────────────────────────────────
export const C = {
  paper: '#F2ECDF',
  paper2: '#E8E0CF',
  ink: '#1C1B18',
  ink2: '#57534A',
  ink3: '#9A9384',
  red: '#E0492B',
  blue: '#2B59E8',
  green: '#1F9D6A',
  yellow: '#F1B434',
  pink: '#EC7FA8',
  white: '#FFFDF8',
};

export const FONT = {
  sans: '"SF Pro Display", "SF Pro", -apple-system, "Helvetica Neue", Helvetica, sans-serif',
  mono: '"SF Mono", ui-monospace, Menlo, monospace',
  serif: '"New York", Georgia, serif',
};

// ── Math ────────────────────────────────────────────────────────────────────
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, p) => a + (b - a) * p;
export const inv = (a, b, v) => clamp((v - a) / (b - a));
/** progress of t through [start, start+dur], clamped 0..1 */
export const prog = (t, start, dur) => clamp((t - start) / dur);

export const ease = {
  linear: (p) => p,
  inQuad: (p) => p * p,
  outQuad: (p) => 1 - (1 - p) * (1 - p),
  inOutQuad: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
  outCubic: (p) => 1 - Math.pow(1 - p, 3),
  inCubic: (p) => p * p * p,
  inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  outExpo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
  inOutExpo: (p) =>
    p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2,
  outBack: (p, s = 1.70158) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2),
  /** damped spring settling to 1; k = stiffness-ish, z = damping */
  spring: (p, k = 9, z = 0.42) => (p <= 0 ? 0 : 1 - Math.exp(-z * k * p) * Math.cos(k * Math.sqrt(1 - z * z) * p)),
};

/** eased progress: e(t, start, dur, fn) */
export const e = (t, start, dur, fn = ease.outCubic) => fn(prog(t, start, dur));

// ── Seeded randomness ───────────────────────────────────────────────────────
export function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (n) => rng(Math.floor(n) + 1)();
/** smooth 1D value noise in [-1, 1] */
export function noise(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i * 7.13 + seed * 131.7) * 2 - 1;
  const b = hash((i + 1) * 7.13 + seed * 131.7) * 2 - 1;
  return lerp(a, b, u);
}
/** hand-drawn "boil": time quantised to `fps` so line wobble steps like cel animation */
export const boil = (t, fps = 8) => Math.floor(t * fps);

// ── Background & chrome ─────────────────────────────────────────────────────
let _grain = null;
function grain() {
  if (_grain) return _grain;
  const c = new OffscreenCanvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const r = rng(42);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 14;
  }
  g.putImageData(img, 0, 0);
  _grain = c;
  return c;
}

/** warm paper background with a soft vignette and fixed grain */
export function paper(ctx, color = C.paper) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(60,40,10,0.13)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(grain(), 0, 0);
  ctx.restore();
}

/** paper grain on top of everything (call last) so ink and fills share the texture */
export function grainOver(ctx, alpha = 0.6) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(grain(), 0, 0);
  ctx.restore();
}

/** small persistent brand bug, top-left; `label` is the segment kicker */
export function chrome(ctx, t, { label = '', date = '', alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = C.ink;
  ctx.font = `700 22px ${FONT.mono}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('THE COMMIT', 72, 64);
  ctx.fillStyle = C.ink3;
  ctx.font = `500 22px ${FONT.mono}`;
  const w = ctx.measureText('THE COMMIT').width;
  if (label) ctx.fillText(`/ ${label}`, 72 + w + 14, 64);
  if (date) {
    ctx.textAlign = 'right';
    ctx.fillText(date, W - 72, 64);
  }
  ctx.restore();
}

// ── Camera ──────────────────────────────────────────────────────────────────
/** draw fn under a camera looking at (x, y) with zoom and rotation (radians) */
export function camera(ctx, { x = W / 2, y = H / 2, zoom = 1, rot = 0 } = {}, fn) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-x, -y);
  fn();
  ctx.restore();
}

/** gentle idle drift so no frame is ever fully static */
export function drift(t, amp = 6, seed = 0) {
  return { x: noise(t * 0.25, seed) * amp, y: noise(t * 0.21, seed + 9) * amp, r: noise(t * 0.17, seed + 3) * 0.004 };
}

// ── Hand-drawn strokes ──────────────────────────────────────────────────────
/** jittered polyline through points; `p` draws on 0..1; `wob` pixel wobble; `seed` + boil for life */
export function sketchPath(ctx, pts, { p = 1, wob = 2.2, seed = 1, t = 0, width = 4, color = C.ink, close = false, fps = 8 } = {}) {
  if (p <= 0 || pts.length < 2) return;
  const b = boil(t, fps);
  const dense = densify(close ? [...pts, pts[0]] : pts, 14);
  const n = Math.max(2, Math.floor(dense.length * clamp(p)));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const [x, y] = dense[i];
    const jx = noise(i * 0.35 + b * 3.1, seed) * wob;
    const jy = noise(i * 0.35 + b * 3.1, seed + 50) * wob;
    if (i === 0) ctx.moveTo(x + jx, y + jy);
    else ctx.lineTo(x + jx, y + jy);
  }
  ctx.stroke();
  ctx.restore();
}

function densify(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const d = Math.hypot(x2 - x1, y2 - y1);
    const k = Math.max(1, Math.ceil(d / step));
    for (let j = 0; j < k; j++) out.push([lerp(x1, x2, j / k), lerp(y1, y2, j / k)]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function sketchLine(ctx, x1, y1, x2, y2, o = {}) {
  sketchPath(ctx, [[x1, y1], [x2, y2]], o);
}

export function sketchRect(ctx, x, y, w, h, o = {}) {
  if (o.fill) {
    ctx.save();
    ctx.fillStyle = o.fill;
    ctx.globalAlpha = o.fillAlpha ?? 1;
    roundRectPath(ctx, x, y, w, h, o.r ?? 10);
    ctx.fill();
    ctx.restore();
  }
  sketchPath(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { ...o, close: true });
}

export function sketchCircle(ctx, cx, cy, r, o = {}) {
  const pts = [];
  const n = Math.max(24, Math.floor(r / 3));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  if (o.fill) {
    ctx.save();
    ctx.fillStyle = o.fill;
    ctx.globalAlpha = o.fillAlpha ?? 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  sketchPath(ctx, pts, o);
}

/** marker-style circle-around (like an editor circling a word); draws on with p */
export function circleAround(ctx, cx, cy, rx, ry, { p = 1, t = 0, seed = 3, color = C.red, width = 6 } = {}) {
  const pts = [];
  const turns = 1.08;
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 * turns - 2.2;
    const k = 1 + noise(i * 0.3, seed) * 0.06;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  sketchPath(ctx, pts, { p, t, seed, color, width, wob: 1.5 });
}

/** hand-drawn underline */
export function underline(ctx, x, y, w, { p = 1, t = 0, seed = 5, color = C.red, width = 7 } = {}) {
  sketchPath(ctx, [[x, y], [x + w * 0.5, y + 4], [x + w, y - 2]], { p, t, seed, color, width, wob: 1.2 });
}

/** arrow with drawn-on shaft and head */
export function arrow(ctx, x1, y1, x2, y2, { p = 1, t = 0, seed = 7, color = C.ink, width = 5, head = 22, bend = 0 } = {}) {
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend;
  const my = (y1 + y2) / 2 + (x2 - x1) * bend;
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const u = i / 20;
    pts.push([
      (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2,
      (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * my + u * u * y2,
    ]);
  }
  sketchPath(ctx, pts, { p: clamp(p / 0.85), t, seed, color, width });
  const hp = inv(0.8, 1, p);
  if (hp > 0) {
    const a = Math.atan2(y2 - my, x2 - mx);
    const L = head * ease.outBack(hp);
    sketchPath(ctx, [[x2 - Math.cos(a - 0.5) * L, y2 - Math.sin(a - 0.5) * L], [x2, y2], [x2 - Math.cos(a + 0.5) * L, y2 - Math.sin(a + 0.5) * L]], { t, seed: seed + 1, color, width });
  }
}

export function roundRectPath(ctx, x, y, w, h, r = 10) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** soft offset shadow card (flat, paper-cut feel) */
export function card(ctx, x, y, w, h, { fill = C.white, r = 18, shadow = 10, stroke = C.ink, sw = 3, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = 'rgba(40,30,10,0.16)';
  roundRectPath(ctx, x + shadow * 0.6, y + shadow, w, h, r);
  ctx.fill();
  ctx.fillStyle = fill;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  if (sw) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = sw;
    ctx.stroke();
  }
  ctx.restore();
}

// ── Text ────────────────────────────────────────────────────────────────────
/**
 * text(ctx, str, x, y, opts)
 * reveal: 0..1 fraction of characters shown; mode 'type' (typewriter) or 'rise' (per-word rise + fade)
 */
export function text(ctx, str, x, y, {
  size = 64, weight = 700, color = C.ink, font = FONT.sans, align = 'left', baseline = 'alphabetic',
  reveal = 1, mode = 'rise', alpha = 1, tracking = 0, t = 0,
} = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textBaseline = baseline;
  if (tracking) ctx.letterSpacing = `${tracking}px`;
  const full = ctx.measureText(str).width;
  let x0 = x;
  if (align === 'center') x0 = x - full / 2;
  else if (align === 'right') x0 = x - full;
  if (mode === 'type') {
    const n = Math.floor(str.length * clamp(reveal));
    ctx.fillText(str.slice(0, n), x0, y);
    if (reveal > 0 && reveal < 1 && Math.floor(t * 2.5) % 2 === 0) {
      const cw = ctx.measureText(str.slice(0, n)).width;
      ctx.fillRect(x0 + cw + 4, y - size * 0.78, size * 0.08, size * 0.9);
    }
  } else {
    const words = str.split(' ');
    const space = ctx.measureText(' ').width;
    let cx = x0;
    words.forEach((w, i) => {
      const ww = ctx.measureText(w).width;
      const wp = ease.outCubic(clamp(reveal * (words.length + 2) - i, 0, 1));
      if (wp > 0) {
        ctx.save();
        ctx.globalAlpha *= wp;
        ctx.fillText(w, cx, y + (1 - wp) * size * 0.35);
        ctx.restore();
      }
      cx += ww + space;
    });
  }
  ctx.restore();
  return full;
}

export function measure(ctx, str, { size = 64, weight = 700, font = FONT.sans, tracking = 0 } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  if (tracking) ctx.letterSpacing = `${tracking}px`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** wrap into lines that fit maxWidth */
export function wrap(ctx, str, maxWidth, o = {}) {
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (measure(ctx, test, o) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** count-up number formatter */
export function countUp(from, to, p, decimals = 0) {
  return lerp(from, to, clamp(p)).toFixed(decimals);
}

// ── Cues (narration sync) ───────────────────────────────────────────────────
/**
 * Build a cue helper from the segment timings.
 *   const q = cues(env);
 *   q.s(3)          -> start time (s) of sentence 3 (0-based)
 *   q.e(3)          -> end time of sentence 3
 *   q.word('Medicare') -> start time of the first word matching (case-insensitive), or null
 *   q.word('Medicare', 2) -> second occurrence
 *   q.at(t)         -> index of the sentence being spoken at t
 *   q.mark('x')     -> time of <mark name="x"/> in the narration, or null
 */
export function cues(env) {
  const S = env.timing.sentences;
  const words = S.flatMap((s) => s.words);
  const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
  return {
    list: S,
    s: (i) => S[Math.min(i, S.length - 1)].start,
    e: (i) => S[Math.min(i, S.length - 1)].end,
    word(match, nth = 1) {
      const m = norm(match);
      let k = 0;
      for (const w of words) if (norm(w.w) === m && ++k === nth) return w.start;
      return null;
    },
    mark: (name) => env.timing.marks?.[name] ?? null,
    at(t) {
      let idx = 0;
      S.forEach((s, i) => { if (t >= s.start) idx = i; });
      return idx;
    },
  };
}

// ── Transitions ─────────────────────────────────────────────────────────────
/** ink wipe: a paper-colored band sweeps across. p 0..1. Use at scene edges. */
export function wipe(ctx, p, { color = C.ink, dir = 1 } = {}) {
  if (p <= 0 || p >= 1) return;
  const a = ease.inOutCubic(p);
  ctx.save();
  ctx.fillStyle = color;
  const x = dir > 0 ? lerp(-W * 1.2, W * 1.2, a) : lerp(W * 1.2, -W * 1.2, a);
  ctx.beginPath();
  ctx.moveTo(x - 200, 0);
  ctx.lineTo(x + W * 0.7, 0);
  ctx.lineTo(x + W * 0.7 - 200, H);
  ctx.lineTo(x - 400, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** fade whole frame from/to paper at scene edges; returns alpha multiplier to apply to content */
export function edgeFade(t, dur, inDur = 0.35, outDur = 0.35) {
  return Math.min(ease.outQuad(prog(t, 0, inDur)), 1 - ease.inQuad(prog(t, dur - outDur, outDur)));
}

/** narration loudness at t (0..1), from the segment's per-frame RMS — use for mouths, meters, pulses */
export function level(env, t, smooth = 2) {
  const r = env.timing.rms || [];
  const i = Math.floor(t * FPS);
  let s = 0, n = 0;
  for (let k = i - smooth; k <= i + smooth; k++) if (k >= 0 && k < r.length) { s += r[k]; n++; }
  return n ? s / n : 0;
}
