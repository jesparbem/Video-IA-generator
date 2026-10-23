#!/usr/bin/env node
// One-page explanatory infographic for a video, in the video's style.
//
//   node engine/infographic.mjs videos/<slug> [--style name] [--format vertical|horizontal|square|a4]
//
// Reads  <ep>/infographic.json (written by the agent from briefing.md — schema in
//        templates/video/infographic.json). Without it, a minimal one is derived from
//        audio/timings.json so the command always produces something.
// Writes <ep>/out/<slug>-infografia.html · .png (2× pixel density) · .pdf (outputs.infographicPdf)

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadConfig, loadTheme, readJson, ROOT } from './config.mjs';

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
if (!args[0]) { console.error('usage: infographic.mjs videos/<slug> [--style name] [--format vertical|horizontal|square|a4]'); process.exit(1); }
const ep = path.resolve(args[0]);
const slug = path.basename(ep);
const cfg = loadConfig(ep);
const style = flag('--style', cfg.style || 'corporate');
const th = loadTheme(style);
const C = th.colors ?? {};
const F = th.fonts ?? {};
const TY = th.type ?? {};
const SH = th.shape ?? {};
const FORMATS = { vertical: [1080, 1920], horizontal: [1920, 1080], square: [1080, 1080], a4: [794, 1123] };
const fmt = flag('--format', cfg.outputs?.infographicFormat || 'vertical');
const [PW, PH] = FORMATS[fmt] ?? FORMATS.vertical;

// ── content ───────────────────────────────────────────────────────────────────
let data = readJson(path.join(ep, 'infographic.json'), null);
if (!data) {
  const tm = readJson(path.join(ep, 'audio', 'timings.json'), { segments: [] });
  data = {
    title: cfg.brand?.product || slug,
    subtitle: cfg.project?.name || '',
    steps: tm.segments.map((s) => ({ title: s.name, text: s.sentences?.[0]?.text ?? '' })),
    footer: 'Infografía generada automáticamente: escribe infographic.json para controlarla.',
  };
  console.warn('no infographic.json — derived a minimal one from timings.json');
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Small stroke icon set (24×24, currentColor) — original shapes, no third-party licence.
const ICONS = {
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  voice: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c3 0 5 2 5 5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M7.5 12.5l3 3 6-6.5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  rocket: '<path d="M5 15c-1.5 1.5-2 4-2 6 2 0 4.5-.5 6-2M9 15l-3-3c2-6 7-9 15-9 0 8-3 13-9 15z"/><circle cx="15" cy="9" r="1.8"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
};
const icon = (n, size = 40) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] ?? ICONS.idea}</svg>`;

const light = th.mode === 'light';
const cardBg = SH.panel === 'outline' ? 'transparent' : light ? (C.paper ?? '#fff') : 'rgba(255,255,255,0.06)';
const cardBorder = SH.panel === 'outline' || !light ? `1.5px solid ${C.line ?? 'rgba(127,127,127,.3)'}` : '1px solid rgba(0,0,0,.06)';
const cardShadow = light && SH.panel !== 'outline' ? '0 10px 30px rgba(0,0,0,.08)' : 'none';
const series = C.series ?? [C.accent];
const isWide = PW > PH;

const html = `<!doctype html><html lang="${esc(cfg.project?.language || 'es')}"><head><meta charset="utf-8">
<title>${esc(data.title)} — infografía</title>
<style>
  :root { --bg:${C.bg}; --bg2:${C.bg2}; --text:${C.text}; --soft:${C.soft}; --accent:${C.accent}; --primary:${C.primary}; --line:${C.line};
          --display:${F.display}; --body:${F.body}; --r:${SH.radius ?? 16}px; }
  * { box-sizing: border-box; margin: 0; }
  html { width: ${PW}px; }
  body { min-height: ${PH}px; background: radial-gradient(120% 80% at 50% 0%, var(--bg2), var(--bg) 70%); color: var(--text); font-family: var(--body);
         padding: ${isWide ? '56px 72px' : '72px 64px'}; display: flex; flex-direction: column; gap: ${PH > 1500 ? 44 : 28}px; }
  .kicker { color: var(--accent); font: ${TY.labelWeight ?? 600} 22px var(--body); letter-spacing: .28em; text-transform: uppercase; display: flex; align-items: center; gap: 16px; }
  .kicker::before { content: ''; width: 40px; height: 4px; background: var(--accent); }
  h1 { font: ${TY.headWeight ?? 300} ${isWide ? 72 : PW < 900 ? 52 : 84}px/1.04 var(--display); ${TY.headCase === 'upper' ? 'text-transform: uppercase;' : ''} }
  h1 em { font-style: normal; color: var(--accent); }
  .sub { color: var(--soft); font-size: ${PW < 900 ? 22 : 30}px; line-height: 1.35; max-width: 92%; }
  .idea { border-left: 8px solid var(--accent); padding: 18px 28px; font: ${TY.headWeight ?? 300} ${PW < 900 ? 26 : 36}px/1.3 var(--display); background: ${cardBg}; border-radius: 0 var(--r) var(--r) 0; }
  .kpis { display: grid; grid-template-columns: repeat(${Math.min(4, (data.kpis ?? []).length || 1)}, 1fr); gap: 22px; }
  .kpi { background: ${cardBg}; border: ${cardBorder}; box-shadow: ${cardShadow}; border-radius: var(--r); padding: 26px; }
  .kpi b { display: block; font: ${TY.headWeight ?? 300} ${PW < 900 ? 52 : 76}px/1 var(--display); color: var(--accent); }
  .kpi span { color: var(--soft); font-size: ${PW < 900 ? 18 : 24}px; line-height: 1.3; display: block; margin-top: 10px; }
  h2 { font: ${TY.labelWeight ?? 600} 24px var(--body); letter-spacing: .2em; text-transform: uppercase; color: var(--soft); }
  .steps { display: grid; grid-template-columns: ${isWide ? `repeat(${(data.steps ?? []).length || 1}, 1fr)` : '1fr'}; gap: 18px; counter-reset: s; }
  .step { display: flex; gap: 22px; align-items: flex-start; background: ${cardBg}; border: ${cardBorder}; box-shadow: ${cardShadow}; border-radius: var(--r); padding: 22px 26px; ${isWide ? 'flex-direction: column;' : ''} }
  .step i { flex: none; width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; font: 700 26px var(--display); color: ${light ? '#fff' : C.bg}; font-style: normal; }
  .step h3 { font: ${TY.labelWeight ?? 600} ${PW < 900 ? 24 : 30}px var(--display); margin-bottom: 6px; }
  .step p, .sec p, .sec li { color: var(--soft); font-size: ${PW < 900 ? 19 : 24}px; line-height: 1.4; }
  .secs { display: grid; grid-template-columns: repeat(${isWide ? Math.min(4, (data.sections ?? []).length || 1) : 2}, 1fr); gap: 20px; }
  .sec { background: ${cardBg}; border: ${cardBorder}; box-shadow: ${cardShadow}; border-radius: var(--r); padding: 26px; }
  .sec .ic { color: var(--accent); margin-bottom: 12px; }
  .sec h3 { font: ${TY.labelWeight ?? 600} ${PW < 900 ? 22 : 28}px var(--display); margin-bottom: 8px; }
  .sec ul { padding-left: 1.1em; margin-top: 8px; }
  blockquote { font: italic ${TY.headWeight ?? 300} ${PW < 900 ? 26 : 38}px/1.3 var(--display); text-align: center; padding: 0 6%; }
  blockquote cite { display: block; margin-top: 14px; font: ${TY.labelWeight ?? 600} 22px var(--body); color: var(--soft); font-style: normal; }
  footer { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; gap: 30px; color: var(--soft); font-size: 18px; border-top: 1px solid var(--line); padding-top: 20px; }
  footer .brand { font: ${TY.labelWeight ?? 600} 20px var(--body); letter-spacing: .25em; text-transform: uppercase; color: var(--text); white-space: nowrap; }
  footer .brand img { height: 40px; }
</style></head><body>
  <header>
    ${data.kicker || cfg.brand?.product ? `<div class="kicker">${esc(data.kicker || cfg.brand?.product)}</div>` : ''}
    <h1 style="margin-top:18px">${esc(data.title).replace(/\*([^*]+)\*/g, '<em>$1</em>')}</h1>
    ${data.subtitle ? `<p class="sub" style="margin-top:16px">${esc(data.subtitle)}</p>` : ''}
  </header>
  ${data.idea ? `<div class="idea">${esc(data.idea)}</div>` : ''}
  ${(data.kpis ?? []).length ? `<div class="kpis">${data.kpis.map((k) => `<div class="kpi"><b>${esc(k.value)}</b><span>${esc(k.label)}</span></div>`).join('')}</div>` : ''}
  ${(data.steps ?? []).length ? `<section><h2 style="margin-bottom:18px">${esc(data.stepsTitle || 'Cómo funciona')}</h2><div class="steps">${data.steps.map((s, i) => `<div class="step"><i style="background:${series[i % series.length]}">${i + 1}</i><div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div></div>`).join('')}</div></section>` : ''}
  ${(data.sections ?? []).length ? `<div class="secs">${data.sections.map((s) => `<div class="sec"><div class="ic">${icon(s.icon)}</div><h3>${esc(s.title)}</h3>${s.text ? `<p>${esc(s.text)}</p>` : ''}${(s.bullets ?? []).length ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div>` : ''}
  ${data.quote?.text ? `<blockquote>“${esc(data.quote.text)}”${data.quote.cite ? `<cite>— ${esc(data.quote.cite)}</cite>` : ''}</blockquote>` : ''}
  <footer>
    <div>${esc(data.footer || '')}${(data.sources ?? []).length ? `<br>Fuentes: ${data.sources.map(esc).join(' · ')}` : ''}</div>
    <div class="brand">${cfg.brand?.[light ? 'logoOnLight' : 'logo'] ? `<img src="/${esc(cfg.brand[light ? 'logoOnLight' : 'logo'])}">` : esc(cfg.brand?.name || cfg.brand?.product || '')}</div>
  </footer>
</body></html>`;

// ── render ────────────────────────────────────────────────────────────────────
const outDir = path.join(ep, 'out');
fs.mkdirSync(outDir, { recursive: true });
const base = path.join(outDir, `${slug}-infografia`);
// the HTML references the logo with a root-relative path, so we serve it from the repo root
const tmp = path.join(ROOT, `.infographic-${slug}.html`);
fs.writeFileSync(tmp, html);
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || cfg.render?.browserChannel || undefined });
try {
  const page = await browser.newPage({ viewport: { width: PW, height: PH }, deviceScaleFactor: 2 });
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    const p = path.join(ROOT, decodeURIComponent(u.pathname));
    if (u.protocol === 'file:' || !p.startsWith(ROOT) || !fs.existsSync(p)) return route.continue();
    return route.fulfill({ path: p });
  });
  await page.goto('http://local.infographic/' + path.basename(tmp));
  await page.evaluate(() => document.fonts.ready);
  // auto-fit: shrink with CSS zoom until the content fits the page (text stays vector in the PDF)
  const k = await page.evaluate(([PW, PH]) => {
    let z = 1;
    for (let i = 0; i < 8; i++) {
      const h = document.body.getBoundingClientRect().height;
      if (h <= PH + 1) break;
      z *= (PH / h) * 0.995;
      document.documentElement.style.zoom = z;
      document.documentElement.style.width = PW / z + 'px';
      document.body.style.minHeight = PH / z + 'px';
    }
    return z;
  }, [PW, PH]);
  if (k < 0.8) console.warn(`content scaled to ${(k * 100).toFixed(0)}% to fit ${PW}×${PH} — consider shorter texts or another format`);
  await page.screenshot({ path: `${base}.png` });
  if (cfg.outputs?.infographicPdf !== false) await page.pdf({ path: `${base}.pdf`, width: `${PW}px`, height: `${PH}px`, printBackground: true, pageRanges: '1' });
  fs.writeFileSync(`${base}.html`, html.replace(/src="\/([^"]+)"/g, (_, p) => `src="${path.relative(outDir, path.join(ROOT, p)).split(path.sep).join('/')}"`));
} finally {
  await browser.close();
  fs.rmSync(tmp, { force: true });
}
console.log(`${path.relative(process.cwd(), base)}.png · .pdf · .html  (${fmt} ${PW}×${PH}, style ${style})`);
