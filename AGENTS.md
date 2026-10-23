# Video IA Generator — instrucciones para agentes

Este repositorio produce **vídeos narrados animados en código** y su **infografía explicativa**. Cada fotograma lo dibuja JavaScript sobre un canvas, sincronizado al milisegundo con la voz en off. No hay plantillas de vídeo ni imágenes generadas: el agente escribe una escena por segmento.

Quien lo usa pide algo como "hazme un vídeo de 2 minutos explicando X a partir de este documento" y tú, el agente, ejecutas el procedimiento completo.

- Procedimiento paso a paso: `docs/playbook.md` (léelo entero antes del primer vídeo).
- Configuración del proyecto: `project.config.json` (idioma, formato, estilo, voz, marca, salidas, guardrails). Cada vídeo la sobrescribe en `videos/<slug>/video.json`. Referencia: `docs/configuracion.md`.
- Estilos: `docs/estilos.md` (galería y cuándo usar cada uno) y `styles/<estilo>/estilo.md`.
- Skills empaquetadas: `.agents/skills/` → `crear-video`, `crear-estilo`, `crear-infografia`.

## Primer uso en una máquina

1. `npm run doctor`. Si falla algo, sigue la instrucción que imprime (o `docs/instalacion.md`).
2. Si `project.config.json` está con los valores por defecto y la persona no lo ha configurado, propón `npm run init` (asistente interactivo; con `-- --yes` acepta valores por defecto). Si no puedes usar una terminal interactiva, pregunta tú lo esencial (idioma, formato, estilo, voz, marca) y edita `project.config.json`.
3. `npm run demo` renderiza `videos/demo/` de punta a punta: prueba que todo funciona.

## Estructura

```
engine/              motor: render.mjs (Playwright → fotogramas → ffmpeg) · audio.py (TTS + tiempos por palabra)
                     assemble.mjs (MP4 + subtítulos + capítulos + música) · infographic.mjs · frame.html
                     runtime.js (utilidades de dibujo y tiempo) · iso.js (motor isométrico)
                     init / new-video / new-style / style-preview / build / doctor (.mjs)
styles/_base/        theme.js (tokens del tema) · kit.js (componentes que leen el tema al dibujar)
styles/<estilo>/     theme.json (datos del estilo) · kit.js (reexporta la base + piezas propias) · estilo.md · preview.png
templates/video/     esqueleto de un vídeo nuevo (briefing, narración, prompt común, infographic.json)
videos/<slug>/       un vídeo: video.json · briefing.md · narration.md · infographic.json · prompts/ · scenes/
                     fuente/ · assets/ · audio/ · out/   (review/ y render/ son regenerables, ignorados por git)
```

## Reglas que no se negocian

1. **Primero el audio.** Narración → `npm run audio` → `audio/timings.json` → escenas. Nunca se anima a tiempos supuestos. Si cambia la narración, se regenera el audio y se revisan las escenas afectadas.
2. **Una escena por segmento, función pura del tiempo** (`draw(ctx, t, env)` sin estado entre fotogramas). Lo compartido vive en `styles/` o `engine/`, no se copia entre escenas.
3. **Cada beat cae en su palabra**: `cuesFor(env)` (`q.word('calidad')`, `q.s(2)`), no segundos fijos.
4. **Sin colores ni tamaños fijos en las escenas**: tokens del tema (`T.accent`, `T.text`, `T.fontDisplay`…) y `W`/`H`. Así cualquier vídeo cambia de estilo o de formato sin reescribirse.
5. **Se revisan fotogramas antes de renderizar** (`npm run stills`). Texto ≥ 30 px, nada solapado, nada quieto más de 1 s.
6. **Marca**: solo los ficheros indicados en `brand.*` (se pueden mover, escalar y rotar; nunca deformar ni recolorear). El repositorio no trae logos de nadie.
7. **Veracidad**: solo cifras y hechos que estén en el material fuente, recogidos en `briefing.md`. Nada de nombres de personas salvo que `guardrails.personNames` sea `true` o se pida explícitamente. Lo que es futuro se cuenta como futuro. La infografía sigue las mismas reglas.
8. **Paradas de revisión**: guion antes de gastar voz (`guardrails.reviewBeforeTTS`) y fotogramas antes del render (`guardrails.reviewStills`).
9. **Nada se publica ni se envía** sin el OK de quien pidió el vídeo.
10. **Secretos**: las claves solo en `.env` (ignorado por git). Nunca en `project.config.json`, `video.json`, commits ni en la salida de la terminal.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run init` | asistente: pregunta todo lo parametrizable y escribe `project.config.json` |
| `npm run doctor` | comprueba Node, ffmpeg, Python, Playwright, navegador, config (`-- --voice` prueba la voz) |
| `npm run new-video -- <slug> [--style s]` | crea `videos/<slug>/` desde la plantilla |
| `npm run new-style` | crea un estilo (interactivo, o por flags: ver `engine/new-style.mjs`) y su preview |
| `npm run audio -- videos/<slug> [seg]` | voz + `timings.json` |
| `npm run stills -- videos/<slug> <seg> --stills 12` | hoja de contactos para revisar |
| `npm run build -- videos/<slug>` | render + montaje (+ subtítulos, capítulos, música) + infografía |
| `npm run infographic -- videos/<slug>` | solo la infografía |
| `npm run style:preview -- <estilo\|all>` | `styles/<estilo>/preview.png` con la demo |

## Requisitos de la máquina

Node 20+, Python 3.10+, ffmpeg y un navegador Chromium (el de Playwright o Edge/Chrome instalados). Instalación: `docs/instalacion.md`.
