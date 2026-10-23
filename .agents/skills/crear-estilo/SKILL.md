---
name: crear-estilo
description: Crea un estilo visual nuevo para los vídeos e infografías (paleta, tipografía, fondo animado, paneles, brillo) a partir de una descripción, unos colores, una guía de marca o una web, y genera su vista previa. Úsala cuando pidan "crea un estilo", "con los colores de nuestra marca", "un estilo tipo X", "quiero otro look", o cuando el estilo pedido para un vídeo no exista en styles/.
metadata: {"openclaw":{"requires":{"bins":["node"]},"emoji":"🎨"}}
---

# Crear un estilo

Un estilo es **datos** (`styles/<nombre>/theme.json`) más un `kit.js` opcional con piezas propias. Todas las escenas que usan tokens (`T.*`) lo adoptan sin cambios. Lee `docs/estilos.md` (galería, esquema de `theme.json` y tipos de fondo).

1. **Reúne la intención** en una sola pregunta si falta: nombre, tono (3 adjetivos), para qué tipo de vídeos, fondo claro u oscuro, y de dónde salen los colores (hex, guía de marca, web, logo). Si dan una web o un PDF de marca, extrae tú los colores (fondo, principal, acento) y las fuentes.
2. **Elige la base** más parecida (`--from`): `corporate` (keynote nocturno), `minimal` (aire y tipografía grande), `creativo` (malla de color, tipografía gruesa), `clasico` (papel y serif), `neon` (rejilla y brillo), `editorial` (revista), `pastel` (amable).
3. **Genera** sin preguntas interactivas:
   ```bash
   npm run new-style -- --yes --name <slug> --label "<Nombre>" --from <base> --mode dark|light \
     --bg "#rrggbb" --primary "#rrggbb" --accent "#rrggbb" \
     --display '<pila CSS de titulares>' [--body '<pila CSS de texto>'] \
     --stage night|clean|mesh|paper|grid|blocks|blobs --panel glass|solid|outline|card \
     --radius <px> --head-weight 300|400|600|700|900 --case none|upper --glow <0-3> \
     --tone "<adjetivos>" --best-for "<usos, separados por comas>" --description "<una frase>"
   ```
   El script deriva el resto de la paleta, comprueba el contraste (avisa si el texto baja de 4,5:1) y escribe `theme.json`, `kit.js`, `estilo.md` y `preview.png`.
4. **Mira `styles/<slug>/preview.png`**. Ajusta `theme.json` a mano si hace falta (colores derivados, `series` para gráficos, pesos) y regenera con `npm run style:preview -- <slug>`.
5. Si la marca usa una fuente propia, copia los ficheros a `styles/<slug>/fonts/` y decláralos en `theme.json → fonts.files` (`[{ "family", "src": "fonts/x.woff2", "weight" }]`). Comprueba la licencia de la fuente antes de subirla a un repo público.
6. Opcional: añade a `styles/<slug>/kit.js` 1–3 componentes distintivos (ver los de `styles/neon/kit.js` o `styles/clasico/kit.js`).
7. Para usarlo por defecto: `style` en `project.config.json`; para un vídeo: `style` en su `video.json`.

No uses logos ni nombres de marcas ajenas en el nombre del estilo si el repo va a ser público.
