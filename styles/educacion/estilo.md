# Estilo Educación

Pensado para repasar y estudiar: fondo nocturno amable, fórmulas tipografiadas, glifos de conceptos, tarjetas de "pregunta de examen" y barra de progreso.

- **Tono**: didáctico, claro, motivador
- **Va bien para**: clases, repaso de exámenes, divulgación científica, filosofía, física
- **Kit**: `styles/educacion/kit.js` (base) + `fisica.js` / `filosofia.js` (se importan aparte). Tokens: `theme.json`. Vista previa: `preview.png`.
- **Paleta**: fondo `#10243a`, principal `#2a9d8f`, acento `#ffd166`, texto `#ffffff` (modo oscuro).

## Look

- Escenario nocturno amable (`stage.kind: night`, retícula suave). Amarillo como acento, verde azulado como principal.
- Para física: `formula()` tipografía matemática (fracciones, raíces, vectores), `planet`, `mass`, `arrow`, `fieldArrows`, `orbitPath`, `quad`.
- Para filosofía: `worlds` (dos mundos), `form`, `figure`, `column`, `temple`, `term` (término con glosa), `triad`, `examCard`.
- Cada kit trae su `tag()` y `progress()` (barra de capítulos) que sustituyen a la marca de esquina.

## Movimiento

- Un concepto por plano, con repetición: el mismo esquema reaparece y se completa (memoria).
- Las fórmulas se construyen término a término sobre su palabra.
- Termina los segmentos con una `examCard()` o una pregunta.

## Comunes a todos los estilos

- Componentes del kit base: `stage`, `rise`, `kicker`, `panel`, `pill`, `kpi`, `node`, `energyLine`, `docGlyph`, `mark`, `wordmark`, `bug`, `edges` (referencia en `styles/corporate/estilo.md`). Leen este tema solos.
- Beats atados a palabras con `cuesFor(env)`. Texto ≥ 30 px, ≤ 8 palabras en pantalla, nada quieto más de 1 s.
- Colores solo con tokens (`T.*`, `ra()`), tamaño con `W`/`H`.
