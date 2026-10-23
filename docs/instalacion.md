# Instalación

Tiempo: 10–15 minutos. Funciona en Windows, macOS y Linux.

## 1. Requisitos del sistema

| Herramienta | Versión | Windows | macOS | Linux (Debian/Ubuntu) |
|---|---|---|---|---|
| Git | cualquiera | `winget install Git.Git` | `xcode-select --install` | `sudo apt install git` |
| Node.js | 20 o superior | `winget install OpenJS.NodeJS.LTS` | `brew install node` | `sudo apt install nodejs npm` (o nvm) |
| Python | 3.10 o superior | `winget install Python.Python.3.12` | `brew install python` | `sudo apt install python3 python3-venv` |
| ffmpeg | 6 o superior | `winget install Gyan.FFmpeg` | `brew install ffmpeg` | `sudo apt install ffmpeg` |

Cierra y vuelve a abrir la terminal después de instalar para que el `PATH` se actualice.

## 2. Descargar e instalar dependencias

```bash
git clone https://github.com/jesparbem/Video-IA-generator.git
cd Video-IA-generator

npm install
npx playwright install chromium          # navegador para renderizar (o usa Edge/Chrome, ver abajo)

python -m venv .venv                     # macOS/Linux: python3 -m venv .venv
# Windows:      .venv\Scripts\python -m pip install -r requirements.txt
# macOS/Linux:  .venv/bin/python -m pip install -r requirements.txt
```

No hace falta activar el entorno: los comandos `npm run …` usan `.venv` solos.

## 3. Configurar el proyecto

```bash
npm run init        # asistente: idioma, formato, estilo (o crear uno), marca, voz, audio, salidas, guardrails, render
npm run doctor      # comprueba que todo está bien; -- --voice además prueba la voz
npm run demo        # genera videos/demo/out/demo.mp4 + subtítulos + infografía (≈ 2 min)
```

`npm run init` crea `.env` desde `.env.example` sin valores. Solo hay que rellenarlo si usas ElevenLabs (u otro servicio con clave). Las claves no se escriben nunca en `project.config.json`.

## 4. Marca propia (opcional)

Copia tus logos a `brand/` (está en `.gitignore`, así no se suben) y apunta a ellos en `npm run init` o en `project.config.json → brand`:

```json
"brand": { "name": "Mi Empresa", "product": "Mi Programa", "logo": "brand/logo-blanco.png", "logoOnLight": "brand/logo-color.png", "symbol": "brand/simbolo.png", "showBug": true }
```

Si la marca usa una tipografía propia, créale un estilo (`npm run new-style`) y declara los ficheros en `theme.json → fonts.files`.

## 5. Abrirlo con tu agente

Abre la carpeta con Claude Code, OpenAI Codex u OpenClaw y pide un vídeo. Prompts listos para copiar: [`INSTALL-PROMPTS.md`](INSTALL-PROMPTS.md).

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `npx playwright install` falla o tarda eternamente | la red corporativa bloquea la descarga | `npm run init` → navegador "Microsoft Edge instalado", o `PW_CHANNEL=msedge` en `.env` |
| `pip` dice `Could not find a suitable TLS CA certificate bundle, invalid path …` | una variable `REQUESTS_CA_BUNDLE`/`CURL_CA_BUNDLE` apunta a un fichero que no existe | corrige la variable, o ejecuta pip sin ella: PowerShell `Remove-Item Env:REQUESTS_CA_BUNDLE; Remove-Item Env:CURL_CA_BUNDLE` y repite |
| Node avisa `Ignoring extra certs from …` | `NODE_EXTRA_CA_CERTS` apunta a un fichero que no existe | es solo un aviso; corrige o borra la variable |
| Edge TTS da error SSL detrás de un proxy corporativo | inspección TLS | `truststore` (ya en `requirements.txt`) usa los certificados del sistema; si persiste, usa `tts.engine: "none"` para maquetar |
| `ffmpeg` no encontrado | no está en el `PATH` | reinstala con el gestor de paquetes y abre una terminal nueva |
| El texto sale en Arial | la fuente del estilo no está instalada | instala la fuente o declara sus ficheros en `theme.json → fonts.files` |
| El render va lento | demasiados o pocos workers | ajusta `render.workers` (≈ núcleos − 2) en `npm run init` |
