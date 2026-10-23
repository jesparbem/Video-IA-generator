# Estilo Pastel amable

Fondo crema con formas suaves, colores pastel, esquinas muy redondeadas y tipografía redonda: cercano y didáctico.

- **Tono**: cercano, optimista, didáctico
- **Va bien para**: formación, onboarding, RR. HH., público infantil o general, tutoriales
- **Kit**: `styles/pastel/kit.js` (= kit base + piezas propias). Tokens: `theme.json`. Vista previa: `preview.png`.
- **Paleta**: fondo `#fff8f1`, principal `#7c6cf2`, acento `#ff7a93`, texto `#3d3a50` (modo claro).

## Look

- Fondo crema con formas suaves en colores pastel (`stage.kind: blobs`). Fondo claro: texto oscuro.
- Tipografía redonda (700), esquinas muy redondeadas (32 px), tarjetas con sombra suave.
- `bubble()` para diálogos o preguntas; `stepBadge(n)` para pasos; `buddy()` como personaje guía.
- Iconos y colores de la serie pastel; el rosa de acento para destacar.

## Movimiento

- Rebote suave (`ease.spring` con amortiguación 0,5); todo flota un poco.
- Ritmo pausado y amable: un concepto por plano.
- El personaje reacciona a la narración (`mood: think` en preguntas).

## Comunes a todos los estilos

- Componentes del kit base: `stage`, `rise`, `kicker`, `panel`, `pill`, `kpi`, `node`, `energyLine`, `docGlyph`, `mark`, `wordmark`, `bug`, `edges` (referencia en `styles/corporate/estilo.md`). Leen este tema solos.
- Beats atados a palabras con `cuesFor(env)`. Texto ≥ 30 px, ≤ 8 palabras en pantalla, nada quieto más de 1 s.
- Colores solo con tokens (`T.*`, `ra()`), tamaño con `W`/`H`.
