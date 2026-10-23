---
name: crear-video
description: Crea un vídeo narrado y animado en código (canvas fotograma a fotograma, voz en off sincronizada por palabra) y su infografía explicativa, a partir de un documento, una web, un HTML o una idea, en cualquiera de los estilos del repo (corporate, minimal, creativo, clásico, neón, editorial, pastel, educación, islas o uno propio). Úsala cuando pidan "hazme un vídeo", "vídeo explicativo", "vídeo de presentación", "convierte este documento en vídeo", o cambiar, re-narrar o re-renderizar un vídeo de videos/.
metadata: {"openclaw":{"requires":{"bins":["node","ffmpeg"]},"emoji":"🎬"}}
---

# Crear un vídeo

El procedimiento completo está en `docs/playbook.md` y las reglas en `AGENTS.md`. Léelos enteros antes de empezar, junto con `project.config.json` y el `estilo.md` del estilo elegido. Este fichero solo empaqueta el flujo.

1. Si es la primera vez en esta máquina: `npm run doctor`. Si la config está por defecto y la persona no la ha revisado, ofrece `npm run init`.
2. Pide lo que falte con **una** pregunta concreta: material fuente, audiencia, duración aproximada, estilo (recomienda uno con la tabla de `docs/estilos.md`) y formato si no es el de la config. Si viene en la petición, no preguntes. Si pide un estilo que no existe, usa antes la skill `crear-estilo`.
3. `npm run new-video -- <slug> --style <estilo>` y guarda la fuente en `videos/<slug>/fuente/`.
4. Escribe `briefing.md` y `narration.md`. Si `guardrails.reviewBeforeTTS`: **para y enséñalos**, porque la voz puede costar créditos.
5. Con el OK: `npm run audio -- videos/<slug>`.
6. Escribe tú la escena de apertura y revísala con `npm run stills -- videos/<slug> <seg> --stills 8`. Después escribe `prompts/_common.md` y un `prompts/NN-seg.md` por segmento, con los tiempos sacados de `audio/timings.json`.
7. Escribe el resto de escenas (en paralelo con subagentes si tu entorno lo permite, uno por cada 1–2 segmentos). Revisa cada hoja de contactos. Si `guardrails.reviewStills`: **para y enséñalas**.
8. Escribe `infographic.json` desde el briefing (esquema en `templates/video/infographic.json`).
9. `npm run build -- videos/<slug>` → MP4, subtítulos, capítulos e infografía en `videos/<slug>/out/`.
10. Informa: ruta del MP4 y duración, infografía, y qué conviene revisar (pronunciaciones, datos de demo, decisiones tomadas). No publiques ni envíes nada sin OK.

Ejemplos terminados: `videos/demo/` (kit base, vale para cualquier estilo) y `videos/demo-islas/` (islas).
