---
name: rn-pipeline
description: >
  Orquesta el pipeline completo de calidad: lee el BRIEFING.md si existe, ejecuta rn-audit
  (diagnóstico por categorías), luego rn-codereview (review archivo por archivo añadiendo lo
  que el audit no vio), y finalmente rn-fix (aplica los fixes). Úsala cuando el usuario diga
  "audita el proyecto completo", "corre el pipeline", "haz todo", "audit + codereview + fix",
  "analiza todo y arregla", "revisión completa del proyecto", o cualquier variante que implique
  querer el análisis y corrección completos de una sola vez.
---

# RN Pipeline — Orquestador Completo

## Propósito

Ejecutar el ciclo completo de calidad en un solo comando:
**Briefing humano → Audit → Code Review → Fix**

Cada etapa alimenta a la siguiente. El Code Review sabe lo que el Audit ya encontró y
agrega lo que el código no puede revelar. El Fix recibe todo el contexto combinado.

---

## Paso 0 — Descubrimiento profundo automático

**Hacer esto SIEMPRE antes del audit. No requiere input humano.**

### 0a. Ejecutar rn-discover

Ejecutar el workflow completo de `rn-discover` (ver su SKILL.md):
- Correr todas las investigaciones de código: i18n, assets, require(), dependencias, DB, navegación, etc.
- Generar o actualizar `plan/BRIEFING.md` con los hallazgos auto-descubiertos

### 0b. Leer el BRIEFING.md resultante

```bash
cat plan/BRIEFING.md
```

Internalizar todos los issues (BRF-XXX) — tienen igual o mayor prioridad que el audit.
Referenciarlos con su ID en todos los documentos del pipeline.

---

## Paso 1 — Determinar el número de pipeline

```bash
ls plan/audit/ 2>/dev/null
ls plan/codereview/ 2>/dev/null
```

Tomar el número más alto entre ambas carpetas y usar el mismo para esta ejecución.
Si ambas están vacías → usar `001`. Si audit tiene `003` y codereview tiene `002` → usar `004`.

Crear ambas carpetas con el mismo número:
```bash
mkdir -p plan/audit/audit-00X
mkdir -p plan/codereview/review-00X
```

Así se puede cruzar información entre ambos fácilmente.

---

## Paso 2 — AUDIT (diagnóstico por categorías)

Ejecutar el workflow completo de `rn-audit`:

1. Explorar el proyecto con bash (estructura, package.json, búsqueda de patrones)
2. Generar documentos por categoría en `plan/audit/audit-00X/`
3. **Incorporar issues del BRIEFING** en las categorías correspondientes:
   - Issues de i18n → `06-accessibility.md` o crear `07-i18n.md` si hay varios
   - Issues de assets/bundle → `05-dependencies.md`
   - Issues de DB/migraciones → `03-architecture.md`
   - Issues de módulos nativos → `03-architecture.md`
   - Issues de stores → `05-dependencies.md`
   - Workarounds y hacks → `03-architecture.md`
4. Cuando un hallazgo viene del BRIEFING, marcarlo:
   ```markdown
   > **Fuente:** 🧑‍💻 Conocimiento del equipo (BRF-001) — no detectable por análisis estático
   ```
5. Generar `ROADMAP.md` y `README.md` normales

---

## Paso 3 — CODE REVIEW (archivo por archivo)

Ejecutar el workflow completo de `rn-codereview` **inmediatamente después** del audit:

1. Leer el ROADMAP del audit para saber qué ya se documentó: 
   ```bash
   cat plan/audit/audit-00X/ROADMAP.md
   ```
2. Mapear todos los archivos del proyecto (excluyendo ios/, android/, node_modules/, vendor/)
3. Revisar cada archivo buscando lo que el audit no cubre:
   - Bugs específicos de línea (el audit detecta patrones, el codereview ve el código real)
   - Calidad de implementación, nombres, lógica
   - Casos borde no manejados
   - **Verificar activamente** los issues del BRIEFING en cada archivo relevante
4. En los archivos afectados por issues del BRIEFING, agregar una sección especial:

   ```markdown
   ## Issues del briefing verificados en este archivo

   ### [BRF-001] Descripción del issue del briefing
   **Verificación:** Confirmado / Parcialmente confirmado / No afecta este archivo  
   **Evidencia en el código:**
   ```tsx
   // línea 42 — require() estático, no puede recibir variable dinámica
   const image = require('../assets/images/product_001.png')
   ```
   **Cómo contribuye este archivo al problema:** descripción
   ```

5. **No duplicar** hallazgos que el audit ya documentó — referenciarlos:
   ```markdown
   > Ver también: `plan/audit/audit-00X/02-performance.md#perf-001` (mismo problema, contexto de audit)
   ```
6. Generar `SUMMARY.md`, `ROADMAP.md` y `README.md` normales

---

## Paso 4 — MERGE: Crear el roadmap maestro del pipeline

Crear `plan/pipeline-00X-MASTER-ROADMAP.md`:

```markdown
# 🗺️ Master Roadmap — Pipeline 00X

**Fecha:** YYYY-MM-DD  
**Audit:** `plan/audit/audit-00X/`  
**Code Review:** `plan/codereview/review-00X/`  
**Briefing:** `plan/BRIEFING.md` (N issues incorporados)

---

## Fuentes de este roadmap

| Fuente | Items | Descripción |
|---|---|---|
| 🔍 Análisis de código (audit) | N | Patrones detectados automáticamente |
| 👁️ Code review línea por línea | N | Bugs y calidad detectados por archivo |
| 🧑‍💻 Briefing del equipo | N | Contexto que solo el equipo conoce |

---

## 🚨 Fase 1 — Crítico (antes del próximo deploy)

> Incluye issues de TODAS las fuentes ordenados por impacto real.

- [ ] **[BRF-001]** Issue de los assets locales que superan 300MB  
  🧑‍💻 Briefing del equipo  
  📄 Ver: [`plan/audit/audit-00X/05-dependencies.md#brf-001`](./audit/audit-00X/05-dependencies.md#brf-001)  
  ⏱ Estimado: 3-5 días (requiere módulo nativo)  
  ⚠️ Blocker para aprobación en stores

- [ ] **[BRF-002]** Migración de DB pendiente por cambio de assets a base local  
  🧑‍💻 Briefing del equipo  
  📄 Ver: [`plan/audit/audit-00X/03-architecture.md#brf-002`](./audit/audit-00X/03-architecture.md#brf-002)  
  ⏱ Estimado: 1-2 días  
  ⚠️ Pantallas rotas en producción

- [ ] **[SEG-001]** Issue detectado en código  
  🔍 Análisis automático  
  📄 Ver: [`plan/audit/audit-00X/01-security.md#seg-001`](./audit/audit-00X/01-security.md#seg-001)  
  ⏱ 30 min

[Continuar con todos los items de Fase 1 de ambas fuentes]

---

## ⚠️ Fase 2 — Importante (próximo sprint)

[Items de Fase 2 de audit + codereview + briefing mezclados por prioridad real]

---

## 🔧 Fase 3 — Mantenibilidad

[Items de ambas fuentes]

---

## 💅 Fase 4 — Style y convenciones

[Items de codereview]

---

## Leyenda de fuentes

- 🔍 Análisis automático de código (audit)
- 👁️ Code review línea por línea
- 🧑‍💻 Conocimiento del equipo (briefing)
```

---

## Paso 5 — FIX (aplicar correcciones)

Preguntar al usuario antes de ejecutar el fix:

```
✅ Pipeline completado:
   📊 Audit: N hallazgos en plan/audit/audit-00X/
   🔍 Code Review: N hallazgos en plan/codereview/review-00X/
   🧑‍💻 Briefing: N issues incorporados
   📋 Master Roadmap: plan/pipeline-00X-MASTER-ROADMAP.md

🔧 ¿Quieres que aplique los fixes ahora?
   [1] Todo en orden (Fases 1→4) 
   [2] Solo Fase 1 — crítico (~X horas)
   [3] Revisar el roadmap primero y decidir después
```

Si el usuario confirma, ejecutar el workflow de `rn-fix` usando el **Master Roadmap**
como fuente en lugar de los roadmaps individuales.

---

## Paso 6 — Reporte final del pipeline

Crear `plan/pipeline-00X-REPORT.md`:

```markdown
# Pipeline 00X — Reporte Final

**Fecha inicio:** YYYY-MM-DD HH:MM  
**Fecha fin:** YYYY-MM-DD HH:MM

## Resumen de hallazgos

| Fuente | Críticos | Importantes | Mejoras | Total |
|---|---|---|---|---|
| Audit (código) | N | N | N | N |
| Code Review | N | N | N | N |
| Briefing equipo | N | N | N | N |
| **Total único** | **N** | **N** | **N** | **N** |

## Fixes aplicados: N
## Pendientes manuales: N
## Archivos modificados: N

Ver detalles en: `plan/fix-session/FECHA/SESSION-REPORT.md`
```

---

## Reglas del pipeline

1. **El BRIEFING siempre se lee primero** — sin excepción
2. **El Code Review nunca duplica el Audit** — referencia, no copia
3. **Los issues del BRIEFING se tratan como hallazgos de severidad 🔴 por defecto** — el equipo los marcó porque importan
4. **El Master Roadmap es la única fuente de verdad para rn-fix** — los roadmaps individuales son de referencia
5. **Preguntar antes del fix** — el análisis es automático, los cambios al código necesitan confirmación
6. **Si no existe BRIEFING al final** — sugerir correr `rn-brief` antes del próximo pipeline