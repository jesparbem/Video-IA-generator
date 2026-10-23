# Brief común para cada autor de escena — <TÍTULO DEL VÍDEO>

Escribes UNA o DOS escenas en canvas para un vídeo narrado (~<DURACIÓN>, idioma <IDIOMA>) sobre <TEMA>. Audiencia: <AUDIENCIA>. Estilo: `<estilo>`. Listón de calidad: motion graphics de keynote, pulidos, con vida continua.

## Lee primero (en este orden)
1. `styles/<estilo>/estilo.md`: reglas visuales del estilo.
2. `styles/<estilo>/kit.js` y `styles/_base/kit.js`: todos los componentes disponibles. No reimplementes lo que ya existe. Si necesitas algo genérico, escríbelo local al principio de tu escena y menciónalo en el informe. NO edites nada de `styles/`, porque otros autores trabajan en paralelo.
3. `videos/<slug>/scenes/01-<apertura>.js`: escena de referencia (estructura, cues, capas). Más ejemplos: `videos/demo/scenes/` (y `videos/demo-islas/` para islas).
4. `videos/<slug>/briefing.md`: datos y guardrails.
5. Tu prompt de segmento, `prompts/NN-seg.md`: narración con tiempos exactos y concepto visual. El concepto es una sugerencia fuerte. Mejóralo si encuentras algo mejor, pero cada beat va atado a su palabra.

## Contrato de escena
```js
import { … } from '../../../styles/<estilo>/kit.js';
let A;
export default {
  async setup(env) { A = await assets(env /*, ['01-pantalla.png'] */); },
  draw(ctx, t, env) { /* función pura de t, sin estado entre fotogramas */ },
};
```
Fichero: `videos/<slug>/scenes/NN-seg.js`. `env.dur` = duración del segmento con la cola. Tamaño: `W`×`H` del kit (no lo supongas). Colores y fuentes: tokens `T.*`, nunca hex sueltos. Beats: `cuesFor(env)` (`q.word('palabra')`, `q.s(i)`, `q.wordIn(i, 'palabra')`), nunca segundos fijos salvo pequeños desfases.

## Bucle (desde la raíz del repo)
- `npm run stills -- videos/<slug> <seg> --stills 12` (o `--at 1.2,5,9.8`, ≤ 16 instantes) genera `review/<seg>/contact.png` y los fotogramas sueltos.
- En cada ronda mira la hoja de contactos y 2–4 fotogramas a tamaño completo. Comprueba: texto ≥ 30 px y dentro del cuadro, nada solapado ni cortado, la marca de esquina sin tapar, una idea por beat, el visual cae en su palabra, nada quieto más de 1 s, acento con moderación, márgenes ≥ 100 px.
- Haz de 3 a 6 rondas. Para cuando esté de verdad a nivel de presentación. No renderices el vídeo (lo hace el agente principal).

## Informe (corto)
Ficheros escritos, rondas hechas, lo que no hayas podido resolver y cualquier componente local que merezca pasar al kit.
