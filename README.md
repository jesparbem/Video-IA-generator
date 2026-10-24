# Video IA Generator

**De un documento a un vídeo narrado y animado en código, con su infografía, de la mano de un agente de IA.**

Le das a tu agente (Claude Code, OpenAI Codex, OpenClaw u otro con terminal) un documento, una web o una idea. El agente escribe el guion, genera la voz, dibuja cada escena en JavaScript sincronizada palabra a palabra con la narración y monta el MP4. Además entrega subtítulos, capítulos y una infografía explicativa de una página.

![Galería de estilos](styles/corporate/preview.png)

- **9 estilos** listos (corporate, minimal, creativo, clásico, neón, editorial, pastel, educación e islas isométricas) y un **creador de estilos** que genera uno nuevo a partir de tres colores, una guía de marca o una web.
- **Todo parametrizable** en `project.config.json`: idioma, formato (16:9, 9:16, 1:1, 4K), fps, estilo, marca y logos, voz, música, salidas y reglas de contenido. `npm run init` te lo pregunta todo.
- **Voz gratis por defecto** (Edge TTS, sin clave, decenas de idiomas). ElevenLabs y Kokoro local como alternativas.
- **Subtítulos** `.srt`/`.vtt` y, si quieres, **subtítulos cinéticos** (karaoke por palabra) dibujados en el vídeo.
- **Infografía** PNG + PDF + HTML con el mismo estilo que el vídeo.
- **Sin secretos en el repo**: las claves solo en `.env`; la marca y los logos los pones tú (no se incluye ninguna marca).
- **Humano en el bucle**: el agente para a enseñarte el guion antes de gastar voz y los fotogramas antes del render.

## Empezar en 3 pasos

```bash
git clone https://github.com/jesparbem/Video-IA-generator.git && cd Video-IA-generator
npm install && npx playwright install chromium
python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt   # macOS/Linux: .venv/bin/python

npm run init      # asistente de configuración
npm run doctor    # comprueba la instalación
npm run demo      # → videos/demo/out/demo.mp4 + subtítulos + infografía
```

Guía detallada, requisitos por sistema operativo y problemas frecuentes: [docs/instalacion.md](docs/instalacion.md).

## Instalarlo con tu IA

¿Prefieres que lo instale tu agente? Copia el prompt correspondiente de [docs/INSTALL-PROMPTS.md](docs/INSTALL-PROMPTS.md):

| Agente | Cómo lee el proyecto |
|---|---|
| **Claude Code** | `CLAUDE.md` (importa `AGENTS.md`) + skills en `.claude/skills/` |
| **OpenAI Codex** | `AGENTS.md` + skills en `.agents/skills/` (`$crear-video`) |
| **OpenClaw** | skills AgentSkills de `.agents/skills/` (`openclaw skills install`) |
| Otros (Gemini CLI, Cursor, Copilot…) | `AGENTS.md` + `docs/playbook.md` |

## Hacer un vídeo

Abre la carpeta con tu agente y pídelo en lenguaje natural:

> Usa la skill crear-video. Quiero un vídeo de unos 2 minutos para el comité de dirección explicando [tema], a partir de este documento: [ruta]. Estilo editorial, formato 16:9.

El agente sigue [docs/playbook.md](docs/playbook.md): briefing → narración (**para** y te lo enseña) → voz → escenas → fotogramas de revisión (**para**) → render → infografía. El resultado queda en `videos/<slug>/out/`:

| Fichero | Qué es |
|---|---|
| `<slug>.mp4` | vídeo final, volumen normalizado, con música si la configuras |
| `<slug>.srt` · `<slug>.vtt` | subtítulos (y `<slug>-subs.mp4` con ellos incrustados, si lo activas) |
| `chapters.txt` | capítulos con marcas de tiempo |
| `<slug>-infografia.png` · `.pdf` · `.html` | infografía explicativa |

## Estilos

| | | |
|---|---|---|
| ![corporate](styles/corporate/preview.png) **corporate** | ![minimal](styles/minimal/preview.png) **minimal** | ![creativo](styles/creativo/preview.png) **creativo** |
| ![clasico](styles/clasico/preview.png) **clasico** | ![neon](styles/neon/preview.png) **neon** | ![editorial](styles/editorial/preview.png) **editorial** |
| ![pastel](styles/pastel/preview.png) **pastel** | ![educacion](styles/educacion/preview.png) **educacion** | ![islas](styles/islas/preview.png) **islas** |

Crea el tuyo con `npm run new-style` o pídeselo al agente ("crea un estilo con los colores de nuestra web"). Detalles y esquema: [docs/estilos.md](docs/estilos.md).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run init` | asistente: pregunta todo lo parametrizable y escribe `project.config.json` |
| `npm run doctor [-- --voice]` | comprueba la instalación (y prueba la voz) |
| `npm run new-video -- <slug> [--style s] [--format 1080x1920]` | crea un vídeo desde la plantilla |
| `npm run new-style` | crea un estilo (asistente o flags) y su vista previa |
| `npm run audio -- videos/<slug> [seg]` | genera la voz y los tiempos por palabra |
| `npm run stills -- videos/<slug> <seg> --stills 12 [--style s]` | hoja de contactos para revisar |
| `npm run preview -- videos/<slug> <seg> --serve` | reproductor en el navegador con audio y scrub |
| `npm run build -- videos/<slug>` | render + MP4 + subtítulos + capítulos + infografía |
| `npm run infographic -- videos/<slug> [--format a4]` | solo la infografía |
| `npm run style:preview -- <estilo\|all>` | regenera las vistas previas de estilos |

Toda la configuración: [docs/configuracion.md](docs/configuracion.md).

## Cómo funciona

```
documento ─▶ briefing.md ─▶ narration.md ─▶ TTS por frase ─▶ timings.json (inicio de cada palabra)
                                                                     │
       styles/<estilo>/theme.json ─▶ kit (tokens) ─▶ scenes/NN-seg.js: draw(ctx, t) puro
                                                                     │
                        Playwright (N navegadores en paralelo) ─▶ fotogramas PNG ─▶ ffmpeg
                                                                     │
          out/: MP4 normalizado (+ música con ducking) · SRT/VTT · capítulos · infografía PNG/PDF/HTML
```

Cada fotograma es una función pura del tiempo, así que el render se reparte entre varios navegadores y es reproducible. Estructura del repo y reglas para agentes: [AGENTS.md](AGENTS.md).

## Requisitos

Node 20+, Python 3.10+, ffmpeg y un Chromium (el de Playwright, o Edge/Chrome instalados). Windows, macOS o Linux.

## Hoja de ruta

Ideas tomadas de proyectos abiertos (alineación forzada para cualquier voz, transiciones como bloques, gráficos en la infografía…): [docs/mejoras-github.md](docs/mejoras-github.md).

## Licencia

[MIT](LICENSE). Las voces, fuentes, logos y música que añadas tienen sus propias licencias: revísalas antes de publicar un vídeo.
