# Configuración

Dos niveles, que se combinan (el segundo gana):

1. `project.config.json`: valores del proyecto. Lo escribe `npm run init`; se puede editar a mano.
2. `videos/<slug>/video.json`: lo que cambia en un vídeo concreto. Solo pon las claves que cambian.

```json
// videos/lanzamiento-q3/video.json
{ "style": "creativo", "video": { "width": 1080, "height": 1920 }, "audio": { "music": "brand/musica.mp3" } }
```

Los **secretos** van en `.env` (plantilla en `.env.example`), nunca en estos ficheros.

## Referencia

| Clave | Por defecto | Qué controla |
|---|---|---|
| `project.name` | `Mi proyecto` | nombre del proyecto o equipo (pies de infografía) |
| `project.language` | `es-ES` | idioma de narración y textos; elige la voz Edge por defecto |
| `project.audience` / `project.tone` | — | audiencia y tono por defecto para los briefings |
| `video.width` / `video.height` | 1920 / 1080 | tamaño del vídeo: 16:9, 9:16 (1080×1920), 1:1, 4K… El estilo islas es solo 16:9 |
| `video.fps` | 30 | fotogramas por segundo |
| `video.targetMinutes` | 2 | duración objetivo por defecto |
| `video.wordsPerMinute` | 150 | ritmo de la narración; también estima tiempos con `tts.engine: none` |
| `video.segments.min/max` | 5 / 9 | número de segmentos del briefing |
| `style` | `corporate` | estilo por defecto (carpeta de `styles/`) |
| `brand.name` / `brand.product` | vacío | nombre de la organización y del producto o programa (esquina, wordmark, cartel del taller en islas) |
| `brand.logo` / `brand.logoOnLight` / `brand.symbol` | vacío | rutas relativas a la raíz (p. ej. `brand/logo.png`); sin ellas se usa tipografía |
| `brand.showBug` | `true` | marca de esquina en cada segmento |
| `tts.engine` | `edge` | `edge` (gratis), `elevenlabs` (clave en `.env`), `kokoro` (local), `none` (silencio) |
| `tts.edge.voice` / `rate` | `es-ES-AlvaroNeural` / `+0%` | voz y velocidad de Edge (`edge-tts --list-voices`) |
| `tts.elevenlabs.voiceId` / `model` | vacío / `eleven_multilingual_v2` | voz de tu biblioteca de ElevenLabs |
| `tts.kokoro.voice` / `lang` | `em_alex` / `es` | voz local (modelos en `kokoro-models/`) |
| `tts.sentenceGap` / `paragraphGap` / `tail` | 0.22 / 0.45 / 0.6 | silencios entre frases, párrafos y al final de cada segmento (s) |
| `render.workers` | 6 | páginas de navegador en paralelo |
| `render.crf` / `preset` | 16 / `medium` | calidad y velocidad de x264 |
| `render.browserChannel` | vacío | vacío = Chromium de Playwright; `msedge` o `chrome` = navegador instalado |
| `audio.loudness` | -16 | LUFS finales (-14 redes, -23 broadcast) |
| `audio.music` | vacío | música de fondo (ruta; asegúrate de tener la licencia) |
| `audio.musicVolume` / `ducking` | 0.25 / `true` | volumen de la música y si baja sola cuando habla la voz |
| `outputs.subtitles` / `burnSubtitles` | `true` / `false` | `.srt` + `.vtt`, y copia con subtítulos incrustados |
| `outputs.infographic` / `infographicFormat` / `infographicPdf` | `true` / `vertical` / `true` | infografía (`vertical`, `horizontal`, `square`, `a4`) |
| `outputs.chapters` | `true` | `chapters.txt` con marcas de tiempo por segmento |
| `guardrails.personNames` | `false` | si se pueden nombrar personas |
| `guardrails.sourceOnlyFacts` | `true` | solo cifras y hechos del material fuente |
| `guardrails.reviewBeforeTTS` / `reviewStills` | `true` / `true` | paradas de revisión humana |
| `guardrails.minTextPx` / `maxOnScreenWords` | 30 / 8 | legibilidad en pantalla |
| `islas.areas` (en `video.json`) | áreas genéricas | islas del mapa: `[{ "name", "short"?, "apps", "ang", "size", "islets"? }]` |

## Variables de entorno (`.env`)

| Variable | Uso |
|---|---|
| `ELEVENLABS_API_KEY` | clave de ElevenLabs (solo con `tts.engine: elevenlabs`) |
| `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL` | sobrescriben la config en esta máquina |
| `EDGE_VOICE`, `EDGE_RATE` | sobrescriben `tts.edge.*` |
| `KOKORO_MODELS`, `KOKORO_VOICE`, `KOKORO_LANG` | voz local |
| `PW_CHANNEL` | `msedge` / `chrome`: navegador instalado para renderizar |
