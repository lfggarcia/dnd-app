# 🧪 Testing — Auditoría TORRE (dnd3) — audit-002

> **Severidad general:** 🔴 Alta  
> **Archivos afectados:** 24+ archivos sin tests  
> **Esfuerzo estimado:** 3-5 días  
> **Fecha:** 2026-03-14

---

## Resumen ejecutivo

El estado de testing es crítico. Solo 2 de 22 screens tienen tests (`App.test.tsx` y
`CampScreen.test.tsx`), y ambos suites **fallan** porque `@op-engineering/op-sqlite` no está
mockeado en Jest. La cobertura global es 27.6% de statements y 14.96% de branches — la
mayoría del código del juego no tiene red de seguridad para refactors. La prioridad inmediata
es reparar el entorno de test para que el CI verde sea posible, luego aumentar cobertura de
los servicios críticos.

---

## Hallazgos

### [TEST-001] Jest config rota — 2 suites fallan por falta de mock de op-sqlite

> **Fuente:** 🤖 Auto-descubierto (BRF-002)

**Archivo(s):** `jest.config.js`, `jest.setup.js`  
**Severidad:** 🔴 Alta  
**Impacto:** CI roto desde la integración de op-sqlite. No se puede ejecutar `yarn test` 
limpiamente. Bloquea a cualquier desarrollador que intente verificar regresiones.

**Error actual:**
```
FAIL __tests__/App.test.tsx — Test suite failed to run
FAIL __tests__/CampScreen.test.tsx — Test suite failed to run

SyntaxError: Cannot use import statement outside a module
> 1 | import { open, type DB } from '@op-engineering/op-sqlite';
```

**Causa:** `@op-engineering/op-sqlite` es un native module con ESM exports. Jest usa CommonJS
por defecto y no puede transpilarlo, y no hay mock manual configurado.

**Solución paso a paso:**

1. Agregar mock de `@op-engineering/op-sqlite` en `jest.setup.js`:
```js
// jest.setup.js
jest.mock('@op-engineering/op-sqlite', () => {
  const mockDB = {
    execute: jest.fn(() => ({ rows: { _array: [] } })),
    executeAsync: jest.fn(() => Promise.resolve({ rows: { _array: [] } })),
    close: jest.fn(),
    transaction: jest.fn((fn) => fn(mockDB)),
  };
  return {
    open: jest.fn(() => mockDB),
    OPSQLite: {
      open: jest.fn(() => mockDB),
    },
  };
});
```

2. Verificar que los tests pasan:
```bash
yarn test __tests__/App.test.tsx
yarn test __tests__/CampScreen.test.tsx
```

3. Opcionalmente, agregar `@op-engineering/op-sqlite` al `transformIgnorePatterns` como
fallback por si el mock tiene gaps:
```js
// jest.config.js
transformIgnorePatterns: [
  'node_modules/(?!(@react-native|react-native|@react-navigation|nativewind|react-native-css-interop|@op-engineering)/)',
],
```

**Tiempo estimado:** 30 min  
**Prioridad:** P1 — Bloquea CI, resolver primero

---

### [TEST-002] Cobertura 14.96% de branches — sin red de seguridad

> **Fuente:** 🤖 Auto-descubierto (BRF-003)

**Archivo(s):** Toda la carpeta `src/`  
**Severidad:** 🔴 Alta  
**Impacto:** La mayoría del código crítico de juego no está testado. Un refactor o bug en
`gameStore`, `combatEngine`, o los servicios de economía puede pasar desapercibido.

**Cobertura actual:**
```
Statements   : 27.61% ( 193/699 )
Branches     : 14.96% ( 57/381 )
Functions    : 29.78% ( 42/141 )
Lines        : 29.15% ( 172/590 )
```

**Archivos sin tests (screens — las 22 screens del proyecto):**
Ninguna screen tiene tests (ver BRF-003).

**Archivos con tests existentes:**
- ✅ `__tests__/combatEngine.test.ts`
- ✅ `__tests__/economyService.test.ts`
- ✅ `__tests__/lootService.test.ts`
- ✅ `__tests__/migrations.test.ts`
- ✅ `__tests__/prng.test.ts`
- ✅ `__tests__/progressionService.test.ts`
- ✅ `__tests__/worldSimulator.perf.test.ts`
- ✅ `__tests__/navigation.test.tsx`
- ✅ `__tests__/NarrativeMomentPanel.test.tsx`
- ❌ `__tests__/App.test.tsx` — falla (BRF-002)
- ❌ `__tests__/CampScreen.test.tsx` — falla (BRF-002)

**Plan de ampliación de cobertura (priorizado):**

Fase 1 — Servicios críticos (mayor ROI):
```bash
# Tests faltantes críticos:
__tests__/gameStore.test.ts      # hydrate, startNewGame, updateProgress, endGame
__tests__/dungeonGraphService.test.ts  # generación de mapas
__tests__/characterStats.test.ts  # cálculos de stats DnD 5e
```

Fase 2 — Screens críticas:
```bash
__tests__/BattleScreen.test.tsx  # flujo de combate
__tests__/MapScreen.test.tsx     # navegación de rooms
__tests__/VillageScreen.test.tsx # compras, avance de ciclo
```

**Ejemplo de test para gameStore:**
```ts
// __tests__/gameStore.test.ts
import { act, renderHook } from '@testing-library/react-native';
import { useGameStore } from '../src/stores/gameStore';

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().clearActive();
  });

  it('startNewGame crea un juego activo', () => {
    const { result } = renderHook(() => useGameStore());
    
    act(() => {
      result.current.startNewGame('test-seed', 'hash123', []);
    });
    
    expect(result.current.activeGame).not.toBeNull();
    expect(result.current.activeGame?.seed).toBe('test-seed');
  });
});
```

**Tiempo estimado:** 3-4 días (Fase 1 + 2)  
**Prioridad:** P2 — Importante para estabilidad a largo plazo

---

### [TEST-003] 22 screens sin ningún test unitario

**Archivo(s):** Toda la carpeta `src/screens/`  
**Severidad:** 🟡 Media  
**Impacto:** Sin smoke tests básicos, una pantalla puede crashear en el arranque sin ser
detectado hasta que un usuario lo reporta.

**Estrategia mínima viable (snapshot + smoke test):**
```tsx
// __tests__/VillageScreen.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { VillageScreen } from '../src/screens/VillageScreen';

// Mock navigation
const mockNavigation = { navigate: jest.fn(), push: jest.fn(), goBack: jest.fn() };
const mockRoute = { params: {} };

describe('VillageScreen', () => {
  it('renderiza sin crashear', () => {
    expect(() => render(
      <VillageScreen navigation={mockNavigation as any} route={mockRoute as any} />
    )).not.toThrow();
  });
});
```

**Tiempo estimado:** 15-20 min por screen (smoke test básico)  
**Prioridad:** P3 — Una vez TEST-001 esté resuelto

---

## Checklist de verificación

- [ ] TEST-001: Mock de op-sqlite agregado a jest.setup.js
- [ ] TEST-001: `yarn test` pasa sin errores
- [ ] TEST-002: Tests de gameStore escritos y pasando
- [ ] TEST-002: Tests de dungeonGraphService escritos
- [ ] TEST-002: Tests de characterStats escritos
- [ ] TEST-003: Al menos 5 screens con smoke tests
