// Demo · cierre — two short statements, then the product wordmark builds and holds.
import { W, H, T, stage, rise, wordmark, bug, edges, assets, cuesFor, e, ease, spark } from '../../../styles/_base/kit.js';

let A;

export default {
  async setup(env) { A = await assets(env); },
  draw(ctx, t, env) {
    const q = cuesFor(env);
    stage(ctx, t, { lightX: W * 0.5, lightY: H * 0.45 });
    const cx = W / 2;
    const t1 = q.s(0), t2 = q.s(1);
    rise(ctx, 'Tú decides qué se cuenta', cx, H * 0.42, { size: 100, align: 'center', p: e(t, t1, 0.9), out: e(t, t2 + 1.4, 0.5, ease.inCubic), accent: [1] });
    rise(ctx, 'La IA hace el resto', cx, H * 0.58, { size: 100, align: 'center', p: e(t, t2, 0.9), out: e(t, t2 + 1.4, 0.5, ease.inCubic), color: T.soft });
    const tm = t2 + 1.7;
    wordmark(ctx, A, cx, H * 0.53, 92, { p: e(t, tm, 1.2), t });
    if (t > tm + 0.8) spark(ctx, cx + Math.cos(t * 1.4) * 420, H * 0.53 + Math.sin(t * 1.4) * 120, 6, { alpha: e(t, tm + 0.8, 0.5) });
    bug(ctx, A, { chapter: '03 · Cierre', alpha: 1 - e(t, tm, 0.6) });
    edges(ctx, t, env.dur, { outDur: 0.8 });
  },
};
