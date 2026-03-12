# TORRE — Guía de Refactor: Separación de Lógica, Atom Design y Archivos Largos
> Auditoría v5.0 · 2026-03-12 · Fase final — el proyecto funciona, ahora se estructura

---

## ¿Por qué refactorizar en fase final?

El proyecto fue construido en sprints rápidos. Las pantallas crecieron incorporando lógica, servicios y UI en el mismo archivo. Esto es normal y acceptable durante desarrollo, pero en fase final genera:

1. **Archivos difíciles de mantener**: `BattleScreen.tsx` tiene 1568 líneas — es difícil encontrar un bug sin leer todo el archivo.
2. **Lógica mezclada con UI**: `PartyScreen.tsx` tiene llamadas a `generateCharacterPortrait` y `generateCharacterExpressions` directamente en el componente — viola el principio de separación de responsabilidades.
3. **Falta de reutilización**: `EnemyCard`, `PartyCard`, `TurnToken` están definidos en `BattleScreen.tsx` — no pueden usarse en `ReportScreen` o `CampScreen` sin copiar código.
4. **No sigue React ni Atom Design**: los componentes de UI primitivos están mezclados con los de lógica compleja.

**Regla de oro:** Si separar algo crea un memory leak, multiplica los re-renders, o rompe la coherencia del estado → **no separar**. Este documento justifica cada decisión.

---

## Qué es Atom Design en este contexto

Atom Design es una metodología de organización de componentes UI en niveles de complejidad:

| Nivel | Ejemplos en este proyecto | Responsabilidad |
|-------|--------------------------|-----------------|
| **Átomos** | `HPBar`, `MoraleChip`, `ActionSlotButton`, `CRTText` | Primitivos visuales sin estado propio |
| **Moléculas** | `CharacterPortraitCard`, `TurnTokenRow`, `CombatLogStrip` | Composición de átomos con props simples |
| **Organismos** | `BattleActionBar`, `EnemyGrid`, `PartyStrip`, `MapRoomPanel` | Componentes con lógica de presentación |
| **Templates** | Layout de una pantalla sin datos reales | Estructura abstracta de la pantalla |
| **Pantallas** | `BattleScreen`, `MapScreen`, etc. | Conectadas al store + lógica de negocio |

En React Native la carpeta quedaría:

```
src/
  components/
    atoms/         ← primitivos
    molecules/     ← composiciones
    organisms/     ← componentes complejos
    party/         ← ya existe, mantener
  hooks/           ← lógica encapsulada
    combat/        ← hooks de combate
    map/           ← hooks de mapa
  screens/         ← solo pantallas wired al store
  services/        ← solo lógica pura (sin JSX)
```

---

## RF-01 🔴 — BattleScreen.tsx (1568 líneas): extraer sub-componentes

### Diagnóstico

`BattleScreen.tsx` contiene:
- 6 sub-componentes definidos en el módulo: `TurnToken`, `TurnTimeline`, `EnemyCard`, `PartyCard`, `LogStrip`, `DefeatAnimation`
- 1 componente principal: `BattleScreen` (la pantalla en sí) con ~600 líneas de lógica
- 1 bloque de estilos: `StyleSheet.create(S)` con ~500 líneas
- 17 imports

**Criterio de separación:** Los 6 sub-componentes ya usan `memo()` — ya son componentes puros con props bien definidas. Solo necesitan moverse a sus propios archivos.

**¿Por qué no hacerlo antes?** Porque `StyleSheet.create` compartido en un módulo puede ser más eficiente si los estilos no se recrean. Al separar, los estilos deben ir con cada componente o a un archivo de tokens compartidos.

### Plan de extracción (seguro, sin riesgo de memory leak)

**Paso 1 — Crear la carpeta de atoms y molecules de combate**

```bash
mkdir -p src/components/atoms
mkdir -p src/components/molecules
mkdir -p src/components/organisms
mkdir -p src/components/organisms/battle
```

**Paso 2 — Extraer `HPBar` (átomo nuevo — no existe pero es necesario)**

```typescript
// src/components/atoms/HPBar.tsx
// Razón de extracción: se usa en EnemyCard, PartyCard, y potencialmente CampScreen/ReportScreen
// Riesgo: ninguno — es un componente visual puro sin estado

type HPBarProps = {
  current: number;
  max: number;
  width: number;
  color?: string;
};

export const HPBar = memo(({ current, max, width, color = '#00FF41' }: HPBarProps) => {
  const pct = Math.max(0, Math.min(1, current / max));
  const barColor = pct > 0.5 ? color : pct > 0.25 ? '#FF9F0A' : '#FF453A';
  return (
    <View style={{ width, height: 4, backgroundColor: 'rgba(0,255,65,0.15)', borderRadius: 2 }}>
      <View style={{ width: width * pct, height: 4, backgroundColor: barColor, borderRadius: 2 }} />
    </View>
  );
});
```

**Paso 3 — Extraer los 6 sub-componentes existentes**

| Componente actual | Destino | Razón |
|------------------|---------|-------|
| `TurnToken` | `src/components/atoms/TurnToken.tsx` | Primitivo visual — círculo en la timeline |
| `TurnTimeline` | `src/components/molecules/TurnTimeline.tsx` | Composición de TurnTokens |
| `EnemyCard` | `src/components/organisms/battle/EnemyCard.tsx` | Carta de enemigo con lógica de display |
| `PartyCard` | `src/components/organisms/battle/PartyCard.tsx` | Carta de personaje con HP y retrato |
| `LogStrip` | `src/components/molecules/CombatLogStrip.tsx` | Tira de log de combate |
| `DefeatAnimation` | `src/components/organisms/battle/DefeatAnimation.tsx` | Animación de derrota |

**Por qué es seguro:**  
Todos ya usan `React.memo`. Las props están bien tipadas. No tienen estado propio ni acceden al store directamente — reciben todo por props. El único riesgo sería si los estilos se redefinen en cada render del padre, pero `StyleSheet.create` garantiza que los objetos de estilo son estables.

**Paso 4 — Separar los estilos del BattleScreen**

Los estilos son ~500 líneas de `StyleSheet.create`. Al separar los componentes, cada uno lleva sus estilos. El stylesheet del BattleScreen queda solo con los estilos de la pantalla en sí.

```typescript
// src/components/organisms/battle/EnemyCard.tsx — lleva sus propios estilos
const S = StyleSheet.create({
  // solo los estilos de EnemyCard
});
```

**Paso 5 — Extraer `useCombat` hook**

La lógica del combate en `BattleScreen` (init, dispatch, phase transitions) puede encapsularse:

```typescript
// src/hooks/combat/useCombat.ts
// Encapsula:
// - initCombat al montar
// - useReducer del LiveCombatState
// - advanceTurnLive, findNextLiveTurn
// - useEffect de phase transitions
// - los handlers: handleAttack, handleAbility, handleDodge, handleDash, handleHelp

// ADVERTENCIA DE PERFORMANCE: El hook recibe cs (LiveCombatState) del store local.
// Si el hook se actualiza pero el componente no necesita re-render completo,
// verificar que el reducer no produzca objetos nuevos innecesariamente.
// Usar el patrón: dispatch solo cambia lo que cambió (inmutable spread).
```

**¿Es seguro separar el hook?**  
Sí, siempre que el hook use `useReducer` local (no Zustand). El estado de combate (`LiveCombatState`) es estado local del componente — no va al store global. Separar en un hook no cambia el ciclo de vida del estado.

**Resultado esperado después de RF-01:**

| Archivo | Líneas antes | Líneas después |
|---------|-------------|----------------|
| `BattleScreen.tsx` | 1568 | ~400 (solo JSX de layout + orquestación) |
| `useCombat.ts` (nuevo) | — | ~350 |
| `EnemyCard.tsx` (nuevo) | — | ~100 |
| `PartyCard.tsx` (nuevo) | — | ~100 |
| `TurnTimeline.tsx` (nuevo) | — | ~80 |
| `DefeatAnimation.tsx` (nuevo) | — | ~60 |
| `CombatLogStrip.tsx` (nuevo) | — | ~40 |
| `HPBar.tsx` (nuevo) | — | ~30 |

---

## RF-02 🟡 — PartyScreen.tsx (876 líneas): separar lógica de generación de imágenes

### Diagnóstico

`PartyScreen.tsx` tiene embebida la lógica de:
- Generación de retratos (`generateCharacterPortrait`)
- Generación de expresiones (`generateCharacterExpressions`)
- Progreso de generación (`LaunchProgressModal`)
- UI de creación de personajes

Esta mezcla viola el principio de que las pantallas solo deben **orquestar** servicios, no implementarlos.

### Plan de extracción

**Paso 1 — Crear `usePortraitGeneration` hook**

```typescript
// src/hooks/usePortraitGeneration.ts
// Encapsula:
// - generatingForIdx (qué índice se está generando)
// - handleGeneratePortrait (llamar al servicio + guardar resultado)
// - handleGenerateAllPortraits (batch de todos los personajes)
// - handleGenerateExpressions (expresiones por personaje)
// - progress state para LaunchProgressModal

export function usePortraitGeneration(party: CharacterSave[]) {
  const [generatingForIdx, setGeneratingForIdx] = useState<number | null>(null);
  const [batchProgress, setBatchProgress] = useState<string>('');
  const saveCharacterPortraits = useGameStore(s => s.saveCharacterPortraits);
  const saveCharacterExpressions = useGameStore(s => s.saveCharacterExpressions);

  const generatePortrait = useCallback(async (idx: number) => {
    if (generatingForIdx !== null) return;
    const char = party[idx];
    if (!char) return;
    setGeneratingForIdx(idx);
    try {
      const uri = await generateCharacterPortrait(char);
      // Con FEAT-07 (imageStorageService): guardar en filesystem
      const localUri = await savePortraitToFS(char.characterId, uri);
      saveCharacterPortraits({ [String(idx)]: localUri });
      // Intentar expresiones en background
      generateCharacterExpressions(char, uri)
        .then(expressions => saveCharacterExpressions({ [String(idx)]: expressions }))
        .catch(() => { /* non-blocking */ });
    } finally {
      setGeneratingForIdx(null);
    }
  }, [generatingForIdx, party, saveCharacterPortraits, saveCharacterExpressions]);

  return { generatingForIdx, batchProgress, generatePortrait };
}
```

**¿Es seguro?**  
Sí. El hook encapsula estado local (`generatingForIdx`, `batchProgress`) que pertenece a la lógica de generación, no a la UI de la party. No accede al DOM ni crea listeners que necesiten cleanup específico. Las promesas se resuelven normalmente.

**⚠️ No extraer en este momento:** El estado de `generatingForIdx` en el hook actual también controla la UI de progreso en el modal. Si se extrae el hook pero el modal sigue en la pantalla, hay que pasar `generatingForIdx` como prop — lo cual es aceptable y limpio.

### Lo que NO mover (justificación)

| Lógica | Razón para no mover |
|--------|---------------------|
| Inicialización de personajes (`initPartyFromSeed`) | Es lógica de una sola ejecución en mount — moverla crea una dependencia del hook en el ciclo de vida del componente sin beneficio real |
| `LaunchProgressModal` render | Es UI de la pantalla — debe permanecer en PartyScreen. El hook expone el estado, la pantalla renderiza el modal |

---

## RF-03 🟡 — GuildScreen.tsx (696 líneas): separar secciones en organismos

### Diagnóstico

`GuildScreen.tsx` tiene 4 secciones expandibles: Party, Rankings, Alianzas, Bounty Board. Cada sección tiene su propia lógica de datos y UI. Actualmente todo está inline.

### Plan

**Extraer como organismos:**

```
src/components/organisms/guild/
  RankingsSection.tsx    — lista de rankings con formato
  AlliancesSection.tsx   — lista de alianzas activas
  BountySection.tsx      — tabla de bounties
```

**Conservar en GuildScreen:**
- El `useFocusEffect` de refresh de datos
- La orquestación de qué sección está abierta (`showRankings`, `showAlliances`, etc.)
- La navegación a `CharacterDetail`

**¿Es seguro extraer?**  
Sí, con una condición: las queries DB (`getAllActiveBounties`, `getActiveAlliances`) deben permanecer en `GuildScreen` dentro del `useMemo` o `useEffect`, y los datos se pasan como props a los organismos. **No** mover las queries al interior de los componentes hijo — eso crearía múltiples queries para el mismo dato.

```typescript
// ✅ CORRECTO — query en GuildScreen, datos como props
const activeBounties = useMemo(() => { ... }, [showBountyBoard]);
<BountySection bounties={activeBounties} />

// ❌ INCORRECTO — query dentro del organismo hijo
// BountySection hace la query internamente
// → dos renders del padre = dos queries = inconsistencia posible
```

---

## RF-04 🟡 — MapScreen.tsx (748 líneas): extraer `MapRoomPanel`

### Diagnóstico

El panel inferior del mapa (cuando se selecciona una sala) tiene ~70 líneas de JSX con lógica condicional por tipo de sala. Es candidato a ser un organismo separado.

### Plan

```typescript
// src/components/organisms/map/MapRoomPanel.tsx
type MapRoomPanelProps = {
  room: DungeonRoom;
  isBossCleared: boolean;
  floorIndex: number;
  party: CharacterSave[];
  onEnter: () => void;
  onCancel: () => void;
  onReturnToVillage: () => void;
};
```

**¿Es seguro extraer?**  
Sí. El panel es UI pura con props bien definidas. No tiene estado propio — todo el estado viene del padre. Los handlers son callbacks que se pasan como props.

**Advertencia:** `BossRoomEntryUI` ya está separado (`src/components/BossRoomEntryUI.tsx`) y funciona bien. Seguir el mismo patrón.

---

## RF-05 🔴 — combatEngine.ts (976 líneas): NO separar — justificación técnica

### ¿Por qué no separar?

`combatEngine.ts` tiene 976 líneas pero es un **servicio puro** (no JSX). Sus funciones son altamente cohesivas — dependen entre sí mediante el tipo `LiveCombatState`. Separar en múltiples archivos crearía:

1. **Imports circulares**: `resolveEnemyTurn` necesita tipos definidos junto a `resolvePlayerAttack`. Si se separan, ambos importan los tipos del otro.
2. **Overhead sin beneficio**: El motor de combate no se renderiza — no hay tree shaking que se beneficie de la separación.
3. **Dificultad de mantenimiento**: Un bug de combate requeriría consultar 4-5 archivos en lugar de 1.

**Sí aplicar en combatEngine.ts:**
- Agregar `characterId` a los tipos (FEAT-07)
- Agregar `applyStandardAction` (BUG-01)
- Mantener en el mismo archivo

---

## RF-06 🟡 — gameStore.ts: separar `advanceCycle` lógica

### Diagnóstico

`gameStore.ts` (238 líneas) es razonablemente pequeño, pero la función `advanceCycle` tiene lógica de negocio embebida (llamar a `simulateWorld`, calcular nuevos ciclos, actualizar rivales). Esto debería estar en un servicio, no en el store.

### Plan

```typescript
// src/services/cycleService.ts (nuevo)
// Responsabilidad: calcular el nuevo estado del ciclo
// Devuelve los datos a persistir — sin side effects de DB

export function computeCycleAdvance(
  game: SavedGame,
  action: TimeAction,
): {
  newCycleRaw: number;
  newCycle: number;
  simEvents: SimulationEvent[];
} {
  const cost = CYCLE_COST[action];
  const newRaw = (game.cycleRaw ?? 0) + cost;
  const newCycle = Math.floor(newRaw);
  const simEvents = newCycle > (game.cycle ?? 0)
    ? simulateWorld(game.seedHash, game.cycle ?? 0, newCycle)
    : [];
  return { newCycleRaw: newRaw, newCycle, simEvents };
}

// gameStore.ts — advanceCycle queda delgado
advanceCycle: async (action) => {
  const { activeGame } = get();
  if (!activeGame) return;
  const { newCycleRaw, newCycle, simEvents } = computeCycleAdvance(activeGame, action);
  set(state => ({ lastSimulationEvents: simEvents }));
  updateSavedGame(activeGame.id, { cycleRaw: newCycleRaw, cycle: newCycle });
  // ... guardar rivales
},
```

**¿Es seguro?**  
Sí. `computeCycleAdvance` es una función pura. El store sigue siendo la fuente de verdad para el estado. La separación no cambia el ciclo de vida ni crea listeners extra.

---

## RF-07 🔴 — Atoms faltantes: primitivos UI que se repiten

### Diagnóstico

Los siguientes elementos visuales aparecen múltiples veces en el código pero no están centralizados como átomos:

| Elemento | Aparece en | Propuesta |
|----------|-----------|-----------|
| Texto con fuente `RobotoMono-Bold` | 20+ archivos | `CRTText` átomo |
| Barra de progreso HP | `EnemyCard`, `PartyCard`, `CampScreen` | `HPBar` átomo |
| Chip de moral | `BattleScreen`, `CampScreen` | `MoraleChip` átomo |
| Botón con borde CRT | Todas las pantallas | `CRTButton` átomo |

### Crear `CRTText` átomo

```typescript
// src/components/atoms/CRTText.tsx
// Razón: la fuente RobotoMono-Bold se usa en 20+ lugares con los mismos props
// Centralizar evita inconsistencias en size/color cuando se haga theming

type CRTTextProps = {
  children: React.ReactNode;
  size?: number;
  color?: string;
  bold?: boolean;
  style?: StyleProp<TextStyle>;
};

export const CRTText = memo(({ children, size = 12, color = '#00FF41', bold = false, style }: CRTTextProps) => (
  <Text
    style={[
      {
        fontFamily: bold ? 'RobotoMono-Bold' : 'RobotoMono-Regular',
        fontSize: size,
        color,
      },
      style,
    ]}
  >
    {children}
  </Text>
));
```

**¿Cuándo NO usar CRTText?**  
Si el texto tiene animaciones `Animated.Text` o estilos muy específicos del contexto — en ese caso es mejor dejar el `Text` nativo directamente.

---

## RF-08 — Archivos que NO deben separarse (justificaciones)

| Archivo | Líneas | Razón para NO separar |
|---------|--------|----------------------|
| `combatEngine.ts` | 976 | Servicio puro cohesivo — separar crea imports circulares |
| `dungeonGraphService.ts` | ~350 | Algoritmo de grafos cohesivo — separar requeriría pasar tipos entre archivos |
| `worldSimulator.ts` | ~340 | Motor de simulación — depende fuertemente de `rivalRepository` y tipos compartidos |
| `gameRepository.ts` | ~450 | Capa de datos — centralizarla es una ventaja, no un problema |
| `gameStore.ts` | 238 | Ya es pequeño — la lógica de `advanceCycle` puede separarse a `cycleService.ts` opcionalmente |
| `migrations.ts` | ~300 | Historial inmutable de migraciones — debe permanecer monolítico |

---

## Orden de implementación de refactors

```
FASE 1 — Extracciones sin riesgo (2-3 días)
  RF-07: Crear átomos HPBar, CRTText          — sin riesgo, nuevos archivos
  RF-01: Extraer sub-componentes de Battle    — mover archivos, actualizar imports
  RF-04: Extraer MapRoomPanel                 — mismo patrón que BossRoomEntryUI

FASE 2 — Extracción de lógica (2-3 días)
  RF-02: Hook usePortraitGeneration           — encapsular generación en PartyScreen
  RF-06: Separar cycleService                 — limpiar gameStore

FASE 3 — Organismos de Guild (1 día)
  RF-03: RankingsSection, AlliancesSection    — separar secciones de GuildScreen

VERIFICACIÓN FINAL
  - No hay warnings de duplicate key
  - No hay memory leaks (animaciones con cleanup)
  - No hay queries DB en render phase
  - Tests existentes en __tests__/ siguen pasando
```

---

## Checklist de calidad post-refactor

**Por cada archivo extraído verificar:**
- [ ] `React.memo` aplicado si el componente es puro (solo props, sin estado)
- [ ] Props tipadas con interfaz `type XXXProps = {...}`
- [ ] Si el componente tiene animaciones, tiene `return () => cancelAnimation(...)` en cleanup
- [ ] Si el componente hace queries DB, las queries están en `useEffect` no en `useMemo`
- [ ] Si el componente usa `useGameStore`, usa selector granular `s => s.specificField`
- [ ] El archivo tiene menos de 200 líneas (excepción: pantallas complejas hasta 500)
- [ ] No hay imports no usados
- [ ] Los tests en `__tests__/` siguen pasando tras el refactor
