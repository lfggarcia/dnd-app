# 07 · POLÍTICA, ALIANZAS Y GREMIO
> **Estado actual:** ~5% — GuildScreen con UI lista, sin contratos, sin alianzas, sin bounty board real
> **Sprint objetivo:** 6
> **Archivos a crear/modificar:** `migrations.ts` (v10), nuevo `src/services/allianceService.ts`, `GuildScreen.tsx`, nuevo `src/screens/AllianceScreen.tsx`

---

## Concepto

El gremio es el hub social de la Torre. Las parties pueden pagar protección, negociar contratos de no agresión, o publicar bounties. Las alianzas son contractuales: duran mientras se pague. No existe traición libre dentro de una alianza activa — solo terminación contractual. Las parties IA evalúan el bounty y el historial antes de aliarse.

---

## Estado Actual vs Objetivo

| Aspecto | Hoy | Objetivo |
|---------|-----|----------|
| GuildScreen | UI con lista de personajes y navegación | Hub social: contratos activos, bounty board, WorldLog |
| Alianzas | No existen | Tabla `alliances` + `allianceService.ts` |
| Bounty board | No existe | Lista de bounties activos con recompensas |
| Contratos activos | No existen | Lista de alianzas vigentes con ciclos restantes |

---

## Paso 1 — Migration v10: tabla `alliances`

```typescript
// src/database/migrations.ts — migration v10

10: [
  `CREATE TABLE IF NOT EXISTS alliances (
    id TEXT PRIMARY KEY,
    seed_hash TEXT NOT NULL,
    party_a TEXT NOT NULL,        -- game_id del jugador
    party_b TEXT NOT NULL,        -- nombre de la party IA
    protection_fee INTEGER NOT NULL DEFAULT 0,  -- gold por ciclo
    expires_at_cycle INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',      -- 'active' | 'expired' | 'terminated'
    created_at TEXT NOT NULL,
    created_cycle INTEGER NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_alliances_seed ON alliances(seed_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_alliances_party_a ON alliances(party_a)`,
  `CREATE INDEX IF NOT EXISTS idx_alliances_status ON alliances(status)`,
],
```

---

## Paso 2 — Servicio de alianzas

Crear `src/services/allianceService.ts`:

```typescript
/**
 * allianceService.ts
 * Gestiona contratos de alianza/protección entre el jugador y parties IA.
 * SYSTEMS.MD: "No existe traición arbitraria. La ruptura es contractual."
 */

import { getDB } from '../database/connection';
import type { RivalEntry } from './rivalGenerator';

// ─── Types ────────────────────────────────────────────────

export type Alliance = {
  id: string;
  seedHash: string;
  partyA: string;        // gameId del jugador
  partyB: string;        // nombre de la party IA
  protectionFee: number; // gold por ciclo
  expiresAtCycle: number;
  status: 'active' | 'expired' | 'terminated';
  createdCycle: number;
};

export type AllianceOffer = {
  rivalName: string;
  protectionFee: number;
  durationCycles: number;
  totalCost: number;
};

// ─── CRUD ─────────────────────────────────────────────────

export function getActiveAlliances(gameId: string, seedHash: string): Alliance[] {
  const db = getDB();
  const result = db.executeSync(
    `SELECT * FROM alliances WHERE party_a = ? AND seed_hash = ? AND status = 'active'
     ORDER BY expires_at_cycle ASC`,
    [gameId, seedHash],
  );
  return (result.rows ?? []).map(rowToAlliance);
}

export function isAlliedWith(gameId: string, rivalName: string, seedHash: string): boolean {
  const db = getDB();
  const result = db.executeSync(
    `SELECT id FROM alliances WHERE party_a = ? AND party_b = ? AND seed_hash = ? AND status = 'active'`,
    [gameId, rivalName, seedHash],
  );
  return (result.rows?.length ?? 0) > 0;
}

/**
 * Crea un nuevo contrato de alianza.
 */
export function formAlliance(
  gameId: string,
  seedHash: string,
  rivalName: string,
  protectionFee: number,
  durationCycles: number,
  currentCycle: number,
): Alliance {
  const db = getDB();
  const id = `${seedHash}_alliance_${gameId}_${rivalName}_${currentCycle}`;
  const expiresAt = currentCycle + durationCycles;

  db.executeSync(
    `INSERT INTO alliances (id, seed_hash, party_a, party_b, protection_fee, expires_at_cycle, status, created_at, created_cycle)
     VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), ?)`,
    [id, seedHash, gameId, rivalName, protectionFee, expiresAt, currentCycle],
  );

  return {
    id, seedHash, partyA: gameId, partyB: rivalName,
    protectionFee, expiresAtCycle: expiresAt,
    status: 'active', createdCycle: currentCycle,
  };
}

/**
 * Termina una alianza (fin de contrato, no traición).
 * SYSTEMS.MD: "Si el pago se detiene, la alianza termina automáticamente."
 */
export function terminateAlliance(allianceId: string): void {
  const db = getDB();
  db.executeSync(
    `UPDATE alliances SET status = 'terminated' WHERE id = ?`,
    [allianceId],
  );
}

/**
 * Verifica y expira alianzas vencidas en el ciclo actual.
 * Llamar desde gameStore.advanceCycle().
 */
export function expireOldAlliances(gameId: string, seedHash: string, currentCycle: number): string[] {
  const db = getDB();
  const expired = db.executeSync(
    `SELECT id, party_b FROM alliances WHERE party_a = ? AND seed_hash = ? AND status = 'active' AND expires_at_cycle <= ?`,
    [gameId, seedHash, currentCycle],
  );

  const expiredNames: string[] = [];
  for (const row of (expired.rows ?? [])) {
    db.executeSync(`UPDATE alliances SET status = 'expired' WHERE id = ?`, [row.id]);
    expiredNames.push(row.party_b as string);
  }

  return expiredNames;  // Para notificar al jugador qué alianzas expiraron
}

/**
 * Cobra la cuota de protección del ciclo actual.
 * Retorna el gold descontado (0 si no hay alianzas activas).
 */
export function chargeAllianceFees(gameId: string, seedHash: string): number {
  const alliances = getActiveAlliances(gameId, seedHash);
  return alliances.reduce((total, a) => total + a.protectionFee, 0);
}

// ─── IA: probabilidad de aceptar alianza ──────────────────

/**
 * SYSTEMS.MD: "La IA evalúa si atacar/aliarse conviene más que confrontar."
 * Factores: bountyLevel del jugador, rep del rival, fee ofrecido.
 */
export function evaluateAllianceOffer(
  offer: AllianceOffer,
  rival: RivalEntry,
  playerBountyLevel: number,
): { accepts: boolean; counterOffer?: AllianceOffer } {
  // Base: cuánto quiere cobrar la IA por protección
  const desiredFee = rival.floor * 30;  // más avanzado = más caro

  if (offer.protectionFee >= desiredFee * 0.9) {
    // Oferta aceptable
    return { accepts: true };
  }

  if (offer.protectionFee >= desiredFee * 0.5) {
    // Contra-oferta al precio justo
    return {
      accepts: false,
      counterOffer: {
        rivalName: offer.rivalName,
        protectionFee: desiredFee,
        durationCycles: offer.durationCycles,
        totalCost: desiredFee * offer.durationCycles,
      },
    };
  }

  // Oferta insultante → rechaza
  return { accepts: false };
}

// ─── Helpers ──────────────────────────────────────────────

function rowToAlliance(row: Record<string, unknown>): Alliance {
  return {
    id: row.id as string,
    seedHash: row.seed_hash as string,
    partyA: row.party_a as string,
    partyB: row.party_b as string,
    protectionFee: row.protection_fee as number,
    expiresAtCycle: row.expires_at_cycle as number,
    status: row.status as Alliance['status'],
    createdCycle: row.created_cycle as number,
  };
}
```

---

## Paso 3 — GuildScreen refactorizada como hub social

```typescript
// src/screens/GuildScreen.tsx — estructura de tabs actualizada

type GuildTab = 'ROSTER' | 'ALLIANCES' | 'BOUNTIES' | 'WORLDLOG';

export const GuildScreen = ({ navigation }: ScreenProps<'Guild'>) => {
  const activeGame = useGameStore(s => s.activeGame);
  const [activeTab, setActiveTab] = useState<GuildTab>('ROSTER');

  const alliances = useMemo(() =>
    activeGame ? getActiveAlliances(activeGame.id, activeGame.seedHash) : [],
    [activeGame],
  );

  const bounty = useMemo(() =>
    activeGame ? getBounty(activeGame.id, activeGame.seedHash) : null,
    [activeGame],
  );

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Header */}
      <View className="px-4 pt-4">
        <Text className="text-primary font-robotomono-bold text-lg">GREMIO DE AVENTUREROS</Text>
        <Text className="text-muted font-robotomono text-xs">TEMPORADA {activeGame?.cycle ?? 1}</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-primary/30 mt-4">
        {(['ROSTER', 'ALLIANCES', 'BOUNTIES', 'WORLDLOG'] as GuildTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 py-2 items-center ${activeTab === tab ? 'border-b-2 border-primary' : ''}`}
          >
            <Text className={`font-robotomono text-[10px] ${activeTab === tab ? 'text-primary' : 'text-muted'}`}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenido por tab */}
      {activeTab === 'ROSTER' && <RosterTab />}
      {activeTab === 'ALLIANCES' && <AlliancesTab alliances={alliances} navigation={navigation} />}
      {activeTab === 'BOUNTIES' && <BountiesTab bounty={bounty} />}
      {activeTab === 'WORLDLOG' && <WorldLogTab onViewAll={() => navigation.navigate('WorldLog')} />}
    </View>
  );
};
```

---

## Paso 4 — Tab de Alianzas

```typescript
// Dentro de GuildScreen.tsx o en componente separado

const AlliancesTab = ({ alliances, navigation }: { alliances: Alliance[]; navigation: any }) => {
  const activeGame = useGameStore(s => s.activeGame);
  const rivals = useMemo(() =>
    activeGame ? generateRivals(activeGame.seedHash) : [],
    [activeGame],
  );

  const unalliedRivals = rivals.filter(r =>
    !alliances.some(a => a.partyB === r.name) &&
    r.status === 'active'
  );

  return (
    <ScrollView className="flex-1 px-4 pt-4">

      {/* Alianzas activas */}
      <Text className="text-secondary font-robotomono-bold text-xs mb-2">CONTRATOS ACTIVOS ({alliances.length})</Text>
      {alliances.length === 0 && (
        <Text className="text-muted font-robotomono text-xs">Sin alianzas activas</Text>
      )}
      {alliances.map(alliance => (
        <View key={alliance.id} className="border border-primary/40 p-3 mb-2">
          <Text className="text-primary font-robotomono-bold text-xs">{alliance.partyB}</Text>
          <Text className="text-muted font-robotomono text-[10px]">
            Cuota: {alliance.protectionFee}G/ciclo · Expira: ciclo {alliance.expiresAtCycle}
          </Text>
          <TouchableOpacity
            onPress={() => terminateAlliance(alliance.id)}
            className="mt-2 border border-destructive/60 px-3 py-1 self-start"
          >
            <Text className="text-destructive font-robotomono text-[10px]">TERMINAR CONTRATO</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Parties disponibles para aliarse */}
      <Text className="text-secondary font-robotomono-bold text-xs mb-2 mt-4">
        PARTIES DISPONIBLES ({unalliedRivals.length})
      </Text>
      {unalliedRivals.slice(0, 5).map(rival => {
        const desiredFee = rival.floor * 30;
        return (
          <View key={rival.name} className="border border-muted/30 p-3 mb-2">
            <Text className="text-primary font-robotomono-bold text-xs">{rival.name}</Text>
            <Text className="text-muted font-robotomono text-[10px]">
              Piso {rival.floor} · Rep {rival.rep} · Fee estimado: ~{desiredFee}G/ciclo
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Alliance', { rivalName: rival.name })}
              className="mt-2 border border-secondary/60 px-3 py-1 self-start"
            >
              <Text className="text-secondary font-robotomono text-[10px]">NEGOCIAR</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
};
```

---

## Paso 5 — Integrar cobro de alianzas en advanceCycle

```typescript
// src/stores/gameStore.ts — en advanceCycle

advanceCycle: async (action) => {
  const { activeGame } = get();
  if (!activeGame) return;

  const { newCycle, newPhase } = advanceTime(activeGame.cycle, action);
  if (newCycle === activeGame.cycle) return;

  // 1. Expirar alianzas vencidas
  const expiredAlliances = expireOldAlliances(activeGame.id, activeGame.seedHash, newCycle);

  // 2. Cobrar cuotas de protección
  const allianceCost = chargeAllianceFees(activeGame.id, activeGame.seedHash);
  const newGold = Math.max(0, activeGame.gold - allianceCost);

  // 3. Si no hay gold para pagar → las alianzas se terminan automáticamente
  if (newGold === 0 && allianceCost > 0) {
    const alliances = getActiveAlliances(activeGame.id, activeGame.seedHash);
    alliances.forEach(a => terminateAlliance(a.id));
  }

  // 4. Simulación IA
  const { events } = await simulateWorld(activeGame.seedHash, newCycle, activeGame);

  // 5. Persistir
  get().updateProgress({ cycle: newCycle, phase: newPhase, gold: newGold });
  set({ lastSimulationEvents: events });
},
```

---

## Checklist de implementación

- [ ] Migration v10: tabla `alliances` (Paso 1)
- [ ] Crear `src/services/allianceService.ts` (Paso 2)
- [ ] GuildScreen: sistema de tabs (ROSTER/ALLIANCES/BOUNTIES/WORLDLOG) (Paso 3)
- [ ] GuildScreen AlliancesTab: ver contratos y parties disponibles (Paso 4)
- [ ] gameStore.advanceCycle: expirar alianzas y cobrar cuotas (Paso 5)
- [ ] Crear `AllianceScreen` para negociación con oferta/contra-oferta
- [ ] Añadir i18n keys: `guild.alliances`, `guild.bounties`, `guild.negotiate`, `guild.terminateContract`
- [ ] Integrar `isAlliedWith()` en `encounterService.ts` para skip de combate con aliados
- [ ] Añadir ruta `Alliance: { rivalName: string }` al navigator

---

## ACTUALIZACIÓN v2 — Integridad

### Bounty board en GuildScreen

El GuildScreen es el hub que unifica: contratos activos (doc 07), bounty board (doc 05) y WorldLog (doc 04). La pantalla ya tiene la UI construida; los datos reales llegan de tres fuentes:

```typescript
const alliances = getActiveAlliances(activeGame.id, activeGame.seedHash); // doc 07
const bounty    = getBounty(activeGame.id, activeGame.seedHash);          // doc 05
const worldLog  = getRecentEvents(activeGame.seedHash, 20);               // doc 04/08
```

### Cap de alianzas simultáneas (RI-05 en RIESGOS_POST)

```typescript
// src/services/allianceService.ts — añadir validación:
const MAX_SIMULTANEOUS_ALLIANCES = 2;

export function canCreateAlliance(gameId: string, seedHash: string): boolean {
  const active = getActiveAlliances(gameId, seedHash);
  return active.length < MAX_SIMULTANEOUS_ALLIANCES;
}
```

### PRNG compartido

```typescript
// Reemplazar makePRNG inline con:
import { makePRNG } from '../utils/prng';
```
