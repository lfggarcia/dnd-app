---
name: rn-audit
description: >
  Audita proyectos de React Native de forma estructurada. Genera documentación técnica completa
  con hallazgos, soluciones paso a paso, y un roadmap priorizado. Úsala cuando el usuario pida
  auditar, revisar, analizar calidad, o hacer un code review de una app React Native. También
  úsala cuando se mencione seguridad, rendimiento, dependencias, o deuda técnica de una app móvil.
  Crea la carpeta de auditoría automáticamente en `plan/audit/` con numeración secuencial.
---

# React Native Audit Skill

## Propósito

Realizar una auditoría completa de un proyecto React Native, generando documentación técnica
organizada por categorías con soluciones step-by-step, y un roadmap maestro que lo conecte todo.

---

## Paso 0 — Leer el BRIEFING.md si existe

**Hacer esto ANTES de cualquier análisis de código.**

```bash
cat plan/BRIEFING.md 2>/dev/null || echo "NO_EXISTE"
```

Si existe: leer todos los issues (BRF-XXX) y tenerlos presentes durante todo el análisis.
Los issues del BRIEFING se incorporan a las categorías correspondientes con la etiqueta:
```markdown
> **Fuente:** 🧑‍💻 Auto-descubierto / Conocimiento del equipo (BRF-001)
```

Si no existe: considerar correr `rn-discover` primero para auto-generar el BRIEFING,
o continuar sin él si el usuario quiere solo el audit estático.

---

## Paso 1 — Determinar número de auditoría

Antes de crear cualquier archivo:

```bash
# Ver auditorías previas
ls plan/audit/ 2>/dev/null || echo "No existe aún"
```

- Si no existe la carpeta o está vacía → la auditoría es `audit-001`
- Si ya existen carpetas → tomar la última (ej: `audit-003`) y crear `audit-004`
- Formato siempre con 3 dígitos con ceros: `audit-001`, `audit-002`, etc.

Crear la carpeta:
```bash
mkdir -p plan/audit/audit-00X
```

---

## Paso 2 — Explorar el proyecto

Antes de escribir hallazgos, explorar el repositorio activamente:

```bash
# Estructura general
find . -type f -name "*.tsx" -o -name "*.ts" -o -name "*.js" | grep -v node_modules | head -60

# Dependencias instaladas
cat package.json

# Versión de RN
grep -i "react-native" package.json | head -5

# Archivos de configuración relevantes
ls -la android/ ios/ 2>/dev/null
cat .env 2>/dev/null || echo "Sin .env"
cat app.json 2>/dev/null || cat app.config.js 2>/dev/null
```

Buscar patrones problemáticos concretos antes de documentarlos:

```bash
# API keys hardcodeadas
grep -rn "sk-\|api_key\|apiKey\|SECRET\|PASSWORD" --include="*.ts" --include="*.tsx" --include="*.js" . | grep -v node_modules | grep -v ".env"

# AsyncStorage con datos sensibles
grep -rn "AsyncStorage.setItem" --include="*.ts" --include="*.tsx" . | grep -v node_modules

# useEffect sin cleanup
grep -rn "useEffect" --include="*.tsx" --include="*.ts" . | grep -v node_modules

# ScrollView con listas grandes (antipatrón)
grep -rn "ScrollView" --include="*.tsx" . | grep -v node_modules

# console.log en producción
grep -rn "console\.log" --include="*.ts" --include="*.tsx" . | grep -v node_modules | wc -l

# Dependencias vulnerables
npm audit --json 2>/dev/null | head -100
```

---

## Paso 3 — Generar los documentos de categoría

Crear **un archivo `.md` por categoría** dentro de `plan/audit/audit-00X/`.
Solo crear documentos para las categorías donde se encuentren hallazgos reales.

### Estructura de cada documento de categoría

```markdown
# [Emoji] [Nombre Categoría] — Auditoría RN

> **Severidad general:** 🔴 Alta / 🟡 Media / 🟢 Baja  
> **Archivos afectados:** N  
> **Esfuerzo estimado:** X horas / días

---

## Resumen ejecutivo
[2-3 oraciones describiendo el estado general de esta categoría]

---

## Hallazgos

### [SEVERITY-001] Título del problema
**Archivo(s):** `src/services/auth.ts` línea 42  
**Severidad:** 🔴 Alta  
**Impacto:** Descripción del impacto real  

**Código actual (problema):**
```tsx
// código problemático aquí
```

**Por qué es un problema:**
Explicación técnica clara.

**Solución paso a paso:**

1. Instalar dependencia si aplica:
```bash
npm install react-native-keychain
npx pod-install
```

2. Reemplazar el código:
```tsx
// código corregido aquí
```

3. Verificar que funciona:
```bash
# comando de verificación
```

**Tiempo estimado:** 30 min  
**Prioridad:** P1 — Hacer antes del próximo release

---
[Repetir para cada hallazgo]

## Checklist de verificación
- [ ] Hallazgo 001 resuelto
- [ ] Hallazgo 002 resuelto
- [ ] Tests actualizados
- [ ] Revisión en dispositivo físico
```

### Categorías a documentar (leer referencias para detalle)

Consultar `references/categories.md` para la lista completa de checks por categoría.

Los nombres de archivo a usar:
- `01-security.md`
- `02-performance.md`
- `03-architecture.md`
- `04-testing.md`
- `05-dependencies.md`
- `06-accessibility.md`

Si una categoría no tiene hallazgos, incluirla brevemente en el roadmap como ✅ sin crear documento.

---

## Paso 4 — Generar el ROADMAP.md

Crear `plan/audit/audit-00X/ROADMAP.md` como documento maestro.

```markdown
# 🗺️ Roadmap de Auditoría — audit-00X
**Fecha:** YYYY-MM-DD  
**Proyecto:** [nombre del proyecto]  
**Auditoría anterior:** audit-00Y (si existe) / Primera auditoría

---

## Estado general

| Categoría | Hallazgos | Severidad | Estado |
|---|---|---|---|
| 🔒 Seguridad | N | 🔴 Alta | Pendiente |
| ⚙️ Rendimiento | N | 🟡 Media | Pendiente |
| 🏗️ Arquitectura | N | 🟡 Media | Pendiente |
| 🧪 Testing | N | 🟢 Baja | Pendiente |
| 📦 Dependencias | N | 🔴 Alta | Pendiente |
| ♿ Accesibilidad | N | 🟢 Baja | Pendiente |

**Total de hallazgos:** N  
**Esfuerzo total estimado:** X días

---

## Orden de ejecución recomendado

### 🚨 Fase 1 — Crítico (hacer YA, antes del próximo deploy)
> Tiempo estimado: X horas

1. **[SEG-001]** Descripción del problema crítico  
   📄 Ver: [`01-security.md#seg-001`](./01-security.md#seg-001)  
   ⏱ 30 min

2. **[DEP-001]** Descripción del problema crítico  
   📄 Ver: [`05-dependencies.md#dep-001`](./05-dependencies.md#dep-001)  
   ⏱ 1 hora

---

### ⚠️ Fase 2 — Importante (próximo sprint)
> Tiempo estimado: X días

3. **[PERF-001]** Descripción  
   📄 Ver: [`02-performance.md#perf-001`](./02-performance.md#perf-001)  
   ⏱ 2 horas

...

---

### 💡 Fase 3 — Mejoras (backlog técnico)
> Tiempo estimado: X días

...

---

## Cómo usar este roadmap

1. Ir al hallazgo en el orden indicado
2. Abrir el documento de la categoría referenciado
3. Seguir los pasos de solución
4. Marcar el checkbox en el documento de categoría
5. Actualizar la columna "Estado" en la tabla de arriba

---

## Comparación con auditoría anterior
[Solo si existe una previa]
- Hallazgos resueltos desde audit-00Y: N
- Hallazgos nuevos: N  
- Hallazgos persistentes: N
```

---

## Paso 5 — Crear index de la auditoría

Crear `plan/audit/audit-00X/README.md`:

```markdown
# Auditoría audit-00X

**Fecha:** YYYY-MM-DD  
**Versión de RN auditada:** X.XX  
**Herramienta:** Claude RN Audit Skill

## Archivos de esta auditoría

| Archivo | Descripción |
|---|---|
| [ROADMAP.md](./ROADMAP.md) | 🗺️ Punto de entrada — empieza aquí |
| [01-security.md](./01-security.md) | 🔒 Hallazgos de seguridad |
| [02-performance.md](./02-performance.md) | ⚙️ Hallazgos de rendimiento |
| [03-architecture.md](./03-architecture.md) | 🏗️ Hallazgos de arquitectura |
| [04-testing.md](./04-testing.md) | 🧪 Cobertura y calidad de tests |
| [05-dependencies.md](./05-dependencies.md) | 📦 Estado de dependencias |
| [06-accessibility.md](./06-accessibility.md) | ♿ Accesibilidad |

> Comienza siempre por el **ROADMAP.md** para saber qué atacar primero.
```

---

## Reglas importantes

- **No inventar hallazgos** — solo documentar lo que se encontró explorando el código real
- **Ser específico** — siempre indicar archivo y línea cuando sea posible
- **Las soluciones deben ser ejecutables** — comandos reales, código que compila
- **Si no hay acceso al código** — pedirle al usuario que pegue archivos clave o comparta el repo
- **Numeración de hallazgos** — usar prefijo de categoría: SEG-001, PERF-001, ARCH-001, etc.

---

## Referencias

- `references/categories.md` — Checklist completo de qué revisar por categoría
- `references/severity-guide.md` — Criterios para asignar severidad
