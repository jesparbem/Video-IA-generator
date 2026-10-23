---
name: crear-infografia
description: Genera una infografía explicativa de una página (PNG a doble densidad, PDF y HTML) con el estilo del vídeo, a partir del briefing de un vídeo de videos/ o de un documento suelto. Úsala cuando pidan "infografía", "resumen visual", "one-pager", "póster explicativo", o la infografía de un vídeo existente.
metadata: {"openclaw":{"requires":{"bins":["node"]},"emoji":"🧾"}}
---

# Crear una infografía

1. **Origen del contenido**:
   - De un vídeo: lee `videos/<slug>/briefing.md` (idea, tabla de datos, segmentos) y `narration.md`.
   - De un documento suelto: crea un contenedor con `npm run new-video -- <slug> --style <estilo>`, guarda la fuente en `fuente/` y escribe un `briefing.md` corto (idea + tabla de datos con su origen).
2. **Escribe `videos/<slug>/infographic.json`** siguiendo `templates/video/infographic.json`:
   - `title` con la palabra clave entre `*asteriscos*` (sale en el color de acento); `subtitle` de 1–2 frases; `idea` = la frase que queda.
   - `kpis`: 2–4 cifras, **solo de la tabla de datos** (nada inventado).
   - `steps`: 3–5 pasos de una frase. `sections`: 2–4 bloques con `icon` (`doc, voice, play, chart, users, bolt, check, gear, target, clock, shield, globe, idea, rocket, palette, film`).
   - `sources` y `footer`. Sin nombres de personas salvo que la config o la petición lo permitan.
3. **Genera**: `npm run infographic -- videos/<slug> [--format vertical|horizontal|square|a4] [--style <estilo>]`.
4. **Revisa el PNG** (`videos/<slug>/out/<slug>-infografia.png`). Si el script avisa de que ha reducido por debajo del 80 %, acorta textos o cambia de formato.
5. Entrega las rutas de PNG, PDF y HTML. No la publiques ni la envíes sin OK.
