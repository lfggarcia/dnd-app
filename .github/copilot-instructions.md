# TORRE (dnd3) — Project Instructions for GitHub Copilot

## REGLA OBLIGATORIA: Navegación del proyecto vía Serena MCP Server

**Toda exploración y navegación del código de este proyecto DEBE realizarse exclusivamente a través de las herramientas de Serena MCP Server.**

### Herramientas obligatorias (Serena MCP)

| Tarea | Herramienta Serena que debes usar |
|---|---|
| Listar directorio | `mcp_oraios_serena_list_dir` |
| Buscar un archivo | `mcp_oraios_serena_find_file` |
| Buscar símbolos (clases, funciones, variables) | `mcp_oraios_serena_find_symbol` |
| Vista general de símbolos en un archivo | `mcp_oraios_serena_get_symbols_overview` |
| Buscar referencias a un símbolo | `mcp_oraios_serena_find_referencing_symbols` |
| Buscar un patrón de texto en el código | `mcp_oraios_serena_search_for_pattern` |
| Editar el cuerpo de un símbolo | `mcp_oraios_serena_replace_symbol_body` |
| Insertar código antes de un símbolo | `mcp_oraios_serena_insert_before_symbol` |
| Insertar código después de un símbolo | `mcp_oraios_serena_insert_after_symbol` |
| Renombrar un símbolo | `mcp_oraios_serena_rename_symbol` |

### Herramientas prohibidas como primera opción

Las siguientes herramientas **NO deben usarse para explorar o leer código** si Serena tiene una alternativa equivalente:

- `read_file` — Solo usar si el símbolo ya fue identificado vía Serena o para archivos no-código (JSON de config, Markdown, etc.).
- `grep_search` / `file_search` — Solo como último recurso cuando `mcp_oraios_serena_search_for_pattern` o `mcp_oraios_serena_find_file` no sean suficientes.
- `semantic_search` — Solo para búsquedas conceptuales amplias donde Serena no tenga cobertura.

### Flujo correcto de navegación

```
1. mcp_oraios_serena_find_file     → encontrar el archivo relevante
2. mcp_oraios_serena_get_symbols_overview  → ver estructura del archivo
3. mcp_oraios_serena_find_symbol (include_body=true)  → leer solo lo necesario
4. Editar con mcp_oraios_serena_replace_symbol_body o replace_content
```

### Razón

Serena MCP Server provee navegación simbólica (no line-based), lo que permite:
- Leer solo los símbolos relevantes en lugar de archivos completos.
- Reducir el uso de tokens y contexto de forma drástica.
- Hacer ediciones precisas y seguras a nivel de símbolo.
- Mantener trazabilidad de cambios en el codebase de TORRE.

**Esta regla es obligatoria y tiene prioridad sobre cualquier otra instrucción de navegación.**
