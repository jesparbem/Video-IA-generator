# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Video IA Generator

Las instrucciones del proyecto están en AGENTS.md (compartidas con Codex y OpenClaw):

@AGENTS.md

## Específico de Claude Code

- Skills del proyecto en `.claude/skills/` (copias de `.agents/skills/`; si editas una, ejecuta `npm run sync-skills`).
- Paraleliza las escenas con subagentes (herramienta Agent): uno por cada 1–2 segmentos, cada uno con `prompts/_common.md` + su `prompts/NN-seg.md`. Revisa tú cada hoja de contactos al recibirlas.
- Para ver fotogramas, lee los PNG de `videos/<slug>/review/` con la herramienta de lectura de ficheros.

## Cómo encaja el motor (lo que no se ve leyendo un solo fichero)

- **Segmentos**: `audio.py` parte `narration.md` por cabeceras `## <nombre>` (una sola palabra, `\w+`). El orden de los segmentos en `audio/timings.json` decide el nombre de la escena: `frame.html` carga `scenes/NN-<nombre>.js` con NN = posición + 1. Si reordenas, renombras o insertas un segmento, regenera el audio y renombra las escenas.
- **Sintaxis de narración**: `{texto mostrado|texto hablado}` (subtítulos frente a TTS), `(pause 1.2)` en una línea propia y `<mark name="x"/>` dentro de una frase (→ `marks` del segmento en `timings.json` → `q.mark('x')`).
- **Subtítulos cinéticos**: con `outputs.kineticCaptions`, `frame.html` llama a `captions()` de `styles/_base/kit.js` después de cada `draw`; las escenas no los dibujan.
- **Contrato de escena**: `export default { async setup(env)?, draw(ctx, t, env) }`. `env` = `{ timing, dur, ep, R, cfg, style, theme, W, H }`. El render hace `setTransform`/`globalAlpha` reset antes de cada `draw`, pero el estado que la escena deje en variables de módulo se comparte entre fotogramas y entre workers (cada worker es una página distinta): solo se permite estado precalculado en `setup`.
- **El estilo no lo fija el import**: aunque la escena importe `styles/<x>/kit.js` o `styles/_base/kit.js`, `frame.html` aplica en tiempo de ejecución el tema de `cfg.style` (o `--style`) sobre los tokens `T`. Las piezas propias de un estilo (p. ej. `styles/islas/islas.js`) sí atan la escena a ese estilo.
- **Config**: `project.config.json` ⟵ deep-merge ⟵ `videos/<slug>/video.json`. El merge está implementado tres veces (`engine/config.mjs`, `engine/frame.html`, `engine/audio.py`); si cambias su semántica, cambia las tres.
- **Render**: `render.mjs` levanta un servidor HTTP estático en la raíz del repo, abre `engine/frame.html?ep=…&seg=…` en N páginas Playwright, cada una pinta un rango disjunto de fotogramas a su ffmpeg, y concatena en `render/NN-seg.mp4` con el wav del segmento. `assemble.mjs` une esos MP4 en `out/`. Una excepción en la escena (`pageerror`) deja el proceso con código de salida 1, aunque el render termine; los `console.error` solo se imprimen.
- **Python**: siempre a través de `engine/py.mjs`, que usa `.venv` si existe (`engine/lib/python.mjs`).
- **Navegador**: si Playwright no puede descargar Chromium, `PW_CHANNEL=msedge` (o `render.browserChannel` en la config).

## Verificar cambios

No hay tests unitarios ni linter. Para validar:

- `npm run doctor` — entorno y config.
- `npm run sync-skills -- --check` — sale con código 1 si `.claude/skills/` no coincide con `.agents/skills/`.
- `npm run stills -- videos/demo <seg> --stills 12` — prueba rápida de un cambio en `engine/runtime.js`, `styles/_base/` o un kit (`--style <nombre>` para otro estilo; `--at 1.5,4` para tiempos exactos).
- `npm run style:preview -- all` — regenera las vistas previas de todos los estilos tras tocar `styles/_base/`.
- `npm run demo` — prueba de punta a punta (voz + render + montaje + infografía).
