# Code Review: `src/database/migrations.ts`

**Revisado:** 2026-03-14  
**Líneas de código:** ~280  
**Severidad general:** 🟢 Sin issues críticos  
**Comentarios:** 2 observaciones positivas + 1 mejora

---

## Resumen

El sistema de migraciones está bien implementado: versionado incremental, `IF NOT EXISTS`
en CREATE TABLE, ALTER TABLE para columnas nuevas, índices para queries frecuentes.
Las versiones 1-16 tienen sus comentarios de sprint. No hay riesgo de pérdida de datos.

---

## [CR-021] ✅ Migraciones versionadas y correctamente estructuradas

> **Tipo:** Positivo  

```ts
const migrations: Record<number, string[]> = {
  1: [ /* Schema inicial */ ],
  2: [ `ALTER TABLE saved_games ADD COLUMN location TEXT ...` ],
  // ...
  16: [ /* Última migración */ ],
};
```

El runner de migraciones (asumido en `connection.ts`) ejecuta las versiones en orden y
guarda la versión actual. Patrón correcto — no hay riesgo de rollback o migraciones duplicadas
con `IF NOT EXISTS`. ✅

---

## [CR-022] Migración 16 — última vista, confirmar está actualizada

> **Línea(s):** Final del archivo  
> **Tipo:** Arquitectura  
> **Severidad:** 🟢 Baja

**Observación:**
Con el crecimiento rápido del proyecto (Sprint 7+ en progreso), las nuevas features deben
siempre agregar una migración numerada antes de usar nuevas columnas. Risk: un developer
puede olvidar agregar la migración y crashear apps de usuarios ya instaladas.

**Recomendación:**
Agregar un test específico que verifique que la versión máxima de migración coincide con
el schema esperado:
```ts
// __tests__/migrations.test.ts (ya existe — verificar que cubra la versión más reciente)
it('migración más reciente crea todas las columnas esperadas', () => {
  // ...
});
```

**Tiempo estimado:** 30 min para el test  
**Prioridad:** P3

---

## [CR-023] `CHECK` constraints en SQLite son ignorados por defecto en algunas versiones

> **Línea(s):** Múltiples  
> **Tipo:** Correctness  
> **Severidad:** 🟢 Baja

**Código:**
```sql
type TEXT NOT NULL CHECK(type IN ('weapon','armor','consumable','material','boss_loot')),
status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','terminated')),
```

**Observación:**
SQLite enforces CHECK constraints siempre desde versión 3.25.0 (2018). op-sqlite usa
SQLite moderno, así que esto es correcto. Los CHECK constraints son una buena práctica. ✅

Sin embargo, si se inserta un tipo no válido desde TypeScript y no hay validación en la capa
de repository/service, el CHECK constraint fallará a nivel DB (error no capturado).
Verificar que los services siempre usan los valores del enum correspondiente.
