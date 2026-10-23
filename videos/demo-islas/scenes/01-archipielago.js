// Demo islas · archipiélago — drone shot over the whole map at dawn, houses sprout per area on
// "aplicación", the central workshop rises on "taller" and the camera dives towards it.
import { sky, isoCam, camera, toScreen, tag, bigTitle, grain } from '../../../engine/iso.js';
import { AREAS, drawWorld, areaLabelAt, brandBug, cloudEdges } from '../../../styles/islas/islas.js';
import { cuesFor, assets, e, ease, clamp, T } from '../../../styles/islas/kit.js';

let A;

export default {
  async setup(env) { A = await assets(env); },
  draw(ctx, t, env) {
    const q = cuesFor(env);
    const tIsla = q.word('isla') ?? q.s(1);
    const tApp = q.word('aplicación') ?? q.s(1) + 1.5;
    const tTaller = q.word('taller') ?? q.s(2);
    sky(ctx, t, clamp(t / env.dur) * 0.9);   // day → towards dusk across the shot
    const cam = isoCam(t, [
      { t: 0, x: 0, y: 0, zoom: 0.42 },
      { t: tApp + 1, x: 0, y: 0, zoom: 0.5 },
      { t: tTaller + 0.6, x: 0, y: 0, zoom: 0.9 },
      { t: env.dur, x: 0, y: 0, zoom: 1.05 },
    ]);
    camera(ctx, cam, () => drawWorld(ctx, t, {
      areaAlpha: (i) => 0.35 + 0.65 * e(t, tIsla - 0.6 + i * 0.12, 0.7),
      apps: (i, h) => e(t, tApp + i * 0.15 + h * 0.12, 0.6, ease.outBack),
      fresh: (i, h) => { const s = tApp + i * 0.15 + h * 0.12; return t > s && t < s + 1 ? 1 - (t - s) : 0; },
      central: { show: e(t, tTaller - 1.2, 0.8), rise: e(t, tTaller - 0.4, 1.2), beam: e(t, tTaller + 0.6, 0.6), open: 1 },
    }));
    // area labels while the whole map is in view
    const la = 1 - e(t, tTaller - 0.4, 0.5);
    for (const a of AREAS) {
      const [sx, sy] = toScreen(cam, ...areaLabelAt(a));
      tag(ctx, sx, sy, a.short ?? a.name, { size: 30, p: e(t, tIsla + a.i * 0.12, 0.5), alpha: la, color: T.primary });
    }
    bigTitle(ctx, 'Tu organización, un archipiélago', { kicker: 'Estilo islas', y: 150, size: 70, p: e(t, 0.4, 0.9), alpha: 1 - e(t, tIsla + 0.2, 0.5) });
    brandBug(ctx, t, A, { chapter: 'Demo' });
    grain(ctx, t);
    cloudEdges(ctx, t, env.dur, { first: true, last: true });
  },
};
