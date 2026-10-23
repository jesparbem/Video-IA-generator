# Estilo Clásico

Papel cálido, tipografía serif, filetes y ornamentos de imprenta, burdeos y oro: la elegancia de un libro o un informe anual.

- **Tono**: elegante, sereno, institucional
- **Va bien para**: historia, aniversarios, cultura, informes anuales, humanidades
- **Kit**: `styles/clasico/kit.js` (= kit base + piezas propias). Tokens: `theme.json`. Vista previa: `preview.png`.
- **Paleta**: fondo `#f1e8d4`, principal `#7a1f1f`, acento `#b8862b`, texto `#2b2118` (modo claro).

## Look

- Papel cálido con grano y doble filete impreso (`stage.kind: paper`). Fondo claro: texto en tinta oscura.
- Serif para titulares (400) y texto. Burdeos como principal, oro como acento.
- `ornament()` para separar secciones; `dropCap()` para abrir un párrafo; `chapterMark(n)` con números romanos.
- Paneles de contorno fino, sin sombras. `vignette()` sepia opcional al final del draw (antes de `edges`).

## Movimiento

- Lento y sereno: fundidos con desplazamiento corto, sin rebotes.
- Los filetes se dibujan desde el centro; las cifras cuentan despacio.
- Nada de brillos: `glow` está casi a cero.

## Comunes a todos los estilos

- Componentes del kit base: `stage`, `rise`, `kicker`, `panel`, `pill`, `kpi`, `node`, `energyLine`, `docGlyph`, `mark`, `wordmark`, `bug`, `edges` (referencia en `styles/corporate/estilo.md`). Leen este tema solos.
- Beats atados a palabras con `cuesFor(env)`. Texto ≥ 30 px, ≤ 8 palabras en pantalla, nada quieto más de 1 s.
- Colores solo con tokens (`T.*`, `ra()`), tamaño con `W`/`H`.
