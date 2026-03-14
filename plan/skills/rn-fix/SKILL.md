---
name: rn-fix
description: >
  Lee los documentos generados por rn-audit o rn-codereview y aplica los fixes directamente
  en el código del proyecto, siguiendo el roadmap en orden de prioridad. Úsala cuando el
  usuario diga "aplica la auditoría", "ejecuta el roadmap", "arregla lo que encontró la
  auditoría", "implementa los fixes del code review", "resuelve los issues", o cualquier
  variante de querer que se ejecuten las correcciones documentadas. También úsala si el
  usuario dice "haz lo que dice el roadmap" o "aplica los cambios". Modifica los archivos
  reales del proyecto y marca cada item como resuelto en el roadmap.
---

# RN Fix Executor — Aplicador de Auditorías y Code Reviews

## Rol

Eres el ejecutor. Tienes los diagnósticos (generados por `rn-audit` o `rn-codereview`),
ahora tu trabajo es **leer cada solución documentada y aplicarla en el código real**.
No re-diagnosticas — ejecutas lo que ya está documentado.

---

## Paso 1 — Encontrar qué ejecutar

### Detectar el source (auditoría o code review)

```bash
# Ver auditorías disponibles
ls plan/audit/ 2>/dev/null

# Ver code reviews disponibles
ls plan/codereview/ 2>/dev/null
```

Si existen ambos, preguntar al usuario cuál ejecutar — o si quiere ejecutar ambos.
Si solo existe uno, proceder con ese.

**Tomar siempre el más reciente** (número más alto) a menos que el usuario especifique otro.

### Leer el ROADMAP.md

```bash
# Para auditoría
cat plan/audit/audit-00X/ROADMAP.md

# Para code review
cat plan/codereview/review-00X/ROADMAP.md
```

Este es el documento maestro. Define qué hacer y en qué orden.

---

## Paso 2 — Entender el scope

Antes de ejecutar, informar al usuario:

```
📋 Encontré: [audit-00X / review-00X]
📅 Fecha: YYYY-MM-DD
🔴 Fase 1 (Crítico): N items — X horas estimadas
🟡 Fase 2 (Importante): N items — X días estimados
🟢 Fase 3+: N items — X días estimados
📁 Total de archivos a modificar: N
```

Luego preguntar el alcance de esta sesión. Ver `references/scope-guide.md` para opciones.

Si el usuario dice "todo" o "aplica todo" → ejecutar en orden fase por fase.
Si el usuario dice "solo lo crítico" → ejecutar solo Fase 1.
Si el usuario menciona un ID específico (ej: "aplica CR-007") → ejecutar solo ese.

---

## Paso 3 — Ejecutar cada fix

Para cada item del roadmap **en orden de prioridad (Fase 1 → 2 → 3 → 4)**:

### 3a. Leer la solución documentada

```bash
# Abrir el documento de la categoría o archivo referenciado
cat plan/audit/audit-00X/01-security.md       # para auditoría
cat plan/codereview/review-00X/files/src__screens__HomeScreen.md  # para code review
```

Leer la sección específica del hallazgo/comentario. Entender:
- Cuál es el archivo afectado
- Cuáles son las líneas exactas
- Qué código reemplazar
- Cuál es el código correcto

### 3b. Leer el archivo actual del proyecto

```bash
cat <ruta_del_archivo_afectado>
```

Verificar que el problema todavía existe (puede haber sido resuelto manualmente).
Si ya fue resuelto → marcar como ✅ y continuar al siguiente.

### 3c. Aplicar el fix

Aplicar la solución exactamente como está documentada.

**Si el fix requiere instalar una dependencia:**
```bash
npm install <package>
# o
yarn add <package>
```

**Si el fix modifica un archivo existente:**
Editar el archivo directamente con el código correcto documentado.

**Si el fix requiere crear un archivo nuevo:**
Crear el archivo en la ruta indicada.

**Si el fix requiere ejecutar un comando:**
```bash
# Ejecutar el comando documentado
npx pod-install  # si es nativo iOS
```

### 3d. Verificar el fix

Después de cada cambio, verificar que:
```bash
# El archivo modificado tiene la sintaxis correcta (TypeScript)
npx tsc --noEmit 2>&1 | grep <archivo_modificado>

# O para JS, verificar que el archivo no tiene errores de sintaxis
node -e "require('./<archivo>')" 2>&1
```

Si el tipo de fix lo permite, hacer una verificación rápida.

### 3e. Marcar como resuelto

Después de aplicar cada fix exitosamente, actualizar el roadmap:

En el archivo ROADMAP.md, cambiar:
```markdown
- [ ] **[CR-007]** Descripción
```
por:
```markdown
- [x] **[CR-007]** Descripción ✅ Aplicado YYYY-MM-DD
```

Y en el documento de la categoría/archivo, marcar el checkbox correspondiente:
```markdown
- [x] CR-007 resuelto
```

---

## Paso 4 — Manejar fixes complejos

Algunos fixes no pueden aplicarse automáticamente. Documentar en lugar de bloquear.

### Cuando NO aplicar automáticamente:

- El fix requiere decisión de arquitectura que el usuario debe tomar
- El fix implica cambiar lógica de negocio que no está clara en el doc
- El fix tiene múltiples opciones y el doc no especifica cuál elegir
- El fix requiere acceso a credenciales o configuración externa
- El fix podría romper funcionalidad que no está testeada

### Cómo documentar un fix que necesita intervención manual:

Crear `plan/fix-session/YYYY-MM-DD/manual-required.md`:

```markdown
# Fixes que requieren intervención manual

## [CR-012] Nombre del issue

**Archivo:** `src/services/auth.ts`  
**Razón por la que no se aplicó automáticamente:**
La solución documentada tiene dos opciones (react-native-keychain vs expo-secure-store)
y no se especificó cuál usa el proyecto. 

**Lo que necesitas hacer:**
1. Decidir entre `react-native-keychain` (bare RN) o `expo-secure-store` (Expo)
2. Seguir los pasos en `plan/codereview/review-001/files/src__services__auth.md#cr-012`
3. Marcar el item como resuelto en el ROADMAP.md cuando termines

**Tiempo estimado:** 1 hora
```

---

## Paso 5 — Reporte final de sesión

Al terminar, generar `plan/fix-session/YYYY-MM-DD/SESSION-REPORT.md`:

```markdown
# Reporte de Sesión de Fixes — YYYY-MM-DD

**Source:** audit-00X / review-00X  
**Duración de sesión:** estimada  
**Fase(s) ejecutada(s):** Fase 1 / Fase 1 y 2 / Todas

---

## Resumen

| Estado | Items |
|---|---|
| ✅ Aplicados exitosamente | N |
| ⚠️ Requieren intervención manual | N |
| ⏭️ Ya estaban resueltos | N |
| ❌ Fallaron | N |

---

## Fixes aplicados en esta sesión

### ✅ [CR-001] Nombre del fix
**Archivo modificado:** `src/screens/HomeScreen.tsx`  
**Cambio:** Reemplazado `Math.random()` como key por `item.id`

### ✅ [CR-003] Nombre del fix  
**Archivos modificados:** `src/services/api.ts`  
**Cambio:** Agregado try/catch + manejo de error en fetchUser()

[... resto de fixes ...]

---

## Requieren intervención manual

Ver: `plan/fix-session/YYYY-MM-DD/manual-required.md`

---

## Archivos modificados en total

```bash
# Lista de todos los archivos tocados en esta sesión
src/screens/HomeScreen.tsx
src/services/api.ts
src/hooks/useAuth.ts
package.json
```

---

## Próximos pasos

1. Revisar los fixes en `manual-required.md`
2. Correr los tests del proyecto: `npm test`
3. Probar en dispositivo físico los flujos afectados
4. Cuando todo esté resuelto, correr `rn-audit` o `rn-codereview` de nuevo para verificar
```

---

## Reglas del ejecutor

1. **Nunca inventar soluciones** — aplicar exactamente lo que está documentado en el roadmap/docs
2. **Orden estricto** — siempre Fase 1 antes que Fase 2, nunca saltarse prioridades
3. **Verificar antes de modificar** — leer el archivo actual antes de editarlo
4. **Un fix a la vez** — aplicar, verificar, marcar, continuar. No hacer todos y verificar al final
5. **Si el doc dice instalar X, instalar X** — no sustituir por alternativas no documentadas
6. **Documentar lo que no se pudo hacer** — nunca silenciar un fix que falló
7. **Preservar lógica existente** — el fix modifica solo lo documentado, no refactoriza de más
8. **Si hay duda, preguntar** — mejor preguntar que romper algo que funciona

---

## Referencias

- `references/scope-guide.md` — Opciones de scope para ejecutar fixes parciales
- `references/fix-patterns.md` — Patrones comunes de aplicación de fixes en RN
