# Video IA Generator

Las instrucciones del proyecto están en AGENTS.md (compartidas con Codex y OpenClaw):

@AGENTS.md

## Específico de Claude Code

- Skills del proyecto en `.claude/skills/` (copias de `.agents/skills/`; si editas una, ejecuta `npm run sync-skills`).
- Paraleliza las escenas con subagentes (herramienta Agent): uno por cada 1–2 segmentos, cada uno con `prompts/_common.md` + su `prompts/NN-seg.md`. Revisa tú cada hoja de contactos al recibirlas.
- Para ver fotogramas, lee los PNG de `videos/<slug>/review/` con la herramienta de lectura de ficheros.
