# CLAUDE.md — RN Quality Pipeline

> Este archivo se lee automáticamente al inicio de cada sesión.

## Sistema de calidad activo

Las skills viven en `plan/skills/`. Antes de cualquier acción, verificar el estado del pipeline:

```bash
# ▶ Verificando estado del pipeline anterior
ls plan/audit/ 2>/dev/null | tail -1
ls plan/codereview/ 2>/dev/null | tail -1
ls plan/ | grep pipeline
```

Si hay un MASTER-ROADMAP con items `- [ ]` sin resolver → continuar desde ahí.
Si no hay nada → empezar pipeline desde cero.

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

> ▶ Restaurando contexto de sesión anterior

Serena MCP: `find_files("plan/*MASTER-ROADMAP.md")` → leer el más reciente  
Serena MCP: `read_file("plan/BRIEFING.md")`
