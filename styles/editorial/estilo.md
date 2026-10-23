# Estilo Editorial

Revista: serif de alto contraste para titulares, sans para el texto, bloques de color planos, numerales gigantes y citas destacadas.

- **Tono**: periodístico, culto, con criterio
- **Va bien para**: análisis, tendencias, informes, storytelling con datos, opinión
- **Kit**: `styles/editorial/kit.js` (= kit base + piezas propias). Tokens: `theme.json`. Vista previa: `preview.png`.
- **Paleta**: fondo `#f7f4ef`, principal `#111111`, acento `#e63946`, texto `#111111` (modo claro).

## Look

- Fondo de papel claro con cabecera negra y filete rojo (`stage.kind: blocks`), rayado de periódico.
- Serif de alto contraste (700) para titulares, sans para texto y etiquetas.
- `bigNumeral()` para cifras gigantes; `pullQuote()` para citas; `rubric()` para secciones ("ANÁLISIS"); `columnRule()` para columnas.
- Composición asimétrica: alinea a la izquierda en una retícula de columnas; deja aire a la derecha.

## Movimiento

- Movimiento sobrio: máscaras que revelan (`bigNumeral` sube tras máscara), sin rebotes.
- Un dato por plano, con su fuente en pequeño.
- El rojo de acento solo para la cifra o la palabra clave.

## Comunes a todos los estilos

- Componentes del kit base: `stage`, `rise`, `kicker`, `panel`, `pill`, `kpi`, `node`, `energyLine`, `docGlyph`, `mark`, `wordmark`, `bug`, `edges` (referencia en `styles/corporate/estilo.md`). Leen este tema solos.
- Beats atados a palabras con `cuesFor(env)`. Texto ≥ 30 px, ≤ 8 palabras en pantalla, nada quieto más de 1 s.
- Colores solo con tokens (`T.*`, `ra()`), tamaño con `W`/`H`.
