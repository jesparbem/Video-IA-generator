// Demo · apertura — kicker, rising headline with the accent word, then four pills that
// land on their spoken word. Base kit only, so it renders in every style.
import { W, H, T, stage, rise, kicker, pill, measure, bug, edges, assets, cuesFor, e, ease, clamp, ra } from '../../../styles/_base/kit.js';

let A;
const STEPS = ['guion', 'voz', 'animación', 'infografía'];

export default {
  async setup(env) { A = await assets(env); },
  draw(ctx, t, env) {
    const q = cuesFor(env);
    const cx = W / 2;
    stage(ctx, t, { lightX: W * 0.5, lightY: H * 0.4 });

    // beat 1: product kicker, then the headline on "documento"
    const tHead = q.word('documento') ?? q.s(1);
    kicker(ctx, env.cfg?.brand?.product || 'Video IA Generator', cx, H * 0.30, { p: e(t, 0.3, 0.6), align: 'center' });
    rise(ctx, 'De un documento a un vídeo', cx, H * 0.45, { size: 112, align: 'center', p: e(t, tHead - 0.3, 1.0), accent: [5] });

    // beat 2: the four outputs, each on its word (sentence 2), laid out from measured widths
    // fit the row to the frame width (vertical formats)
    const row = (sz) => STEPS.reduce((a, s) => a + measure(ctx, s, { size: sz, weight: 600 }) + sz * 2, 0) + sz * 0.8 * (STEPS.length - 1);
    const size = Math.floor(40 * Math.min(1, (W * 0.9) / row(40))), gap = size * 0.8, padX = size * 0.55;
    const widths = STEPS.map((s) => measure(ctx, s, { size, weight: 600 }) + padX * 2 + size * 0.9);
    let x = cx - (widths.reduce((a, b) => a + b, 0) + gap * (STEPS.length - 1)) / 2;
    STEPS.forEach((s, i) => {
      const tw = q.wordIn(2, s) ?? q.s(2) + i * 0.5;
      const p = e(t, tw - 0.1, 0.45, ease.outBack);
      pill(ctx, s, x, H * 0.58 - (1 - clamp(p)) * 30, { size, padX, alpha: clamp(p * 2), dot: T.series[i % T.series.length], bg: ra('soft', 0.16), color: T.text });
      x += widths[i] + gap;
    });
    rise(ctx, 'en un solo flujo', cx, H * 0.72, { size: 64, align: 'center', p: e(t, (q.word('flujo') ?? q.e(2)) - 0.5, 0.8), color: T.soft });

    bug(ctx, A, { chapter: '01 · Qué es' });
    edges(ctx, t, env.dur);
  },
};
