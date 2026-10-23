#!/usr/bin/env node
// Project wizard: asks everything that can be parametrised and writes project.config.json.
// Creates .env from .env.example if missing (empty values: secrets are never asked here).
//
//   npm run init            interactive (re-running keeps your current answers as defaults)
//   npm run init -- --yes   accept current/default values without asking

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, readJson, listStyles } from './config.mjs';
import { text, number, yesno, choose, title, note, close, YES } from './lib/ask.mjs';

const CFG_PATH = path.join(ROOT, 'project.config.json');
const cur = readJson(CFG_PATH);
const g = (p, d) => p.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), cur) ?? d;

const LANGS = [
  { value: 'es-ES', label: 'Castellano (España)', m: 'es-ES-AlvaroNeural', f: 'es-ES-ElviraNeural' },
  { value: 'ca-ES', label: 'Català', m: 'ca-ES-EnricNeural', f: 'ca-ES-JoanaNeural' },
  { value: 'es-MX', label: 'Español (México)', m: 'es-MX-JorgeNeural', f: 'es-MX-DaliaNeural' },
  { value: 'en-US', label: 'English (US)', m: 'en-US-GuyNeural', f: 'en-US-JennyNeural' },
  { value: 'en-GB', label: 'English (UK)', m: 'en-GB-RyanNeural', f: 'en-GB-SoniaNeural' },
  { value: 'pt-PT', label: 'Português (Portugal)', m: 'pt-PT-DuarteNeural', f: 'pt-PT-RaquelNeural' },
  { value: 'pt-BR', label: 'Português (Brasil)', m: 'pt-BR-AntonioNeural', f: 'pt-BR-FranciscaNeural' },
  { value: 'fr-FR', label: 'Français', m: 'fr-FR-HenriNeural', f: 'fr-FR-DeniseNeural' },
  { value: 'de-DE', label: 'Deutsch', m: 'de-DE-ConradNeural', f: 'de-DE-KatjaNeural' },
  { value: 'it-IT', label: 'Italiano', m: 'it-IT-DiegoNeural', f: 'it-IT-ElsaNeural' },
];
const FORMATS = [
  { value: '1920x1080', label: '16:9 Full HD 1920×1080', hint: 'presentaciones, YouTube' },
  { value: '1080x1920', label: '9:16 vertical 1080×1920', hint: 'Reels, Shorts, TikTok (el estilo islas es solo 16:9)' },
  { value: '1080x1080', label: '1:1 cuadrado 1080×1080', hint: 'LinkedIn, feed' },
  { value: '3840x2160', label: '16:9 4K 3840×2160', hint: 'render 4× más lento' },
  { value: 'custom', label: 'Otro tamaño' },
];

console.log('\nVideo IA Generator · configuración del proyecto');
note(`Se guardará en ${path.relative(process.cwd(), CFG_PATH)}. Pulsa Enter para aceptar el valor entre corchetes.`);

// 1 · project
title('1/9 Proyecto');
const project = {
  name: await text('Nombre del proyecto o del equipo', g('project.name', 'Mi proyecto')),
  language: await choose('Idioma de la narración y los textos', LANGS, g('project.language', 'es-ES')),
  audience: await text('Audiencia por defecto (p. ej. comité de dirección, clientes, alumnos)', g('project.audience', 'público general')),
  tone: await text('Tono por defecto', g('project.tone', 'claro y cercano')),
};

// 2 · format
title('2/9 Formato de vídeo');
let size = await choose('Formato', FORMATS, `${g('video.width', 1920)}x${g('video.height', 1080)}`);
if (size === 'custom') size = `${await number('Ancho px', g('video.width', 1920), { min: 320, max: 7680 })}x${await number('Alto px', g('video.height', 1080), { min: 320, max: 7680 })}`;
const [width, height] = size.split('x').map(Number);
const video = {
  width, height,
  fps: await choose('Fotogramas por segundo', [24, 25, 30, 60].map((v) => ({ value: v, label: `${v} fps` })), g('video.fps', 30)),
  targetMinutes: await number('Duración objetivo por defecto (minutos)', g('video.targetMinutes', 2), { min: 0.25, max: 30 }),
  wordsPerMinute: await number('Palabras por minuto de la voz (ritmo)', g('video.wordsPerMinute', 150), { min: 80, max: 220 }),
  segments: { min: g('video.segments.min', 5), max: g('video.segments.max', 9) },
};

// 3 · style
title('3/9 Estilo visual por defecto');
let styles = listStyles();
let style = await choose('Estilo (cada vídeo puede cambiarlo en su video.json)', [
  ...styles.map((s) => ({ value: s.name, label: `${s.label ?? s.name}`, hint: s.tone })),
  { value: '__new', label: '➕ Crear un estilo nuevo ahora' },
], g('style', 'corporate'));
if (style === '__new') {
  close();
  const r = spawnSync(process.execPath, [path.join(ROOT, 'engine/new-style.mjs'), '--print-name'], { stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8' });
  process.stdout.write(r.stdout.replace(/^STYLE=.*$/m, ''));
  style = (r.stdout.match(/^STYLE=(.+)$/m) ?? [])[1] ?? 'corporate';
}

// 4 · brand
title('4/9 Marca (opcional)');
note('Los logos son rutas relativas a la raíz del repo, p. ej. brand/logo-blanco.png. La carpeta brand/ está en .gitignore.');
const brand = {
  name: await text('Nombre de la organización (vacío = ninguno)', g('brand.name', '')),
  product: await text('Nombre del producto o programa que aparece en la esquina', g('brand.product', '')),
  logo: await text('Logo para fondos oscuros (PNG/SVG)', g('brand.logo', '')),
  logoOnLight: await text('Logo para fondos claros (vacío = el mismo)', g('brand.logoOnLight', '')),
  symbol: await text('Símbolo o isotipo suelto (vacío = un círculo del color de acento)', g('brand.symbol', '')),
  showBug: await yesno('¿Mostrar la marca de esquina en todos los segmentos?', g('brand.showBug', true)),
};
for (const k of ['logo', 'logoOnLight', 'symbol']) if (brand[k] && !fs.existsSync(path.join(ROOT, brand[k]))) note(`  aviso: ${brand[k]} no existe todavía`);

// 5 · voice
title('5/9 Voz (TTS)');
const engine = await choose('Motor de voz', [
  { value: 'edge', label: 'Edge TTS', hint: 'gratis, sin clave, voces neuronales en muchos idiomas' },
  { value: 'elevenlabs', label: 'ElevenLabs', hint: 'mejor calidad; clave en .env, consume créditos' },
  { value: 'kokoro', label: 'Kokoro (local)', hint: 'sin red ni coste; requiere kokoro-models/' },
  { value: 'none', label: 'Sin voz (silencio)', hint: 'previsualizar sin red; tiempos estimados' },
], g('tts.engine', 'edge'));
const lang = LANGS.find((l) => l.value === project.language) ?? LANGS[0];
const tts = { ...(cur.tts ?? {}), engine };
tts.edge = { voice: g('tts.edge.voice', lang.m), rate: g('tts.edge.rate', '+0%') };
if (engine === 'edge') {
  const def = [lang.m, lang.f].includes(tts.edge.voice) ? tts.edge.voice : lang.m;
  tts.edge.voice = await choose('Voz', [
    { value: lang.m, label: lang.m, hint: 'masculina' }, { value: lang.f, label: lang.f, hint: 'femenina' },
    { value: '__other', label: 'Otra (lista completa: edge-tts --list-voices)' }], def);
  if (tts.edge.voice === '__other') tts.edge.voice = await text('ID de voz Edge', lang.m);
  tts.edge.rate = await text('Velocidad (+10% más rápido, -10% más lento)', tts.edge.rate);
}
tts.elevenlabs = { voiceId: g('tts.elevenlabs.voiceId', ''), model: g('tts.elevenlabs.model', 'eleven_multilingual_v2') };
if (engine === 'elevenlabs') {
  tts.elevenlabs.voiceId = await text('ID de la voz de ElevenLabs (de tu Voice Library)', tts.elevenlabs.voiceId);
  tts.elevenlabs.model = await text('Modelo', tts.elevenlabs.model);
  note('  La clave va en .env → ELEVENLABS_API_KEY (no se pregunta aquí ni se guarda en la config).');
}
tts.kokoro = { voice: g('tts.kokoro.voice', 'em_alex'), lang: g('tts.kokoro.lang', project.language.slice(0, 2)) };
tts.sentenceGap = g('tts.sentenceGap', 0.22); tts.paragraphGap = g('tts.paragraphGap', 0.45); tts.tail = g('tts.tail', 0.6);

// 6 · audio
title('6/9 Audio');
const audio = {
  loudness: await choose('Volumen final', [{ value: -16, label: '-16 LUFS', hint: 'web, presentaciones' }, { value: -14, label: '-14 LUFS', hint: 'redes sociales' }, { value: -23, label: '-23 LUFS', hint: 'broadcast EBU R128' }], g('audio.loudness', -16)),
  music: await text('Música de fondo por defecto (ruta a mp3/wav con licencia; vacío = sin música)', g('audio.music', '')),
  musicVolume: g('audio.musicVolume', 0.25),
  ducking: g('audio.ducking', true),
};
if (audio.music) {
  audio.musicVolume = await number('Volumen de la música (0–1)', audio.musicVolume, { min: 0, max: 1 });
  audio.ducking = await yesno('¿Bajar la música automáticamente cuando habla la voz (ducking)?', audio.ducking);
}

// 7 · outputs
title('7/9 Salidas');
const outputs = {
  subtitles: await yesno('¿Generar subtítulos .srt y .vtt?', g('outputs.subtitles', true)),
  burnSubtitles: false,
  infographic: await yesno('¿Generar infografía explicativa (PNG + HTML)?', g('outputs.infographic', true)),
  infographicFormat: g('outputs.infographicFormat', 'vertical'),
  infographicPdf: g('outputs.infographicPdf', true),
  chapters: await yesno('¿Generar lista de capítulos (chapters.txt)?', g('outputs.chapters', true)),
};
if (outputs.subtitles) outputs.burnSubtitles = await yesno('¿Además, una copia con los subtítulos incrustados?', g('outputs.burnSubtitles', false));
if (outputs.infographic) {
  outputs.infographicFormat = await choose('Formato de la infografía', [
    { value: 'vertical', label: 'Vertical 1080×1920' }, { value: 'horizontal', label: 'Horizontal 1920×1080' },
    { value: 'square', label: 'Cuadrada 1080×1080' }, { value: 'a4', label: 'A4' }], outputs.infographicFormat);
  outputs.infographicPdf = await yesno('¿También en PDF?', outputs.infographicPdf);
}

// 8 · guardrails
title('8/9 Reglas de contenido (guardrails)');
const guardrails = {
  personNames: await yesno('¿Se permiten nombres de personas en los vídeos?', g('guardrails.personNames', false)),
  sourceOnlyFacts: await yesno('¿Solo cifras y hechos que estén en el material fuente?', g('guardrails.sourceOnlyFacts', true)),
  reviewBeforeTTS: await yesno('¿Parar para revisar guion antes de generar la voz?', g('guardrails.reviewBeforeTTS', true)),
  reviewStills: await yesno('¿Parar para revisar fotogramas antes del render final?', g('guardrails.reviewStills', true)),
  minTextPx: g('guardrails.minTextPx', 30),
  maxOnScreenWords: g('guardrails.maxOnScreenWords', 8),
};

// 9 · render
title('9/9 Render');
const cpus = os.cpus().length;
const render = {
  workers: await number(`Navegadores en paralelo (tienes ${cpus} CPU)`, g('render.workers', Math.max(2, Math.min(8, cpus - 2))), { min: 1, max: 32 }),
  crf: await choose('Calidad del MP4', [{ value: 16, label: 'Alta (CRF 16)', hint: 'archivo mayor' }, { value: 20, label: 'Media (CRF 20)' }, { value: 24, label: 'Ligera (CRF 24)', hint: 'para enviar por correo' }], g('render.crf', 16)),
  preset: g('render.preset', 'medium'),
  browserChannel: await choose('Navegador para renderizar', [
    { value: '', label: 'Chromium de Playwright', hint: 'npx playwright install chromium' },
    { value: 'msedge', label: 'Microsoft Edge instalado', hint: 'si la red bloquea la descarga de Chromium' },
    { value: 'chrome', label: 'Google Chrome instalado' }], g('render.browserChannel', '')),
};

close();
const out = { $comment: cur.$comment ?? 'Project-wide defaults. Regenerate with `npm run init`. Each video can override any key in videos/<slug>/video.json. Secrets never go here: they live in .env.', project, video, style, brand, tts, render, audio, outputs, guardrails };
fs.writeFileSync(CFG_PATH, JSON.stringify(out, null, 2) + '\n');
if (!fs.existsSync(path.join(ROOT, '.env')) && fs.existsSync(path.join(ROOT, '.env.example'))) {
  fs.copyFileSync(path.join(ROOT, '.env.example'), path.join(ROOT, '.env'));
  console.log('\n.env creado desde .env.example (sin valores). Rellénalo solo si usas ElevenLabs u otro servicio con clave.');
}
console.log(`\n✔ Guardado ${path.relative(process.cwd(), CFG_PATH)}${YES ? ' (valores por defecto)' : ''}`);
console.log('Siguiente: npm run doctor   ·   npm run demo   ·   npm run new-video -- <slug>');
