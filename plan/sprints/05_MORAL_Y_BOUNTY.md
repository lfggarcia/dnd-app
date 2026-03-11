# 05 · IA, MORAL Y BOUNTY
> **Estado actual:** ~4% — `rivalGenerator.ts` genera datos estáticos, sin simulación ni moral
> **Sprint objetivo:** 6
> **Archivos a crear/modificar:** nuevo `src/services/moralSystem.ts`, nuevo `src/services/bountyService.ts`, `migrations.ts`, `gameRepository.ts`, `GuildScreen.tsx`

---

## Concepto

Cada personaje tiene un nivel de moral influenciado por sus acciones. Si la party mata otras parties repetidamente, los miembros de alineamiento bueno pueden abandonar. El bounty es permanente en la seed: no hay redención automática. Las parties IA evalúan el bounty al decidir si atacar o aliarse.

---

## Estado Actual vs Objetivo

| Aspecto | Hoy | Objetivo |
|---------|-----|----------|
| Moral de personajes | No existe | Campo `morale: number` (0-100) por personaje |
| Abandono de miembros | No existe | Al moral < 20 y alineamiento bueno/legal → abandona |
| Bounty del jugador | No existe | Se acumula por matar parties, visible en GuildScreen |
| Tabla `bounties` en DB | No existe | Entidad persistida con nivel, recompensa, historial |
| Tabla `events` en DB | No existe | Historial permanente de violencia |

---

## Paso 1 — Migration v9: tablas `bounties` y `events`

```typescript
// src/database/migrations.ts — migration v9

9: [
  // Historial permanente de eventos (no se puede borrar)
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    seed_hash TEXT NOT NULL,
    type TEXT NOT NULL,
    floor INTEGER NOT NULL,
    cycle INTEGER NOT NULL,
    party_name TEXT NOT NULL,
    target_name TEXT,
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_events_seed ON events(seed_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`,
  `CREATE INDEX IF NOT EXISTS idx_events_cycle ON events(cycle)`,

  // Bounties activos en la seed
  `CREATE TABLE IF NOT EXISTS bounties (
    id TEXT PRIMARY KEY,
    seed_hash TEXT NOT NULL,
    target_game_id TEXT NOT NULL,     -- la partida del jugador
    issued_by TEXT NOT NULL DEFAULT 'GUILD',
    reward_amount INTEGER NOT NULL DEFAULT 0,
    bounty_level INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    kill_count INTEGER NOT NULL DEFAULT 0,   -- cuántas parties ha matado
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_bounties_seed ON bounties(seed_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_bounties_active ON bounties(is_active)`,
],
```

---

## Paso 2 — Añadir `morale` y `deathCount` a CharacterSave

```typescript
// src/database/gameRepository.ts — actualizar CharacterSave

export type CharacterSave = {
  name: string;
  race: string;
  charClass: string;
  subclass: string;
  background: string;
  alignment: string;
  baseStats: Stats;
  statMethod: 'standard' | 'rolled';
  featureChoices: Record<string, string | string[]>;
  hp: number;
  maxHp: number;
  alive: boolean;
  portrait?: string;
  // ─── NUEVOS CAMPOS ───────────────────────────────────
  level: number;            // nivel actual (inicia en 1)
  xp: number;               // experiencia acumulada
  deathCount: number;       // veces que ha muerto (afecta costo de revivir)
  morale: number;           // 0-100 (inicia en 80)
  killCount: number;        // parties IA eliminadas (afecta moral y bounty)
};
```

---

## Paso 3 — Sistema de moral

Crear `src/services/moralSystem.ts`:

```typescript
/**
 * moralSystem.ts
 * Gestiona la moral de los personajes y el abandono.
 * SYSTEMS.MD: "Si la party ataca frecuentemente otras parties → tensión moral → abandono"
 */

import type { CharacterSave } from '../database/gameRepository';

// ─── Constantes ───────────────────────────────────────────

export const MORALE_INITIAL   = 80;
export const MORALE_MIN       = 0;
export const MORALE_MAX       = 100;
export const ABANDON_THRESHOLD = 20;  // morale < 20 → riesgo de abandono

// ─── Modificadores de moral ───────────────────────────────

export type MoralEvent =
  | 'KILL_MONSTER'          // +1
  | 'KILL_RIVAL_PARTY'      // -20 para alineamiento legal/bueno
  | 'PARTY_MEMBER_DIED'     // -10 para todos
  | 'BOSS_DEFEATED'         // +15
  | 'REST_LONG'             // +5
  | 'FLOOR_ADVANCE'         // +8
  | 'MEMBER_ABANDONED'      // -15 para todos los que quedan
  | 'GOLD_REWARD'           // +3
  | 'DEFEAT_IN_COMBAT';     // -15

const MORALE_DELTAS: Record<MoralEvent, (alignment: string) => number> = {
  KILL_MONSTER:        () => 1,
  KILL_RIVAL_PARTY:    (alignment) => isGoodOrLawful(alignment) ? -20 : -5,
  PARTY_MEMBER_DIED:   () => -10,
  BOSS_DEFEATED:       () => 15,
  REST_LONG:           () => 5,
  FLOOR_ADVANCE:       () => 8,
  MEMBER_ABANDONED:    () => -15,
  GOLD_REWARD:         () => 3,
  DEFEAT_IN_COMBAT:    () => -15,
};

function isGoodOrLawful(alignment: string): boolean {
  const lower = alignment.toLowerCase();
  return lower.includes('good') || lower.includes('lawful') ||
         lower.includes('bueno') || lower.includes('legal');
}

function isEvilOrChaotic(alignment: string): boolean {
  const lower = alignment.toLowerCase();
  return lower.includes('evil') || lower.includes('chaotic') ||
         lower.includes('maligno') || lower.includes('caótico');
}

// ─── Aplicar evento moral ─────────────────────────────────

/**
 * Aplica un evento moral a toda la party.
 * Personajes malignos o caóticos tienen menos penalización por PvP.
 */
export function applyMoralEvent(
  party: CharacterSave[],
  event: MoralEvent,
): CharacterSave[] {
  return party.map(char => {
    if (!char.alive) return char;
    const delta = MORALE_DELTAS[event](char.alignment);
    const newMorale = Math.max(MORALE_MIN, Math.min(MORALE_MAX, (char.morale ?? MORALE_INITIAL) + delta));
    return { ...char, morale: newMorale };
  });
}

// ─── Verificar abandono ───────────────────────────────────

export type AbandonCheckResult = {
  abandoned: CharacterSave[];
  remained: CharacterSave[];
  log: string[];
};

/**
 * SYSTEMS.MD: "Si moral < 20 y alineamiento bueno/legal → puede abandonar"
 * Se llama después de aplicar eventos morales severos (matar rival, miembro muerto).
 */
export function checkForAbandonment(
  party: CharacterSave[],
  seedHash: string,
  cycle: number,
): AbandonCheckResult {
  const log: string[] = [];
  const abandoned: CharacterSave[] = [];
  const remained: CharacterSave[] = [];

  // PRNG determinístico para el ciclo actual
  let h = 5381;
  const key = `${seedHash}_moral_${cycle}`;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 33) ^ key.charCodeAt(i)) >>> 0;
  let s = h >>> 0;
  const rand = () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0x100000000; };

  for (const char of party) {
    if (!char.alive) { remained.push(char); continue; }

    const morale = char.morale ?? MORALE_INITIAL;
    const isAtRisk = morale < ABANDON_THRESHOLD && (isGoodOrLawful(char.alignment));

    if (isAtRisk) {
      // Probabilidad de abandono: más baja la moral, más probable
      const abandonChance = (ABANDON_THRESHOLD - morale) / ABANDON_THRESHOLD;
      if (rand() < abandonChance) {
        abandoned.push(char);
        log.push(`${char.name.toUpperCase()} ABANDONA LA PARTY — moral demasiado baja (${morale})`);
        continue;
      }
    }
    remained.push(char);
  }

  return { abandoned, remained, log };
}

// ─── Pool de aventureros exclusivo ────────────────────────

/**
 * SYSTEMS.MD: "Si un miembro abandona → se genera un aventurero nuevo del pool exclusivo."
 * Mismo nivel base, no editable inicialmente.
 */
export function generateReplacementAdventurer(
  abandonedChar: CharacterSave,
  seedHash: string,
  cycle: number,
): CharacterSave {
  // El reemplazo tiene el mismo nivel base pero stats neutrales
  return {
    ...abandonedChar,
    name: `RECRUIT_${cycle}`,
    alignment: 'True Neutral',
    morale: 60,  // comienza con moral moderada
    killCount: 0,
    deathCount: 0,
    hp: abandonedChar.maxHp,
    alive: true,
    // Stats un poco menores que el promedio
    baseStats: {
      STR: 10, DEX: 10, CON: 10,
      INT: 10, WIS: 10, CHA: 10,
    },
  };
}
```

---

## Paso 4 — Sistema de bounty

Crear `src/services/bountyService.ts`:

```typescript
/**
 * bountyService.ts
 * Sistema de recompensas por violencia.
 * SYSTEMS.MD: "El historial de violencia es PERMANENTE. No existe redención automática."
 */

import { getDB } from '../database/connection';

// ─── Types ────────────────────────────────────────────────

export type BountyRecord = {
  id: string;
  seedHash: string;
  targetGameId: string;
  rewardAmount: number;
  bountyLevel: number;  // 0-5
  isActive: boolean;
  killCount: number;
};

// ─── Umbrales de bounty ───────────────────────────────────

// SYSTEMS.MD: se activa cuando mata repetidamente otras parties
const BOUNTY_THRESHOLDS = [
  { kills: 1,  level: 1, reward: 200,   label: 'SOSPECHOSO' },
  { kills: 3,  level: 2, reward: 500,   label: 'BUSCADO' },
  { kills: 5,  level: 3, reward: 1200,  label: 'PELIGROSO' },
  { kills: 8,  level: 4, reward: 3000,  label: 'MUY_PELIGROSO' },
  { kills: 12, level: 5, reward: 7500,  label: 'ASESINO_EN_SERIE' },
];

// ─── CRUD ─────────────────────────────────────────────────

export function getBounty(gameId: string, seedHash: string): BountyRecord | null {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM bounties WHERE target_game_id = ? AND seed_hash = ? AND is_active = 1',
    [gameId, seedHash],
  );
  if (!result.rows?.length) return null;
  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    seedHash: row.seed_hash as string,
    targetGameId: row.target_game_id as string,
    rewardAmount: row.reward_amount as number,
    bountyLevel: row.bounty_level as number,
    isActive: Boolean(row.is_active),
    killCount: row.kill_count as number,
  };
}

/**
 * Se llama CADA VEZ que el jugador elimina una party rival.
 * SYSTEMS.MD: "El bounty NO desaparece con el tiempo."
 */
export function recordPartyKill(
  gameId: string,
  seedHash: string,
  victimName: string,
  cycle: number,
  floor: number,
): BountyRecord {
  const db = getDB();

  // Registrar el evento (permanente)
  const eventId = `${seedHash}_kill_${cycle}_${victimName}`;
  db.executeSync(
    `INSERT OR IGNORE INTO events (id, seed_hash, type, floor, cycle, party_name, target_name, data, created_at)
     VALUES (?, ?, 'PARTY_KILL', ?, ?, 'PLAYER', ?, '{}', datetime('now'))`,
    [eventId, seedHash, floor, cycle, victimName],
  );

  // Obtener o crear bounty
  let bounty = getBounty(gameId, seedHash);

  if (!bounty) {
    const id = `${seedHash}_bounty_${gameId}`;
    db.executeSync(
      `INSERT INTO bounties (id, seed_hash, target_game_id, issued_by, reward_amount, bounty_level, is_active, kill_count, created_at, updated_at)
       VALUES (?, ?, ?, 'GUILD', 200, 1, 1, 1, datetime('now'), datetime('now'))`,
      [id, seedHash, gameId],
    );
    bounty = getBounty(gameId, seedHash)!;
  } else {
    // Incrementar kill count y actualizar nivel
    const newKills = bounty.killCount + 1;
    const newLevel = BOUNTY_THRESHOLDS
      .filter(t => t.kills <= newKills)
      .reduce((max, t) => t.level > max.level ? t : max, BOUNTY_THRESHOLDS[0]);

    db.executeSync(
      `UPDATE bounties SET kill_count = ?, bounty_level = ?, reward_amount = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [newKills, newLevel.level, newLevel.reward, bounty.id],
    );
    bounty = getBounty(gameId, seedHash)!;
  }

  return bounty;
}

/**
 * SYSTEMS.MD: "BountyRiskMultiplier = 1 + (BountyLevel × 0.2)"
 * Afecta la probabilidad de emboscada y la dificultad de encuentros.
 */
export function getBountyRiskMultiplier(bountyLevel: number): number {
  return 1 + bountyLevel * 0.2;
}

/**
 * Retorna el label visible del bounty para la UI.
 */
export function getBountyLabel(bountyLevel: number): string {
  return BOUNTY_THRESHOLDS.find(t => t.level === bountyLevel)?.label ?? 'LIMPIO';
}
```

---

## Paso 5 — Mostrar bounty en GuildScreen

```typescript
// src/screens/GuildScreen.tsx — añadir sección de bounty

import { getBounty, getBountyLabel, getBountyRiskMultiplier } from '../services/bountyService';

const GuildScreen = ({ navigation }: ScreenProps<'Guild'>) => {
  const activeGame = useGameStore(s => s.activeGame);
  const bounty = useMemo(() =>
    activeGame ? getBounty(activeGame.id, activeGame.seedHash) : null,
    [activeGame],
  );

  return (
    <ScrollView>
      {/* Sección de bounty */}
      {bounty && bounty.bountyLevel > 0 && (
        <View style={{ borderColor: '#FF3E3E', borderWidth: 1, padding: 12 }}>
          <Text style={{ color: '#FF3E3E', fontFamily: 'RobotoMono-Bold' }}>
            ⚠ BOUNTY ACTIVO
          </Text>
          <Text style={{ color: '#FF3E3E', fontFamily: 'RobotoMono-Regular' }}>
            Estado: {getBountyLabel(bounty.bountyLevel)}
          </Text>
          <Text style={{ color: '#FFB000', fontFamily: 'RobotoMono-Regular' }}>
            Recompensa: {bounty.rewardAmount}G
          </Text>
          <Text style={{ color: '#FFB000', fontFamily: 'RobotoMono-Regular' }}>
            Parties eliminadas: {bounty.killCount}
          </Text>
          <Text style={{ color: 'rgba(255,62,62,0.7)', fontFamily: 'RobotoMono-Regular', fontSize: 10 }}>
            Multiplicador de riesgo: ×{getBountyRiskMultiplier(bounty.bountyLevel).toFixed(1)}
          </Text>
        </View>
      )}

      {/* Moral del party */}
      {activeGame?.partyData.map(char => (
        <View key={char.name}>
          <Text>{char.name}: Moral {char.morale ?? 80}/100</Text>
          {(char.morale ?? 80) < 30 && (
            <Text style={{ color: '#FF3E3E', fontSize: 10 }}>
              ⚠ En riesgo de abandonar
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
};
```

---

## Paso 6 — Integrar moral en combate

```typescript
// src/screens/BattleScreen.tsx — en handleContinue, después del combate

import { applyMoralEvent, checkForAbandonment } from '../services/moralSystem';
import { recordPartyKill } from '../services/bountyService';

const handleContinue = useCallback(() => {
  if (!result || !activeGame) return;

  let updatedParty = activeGame.partyData;

  // Aplicar eventos morales según resultado
  if (result.outcome === 'DEFEAT') {
    updatedParty = applyMoralEvent(updatedParty, 'DEFEAT_IN_COMBAT');
  }

  // Si algún compañero murió
  const membersDied = result.partyAfter.filter((m, i) =>
    activeGame.partyData[i]?.alive && !m.alive
  ).length;
  if (membersDied > 0) {
    for (let i = 0; i < membersDied; i++) {
      updatedParty = applyMoralEvent(updatedParty, 'PARTY_MEMBER_DIED');
    }
  }

  // Si fue combate PvP y ganamos → moral impacta y registra bounty
  if (encounterContext?.kind === 'pvp' && result.outcome === 'VICTORY') {
    updatedParty = applyMoralEvent(updatedParty, 'KILL_RIVAL_PARTY');
    recordPartyKill(activeGame.id, activeGame.seedHash, encounterContext.rivalName, activeGame.cycle, activeGame.floor);
  }

  // Verificar si alguien abandona
  const { abandoned, remained, log: abandonLog } = checkForAbandonment(
    updatedParty, activeGame.seedHash, activeGame.cycle
  );

  if (abandoned.length > 0) {
    // Mostrar modal de abandono antes de continuar
    setAbandonedMembers(abandoned);
    setAbandonLog(abandonLog);
    setShowAbandonModal(true);
    return;
  }

  updateProgress({ partyData: remained });
  // ... resto de handleContinue
}, [result, activeGame, encounterContext]);
```

---

## Checklist de implementación

- [ ] Migration v9: tablas `events` y `bounties` (Paso 1)
- [ ] Actualizar `CharacterSave` con `level`, `xp`, `deathCount`, `morale`, `killCount` (Paso 2)
- [ ] Crear `src/services/moralSystem.ts` (Paso 3)
- [ ] Crear `src/services/bountyService.ts` (Paso 4)
- [ ] GuildScreen: mostrar bounty activo y moral de personajes (Paso 5)
- [ ] BattleScreen: aplicar moral y registrar bounty post-combate (Paso 6)
- [ ] VillageScreen: mostrar miembro reemplazante si hay abandono
- [ ] Integrar `getBountyRiskMultiplier` en `encounterService.ts` para aumentar chance de encuentros
- [ ] WorldLogScreen: mostrar eventos de abandono y bounty del historial

---

## ACTUALIZACIÓN v2 — CharacterSave canónico

El tipo `CharacterSave` definido en el Paso 2 de este documento es PARCIAL. La definición canónica completa está en doc 08. Los campos que este doc define (`morale`, `killCount`) se integran con los de doc 06 (`level`, `xp`, `deathCount`) y doc 13 (`isAscended`, `ascensionPath`, `unlockedAbilities`).

Ver doc 08 sección "CharacterSave — Tipo Canónico Completo" para la definición final.
