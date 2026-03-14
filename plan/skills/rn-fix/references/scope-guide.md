# Scope Guide — Referencia

rn-fix ejecuta **todo en orden** por defecto. Esta guía es solo para invocaciones directas
(sin pasar por rn-pipeline) donde el usuario quiere un scope específico.

## Modos de invocación directa

### Todo en orden (default)
**Frase:** "aplica todo" / "ejecuta el roadmap" / invocar desde rn-pipeline
**Comportamiento:** Phases 1 → 6 en orden completo, sin pausas entre items

### Solo crítico
**Frase:** "solo lo crítico" / "lo urgente" / "antes del deploy"
**Comportamiento:** Solo Phase 1

### Fase específica
**Frase:** "aplica la fase 3" / "solo i18n"
**Comportamiento:** Solo la fase mencionada

### Archivo específico
**Frase:** "arregla BattleScreen" / "aplica fixes de syncService"
**Comportamiento:** Todos los fixes de ese archivo

### ID específico
**Frase:** "aplica CR-007" / "resuelve TEST-001"
**Comportamiento:** Solo ese item

## Nota sobre el gate de scope

rn-fix NO pregunta el scope cuando es invocado desde rn-pipeline.
Solo presenta opciones cuando el usuario invoca rn-fix directamente sin contexto.
En ese caso, leer el MASTER-ROADMAP, imprimir el resumen de phases, y comenzar con Phase 1
a menos que el usuario haya especificado otro scope en su mensaje.
