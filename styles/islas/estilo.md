# Estilo islas (diorama isométrico)

El estilo con más efecto wow. Un mundo en miniatura de **islas flotantes** en isometría real, con edificios pequeños, personas, agentes que brillan y una cámara de dron que nunca se para. El color principal del tema va en señales y tejados, y el acento como energía: agentes, puentes de luz, haces. **Solo 16:9.**

- Motor isométrico (primitivas): `engine/iso.js`
- Mundo compartido: `styles/islas/islas.js`
- Base (cues, marca, wordmark): `styles/islas/kit.js` (= kit base)
- Ejemplo: `videos/demo-islas/scenes/01-archipielago.js`

## La idea

La organización es un archipiélago: cada área es una isla y cada aplicación una casa que brota en su isla. En el centro está el taller (la plataforma, con el nombre de `brand.product` en el cartel), de donde salen los agentes a construir sobre un plano (la especificación). **La luz cuenta la historia**: amanecer al principio, día mientras se construye, atardecer con los números y noche al final, con todo encendido.

Las islas se definen por vídeo en `video.json`:

```json
"islas": { "areas": [
  { "name": "Ventas", "apps": 5, "ang": 200, "size": 6 },
  { "name": "Tecnología y Comunicaciones", "short": "Tecnología", "apps": 4, "ang": 340, "size": 5.4 },
  { "name": "Otras áreas", "apps": 5, "ang": 160, "size": 0, "islets": true }
] }
```

`ang` es la posición en grados alrededor del centro (0 = derecha, sentido horario), `size` el tamaño de la isla y `islets: true` la dibuja como varios islotes.

## Proyección

- Coordenadas de mundo (x, y, z) a pantalla con `iso(x, y, z)` (tile 2:1, `U` = 56 px, `ZK` = 63 px por unidad de altura). x va abajo-derecha, y abajo-izquierda y z hacia arriba.
- Cámara: `isoCam(t, keys)` con fotogramas clave `{ t, x, y, z?, zoom }`. Interpola con suavizado, añade un balanceo leve y nunca está quieta. Zoom ≈ 0,45 = todo el archipiélago, 0,8 = una isla y su vecina, 2–2,5 = las personas.
- `toScreen(cam, x, y, z)` devuelve píxeles de pantalla para anclar etiquetas.

## Orden de dibujo de cada fotograma

1. `sky(ctx, t, luz)`: siempre lo primero, fija la luz de todo el fotograma (`'day'`, `'dusk'`, `'night'` o un número 0–2).
2. `camera(ctx, cam, () => { drawWorld(ctx, t, {...}); …objetos del mundo })`.
3. Etiquetas en pantalla: `tag()`, `bigTitle()`, `counterTag()`; `wordmark()`/`logo()` del kit tras `ctx.setTransform(1,0,0,1,0,0)`.
4. `brandBug(ctx, t, A, { chapter })` → `grain(ctx, t)` → `cloudEdges(ctx, t, env.dur)`. Los segmentos se unen atravesando nubes: el primero pasa `{first:true}` y el último `{last:true}`.

## El mundo compartido (`islas.js`)

- `AREAS`: islas de área (de `islas.areas` o las genéricas por defecto).
- `CENTRAL` + `taller()`: la isla y el edificio de la plataforma.
- `drawWorld(ctx, t, opciones)` lo dibuja todo, de atrás hacia delante. Los estados son funciones que reciben **el índice del área** (y de la casa):
  - `apps(i, casa) → 0..1`: cuánto ha brotado cada casa (con rebote).
  - `fresh(i, casa) → 0..1`: halo de acento al aterrizar.
  - `areaAlpha(i)`: visibilidad de cada isla. `chaos(i)`: colores dispares ("cada uno a su manera").
  - `central: { show, rise, beam, open }`: la isla central.
  - `extra(i)` / `extraCentral`: objetos propios que se ordenan con los del mundo.
- `lightBridge(ctx, t, a, b, { p })`: puente de luz en arco con pulsos (extremos con `centralDock(area)` y `dock(area)`).
- `specSheet()`: el plano brillante. `appHouse()`: una casa suelta. `AGENT`: color de los agentes (acento del tema).

## Primitivas útiles de `engine/iso.js`

`island`, `building`, `box`, `prism`, `tree`, `pine`, `bush`, `lamp`, `fence`, `serverRack`, `person`, `crowd`, `agentBot`, `trail`, `beacon`, `ping`, `glow`, `cloud`, `cloudWipe`, `sortDraw`, `along`, `tag`, `bigTitle`, `counterTag`.

## Reglas

- **Anclajes**: `building()` usa la esquina trasera. Árboles, personas y agentes, un punto del suelo. En `sortDraw` la clave es el centro de la huella.
- **Etiquetas fuera de la cámara**, posicionadas con `toScreen`, para que el texto mida lo que tiene que medir con cualquier zoom. Mínimo 30 px.
- **Rendimiento**: las islas se cachean, los edificios se dibujan en vivo. Casas de app baratas, `building()` caro: 4–8 edificios grandes por isla. Renderiza a unos 4 fotogramas/s por worker: itera con `--at` y pocos instantes.
- La cámara siempre se mueve. Máximo tres grupos protagonistas por plano.
- Nada de nombres de personas. Lo que es futuro se dibuja translúcido o con contorno discontinuo.
