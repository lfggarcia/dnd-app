# 🧪 Testing — Auditoría RN

> **Severidad general:** 🟡 Media  
> **Archivos de test:** 11  
> **Esfuerzo estimado:** 4-6 horas para mejorar cobertura crítica

---

## Resumen ejecutivo
Existen 11 archivos de test con buena calidad (tests de comportamiento, determinismo). La cobertura estimada es ~29%. Los gaps principales: 0 tests para gameStore, gameRepository, dungeonGraphService, y la mayoría de pantallas. 2 suites fallan por problemas de mock de op-sqlite.

---

## Hallazgos

### [TEST-001] 2 test suites fallan por import de op-sqlite
**Archivo(s):** `__tests__/App.test.tsx`, `__tests__/CampScreen.test.tsx`  
**Severidad:** 🔴 Alta  
**Impacto:** Tests que importan código que usa op-sqlite crashean porque el módulo nativo no está disponible en el entorno de Jest.

**Solución:**
1. Verificar que `jest.setup.js` tiene un mock de op-sqlite
2. Si no, agregar:
```js
jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => ({
    executeSync: jest.fn(() => ({ rows: { _array: [] } })),
    execute: jest.fn(async () => ({ rows: { _array: [] } })),
  })),
}));
```

**Tiempo estimado:** 30 min  
**Prioridad:** P1 — Tests rotos bloquean CI

---

### [TEST-002] ~29% cobertura estimada — combatEngine al 12%
**Severidad:** 🟡 Media  
**Impacto:** El engine de combate es la lógica más crítica de la app y tiene la cobertura más baja.

**Archivos con tests:**
- `combatEngine.test.ts` — cubre hit/damage/initiative parcialmente
- `economyService.test.ts` — cubre gold/loot
- `lootService.test.ts` — cubre drops
- `progressionService.test.ts` — cubre XP/level up
- `prng.test.ts` — cubre determinismo del PRNG
- `migrations.test.ts` — cubre schema
- `NarrativeMomentPanel.test.tsx` — component test
- `navigation.test.tsx` — basic render
- `worldSimulator.perf.test.ts` — tests a mock (no real coverage)

**Sin tests:**
- `gameStore.ts` (state management central)
- `gameRepository.ts` (persistencia)
- `dungeonGraphService.ts` (generación de mazmorras)
- `timeService.ts`, `worldSimulator.ts`
- `translationSeed.ts`, `translationBridge.ts`
- 20+ pantallas sin component tests

**Solución:**
1. Priorizar test del combatEngine (paths de hit/miss/crit/death)
2. Test del gameRepository (CRUD + edge cases de JSON parsing)
3. Test del dungeonGraphService (generación determinista)

**Tiempo estimado:** 4+ horas  
**Prioridad:** P2

---

### [TEST-003] worldSimulator.perf.test.ts testea un mock (no cubre código real)
**Archivo(s):** `__tests__/worldSimulator.perf.test.ts`  
**Severidad:** 🟢 Baja  
**Impacto:** Da falsa sensación de cobertura. El test mockea la función que debería testear.

**Solución:** Reescribir con el worldSimulator real o eliminar si no se puede testear en aislamiento.

**Tiempo estimado:** 30 min  
**Prioridad:** P3

---

### [TEST-004] No hay CI — tests solo corren manualmente
**Severidad:** 🟡 Media  
**Impacto:** Los tests no se ejecutan antes de merge. Regressions pasan inadvertidas.

**Solución:** Agregar GitHub Actions workflow básico:
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test
```

**Tiempo estimado:** 30 min  
**Prioridad:** P2

---

## Checklist de verificación
- [ ] TEST-001 — op-sqlite mock fixed, all suites green
- [ ] TEST-002 — combatEngine coverage > 50%
- [ ] TEST-003 — worldSimulator perf test rewritten or removed
- [ ] TEST-004 — CI workflow configured
