# Estilo Minimal keynote

Minimalismo de keynote de producto: fondo casi negro, mucho aire, tipografía grande y seminegrita, un único color de acento y movimiento muy suave.

- **Tono**: premium, limpio, contenido
- **Va bien para**: lanzamiento de producto, una sola idea fuerte, visión, anuncios
- **Kit**: `styles/minimal/kit.js` (= kit base + piezas propias). Tokens: `theme.json`. Vista previa: `preview.png`.
- **Paleta**: fondo `#000000`, principal `#2d2d33`, acento `#2997ff`, texto `#f5f5f7` (modo oscuro).

## Look

- Fondo casi negro (`stage.kind: clean`), sin retícula ni partículas: el aire es el diseño.
- Titulares grandes y seminegrita (600), 120–200 px, centrados. Una sola idea por plano.
- Un único acento azul. `gradientWord()` para la palabra "wow" de un plano, como mucho una vez por segmento.
- Paneles sólidos con radio 28, sin bordes llamativos. `spotlight()` detrás de un objeto protagonista.

## Movimiento

- Movimiento lento y preciso: `ease.inOutCubic`, entradas de 0,8–1,2 s. Nada rebota.
- `hairline()` para separar bloques; se dibuja desde el centro.
- Pocos elementos: si sobran, quítalos.

## Comunes a todos los estilos

- Componentes del kit base: `stage`, `rise`, `kicker`, `panel`, `pill`, `kpi`, `node`, `energyLine`, `docGlyph`, `mark`, `wordmark`, `bug`, `edges` (referencia en `styles/corporate/estilo.md`). Leen este tema solos.
- Beats atados a palabras con `cuesFor(env)`. Texto ≥ 30 px, ≤ 8 palabras en pantalla, nada quieto más de 1 s.
- Colores solo con tokens (`T.*`, `ra()`), tamaño con `W`/`H`.
