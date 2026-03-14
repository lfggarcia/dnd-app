# CLAUDE.md — RN Quality Pipeline

> Este archivo se lee automáticamente al inicio de cada sesión.

## Sistema de calidad activo

Las skills viven en `plan/skills/`. **Antes de cualquier acción**, ejecutar este diagnóstico de estado en orden y detenerse en el primer caso que aplique:

### Diagnóstico de estado (ejecutar siempre al inicio)

> ▶ Determinando estado actual del pipeline

**Caso 1 — rn-fix en progreso (prioridad máxima)**
Serena MCP: `find_files("plan/*MASTER-ROADMAP.md")`
Si existe → Serena MCP: `read_file("plan/[MASTER-ROADMAP encontrado]")`
Si tiene items `- [ ]` sin resolver → **REANUDAR rn-fix desde el primer `- [ ]`**. No hacer nada más.

**Caso 2 — codereview completo, fix no iniciado**
Serena MCP: `find_files("plan/codereview/*/ROADMAP.md")`
Si existe y el MASTER-ROADMAP tiene todos `- [ ]` → **REANUDAR rn-fix desde Phase 1**.

**Caso 3 — audit completo, codereview no iniciado**
Serena MCP: `find_files("plan/audit/*/ROADMAP.md")`
Si existe pero no hay `plan/codereview/` → **REANUDAR desde rn-codereview**.

**Caso 4 — discover completo, audit no iniciado**
Serena MCP: `read_file("plan/BRIEFING.md")`
Si existe pero no hay `plan/audit/` → **REANUDAR desde rn-audit**.

**Caso 5 — sin trabajo previo**
Si ninguno de los casos anteriores aplica → **EMPEZAR pipeline desde rn-discover**.

> ⚠️ Nunca iniciar una fase que ya tiene su carpeta de output creada con contenido.
> La existencia de `plan/audit/audit-NNN/` con archivos = esa fase ya se ejecutó.

## Herramienta principal: Serena MCP

Usar **Serena MCP** para toda lectura y búsqueda de código:
- Leer archivos → `serena: read_file`
- Buscar patrones → `serena: search_code`
- Listar archivos → `serena: find_files`
- Navegar símbolos → `serena: find_symbol`

Reservar **bash** exclusivamente para:
- Operaciones de filesystem: `mkdir`, `cp`, `mv`
- Instalación de paquetes: `npm install`, `yarn add`
- Verificación de tipos: `npx tsc --noEmit`
- Medición de tamaño: `du -sh`
- Ejecución de tests: `npm test`
- Scripts de node para lógica que Serena no cubre

## Reglas permanentes

- **Editar archivos reales** — nunca describir cambios, aplicarlos
- **Estado en `plan/`** — si el contexto se compacta, releer los roadmaps
- **Excluir siempre**: `ios/`, `android/`, `node_modules/`, `vendor/`
- **Orden del pipeline**: discover → audit → codereview → fix
- **Antes de cada fix**: verificar que el problema aún existe en el archivo actual
- **Anunciar antes de actuar**: una línea de contexto antes de cada operación

## Cómo retomar después de compactación

Ejecutar el diagnóstico de estado de arriba — es exactamente para esto.
El estado completo del pipeline vive en `plan/`, no en la conversación.

Si necesitas contexto adicional de lo que se hizo en la sesión anterior:

> ▶ Restaurando contexto completo de sesión anterior

Serena MCP: `find_files("plan/*MASTER-ROADMAP.md")` → leer el más reciente
Serena MCP: `read_file("plan/BRIEFING.md")`
Serena MCP: `find_files("plan/fix-session/**/*.md")` → leer el SESSION-REPORT más reciente si existe
