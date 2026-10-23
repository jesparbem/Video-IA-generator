# Estilo corporate (keynote nocturno)

Kit: `styles/corporate/kit.js` (= kit base + `chapterRail`, `source`). Tokens: `theme.json`. Escenas de referencia: `videos/demo/scenes/`.

## Look

- **Escenario nocturno** `stage(ctx, t, {lightX, lightY})`: azul profundo, luz radial, una retícula de puntos tenue que sugiere red, y partículas a la deriva. Es el fondo por defecto.
- **Escenario de día** `dayStage()`: blanco con un velo del color principal, para enseñar producto. Del día a la noche se pasa con un fundido circular o un `sweep()` del color de acento.
- **Tipografía**: titulares ligeros (`T.wHead` = 300), 90–160 px, en minúscula de frase. La palabra que importa va en acento (`accent: [i]` en `rise`). Etiquetas en `T.wLabel`, 30–40 px. Antetítulos con `kicker()`. Nunca por debajo de 30 px salvo la marca de esquina y avisos legales.
- **El acento es energía, no decoración**: pulsos por líneas (`energyLine`), chispas (`spark`), el nodo activo, la palabra destacada, el anillo que resalta una captura. Si todo es acento, nada lo es. Líneas y texto secundario en `T.soft`, texto principal en `T.text`.
- **Paneles de cristal** `panel()` sobre la noche; tarjetas blancas (`panel(..., {day:true})`) sobre el día.
- **Marca**: `bug(ctx, A, {chapter})` en todos los segmentos (producto arriba a la izquierda, logo abajo a la derecha si está en la config). `wordmark()` construye símbolo + nombre del producto; `logo()` el logo completo. Las imágenes de marca solo se mueven, escalan y rotan.
- **Vocabulario recurrente**: agentes de IA = `agentDot()`; documento = `docGlyph()`; pasos = `node()`; resultado = `mark()` (✓ o ✗); cifras = `kpi()` con conteo; etiquetas = `pill()`; capturas reales = `browser()` con `viewFor()`/`viewLerp()`.

## Movimiento

- Los titulares **suben** palabra a palabra tras una máscara: `rise()` con `p` para entrar y `out` para salir. Las cosas aparecen con rebote (`ease.outBack`) y se desplazan con `outCubic`/`inOutCubic`. Nada aparece con un simple fundido desde la nada.
- Vida continua: los pulsos viajan, el nodo activo late, las partículas derivan. Nada quieto más de 1 s.
- Cada beat atado a la narración con `cuesFor(env)`: `q.s(i)`, `q.word('palabra')`, `q.wordIn(i, 'palabra')`.
- Máximo tres grupos en pantalla. Cuando llega el beat siguiente, el anterior sale.
- `edges(ctx, t, env.dur)` al final de cada `draw`: funde desde y hacia `T.deep`, así los cortes no se notan.

## Referencia rápida del kit base

| Función | Para qué |
|---|---|
| `assets(env, ['x.png'])` | marca de la config + capturas de `assets/ui/` + `boxes.json` (en `setup`) |
| `stage`, `dayStage`, `edges`, `bug` | fondo, fundidos de borde, marca de esquina |
| `rise`, `text`, `kicker`, `measure`, `wrapLines`, `font` | tipografía |
| `symbol`, `logo`, `wordmark` | marca |
| `energyLine`, `spark`, `pointAt` | energía: líneas con pulsos, chispas |
| `panel`, `pill`, `kpi`, `node`, `agentDot`, `docGlyph`, `mark` | componentes |
| `browser`, `viewFor`, `viewLerp` | capturas de producto con zoom y foco |
| `sweep` | transición diagonal del color de acento |
| `cuesFor`, `e`, `ease`, `clamp`, `lerp`, `rng`, `noise` | tiempo y matemáticas (`e()` vale 0 exacto antes del inicio) |
| `T`, `ra`, `mixc`, `isLight`, `W`, `H` | tokens del tema, colores con alfa, mezcla, modo, tamaño |
