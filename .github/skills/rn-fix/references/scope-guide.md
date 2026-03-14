# Scope Guide — Opciones de ejecución

## Modos de ejecución

Cuando el usuario dice "aplica la auditoría" sin especificar más, presentar estas opciones:

---

### Modo 1: Todo en orden
**Frase:** "aplica todo" / "ejecuta todo" / "resuelve todo"  
**Comportamiento:** Ejecuta Fase 1 → 2 → 3 → 4 en orden completo  
**Cuándo sugerirlo:** Sesión dedicada con tiempo suficiente

---

### Modo 2: Solo crítico (Fase 1)
**Frase:** "solo lo crítico" / "lo urgente" / "lo que hay que hacer ya"  
**Comportamiento:** Solo Fase 1 del roadmap  
**Cuándo sugerirlo:** Antes de un deploy, poco tiempo disponible

---

### Modo 3: Por fases
**Frase:** "aplica la fase 2" / "ejecuta la fase de performance"  
**Comportamiento:** Solo la fase especificada  
**Cuándo sugerirlo:** Ya se ejecutó Fase 1 en sesión anterior

---

### Modo 4: Por archivo
**Frase:** "arregla HomeScreen" / "aplica los fixes de api.ts"  
**Comportamiento:** Todos los fixes de un archivo específico  
**Cuándo sugerirlo:** El usuario quiere trabajar en un módulo específico

---

### Modo 5: Por ID específico
**Frase:** "aplica CR-007" / "resuelve el issue de las keys"  
**Comportamiento:** Un único fix identificado por ID  
**Cuándo sugerirlo:** El usuario quiere control granular

---

### Modo 6: Por categoría
**Frase:** "arregla todo lo de seguridad" / "aplica los fixes de performance"  
**Comportamiento:** Todos los fixes de una categoría (01-security, 02-performance, etc.)  
**Cuándo sugerirlo:** Para auditorías — cuando el usuario quiere atacar una dimensión completa

---

## Cómo presentar las opciones al usuario

Cuando no quede claro el scope, presentar así:

```
Encontré [N] items en el roadmap distribuidos en [N] fases.
¿Qué quieres ejecutar en esta sesión?

  [1] Todo en orden — Fases 1 a 4 (~X horas)
  [2] Solo crítico (Fase 1) — N items, ~X horas
  [3] Fase específica — dime cuál
  [4] Archivo específico — dime cuál
  [5] ID específico — dime el ID (ej: CR-007)
```

---

## Estimación de tiempo por modo

Calcular basándose en los tiempos documentados en el roadmap:

```bash
# Sumar los tiempos estimados de cada item en el roadmap
# Los tiempos están documentados en el formato: "⏱ 30 min" o "⏱ 2 horas"
grep "⏱" plan/audit/audit-00X/ROADMAP.md
grep "⏱" plan/codereview/review-00X/ROADMAP.md
```

Presentar al usuario el total estimado antes de comenzar.

---

## Sesiones múltiples

Si el proyecto es grande y no se puede hacer todo en una sesión:

1. Al inicio de cada sesión, leer el ROADMAP.md para ver qué ya tiene `[x]`
2. Continuar desde donde quedó la última sesión (primer `[ ]` sin resolver)
3. El reporte de sesión documenta exactamente qué se hizo para que la próxima sesión sepa el punto de partida

El estado del roadmap funciona como el "save point" entre sesiones.