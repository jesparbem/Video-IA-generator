# Estilo Creativo

Malla de color en movimiento, tipografía muy gruesa, pegatinas inclinadas y garabatos: energía de agencia creativa o de redes sociales.

- **Tono**: atrevido, juvenil, enérgico
- **Va bien para**: marketing, redes sociales, eventos, cultura interna, lanzamientos
- **Kit**: `styles/creativo/kit.js` (= kit base + piezas propias). Tokens: `theme.json`. Vista previa: `preview.png`.
- **Paleta**: fondo `#1a0b2e`, principal `#845ef7`, acento `#ffd43b`, texto `#ffffff` (modo oscuro).

## Look

- Malla de color en movimiento (`stage.kind: mesh`) con la serie de colores del tema.
- Tipografía muy gruesa (900). Mezcla tamaños extremos: una palabra enorme y el resto pequeño.
- `sticker()` inclinado para etiquetas y datos; `squiggle()` para subrayar; `burst()` para celebrar una cifra.
- Colores de la serie para categorías; el amarillo de acento para la palabra que importa.

## Movimiento

- Rebotes con `ease.spring` y `ease.outBack`; inclinaciones de ±4°.
- Ritmo rápido: cambios de plano cada 2–4 s.
- Nunca más de tres pegatinas a la vez.

## Comunes a todos los estilos

- Componentes del kit base: `stage`, `rise`, `kicker`, `panel`, `pill`, `kpi`, `node`, `energyLine`, `docGlyph`, `mark`, `wordmark`, `bug`, `edges` (referencia en `styles/corporate/estilo.md`). Leen este tema solos.
- Beats atados a palabras con `cuesFor(env)`. Texto ≥ 30 px, ≤ 8 palabras en pantalla, nada quieto más de 1 s.
- Colores solo con tokens (`T.*`, `ra()`), tamaño con `W`/`H`.
