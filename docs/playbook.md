# Playbook: de un documento a un vídeo (y su infografía)

Procedimiento que sigue el agente (Claude Code, Codex, OpenClaw u otro). Todo se ejecuta desde la raíz del repositorio. Ejemplo completo de cada artefacto: `videos/demo/` (kit base, vale para cualquier estilo) y `videos/demo-islas/` (estilo islas).

Antes de empezar, lee `project.config.json`: idioma, formato, estilo, voz, marca, salidas y guardrails por defecto. Cada vídeo puede sobrescribir cualquier clave en su `video.json`.

## 0. Arranque

```bash
npm run new-video -- <slug> [--style <estilo>] [--minutes 2] [--format 1080x1920]
```

Crea `videos/<slug>/` desde `templates/video/`. El slug va en minúsculas con guiones (`plan-ciber-2027`). Guarda el material fuente en `videos/<slug>/fuente/`.

Si quien lo pide no indica estilo, recomienda uno según el tono (tabla en `docs/estilos.md`) y pregúntalo junto con el briefing. Si quiere un estilo que no existe ("con los colores de nuestra web", "algo tipo revista verde"), créalo con la skill `crear-estilo` antes de seguir.

## 1. Briefing: `briefing.md`

Lee el material fuente entero. Escribe tu propio brief. No es un resumen del documento: es lo que la audiencia tiene que entender al acabar.

- **Audiencia, duración y una sola idea** que el vídeo deja clara.
- **Estilo**, con la metáfora visual principal. En islas, define también qué es cada isla (`islas.areas` en `video.json`) y el arco de luz (amanecer → noche).
- **Arco**: normalmente tres actos (problema → lo que ya funciona → hacia dónde vamos). Decide qué se queda fuera y dilo.
- **Tabla de datos**: cada cifra o hecho que se va a decir, con dónde está en la fuente. Si `guardrails.sourceOnlyFacts` es `true`, lo que no está en la fuente no entra.
- **Guardrails**: nombres de personas (según `guardrails.personNames`, por defecto ninguno), lo que es futuro y no presente, marcas y datos de demo.
- **Tabla de segmentos**: entre `video.segments.min` y `max` segmentos de 15–40 s, cada uno con una idea.

Si `guardrails.reviewBeforeTTS` es `true`: **para y enseña el briefing y la narración antes de generar audio.**

## 2. Narración: `narration.md`

```markdown
# Narration — <título>

## nombreSegmento
Frase. Otra frase.

Párrafo nuevo (pausa algo mayor).
```

- Un `## segmento` por segmento (camelCase, sin acentos). Lenguaje hablado, frases cortas, ritmo variado, en el idioma de `project.language`.
- Unas `video.wordsPerMinute` palabras por minuto (150 por defecto).
- Pronunciación: `{Texto en pantalla|cómo se dice}`, p. ej. `{IT|ái tí}`, `{API|a pe i}`.
- Silencio: un párrafo que sea solo `(pause 1.5)`. Úsalo al final del último segmento para que el cierre respire.
- Escribe los números como se dicen si hay ambigüedad ("veintiún agentes").
- Opcional: una línea `tts: edge|elevenlabs|kokoro|none` antes del primer `##` fuerza el motor para este vídeo.

## 3. Audio: `npm run audio`

```bash
npm run audio -- videos/<slug>             # todos los segmentos
npm run audio -- videos/<slug> cierre      # solo uno (los demás conservan sus tiempos)
npm run voice:check                        # prueba la voz configurada sin tocar el proyecto
```

Genera `audio/NN-seg.wav` y `audio/timings.json` con el inicio y fin de cada frase y palabra, y el volumen por fotograma. Las respuestas del TTS se guardan en `audio/.cache`, así que repetir no gasta créditos.

Motor `none`: audio en silencio con tiempos estimados. Sirve para maquetar sin red; cambia a un motor real antes del render final.

## 4. Prompts de escena: `prompts/`

- `prompts/_common.md`: la plantilla con slug, estilo, audiencia y duración rellenos.
- `prompts/NN-seg.md` por segmento: la narración con los tiempos de cada frase (`s0 · 0.00–6.52 · texto`) y el concepto visual beat a beat, cada uno atado a su palabra. Genera la parte de tiempos con un script que lea `timings.json`, no a mano.

El concepto visual es lo que separa un vídeo bonito de diapositivas animadas. Piensa en metáforas que se mueven: una red que se ilumina, una cola que se convierte en carriles paralelos, una app que se agrieta y de la que salen preguntas. Nada de listas de viñetas en pantalla. El texto en pantalla es un ancla de ≤ `guardrails.maxOnScreenWords` palabras y la voz lleva el detalle.

## 5. Escenas: `scenes/NN-seg.js`

```js
import { stage, rise, kicker, cuesFor, edges, bug, assets, e, W, H, T } from '../../../styles/<estilo>/kit.js';
let A;
export default {
  async setup(env) { A = await assets(env /*, ['01-pantalla.png'] */); },   // marca + capturas de assets/ui/
  draw(ctx, t, env) {                     // función pura de t: sin estado entre fotogramas
    const q = cuesFor(env);               // q.word('calidad'), q.s(2), q.wordIn(1, 'voz')
    stage(ctx, t);
    rise(ctx, 'Una frase', 120, 300, { size: 120, p: e(t, q.word('frase'), 0.6), accent: [1] });
    bug(ctx, A, { chapter: '01 · Capítulo' });
    edges(ctx, t, env.dur);
  },
};
```

- Usa `W`, `H` (vienen de la config: 16:9, 9:16 o 1:1) y nunca coordenadas fijas pensadas para otro formato.
- Colores y fuentes: `T.accent`, `T.text`, `T.soft`, `T.fontDisplay`… nunca hex sueltos, así la escena sirve para cualquier estilo.
- Escribe tú la primera escena (la apertura). Sirve de referencia de calidad para el resto.
- **Paraleliza** si tu agente lo permite: un subagente por cada 1–2 segmentos con su prompt (`_common.md` + `NN-seg.md`). Ninguno edita `styles/` mientras otros trabajan; si echan algo en falta, lo escriben local y lo reportan.
- Nombre del fichero = `NN-<segmento>.js`, donde NN es el orden en `narration.md`.

## 6. Revisión: fotogramas antes que vídeo

```bash
npm run stills -- videos/<slug> <seg> --stills 12            # 12 fotogramas repartidos
npm run stills -- videos/<slug> <seg> --at 1.2,5,9.8         # instantes concretos (≤ 16)
npm run stills -- videos/<slug> <seg> --stills 8 --style neon   # probar otro estilo
npm run preview -- videos/<slug> <seg> --serve               # reproductor con audio y scrub
```

Mira `review/<seg>/contact.png` y 2–4 fotogramas a tamaño completo. Comprueba: texto ≥ `guardrails.minTextPx` y dentro del cuadro, nada solapado, la marca de esquina sin tapar, una idea por beat, el visual cae en su palabra, nada quieto más de 1 s y el acento con moderación.

Si `guardrails.reviewStills` es `true`: **para y enseña las hojas de contactos antes del render final.**

## 7. Infografía: `infographic.json`

Escribe `videos/<slug>/infographic.json` a partir del briefing (esquema en `templates/video/infographic.json`): título con la palabra clave entre `*asteriscos*`, subtítulo, la idea, 2–4 cifras de la tabla de datos, 3–5 pasos y 2–4 bloques con icono. Mismas reglas de veracidad que el vídeo.

```bash
npm run infographic -- videos/<slug> [--format vertical|horizontal|square|a4] [--style <estilo>]
```

Sale `out/<slug>-infografia.png` (a doble densidad), `.pdf` y `.html`. Si el contenido no cabe, se reduce solo; si avisa de que ha bajado del 80 %, acorta textos.

## 8. Render y montaje

```bash
npm run build -- videos/<slug>          # render de todos los segmentos + montaje + infografía
# o por partes:
npm run render -- videos/<slug> all     # render/NN-seg.mp4, cada uno con su audio
npm run assemble -- videos/<slug>       # out/<slug>.mp4 + .srt/.vtt + chapters.txt
```

El montaje normaliza el volumen (`audio.loudness`), añade música con ducking si `audio.music` tiene una ruta, escribe subtítulos y capítulos y, si `outputs.burnSubtitles`, una copia con subtítulos incrustados. Un segmento de 30 s tarda 15–60 s en renderizar con los estilos 2D y 1–2 min en islas. Si cambias una escena, renderiza solo ese segmento y vuelve a montar.

## 9. Entrega

Informa: ruta del MP4 y su duración, infografía, subtítulos, y qué conviene revisar (pronunciaciones, datos de demo, decisiones tomadas). **Nada se publica ni se envía sin el OK de quien pidió el vídeo.**

## Capturas de una aplicación real

Si el vídeo enseña un producto, captura sus pantallas reales en el doble de la resolución del vídeo (viewport 1920×1080, `deviceScaleFactor: 2`) en `assets/ui/`. Junto a ellas va un `boxes.json` con las cajas de los elementos importantes, que las escenas usan para hacer zoom y resaltar (`browser()`, `viewFor()`, `viewLerp()`). Si no hay datos presentables, simula la API con `page.route()` y datos ficticios, y marca en pantalla "Datos de demostración".
