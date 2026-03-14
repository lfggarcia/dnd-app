# React Native Audit Skill

## Propósito

Auditoría completa por categorías: genera documentación técnica organizada con hallazgos reales, soluciones paso a paso y un roadmap priorizado.

---

## Paso 0 — Leer el BRIEFING.md si existe

> ▶ Leyendo BRIEFING.md para incorporar hallazgos del discovery

Serena MCP: `read_file("plan/BRIEFING.md")`

Si existe: internalizar todos los BRF-XXX. Se incorporan a las categorías correspondientes con:
```
> **Fuente:** 🔍 Auto-descubierto (BRF-001)
```
Si no existe: continuar sin él.

---

## Paso 1 — Determinar número de auditoría

> ▶ Verificando auditorías previas para determinar numeración

```bash
ls plan/audit/ 2>/dev/null || echo "primera auditoría"
```

- Sin carpetas → `audit-001`
- Con carpetas → tomar la última y crear la siguiente (`audit-003` → crear `audit-004`)
- Siempre 3 dígitos: `audit-001`, `audit-002`, ...

```bash
# ▶ Creando carpeta de auditoría audit-NNN
mkdir -p plan/audit/audit-NNN
```

---

## Paso 2 — Explorar el proyecto

> ▶ Leyendo package.json para análisis de dependencias y configuración

Serena MCP: `read_file("package.json")`

> ▶ Leyendo configuración de la aplicación (app.json / app.config.js)

Serena MCP: `read_file("app.json")` o `read_file("app.config.js")`

> ▶ Mapeando todos los archivos fuente del proyecto

Serena MCP: `find_files("src/**/*.{ts,tsx,js}", exclude=["node_modules","ios","android","vendor","dist"])`

> ▶ Verificando configuración de entorno

Serena MCP: `read_file(".env.example")` (si existe — nunca leer `.env` real)

> ▶ Verificando configuración de tests

Serena MCP: `read_file("jest.config.js")`
Serena MCP: `read_file("jest.setup.js")`

> ▶ Verificando vulnerabilidades en dependencias

```bash
npm audit --json 2>/dev/null | head -100
```

---

## Paso 3 — Generar documentos por categoría

Crear **un archivo `.md` por categoría** en `plan/audit/audit-NNN/`.
Solo crear documentos donde se encuentren hallazgos reales.
Usar los checklists de `references/categories.md` como guía.

Para buscar patrones en el código, usar Serena MCP en lugar de grep:

> ▶ Buscando [descripción del patrón que se investiga]

Serena MCP: `search_code("[patrón]", file_types=["ts","tsx"], exclude=["node_modules"])`

### Estructura de cada documento de categoría

```markdown
# [Emoji] [Nombre Categoría] — Auditoría RN

> **Severidad general:** 🔴 Alta / 🟡 Media / 🟢 Baja
> **Archivos afectados:** N
> **Esfuerzo estimado:** X horas / días
> **Fecha:** YYYY-MM-DD

## Resumen ejecutivo

[2-3 oraciones describiendo el estado general de esta categoría]

## Hallazgos

### [CAT-001] Título del problema

> **Fuente:** 🔍 Auto-descubierto / Conocimiento del equipo (BRF-NNN)

**Archivo(s):** `src/services/auth.ts` línea 42
**Severidad:** 🔴 Alta
**Impacto:** Descripción del impacto real.

**Código actual (problema):**
```tsx
// código problemático aquí
```

**Por qué es un problema:**
Explicación técnica clara.

**Solución paso a paso:**
1. [Paso con comando si aplica]
```bash
# comando exacto
```
2. [Código corregido]
```tsx
// código correcto
```
3. Verificar:
```bash
# comando de verificación
```

**Tiempo estimado:** 30 min
**Prioridad:** P1 — Resolver antes del próximo deploy

## Checklist de verificación
- [ ] [CAT-001] resuelto
```

### Patrones de búsqueda por categoría

**Seguridad:**
> ▶ Buscando API keys y secrets hardcodeados

Serena MCP: `search_code("sk-|api_key=|apiKey:|SECRET|PASSWORD", file_types=["ts","tsx","js"], exclude=["node_modules"])`

> ▶ Verificando uso de AsyncStorage con datos sensibles

Serena MCP: `search_code("AsyncStorage.setItem", file_types=["ts","tsx"], exclude=["node_modules"])`

> ▶ Buscando console.log con posible información sensible

Serena MCP: `search_code("console\.log", file_types=["ts","tsx"], exclude=["node_modules"])` → contar total

**Performance:**
> ▶ Buscando ScrollView que deberían ser FlatList

Serena MCP: `search_code("ScrollView", file_types=["tsx"], exclude=["node_modules"])`

> ▶ Buscando useEffect sin cleanup con subscripciones

Serena MCP: `search_code("useEffect", file_types=["tsx","ts"], exclude=["node_modules"])`

**Arquitectura:**
> ▶ Buscando ausencia de ErrorBoundary

Serena MCP: `search_code("ErrorBoundary|componentDidCatch", file_types=["tsx","ts"], exclude=["node_modules"])`

> ▶ Buscando archivos grandes (candidatos a refactorizar)

Serena MCP: `find_files("src/**/*.tsx", exclude=["node_modules"])` → leer y medir líneas de los más grandes

**Testing:**
> ▶ Ejecutando tests para ver estado actual del CI

```bash
npm test 2>&1 | grep "FAIL\|PASS\|Error" | head -30
```

> ▶ Verificando cobertura de tests

```bash
npm test -- --coverage --coverageReporters=text 2>&1 | grep "Statements\|Branches\|Functions\|Lines" | head -10
```

**TypeScript:**
> ▶ Verificando errores de tipos en el proyecto

```bash
npx tsc --noEmit 2>&1 | head -40
```

> ▶ Buscando uso de `any` y casts problemáticos

Serena MCP: `search_code("as any|: any|as unknown", file_types=["ts","tsx"], exclude=["node_modules"])` → contar

---

## Paso 4 — Generar ROADMAP.md

> ▶ Creando plan/audit/audit-NNN/ROADMAP.md con todos los hallazgos priorizados

Crear `plan/audit/audit-NNN/ROADMAP.md` con estructura:

```markdown
# Audit Roadmap — audit-NNN
**Proyecto:** [nombre]
**Fecha:** YYYY-MM-DD

## Phase 1 — Critical (resolver esta semana)
| ID | Categoría | Archivo(s) | Fix | Est. |
|---|---|---|---|---|

## Phase 2 — Important (próximo sprint)
...

## Checklist completo
- [ ] [ID] descripción
```
