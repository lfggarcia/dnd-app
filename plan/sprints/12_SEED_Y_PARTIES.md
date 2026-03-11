# 12 · SEEDS, PARTIES Y CICLO DE VIDA
> **Estado actual:** ~40% — creación de party funciona, sin unificación de seeds, sin gestión de parties múltiples del sistema, sin simulación por lotes al cierre de temporada
> **Sprint objetivo:** 6
> **Archivos a crear/modificar:** nuevo `src/services/seedUnificationService.ts`, `gameStore.ts`, `SeedScreen.tsx`, nuevo `src/screens/UnificationScreen.tsx`, `migrations.ts` (v12), `gameRepository.ts`

---

## Concepto

Una seed no es solo una clave de generación — es un **universo persistente**. Todo lo que ocurre en una seed, desde la primera party que el jugador crea hasta las parties IA que el sistema genera para reemplazar a las caídas, forma parte del mismo mundo. Las rules de este sistema definen quién puede existir en ese universo, qué pasa cuando el jugador abandona su party, y cómo termina cada temporada.

---

## Estado Actual vs Objetivo

| Aspecto | Hoy | Objetivo |
|---------|-----|----------|
| Parties por seed | Sin límite real | 1 activa del jugador + máx 2 parties creadas por el jugador bajo control IA |
| Nueva party en misma seed | Crea partida nueva sin consecuencias | Unificación: party anterior pasa a IA, notificación y pantalla dedicada |
| Parties del sistema (IA puras) | Simuladas sin persistencia | Entidades reales en DB, reemplazadas al ser eliminadas heredando nivel |
| Cierre de temporada | Modal básico al ciclo 60 | Flujo completo: simulación por lotes → VillageScreen → nueva temporada |
| Party ex-jugador como rival | No existe | Party heredada usa IA para competir en la torre con el nuevo jugador |

---

## Reglas del sistema (fuente de verdad)

```
REGLAS DE PARTIES POR SEED:
─────────────────────────────────────────────────────────────────
R1. El jugador solo puede tener 1 party ACTIVA por seed en cualquier momento.

R2. Cuando el jugador crea una nueva party en una seed donde ya existe
    una party suya, la party anterior pasa a estado "IA_INHERITED"
    (controlada por el sistema). Esto es IRREVERSIBLE.

R3. El jugador puede tener máximo 2 parties en estado "IA_INHERITED"
    en la misma seed simultáneamente.

R4. Si el jugador intentara crear una cuarta party en esa seed
    (lo que llevaría a 3 en estado IA_INHERITED), el sistema
    ELIMINA PERMANENTEMENTE la más débil de las IA_INHERITED
    antes de crear la nueva party.

R5. "Más débil" = menor (nivel_promedio × HP_porcentaje_actual)
    Si hay empate, la más antigua es eliminada.

R6. Las parties puramente del sistema (nunca creadas por el jugador)
    se generan para mantener la torre activa y no cuentan para
    los límites de R3 y R4.

R7. Una party IA_INHERITED en bancarrota (0 HP en todos sus miembros
    sin gold para revivir) es eliminada y el sistema genera una
    party nueva de nivel heredado (ver R9) para reemplazarla.
    Esta nueva party es del SISTEMA, no heredada de jugador.

R8. Una party IA pura eliminada es siempre reemplazada por otra
    party IA pura en el mismo ciclo de simulación.

R9. Nivel heredado de reemplazo:
    - IA_INHERITED eliminada → nueva party SISTEMA hereda floor(nivel_promedio × 0.7)
    - Party SISTEMA eliminada → nueva party SISTEMA hereda floor(nivel_promedio × 0.5)

REGLA DE UNIFICACIÓN DE SEED:
─────────────────────────────────────────────────────────────────
R10. Si el jugador crea una nueva seed con el MISMO NOMBRE que una
     seed existente, el sistema detecta la colisión y lanza el
     flujo de UNIFICACIÓN (ver Paso 3).

R11. En la unificación: la party activa de la seed existente
     pasa a IA_INHERITED. El jugador pierde control de ella.

R12. La nueva party que el jugador está creando se convierte
     en la party ACTIVA de esa seed.
─────────────────────────────────────────────────────────────────
```

---

## Paso 1 — Migration v12: campos de ciclo de vida de party

```typescript
// src/database/migrations.ts — migration v12

12: [
  // Estado extendido de partida guardada
  // 'active'       = jugador en control
  // 'ia_inherited' = ex-jugador, controlada por sistema
  // 'system'       = nunca fue del jugador
  // 'completed'    = llegó al ciclo 60 y pasó al pueblo
  // 'dead'         = eliminada por bancarrota total
  // 'purged'       = eliminada por regla R4 (era la más débil)
  `ALTER TABLE saved_games ADD COLUMN party_origin TEXT NOT NULL DEFAULT 'player'
   CHECK(party_origin IN ('player','ia_inherited','system'))`,

  `ALTER TABLE saved_games ADD COLUMN predecessor_game_id TEXT`,
  -- ID de la partida que precedió a esta (para trazabilidad de herencia)

  `ALTER TABLE saved_games ADD COLUMN created_by_player INTEGER NOT NULL DEFAULT 1`,
  -- 1 = creada por el jugador, 0 = generada por el sistema

  `ALTER TABLE saved_games ADD COLUMN elimination_reason TEXT`,
  -- 'bankrupt' | 'purged_weakest' | 'normal_completion'

  `CREATE INDEX IF NOT EXISTS idx_games_seed_origin ON saved_games(seed_hash, party_origin)`,
  `CREATE INDEX IF NOT EXISTS idx_games_seed_active ON saved_games(seed_hash, status)`,
],
```

---

## Paso 2 — seedUnificationService.ts

```typescript
// src/services/seedUnificationService.ts

import { getDB } from '../database/connection';
import type { SavedGame } from '../database/gameRepository';

// ─── Types ────────────────────────────────────────────────

export type SeedStatus = {
  seedHash: string;
  activePlayerGame: SavedGame | null;    // la 1 activa del jugador
  inheritedGames: SavedGame[];           // ex-jugador, controladas por IA (máx 2)
  systemGames: SavedGame[];              // parties puramente del sistema
};

export type PartyStrength = {
  gameId: string;
  score: number;  // nivel_promedio × HP_porcentaje
};

// ─── Leer estado de la seed ───────────────────────────────

export function getSeedStatus(seedHash: string): SeedStatus {
  const db = getDB();
  const rows = db.executeSync(
    `SELECT * FROM saved_games WHERE seed_hash = ? AND status IN ('active','ia_inherited','system')
     ORDER BY created_at ASC`,
    [seedHash],
  ).rows ?? [];

  const games = rows.map(rowToSavedGame);

  return {
    seedHash,
    activePlayerGame: games.find(g => g.status === 'active' && g.createdByPlayer) ?? null,
    inheritedGames:   games.filter(g => g.partyOrigin === 'ia_inherited'),
    systemGames:      games.filter(g => g.partyOrigin === 'system'),
  };
}

// ─── Verificar colisión de nombre de seed ─────────────────

/**
 * Detecta si existe una seed con el mismo nombre antes de crearla.
 * Retorna la partida activa existente si hay colisión.
 */
export function detectSeedCollision(seedHash: string): SavedGame | null {
  const status = getSeedStatus(seedHash);
  return status.activePlayerGame;
}

// ─── Calcular fuerza de una party ─────────────────────────

/**
 * R5: "Más débil" = menor (nivel_promedio × HP_porcentaje_actual)
 */
export function calculatePartyStrength(game: SavedGame): number {
  const avgLevel = game.partyData.reduce((s, c) => s + (c.level ?? 1), 0) / game.partyData.length;
  const avgHPPct = game.partyData
    .filter(c => c.alive)
    .reduce((s, c) => s + c.hp / c.maxHp, 0) / Math.max(1, game.partyData.filter(c => c.alive).length);
  return avgLevel * avgHPPct;
}

// ─── Regla R4: eliminar la más débil ─────────────────────

/**
 * Si el jugador va a crear una 4ta party (3 IA_INHERITED existirían),
 * elimina permanentemente la más débil de las IA_INHERITED.
 * Retorna el nombre de la party eliminada (para notificar al jugador).
 */
export function purgeWeakestInherited(seedHash: string): string | null {
  const { inheritedGames } = getSeedStatus(seedHash);

  if (inheritedGames.length < 3) return null; // No se necesita purgar

  const ranked = inheritedGames
    .map(g => ({ game: g, strength: calculatePartyStrength(g) }))
    .sort((a, b) => a.strength - b.strength);

  const weakest = ranked[0].game;

  const db = getDB();
  db.executeSync(
    `UPDATE saved_games SET status = 'dead', elimination_reason = 'purged_weakest' WHERE id = ?`,
    [weakest.id],
  );

  return weakest.seed; // nombre de la party para el mensaje de notificación
}

// ─── Unificación de seed ──────────────────────────────────

/**
 * R10-R12: Ejecutar la unificación cuando se detecta colisión de nombre.
 * Convierte la party activa actual en IA_INHERITED.
 * La nueva party (aún no creada) será la nueva activa.
 */
export function executeUnification(existingGameId: string): void {
  const db = getDB();
  db.executeSync(
    `UPDATE saved_games
     SET party_origin = 'ia_inherited', status = 'ia_inherited'
     WHERE id = ?`,
    [existingGameId],
  );
}

// ─── Helpers internos ─────────────────────────────────────

function rowToSavedGame(row: Record<string, unknown>): SavedGame {
  // importar o duplicar según arquitectura del proyecto
  return row as unknown as SavedGame;
}
```

---

## Paso 3 — Flujo de unificación: detección en SeedScreen

```typescript
// src/screens/SeedScreen.tsx — en handleCreateGame, antes de navegar

import { detectSeedCollision, purgeWeakestInherited } from '../services/seedUnificationService';

const handleCreateGame = useCallback(async () => {
  const seedHash = generateSeedHash(seedInput);

  // Verificar colisión de nombre
  const existingGame = detectSeedCollision(seedHash);

  if (existingGame) {
    // Hay una party activa del jugador en esta seed
    // Mostrar pantalla de unificación antes de continuar
    navigation.navigate('UnificationScreen', {
      seedName: seedInput,
      seedHash,
      existingGameId: existingGame.id,
      existingParty: existingGame.partyData,
      existingCycle: existingGame.cycle,
      existingFloor: existingGame.floor,
    });
    return;
  }

  // No hay colisión → flujo normal de creación
  navigation.navigate('CharacterCreation', { seedHash });
}, [seedInput, navigation]);
```

---

## Paso 4 — UnificationScreen: pantalla de notificación

```typescript
// src/screens/UnificationScreen.tsx
// Pantalla de impacto narrativo que aparece ANTES de crear la nueva party

export const UnificationScreen = ({ navigation, route }: ScreenProps<'UnificationScreen'>) => {
  const {
    seedName, seedHash, existingGameId,
    existingParty, existingCycle, existingFloor,
  } = route.params;

  const { executeUnification, purgeWeakestInherited } = seedUnificationService;
  const { getSeedStatus } = seedUnificationService;

  const seedStatus = getSeedStatus(seedHash);
  const willPurge  = seedStatus.inheritedGames.length >= 2;
  const purgedName = willPurge
    ? (() => {
        const ranked = seedStatus.inheritedGames
          .map(g => ({ g, s: calculatePartyStrength(g) }))
          .sort((a, b) => a.s - b.s);
        return ranked[0].g.seed;
      })()
    : null;

  const handleConfirmUnification = useCallback(() => {
    // Si se necesita purgar → eliminar la más débil primero (R4)
    if (willPurge) {
      purgeWeakestInherited(seedHash);
    }

    // Convertir party activa en IA_INHERITED (R11)
    executeUnification(existingGameId);

    // Navegar a creación de nueva party
    navigation.navigate('CharacterCreation', { seedHash, isUnification: true });
  }, [willPurge, seedHash, existingGameId, navigation]);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View className="flex-1 bg-background justify-center px-6">
      <CRTOverlay />

      {/* Título de impacto */}
      <View className="items-center mb-8">
        <Text className="text-destructive font-robotomono-bold text-2xl">⚠ SEED UNIFICADA</Text>
        <Text className="text-primary font-robotomono text-sm mt-2">
          "{seedName.toUpperCase()}" ya existe en este mundo
        </Text>
      </View>

      {/* Resumen de la party que pasará a IA */}
      <View className="border border-destructive/40 p-4 mb-4">
        <Text className="text-destructive font-robotomono-bold text-xs mb-2">
          TU PARTY ANTERIOR PERDERÁ TU CONTROL
        </Text>
        <Text className="text-muted font-robotomono text-[10px] mb-3">
          Ciclo {existingCycle} · Piso {existingFloor}
        </Text>
        {existingParty.map(char => (
          <Text key={char.name} className="text-primary font-robotomono text-xs">
            · {char.name} — Nv {char.level ?? 1} {char.alive ? '' : '(muerto)'}
          </Text>
        ))}
        <Text className="text-muted font-robotomono text-[10px] mt-3">
          Esta party continuará escalando/descendiendo la Torre bajo control del sistema.
          Podrás encontrarla como rival. No podrás recuperarla.
        </Text>
      </View>

      {/* Advertencia de purga (solo si aplica) */}
      {willPurge && purgedName && (
        <View className="border border-accent/40 p-4 mb-4">
          <Text className="text-accent font-robotomono-bold text-xs mb-1">
            ⚠ UNA PARTY SERA ELIMINADA PERMANENTEMENTE
          </Text>
          <Text className="text-muted font-robotomono text-[10px]">
            Ya existen 2 parties bajo control del sistema en esta seed.
            La más débil — "{purgedName}" — será eliminada para dar lugar a tu nueva party.
            Sus personajes desaparecerán del mundo.
          </Text>
        </View>
      )}

      {/* Motivación para continuar */}
      <View className="border border-primary/20 p-4 mb-6">
        <Text className="text-primary font-robotomono text-xs">
          El mundo de "{seedName.toUpperCase()}" seguirá siendo el mismo.
          Tu nueva party heredará el nivel promedio de la anterior
          y comenzará la siguiente temporada.
        </Text>
      </View>

      {/* Botones */}
      <TouchableOpacity
        onPress={handleConfirmUnification}
        className="border border-destructive bg-destructive/20 py-4 items-center mb-3"
      >
        <Text className="text-destructive font-robotomono-bold text-sm">
          CONFIRMAR — ENTRAR A ESTE MUNDO
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleCancel}
        className="border border-muted/40 py-3 items-center"
      >
        <Text className="text-muted font-robotomono text-xs">CANCELAR — ELEGIR OTRA SEED</Text>
      </TouchableOpacity>
    </View>
  );
};
```

---

## Paso 5 — Integrar party IA_INHERITED en worldSimulator

Las parties `IA_INHERITED` se simulan exactamente igual que las parties del sistema, pero con algunas diferencias importantes:

```typescript
// src/services/worldSimulator.ts — modificar simulateWorld

// Al cargar los rivals, incluir también parties IA_INHERITED de la seed
const allAIParties = [
  ...generateRivals(seedHash),                    // parties del sistema (PRNG)
  ...loadInheritedParties(seedHash, activeGame),  // ex-jugador
];

// En loadInheritedParties:
export function loadInheritedParties(seedHash: string, activeGame: SavedGame): RivalEntry[] {
  const db = getDB();
  const rows = db.executeSync(
    `SELECT * FROM saved_games
     WHERE seed_hash = ? AND party_origin = 'ia_inherited' AND status = 'ia_inherited'`,
    [seedHash],
  ).rows ?? [];

  return rows.map(row => ({
    name: row.seed as string,
    floor: row.floor as number,
    rep: 50,  // reputación neutral al inicio de su vida como IA
    status: 'active' as const,
    // Perfil derivado del comportamiento histórico del jugador (R11 extendida)
    inferredProfile: inferProfileFromPlayerHistory(row as unknown as SavedGame),
  }));
}

/**
 * Infiere el perfil estratégico de una party ex-jugador
 * basándose en sus últimas acciones registradas.
 */
function inferProfileFromPlayerHistory(game: SavedGame): AIProfile {
  // Contar tipos de acciones del jugador en la partida
  // Si el jugador siempre atacó primero → AGGRESSIVE
  // Si negoció muchas veces → OPPORTUNISTIC
  // Si descansó mucho → DEFENSIVE
  // Si evitó el PvP → SURVIVALIST
  // Por ahora: derivar del piso alcanzado y ciclos usados
  const efficiency = game.floor / Math.max(1, game.cycle);
  if (efficiency > 0.8) return 'AGGRESSIVE';
  if (efficiency > 0.5) return 'OPPORTUNISTIC';
  if (game.cycle > 40)  return 'DEFENSIVE';
  return 'SURVIVALIST';
}
```

---

## Paso 6 — Sistema de ventaja: herencia de items de la party eliminada

Cuando una party IA es eliminada por bancarrota (R7/R8), la nueva party que la reemplaza hereda una **ventaja específica** contra la party que la eliminó.

```typescript
// src/services/worldSimulator.ts — en executeAction, caso huntParty (victoria)

// Cuando una party elimina a otra por completo (hp <= 0 y sin gold para revivir):
if (updated.hp <= 0 && updated.gold <= 0) {
  // La party eliminada es reemplazada por una nueva que:
  //  1. Hereda su nivel al 70%
  //  2. Hereda sus items (los que no se "perdieron en batalla")
  //  3. Obtiene el modificador VENDETTA contra la party que la eliminó
  spawnReplacementParty(
    state.entry,       // party eliminada
    state.entry.name,  // su nombre (para el VENDETTA)
    cycle,
    seedHash,
    events,
  );
}

function spawnReplacementParty(
  eliminated: RivalEntry,
  killedByPartyName: string,
  cycle: number,
  seedHash: string,
  events: SimulationEvent[],
): AIPartyState {
  const inheritedLevel = Math.floor((eliminated.floor) * 0.7);

  // El modificador VENDETTA hace a la nueva party más peligrosa contra su objetivo
  const vendettaModifier: VendettaModifier = {
    targetPartyName: killedByPartyName,
    damageBonus: 0.25,       // +25% daño contra el objetivo
    detectionBonus: 0.20,    // +20% detección del objetivo (les encuentra más fácil)
    expiresAfterKill: true,  // se cancela si logra derrotar al objetivo
  };

  const newPartyName = generateReplacementName(eliminated.name, seedHash, cycle);

  events.push({
    type: 'AI_PARTY_SPAWNED',
    cycle,
    floor: 1,
    partyName: newPartyName,
    targetName: eliminated.name,
    summary: `${newPartyName} emerge de las cenizas de ${eliminated.name}, jurando venganza contra ${killedByPartyName}`,
    summary_en: `${newPartyName} rises from the ashes of ${eliminated.name}, swearing vengeance against ${killedByPartyName}`,
  });

  return {
    entry: {
      name: newPartyName,
      floor: 1,
      rep: 30,
      status: 'active',
    },
    cycleProgress: cycle,
    hp: 100,
    gold: inheritedLevel * 30,
    consecutiveLosses: 0,
    profile: 'AGGRESSIVE', // las parties de venganza empiezan agresivas
    vendetta: vendettaModifier,
  };
}
```

---

## Paso 7 — Modificador de relajación tras exterminio

Cuando una party IA extermina completamente a otra (sin posibilidad de revivir a ningún miembro), hay consecuencias para su perfil:

```typescript
// src/services/worldSimulator.ts — tras eliminar a una party por completo

// La party agresiva que exterminó a la otra:
//  1. El bounty por violencia PvP se CANCELA (la víctima ya no existe)
//  2. La party obtiene modificador RELAXED: reduce agresividad durante N ciclos
//  3. No puede volver a ser AGGRESSIVE durante MIN_RELAXED_CYCLES ciclos

const MIN_RELAXED_CYCLES = 5;

function applyPostExterminationRelaxation(
  attacker: AIPartyState,
  cycle: number,
): AIPartyState {
  return {
    ...attacker,
    profile: 'DEFENSIVE',   // forzado temporalmente
    relaxedUntilCycle: cycle + MIN_RELAXED_CYCLES,
    // Esto reduce los pesos de huntParty a 0 hasta que expire
  };
}

// En decideAction: verificar el modificador antes de asignar pesos
function decideAction(state: AIPartyState, ...): AIAction {
  // Si está en modo RELAXED → forzar pesos defensivos independientemente del perfil
  if (state.relaxedUntilCycle && state.cycleProgress < state.relaxedUntilCycle) {
    return selectFromWeights({ ...DEFENSIVE_WEIGHTS, huntParty: 0 }, rng);
  }
  // ... resto de la lógica normal
}
```

---

## Paso 8 — Simulación por lotes al cierre de temporada

Cuando el jugador elige "Esperar fin de temporada" desde una zona segura, los ciclos restantes se simulan en lotes de 6 con feedback visual dinámico.

```typescript
// src/stores/gameStore.ts — nueva acción

advanceCycleBatch: async (targetCycle: number) => {
  const { activeGame } = get();
  if (!activeGame) return;

  const batchSize = 6;
  let current = activeGame.cycle;
  const allEvents: SimulationEvent[] = [];

  while (current < targetCycle) {
    const batchEnd = Math.min(current + batchSize, targetCycle);

    // Simular el lote
    const { updatedRivals, events } = await simulateWorld(
      activeGame.seedHash,
      batchEnd,
      { ...activeGame, cycle: current },
    );

    allEvents.push(...events);

    // Actualizar ciclo y mostrar progreso
    get().updateProgress({ cycle: batchEnd });
    set({
      lastSimulationEvents: events,
      simulationBatchProgress: {
        current: batchEnd,
        target: targetCycle,
        percentage: Math.round((batchEnd / targetCycle) * 100),
        // Los 3 eventos más importantes del lote para mostrar en el loading
        highlights: extractHighlights(events, 3),
      },
    });

    current = batchEnd;

    // Pequeña pausa para que la UI pueda actualizar (evitar freeze)
    await new Promise(resolve => setTimeout(resolve, 16));
  }

  // Todos los ciclos simulados → abrir el pueblo
  set({ lastSimulationEvents: allEvents.slice(-20) });
  get().closeTowerAndOpenVillage();
},
```

```typescript
// src/screens/SimulationLoadingScreen.tsx
// Pantalla que muestra mientras se simulan los ciclos por lotes

export const SimulationLoadingScreen = ({ navigation }: ScreenProps<'SimulationLoading'>) => {
  const progress   = useGameStore(s => s.simulationBatchProgress);
  const isComplete = progress?.current >= progress?.target;

  useEffect(() => {
    if (isComplete) {
      navigation.replace('CycleTransition');
    }
  }, [isComplete, navigation]);

  return (
    <View className="flex-1 bg-background justify-center px-6">
      <CRTOverlay />

      {/* Visualización de días/noches pasando */}
      <View className="items-center mb-8">
        <Text className="text-muted font-robotomono text-xs mb-2">SIMULANDO TEMPORADA</Text>
        <Text className="text-primary font-robotomono-bold text-4xl">
          {progress?.current ?? 0} / {progress?.target ?? 60}
        </Text>
        <Text className="text-muted font-robotomono text-xs mt-1">CICLOS</Text>
      </View>

      {/* Barra de progreso */}
      <View className="h-2 bg-primary/10 mb-6">
        <View
          style={{ width: `${progress?.percentage ?? 0}%` }}
          className="h-2 bg-primary"
        />
      </View>

      {/* Eventos destacados del lote actual */}
      <Text className="text-muted font-robotomono-bold text-xs mb-3">LO MÁS DESTACADO</Text>
      {progress?.highlights?.map((event, i) => (
        <View key={i} className="border-l-2 border-primary/40 pl-3 mb-3">
          <Text className="text-primary font-robotomono text-xs">{event.summary}</Text>
          <Text className="text-muted font-robotomono text-[9px]">
            Ciclo {event.cycle} · Piso {event.floor}
          </Text>
        </View>
      ))}

      <Text className="text-muted font-robotomono text-[10px] mt-6 text-center">
        Los días y las noches se suceden en la Torre...
      </Text>
    </View>
  );
};

/**
 * Extrae los N eventos más importantes de un lote.
 * Prioridad: BOSS_KILLED > AI_ELIMINATED > AI_FLOOR_ADVANCE > resto
 */
function extractHighlights(events: SimulationEvent[], count: number): SimulationEvent[] {
  const priority: Record<string, number> = {
    BOSS_KILLED: 4,
    AI_ELIMINATED: 3,
    BOUNTY_ISSUED: 3,
    ALLIANCE_FORMED: 2,
    AI_FLOOR_ADVANCE: 1,
  };
  return [...events]
    .sort((a, b) => (priority[b.type] ?? 0) - (priority[a.type] ?? 0))
    .slice(0, count);
}
```

---

## Paso 9 — Cierre de Torre y apertura del Pueblo

```typescript
// src/stores/gameStore.ts — closeTowerAndOpenVillage

closeTowerAndOpenVillage: () => {
  const { activeGame } = get();
  if (!activeGame) return;

  // Marcar la partida como 'completed' — temporada finalizada
  get().updateProgress({ status: 'completed' });

  // Calcular herencia para la próxima temporada (ya disponible en el store)
  const inheritedLevel = calculateInheritedLevel(activeGame.partyData);

  set({
    towerClosed: true,
    pendingInheritedLevel: inheritedLevel,
  });
},
```

```typescript
// src/screens/VillageScreen.tsx — disponible SOLO cuando towerClosed = true

const towerClosed = useGameStore(s => s.towerClosed);

// Si la Torre no está cerrada → VillageScreen no debería poder renderizarse
// (protección de navegación en AppNavigator)
useEffect(() => {
  if (!towerClosed) {
    // Redirigir al MapScreen si alguien navega aquí por error
    navigation.replace('Map');
  }
}, [towerClosed, navigation]);
```

---

## Flujo completo del ciclo de vida de una seed

```
CREACIÓN:
  Jugador introduce nombre de seed
      ↓
  detectSeedCollision(seedHash)
      ↓
  [Sin colisión]                    [Con colisión]
  CharacterCreation                 UnificationScreen
      ↓                                 ↓
  Party ACTIVA creada               Confirmar unificación
                                        ↓
                                    Party anterior → IA_INHERITED
                                    CharacterCreation (nueva party)

DURANTE LA TEMPORADA (60 ciclos):
  Party activa explora la Torre
  worldSimulator procesa parties IA + IA_INHERITED en cada ciclo
  Si IA eliminada → spawn de reemplazo con herencia parcial de nivel
  Si IA extermina a otra → modificador de relajación + spawn con vendetta

CIERRE DE TEMPORADA (ciclo 60 o simulación desde zona segura):
  advanceCycleBatch → SimulationLoadingScreen (lotes de 6)
      ↓
  closeTowerAndOpenVillage()
      ↓
  VillageScreen disponible
  Revivir personajes muertos
  Gestionar inventario final
      ↓
  Nueva temporada → herencia de nivel → SeedScreen/CharacterCreation

NUEVA PARTY EN MISMA SEED:
  SeedScreen → detectSeedCollision → UnificationScreen
      ↓
  executeUnification (activa → ia_inherited)
  Si hay 2 ia_inherited → purgeWeakestInherited primero
      ↓
  Nueva party activa con nivel heredado de la anterior
```

---

## Checklist de implementación

- [ ] Migration v12: campos `party_origin`, `predecessor_game_id`, `created_by_player`, `elimination_reason` (Paso 1)
- [ ] Crear `src/services/seedUnificationService.ts` completo (Paso 2)
- [ ] SeedScreen: detectar colisión y navegar a `UnificationScreen` (Paso 3)
- [ ] Crear `src/screens/UnificationScreen.tsx` con resumen narrativo (Paso 4)
- [ ] `worldSimulator.ts`: cargar y simular parties `IA_INHERITED` (Paso 5)
- [ ] `worldSimulator.ts`: spawn de reemplazo con herencia + modificador VENDETTA (Paso 6)
- [ ] `worldSimulator.ts`: modificador de relajación post-exterminio (Paso 7)
- [ ] `gameStore.advanceCycleBatch`: simulación por lotes de 6 ciclos (Paso 8)
- [ ] Crear `src/screens/SimulationLoadingScreen.tsx` con eventos destacados (Paso 8)
- [ ] `gameStore.closeTowerAndOpenVillage()` y guard en VillageScreen (Paso 9)
- [ ] `inferProfileFromPlayerHistory()` para perfil de parties ex-jugador (Paso 5)
- [ ] Añadir rutas `UnificationScreen` y `SimulationLoading` al navigator
- [ ] `simulationBatchProgress` añadido al `GameState` del store
- [ ] Añadir i18n keys: `seed.collision`, `unification.title`, `unification.warning`, `unification.confirm`, `simulation.loading`, `simulation.highlights`
- [ ] AppNavigator: guard que bloquea navegación a VillageScreen si `!towerClosed`

---

## ACTUALIZACIÓN v2 — Integridad con docs 06, 09 y 08

### Level cap en calculatePartyStrength

```typescript
// src/services/seedUnificationService.ts
// La fórmula de fortaleza usa el nivel del personaje.
// En Sprint 6: MAX_LEVEL_MVP = 10
// En Sprint 7+: MAX_LEVEL_FULL = 20
// Usar import { MAX_LEVEL_MVP } from './progressionService'
// para que la constante sea un único lugar de verdad.
```

### inferProfileFromPlayerHistory → aiProfileEngine

```typescript
// La función inferProfileFromPlayerHistory() definida en este doc
// debe RESIDIR en src/services/aiProfileEngine.ts (doc 09), no aquí.
// Este archivo la llama, pero aiProfileEngine.ts es el dueño.

import { inferProfileFromPlayerHistory } from './aiProfileEngine';

// Uso en seedUnificationService al crear IA_INHERITED:
const efficiency = floor / cyclesUsed;
const profile = inferProfileFromPlayerHistory(efficiency, pvpKills, bossKills);
```

### PRNG compartido

```typescript
// Reemplazar makePRNG inline con:
import { makePRNG } from '../utils/prng';
```
