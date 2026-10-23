// Demo · flujo — a live pipeline: nodes joined by energy lines, the active node follows the
// narration; then a KPI counts up to the number of styles.
import { W, H, T, stage, rise, kicker, node, energyLine, kpi, panel, bug, edges, assets, cuesFor, e, ease, clamp, docGlyph, mark } from '../../../styles/_base/kit.js';

let A;
const NODES = [
  { k: 'guion', label: 'Guion' },
  { k: 'voz', label: 'Voz' },
  { k: 'escena', label: 'Escenas' },
  { k: 'palabra', label: 'MP4' },
];

export default {
  async setup(env) { A = await assets(env); },
  draw(ctx, t, env) {
    const q = cuesFor(env);
    stage(ctx, t, { lightX: W * 0.5, lightY: H * 0.5 });

    const tEnd = q.s(2) - 0.3;
    const out = e(t, tEnd, 0.5, ease.inCubic);
    kicker(ctx, 'Cómo funciona', 200, 200, { p: e(t, 0.2, 0.6) * (1 - out) });

    const y = H * 0.50, x0 = 330, x1 = W - 330;
    const xs = NODES.map((_, i) => x0 + ((x1 - x0) * i) / (NODES.length - 1));
    const tn = NODES.map((n, i) => (q.word(n.k) ?? q.s(0) + i * 1.2) - 0.2);
    // doc that feeds the pipeline
    docGlyph(ctx, 150, y, 90, t, { p: e(t, 0.4, 0.6) * (1 - out), alpha: 1 - out });
    for (let i = 0; i < NODES.length; i++) {
      if (i > 0) energyLine(ctx, [[xs[i - 1] + 70, y], [xs[i] - 70, y]], t, { p: e(t, tn[i] - 0.4, 0.5) * (1 - out), pulses: 2, seed: i, width: 3, alpha: 1 - out });
      const active = t >= tn[i] && (i === NODES.length - 1 || t < tn[i + 1]);
      node(ctx, xs[i], y, 64, t, { label: NODES[i].label, p: e(t, tn[i], 0.5) * (1 - out), active, done: t >= (tn[i + 1] ?? 1e9), labelSize: 36 });
    }
    if (t > tn[3] + 0.4) mark(ctx, xs[3], y, 44, { p: e(t, tn[3] + 0.4, 0.4) * (1 - out), color: T.text });

    // beat 2: styles KPI on a panel
    const tk = tEnd + 0.5;   // after the pipeline has left
    const pk = e(t, tk - 0.2, 0.7, ease.outBack);
    if (pk > 0) {
      panel(ctx, W / 2 - 520, H * 0.28, 1040, 470, { alpha: clamp(pk) });
      kpi(ctx, 9, 'estilos listos para usar', W / 2 - 420, H * 0.28 + 250, { p: e(t, tk, 1.2), size: 180 });
      rise(ctx, 'o el tuyo', W / 2 + 40, H * 0.28 + 250, { size: 84, p: e(t, (q.word('tuyo') ?? tk + 2) - 0.4, 0.8), accent: [2] });
    }

    bug(ctx, A, { chapter: '02 · Cómo funciona' });
    edges(ctx, t, env.dur);
  },
};
