# Instalar y usar con tu IA: prompts para copiar y pegar

Cada bloque es un prompt completo. Ábrelo en una carpeta vacía donde quieras instalar el proyecto (o en la carpeta del repo si ya lo has clonado), pega el bloque entero y deja que el agente lo haga. Todos siguen el mismo patrón: **analiza → instala → comprueba → configura → demo**, y paran antes de cualquier acción que gaste dinero o publique algo.

- [Claude Code](#claude-code)
- [OpenAI Codex (CLI, IDE o app)](#openai-codex)
- [OpenClaw](#openclaw)
- [Cualquier otro agente con terminal](#cualquier-otro-agente)

---

## Claude Code

Claude Code lee `CLAUDE.md` (que importa `AGENTS.md`) y las skills de `.claude/skills/`.

```text
Quiero instalar y empezar a usar "Video IA Generator" (https://github.com/jesparbem/Video-IA-generator),
un generador de vídeos narrados animados en código con infografía. Hazlo paso a paso:

1. ANALIZA antes de ejecutar: comprueba mi sistema operativo y si tengo git, Node 20+, Python 3.10+ y ffmpeg
   (dime las versiones). Si falta algo, dime el comando exacto para instalarlo en mi sistema y espera mi OK.
2. Si esta carpeta no contiene ya el repo, clónalo aquí: git clone https://github.com/jesparbem/Video-IA-generator.git
   y trabaja dentro de Video-IA-generator.
3. Instala dependencias: npm install · npx playwright install chromium (si falla por la red, configura
   render.browserChannel = "msedge" o "chrome") · crea .venv con Python e instala requirements.txt con el pip de .venv.
4. Lee CLAUDE.md, AGENTS.md, docs/playbook.md y docs/estilos.md.
5. Ejecuta npm run doctor y arregla lo que falle.
6. Configuración: hazme TÚ las preguntas de npm run init (idioma, formato, estilo o crear uno nuevo, marca y logos,
   motor de voz, música, salidas, guardrails, render) agrupadas en pocas preguntas, y escribe project.config.json.
   No me pidas claves en el chat: si elijo ElevenLabs, dime que pegue la clave yo mismo en .env.
7. Ejecuta npm run demo y enséñame videos/demo/out/ (MP4, subtítulos e infografía) y styles/*/preview.png.
8. Resume qué has instalado y cómo pido mi primer vídeo con la skill crear-video.
No hagas commits, no publiques nada y no instales nada global sin preguntarme.
```

Para el primer vídeo, después:

```text
Usa la skill crear-video. Quiero un vídeo de ~2 minutos para <audiencia> explicando <tema>,
a partir de este documento: <ruta>. Estilo <estilo> (o recomiéndame uno). Formato <16:9 | 9:16 | 1:1>.
```

---

## OpenAI Codex

Codex lee `AGENTS.md` de la raíz del repo y descubre las skills de `.agents/skills/` automáticamente (invócalas con `$crear-video`, `$crear-estilo`, `$crear-infografia` o en lenguaje natural). Necesita permiso de red para `npm install`, `pip` y la voz: arranca con un modo que lo permita (p. ej. `codex --sandbox workspace-write` y aprueba las peticiones de red) o hazlo en una sesión con acceso completo.

```text
Quiero instalar y empezar a usar "Video IA Generator" (https://github.com/jesparbem/Video-IA-generator),
un generador de vídeos narrados animados en código con infografía. Sigue estos pasos y pide aprobación
cuando necesites red o salir del directorio:

1. ANALIZA antes de ejecutar: sistema operativo y versiones de git, Node (>= 20), Python (>= 3.10) y ffmpeg.
   Si falta algo, dame el comando de instalación para mi sistema y espera a que lo confirme.
2. Si el repo no está en esta carpeta: git clone https://github.com/jesparbem/Video-IA-generator.git y entra en ella.
3. npm install · npx playwright install chromium (si la red lo bloquea, pon "browserChannel": "msedge" o "chrome"
   en project.config.json → render) · python -m venv .venv · instala requirements.txt con el pip de .venv.
4. Lee AGENTS.md (instrucciones del proyecto), docs/playbook.md, docs/estilos.md y las skills de .agents/skills/.
5. npm run doctor y corrige lo que falle.
6. Configuración: npm run init es interactivo; si no puedes usarlo, hazme tú sus preguntas (idioma, formato, estilo
   o crear uno, marca/logos, voz, música, salidas, guardrails, render) en pocas preguntas y edita project.config.json.
   Nunca me pidas claves en el chat ni las escribas fuera de .env.
7. npm run demo y enséñame lo generado en videos/demo/out/ y styles/*/preview.png.
8. Explícame cómo pedir mi primer vídeo con $crear-video.
Sin commits, sin publicar nada y sin instalaciones globales sin mi OK.
```

Primer vídeo:

```text
$crear-video Vídeo de ~2 minutos para <audiencia> sobre <tema> a partir de <ruta>. Estilo <estilo>. Formato <16:9|9:16|1:1>.
```

---

## OpenClaw

OpenClaw sigue la especificación AgentSkills: carga skills de `<workspace>/skills`, `<workspace>/.agents/skills` y `~/.agents/skills`, entre otras. Si el repo es tu workspace, las skills de `.agents/skills/` se cargan solas. Si no, instálalas desde el repo con `openclaw skills install`.

```text
Quiero instalar y empezar a usar "Video IA Generator" (https://github.com/jesparbem/Video-IA-generator),
un generador de vídeos narrados animados en código con infografía.

1. ANALIZA primero: sistema operativo y versiones de git, Node (>= 20), Python (>= 3.10) y ffmpeg. Si falta algo,
   dime cómo instalarlo y espera mi confirmación.
2. Clona el repo en mi carpeta de proyectos: git clone https://github.com/jesparbem/Video-IA-generator.git
3. Haz que sus skills estén disponibles: si el repo no es tu workspace, instala las tres skills
   (crear-video, crear-estilo, crear-infografia) desde su carpeta .agents/skills con
   openclaw skills install <ruta-al-repo>/.agents/skills/<skill> --as <skill>
   y comprueba con openclaw skills verify <skill>. Todas las órdenes de esas skills se ejecutan dentro del repo.
4. Dentro del repo: npm install · npx playwright install chromium (o "browserChannel": "msedge"/"chrome" en
   project.config.json si la red lo bloquea) · python -m venv .venv · instala requirements.txt con el pip de .venv.
5. Lee AGENTS.md, docs/playbook.md y docs/estilos.md. Ejecuta npm run doctor y corrige lo que falle.
6. Hazme las preguntas de configuración de npm run init (idioma, formato, estilo o crear uno, marca, voz, música,
   salidas, guardrails, render) en pocos mensajes y escribe project.config.json. Las claves solo en .env, nunca en el chat.
7. npm run demo y envíame el MP4 y la infografía de videos/demo/out/ (si el canal lo permite, como adjuntos).
8. Dime cómo pedirte el primer vídeo.
Sin publicar nada ni instalar nada global sin mi OK.
```

Primer vídeo (desde cualquier canal conectado a OpenClaw):

```text
Usa crear-video: vídeo de ~2 min para <audiencia> sobre <tema>, a partir del documento adjunto. Estilo <estilo>.
Párate a enseñarme el guion antes de generar la voz.
```

---

## Cualquier otro agente

Cualquier agente con terminal y lectura de ficheros sirve (Gemini CLI, Cursor, Copilot agent, Aider…): todo el conocimiento está en `AGENTS.md`, `docs/playbook.md` y `.agents/skills/*/SKILL.md`, y todo se ejecuta con `npm run …`.

```text
Instala y prueba "Video IA Generator" (https://github.com/jesparbem/Video-IA-generator). Analiza primero mi sistema
(git, Node 20+, Python 3.10+, ffmpeg) y espera mi OK si falta algo. Clona el repo, sigue docs/instalacion.md,
lee AGENTS.md y docs/playbook.md, ejecuta npm run doctor y npm run demo, y hazme las preguntas de npm run init
para configurar project.config.json. Las claves solo en .env. Sin commits ni publicaciones sin mi OK.
```
