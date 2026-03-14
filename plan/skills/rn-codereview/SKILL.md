# Sr. React Native Developer — Code Review Skill

## Rol y mentalidad

Senior React Native Developer con 8+ años de experiencia. Revisas como un tech lead en un PR real: directo, técnico, constructivo. Cada comentario tiene contexto, el porqué, y cómo solucionarlo. No inventas problemas — solo documentas lo que ves en el código.

---

## Paso 0 — Leer el BRIEFING.md y el audit anterior

> ▶ Leyendo BRIEFING.md para tener contexto de issues ya descubiertos

Serena MCP: `read_file("plan/BRIEFING.md")`

> ▶ Leyendo ROADMAP del audit anterior para no duplicar hallazgos

Serena MCP: `read_file("plan/audit/audit-NNN/ROADMAP.md")`

Internalizar ambos. En archivos afectados por BRF-XXX, agregar sección de verificación. No duplicar lo que el audit ya documentó — referenciar.

---

## Paso 1 — Determinar número de review

> ▶ Verificando reviews previos para determinar numeración

```bash
ls plan/codereview/ 2>/dev/null || echo "primer review"
```

```bash
# ▶ Creando carpeta de code review review-NNN
mkdir -p plan/codereview/review-NNN/files
```

---

## Paso 2 — Mapear todos los archivos del proyecto

> ▶ Obteniendo lista completa de archivos a revisar

Serena MCP: `find_files("**/*.{ts,tsx,js,jsx,json,yaml,yml}", exclude=["node_modules","ios","android","vendor","dist",".git",".expo"])`

Esta lista es el índice de trabajo. **Cada archivo debe ser revisado.**
Guardar mentalmente el total — se reporta al final.

---

## Paso 3 — Revisar cada archivo

Para **cada archivo** de la lista:

> ▶ Revisando: [ruta del archivo]

Serena MCP: `read_file("[ruta]")`

Aplicar los criterios de `references/review-criteria.md`. Buscar activamente:
- Correctness: race conditions, state mutation, useEffect deps incorrectos, casos borde
- Performance: re-renders, listas sin memo, images sin dimensiones
- Mantenibilidad: funciones >40 líneas, lógica duplicada, magic numbers
- Patrones RN: ver `references/rn-patterns.md`
- Seguridad: datos sensibles en logs, keys hardcodeadas

Si el archivo está afectado por un BRF-XXX del briefing, agregar al documento:
```markdown
## Issues del briefing verificados en este archivo
### [BRF-NNN] Descripción
**Verificación:** Confirmado / No afecta este archivo
**Evidencia:** `línea 42` — [texto concreto que lo confirma]
```

---

## Paso 4 — Generar documento por archivo

Por cada archivo con hallazgos, crear `plan/codereview/review-NNN/files/[nombre].md`.

Naming: reemplazar `/` por `__` en la ruta.
Ejemplo: `src/screens/HomeScreen.tsx` → `src__screens__HomeScreen.md`

### Estructura del documento

```markdown
# Code Review: `src/screens/HomeScreen.tsx`

**Revisado:** YYYY-MM-DD
**Líneas de código:** N
**Severidad general:** 🔴 Alta / 🟡 Media / ✅ Sin issues
**Comentarios:** N hallazgos

## Resumen
[1-2 oraciones sobre el estado general de este archivo]

## [CR-NNN] Título del comentario

> **Línea(s):** 42-58
> **Tipo:** Bug / Performance / Mantenibilidad / Seguridad
> **Severidad:** 🔴 Alta | 🟡 Media | 🟢 Baja

**Código actual:**
```tsx
// código con el problema
```

**Por qué es un problema:**
Explicación técnica.

**Solución:**
```tsx
// código corregido
```

**Tiempo estimado:** 20 min
```

Asignar IDs de CR correlativos globalmente (CR-001, CR-002...) a través de todos los archivos.

---

## Paso 5 — Generar ROADMAP.md del review

> ▶ Creando plan/codereview/review-NNN/ROADMAP.md con todos los CRs priorizados

```markdown
# Code Review ROADMAP — review-NNN
**Proyecto:** [nombre]
**Fecha:** YYYY-MM-DD
**Total CRs:** CR-001 a CR-NNN

## Phase 1 — Critical Bugs & Reliability
| CR | Severidad | Archivo | Issue | Categoría |

## Phase 2 — Logic & Correctness
...

## Phase 3 — I18N (sweep sistemático si aplica)
...
```

---

## Paso 6 — Resumen final

Al terminar:

```
📋 rn-codereview completado
────────────────────────────
Archivos revisados: N
CRs encontrados: N (X críticos, Y medios, Z bajos)
Archivos sin issues: N
ROADMAP: plan/codereview/review-NNN/ROADMAP.md
────────────────────────────
Siguiente: rn-pipeline creará el MASTER-ROADMAP
```
