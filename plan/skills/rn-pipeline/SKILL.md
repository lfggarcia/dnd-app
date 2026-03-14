# RN Pipeline — Orquestador Completo

## Propósito

Ejecutar el ciclo completo de calidad en una sola invocación:
**Discover → Audit → Code Review → Fix**

Cada etapa alimenta a la siguiente. No requiere input humano.

---

## Paso 0 — Determinar número de pipeline

> ▶ Verificando pipelines anteriores para determinar numeración

```bash
ls plan/audit/ 2>/dev/null
ls plan/codereview/ 2>/dev/null
```

Tomar el número más alto entre ambas carpetas y usar el siguiente.
Si ambas vacías → usar `001`.

```bash
# ▶ Creando carpetas del pipeline NNN
mkdir -p plan/audit/audit-NNN
mkdir -p plan/codereview/review-NNN
mkdir -p plan/discover/discover-NNN
```

---

## Paso 1 — Ejecutar rn-discover

Leer y ejecutar `plan/skills/rn-discover/SKILL.md` completo.
Al terminar: `plan/BRIEFING.md` debe existir con todos los BRF-XXX encontrados.

---

## Paso 2 — Ejecutar rn-audit

Leer y ejecutar `plan/skills/rn-audit/SKILL.md` completo.
Al terminar: carpeta `plan/audit/audit-NNN/` con documentos por categoría + `ROADMAP.md`.

---

## Paso 3 — Ejecutar rn-codereview

Leer y ejecutar `plan/skills/rn-codereview/SKILL.md` completo.
Al terminar: carpeta `plan/codereview/review-NNN/files/` + `ROADMAP.md`.

---

## Paso 4 — Crear MASTER-ROADMAP

> ▶ Mergeando hallazgos de audit y codereview en el roadmap maestro

Crear `plan/pipeline-NNN-MASTER-ROADMAP.md` que consolide:
- Correcciones de audit invalidadas por codereview (documentar como INVALIDATED)
- Phase 1 — Critical (items que bloquean CI o producción)
- Phase 2 — Logic & Correctness
- Phase 3 — I18N / Sistemático
- Phase 4 — Architecture Refactoring
- Phase 5 — Safety & Minor Fixes
- Phase 6 — Cleanup & Housekeeping
- Out of Scope (tareas DevOps o decisiones de diseño, no fixes de código)

Formato de cada item:
```
| ID | Source | File(s) | Fix | Est. | Status |
```

Incluir tabla de estadísticas al final:
```
| Phase | Items | Est. Total |
```

---

## Paso 5 — Ejecutar rn-fix

Leer y ejecutar `plan/skills/rn-fix/SKILL.md` apuntando al MASTER-ROADMAP recién creado.
