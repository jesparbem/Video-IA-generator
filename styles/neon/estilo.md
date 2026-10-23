# Estilo Neón tech

Rejilla en perspectiva tipo synthwave, líneas de escaneo, cian y magenta con mucho brillo, titulares en mayúsculas: tecnología, ciber y datos.

- **Tono**: futurista, técnico, intenso
- **Va bien para**: ciberseguridad, IA y datos, gaming, demos técnicas, eventos tech
- **Kit**: `styles/neon/kit.js` (= kit base + piezas propias). Tokens: `theme.json`. Vista previa: `preview.png`.
- **Paleta**: fondo `#05010f`, principal `#00e5ff`, acento `#ff2bd6`, texto `#e8fbff` (modo oscuro).

## Look

- Rejilla en perspectiva tipo synthwave con scanlines (`stage.kind: grid`).
- Titulares en MAYÚSCULAS con tracking; `glowText()` para el titular protagonista.
- Cian como principal, magenta como acento. `hudFrame()` para enmarcar datos o capturas; `typeLine()` para líneas de terminal.
- Paneles solo de contorno; brillo alto (`glow` 1,8).

## Movimiento

- Entradas rápidas con `outExpo`; `glitch(ctx, t, t0)` como corte puntual (≤ 0,25 s, como mucho uno por segmento).
- Los pulsos de `energyLine` corren más (`speed` 500–700).
- Parpadeo (`flicker`) solo en un elemento y muy breve.

## Comunes a todos los estilos

- Componentes del kit base: `stage`, `rise`, `kicker`, `panel`, `pill`, `kpi`, `node`, `energyLine`, `docGlyph`, `mark`, `wordmark`, `bug`, `edges` (referencia en `styles/corporate/estilo.md`). Leen este tema solos.
- Beats atados a palabras con `cuesFor(env)`. Texto ≥ 30 px, ≤ 8 palabras en pantalla, nada quieto más de 1 s.
- Colores solo con tokens (`T.*`, `ra()`), tamaño con `W`/`H`.
