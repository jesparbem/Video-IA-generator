# Ideas de repositorios públicos

Revisión hecha en octubre de 2026 de proyectos abiertos parecidos o complementarios, con lo que ya se ha incorporado y lo que queda como hoja de ruta. Las cifras de estrellas son aproximadas.

## Incorporado en esta versión

| Idea | De dónde | Cómo está aquí |
|---|---|---|
| Voz gratuita con tiempos por palabra | [rany2/edge-tts](https://github.com/rany2/edge-tts) (LGPL-3) | motor por defecto (`tts.engine: edge`), sin clave |
| Subtítulos desde los tiempos | `@remotion/captions`, HyperFrames | `assemble.mjs` escribe `.srt`/`.vtt` (≤ 42 caracteres por línea) y, opcional, la copia incrustada |
| Música con *ducking* | patrón habitual de ffmpeg (`sidechaincompress`), editly | `audio.music` + `audio.ducking` |
| Skills portables entre agentes | [remotion-dev/skills](https://github.com/remotion-dev/skills), [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes), especificación AgentSkills | `.agents/skills/` (Codex y OpenClaw las leen tal cual) + copia en `.claude/skills/` |
| Infografía con el mismo pipeline | HTML → Playwright `screenshot` + `pdf` | `engine/infographic.mjs` |
| Tema como datos | sistemas de *design tokens* | `styles/<estilo>/theme.json` + kit que lee tokens al dibujar |
| Subtítulos cinéticos (karaoke por palabra) | `@remotion/captions` | `captions()` del kit; `outputs.kineticCaptions` los dibuja sobre cada escena |
| Marcadores en la narración | `manim-voiceover`, `waitUntil()` de Motion Canvas | `<mark name="x"/>` en `narration.md` → `marks` en `timings.json` → `q.mark('x')` |

## Hoja de ruta (por impacto/esfuerzo)

| Idea | Fuente | Esfuerzo | Notas |
|---|---|---|---|
| **Alineación forzada** para cualquier TTS o voz grabada | [jianfch/stable-ts](https://github.com/jianfch/stable-ts) (MIT), [m-bain/whisperX](https://github.com/m-bain/whisperX) (BSD-2) | medio | un paso `align` que, si el motor no da tiempos, alinea el texto conocido con el audio. Abre la puerta a Piper, OpenAI TTS o una locución humana |
| **Transiciones entre segmentos** como bloques reutilizables | registro de bloques de HyperFrames, `TransitionSeries` de Remotion, `xfade` de ffmpeg | bajo | solapar fin e inicio de segmentos en el canvas |
| **Diagramas y gráficos** en la infografía | Mermaid, Vega-Lite, [antvis/Infographic](https://github.com/antvis/Infographic) (MIT) | bajo-medio | bloques `chart` y `diagram` en `infographic.json` |
| **Voz clonada local** | Chatterbox (MIT), F5-TTS (pesos CC-BY-NC: no comercial) | medio | requiere la alineación forzada |
| **Distribución como plugin** | marketplace de plugins de Claude Code, `npx skills add` | bajo | instalar las skills sin clonar el repo |

## Descartado

- **Remotion** como motor: muy maduro, pero su licencia exige pago a empresas, lo que choca con un repo abierto y con la soberanía del código.
- **aeneas**: alineación antigua, AGPL y sin mantenimiento.
