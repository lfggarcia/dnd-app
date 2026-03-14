# 🧪 Testing — Auditoría RN

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** 2 suites fallidas, ~15 pantallas sin cobertura  
> **Esfuerzo estimado:** 4–8 horas

---

## Resumen ejecutivo

El proyecto tiene 11 suites de test con 75 tests que pasan — una base sólida para un juego de esta complejidad. La cobertura de lógica de negocio (combat engine, economy, loot, progression, PRNG, migrations) es buena. Los problemas principales son: (1) dos suites fallando (`App.test.tsx` y `CampScreen.test.tsx`) por falta de mock de `@op-engineering/op-sqlite` en Jest; (2) ausencia total de CI/CD — los tests solo corren localmente; (3) ninguna pantalla de juego tiene test de componente más allá de `CampScreen` (que falla); (4) cero tests E2E para los flujos críticos de combate, pago en aldea y level-up.

---

## Hallazgos

### [TEST-001] Dos suites fallando en el runner actual
**Archivos:** `__tests__/App.test.tsx`, `__tests__/CampScreen.test.tsx`  
**Severidad:** 🟡 Media — Tests ciegos: el runner reporta 2 suites como FAIL en cada ejecución, lo que normaliza ver rojo en el CI local

**Error actual:**
```
SyntaxError: Cannot use import statement outside a module
  at src/database/connection.ts:1:1
  → @op-engineering/op-sqlite no tiene mock en Jest
```

**Por qué es un problema:**
`App.test.tsx` hace un render completo de `App`, que transitivamente importa la base de datos. Jest no puede transformar el módulo nativo porque no tiene un mock. El resultado es que todo test que toque un componente que usa SQLite falla, lo que impedirá añadir tests de pantalla en el futuro.

**Solución paso a paso:**

1. Crear mock manual para `op-sqlite` en `__mocks__/@op-engineering/op-sqlite.ts`:

```ts
// __mocks__/@op-engineering/op-sqlite.ts
export const open = jest.fn(() => ({
  execute: jest.fn().mockResolvedValue({ rows: [] }),
  executeSync: jest.fn().mockReturnValue({ rows: [] }),
  close: jest.fn(),
  transaction: jest.fn((fn: (tx: unknown) => void) => fn({})),
}));
```

2. Añadir en `jest.config.js`:
```js
moduleNameMapper: {
  '@op-engineering/op-sqlite': '<rootDir>/__mocks__/@op-engineering/op-sqlite.ts',
}
```

3. Verificar que `App.test.tsx` pasa después de agregar el mock.

---

### [TEST-002] Sin CI/CD — tests solo corren localmente
**Archivos:** Proyecto raíz (sin `.github/workflows/`)  
**Severidad:** 🟡 Media — Un bug puede llegar a `main` sin que se detecte automáticamente

**Por qué es un problema:**
No existe ningún archivo de workflow de GitHub Actions. Esto significa que los tests, el type-check y el lint no se ejecutan automáticamente en cada push o PR.

**Solución paso a paso:**

1. Crear `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test -- --forceExit --passWithNoTests
      - run: npm run lint
```

---

### [TEST-003] Pantallas críticas sin tests de componente
**Archivos:** `src/screens/BattleScreen.tsx`, `src/screens/MainScreen.tsx`, `src/screens/VillageScreen.tsx`, `src/screens/MapScreen.tsx`, y ~15 pantallas más  
**Severidad:** 🟢 Baja — No es bloqueante dado que la lógica de negocio tiene cobertura, pero regresos son invisibles

**Por qué es un problema:**
`BattleScreen` es la pantalla más compleja de la app (~900 líneas) y no tiene ningún test. Un refactor o bug en la UI de combate no sería detectado automáticamente. Solo `CampScreen` tiene test de componente (fallando actualmente).

**Solución paso a paso (prioridad):**

Añadir al menos smoke tests para las pantallas críticas, una vez resuelto TEST-001:

```tsx
// __tests__/BattleScreen.smoke.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { BattleScreen } from '../src/screens/BattleScreen';

// Mock navigation + route + store
test('renders without crash', () => {
  expect(() => render(<BattleScreen navigation={mockNav} route={mockRoute} />)).not.toThrow();
});
```

**Recomendación de prioridad:** BattleScreen → MapScreen → VillageScreen

---

### [TEST-004] Sin tests E2E para flujos críticos
**Archivos:** Proyecto raíz (sin `/e2e/`)  
**Severidad:** 🟢 Baja — Los unit tests cubren la lógica, pero los flujos completos usuario→resultado no están validados

**Por qué es un problema:**
El happy path crítico (crear partida → explorar dungeon → combate → sobrevivir → aldea → comprar equipo) no está automatizado en ningún nivel de integración end-to-end.

**Herramienta recomendada:** Maestro (más sencillo que Detox para RN 0.84+)

**Flujos mínimos a cubrir:**
1. Crear nueva partida y llegar a `MapScreen`
2. Entrar en combate y ganar
3. Llegar a aldea y comprar un ítem
4. Level-up de un personaje

---

## Cobertura estimada por área

| Área | Estado | Severidad |
|------|--------|-----------|
| Lógica de combate (`combatEngine`) | ✅ Bien cubierta | — |
| Economía (`economyService`) | ✅ Bien cubierta | — |
| Loot (`lootService`) | ✅ Cubierta | — |
| Progresión / XP (`progressionService`) | ✅ Cubierta | — |
| PRNG (`prng`) | ✅ Cubierta | — |
| Migraciones DB (`migrations`) | ✅ Cubierta | — |
| Simulador de mundo (`worldSimulator`) | ✅ Test de perf | — |
| Narrativa (`NarrativeMomentPanel`) | ✅ Cubierta | — |
| Navegación (`navigation`) | ✅ Smoke test | — |
| Pantallas de juego (~23 screens) | ❌ Solo CampScreen (fallando) | 🟡 Media |
| E2E flujos críticos | ❌ Sin cobertura | 🟢 Baja |
| CI/CD pipeline | ❌ Sin workflow | 🟡 Media |
