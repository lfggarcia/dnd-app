---
name: torre-combat-engine
description: DnD 5e combat engine implementation guide for TORRE. Contains exact formulas, file locations, implementation order, and combat flow spec for BattleScreen and related services. Use when implementing combat mechanics, working on BattleScreen, ReportScreen, or the dungeon battle loop. Keywords: combat, battle, dnd5e, initiative, hit roll, damage, HP, turns, BattleScreen, ReportScreen.
argument-hint: [sprint task: "4A game loop" | "4B initiative" | "4B damage" | "4B turns"]
---

# TORRE — Combat Engine

---

## Phase 1: Sprint 4A — Wire the Game Loop (DO FIRST)

**Goal:** BattleScreen receives real context. Rooms get marked. Floors advance.

### Files to edit (in order)

#### 1. `src/navigation/types.ts`
```typescript
// Add to RootStackParamList:
Battle: { roomId: string; roomType: RoomType };
Report: { roomId: string; roomWasCleared: boolean };
```
Import `RoomType` from `dungeonGraphService.ts`.

#### 2. `src/screens/MapScreen.tsx`
Find the `handleEnterRoom` or equivalent function that navigates to BattleScreen.
```typescript
navigation.navigate('Battle', { 
  roomId: selectedRoom.id, 
  roomType: selectedRoom.type 
});
```

#### 3. `src/screens/BattleScreen.tsx`
```typescript
const route = useRoute<RouteProp<RootStackParamList, 'Battle'>>();
const { roomId, roomType } = route.params;

// On combat end (mock victory for now):
navigation.navigate('Report', { roomId, roomWasCleared: true });
```

#### 4. `src/screens/ReportScreen.tsx`
```typescript
const route = useRoute<RouteProp<RootStackParamList, 'Report'>>();
const { roomId, roomWasCleared } = route.params;

// On "Continuar" button — navigate BACK to Map, not to Extraction:
navigation.navigate('Map');  // MapScreen will read the updated state
```

#### 5. `src/screens/MapScreen.tsx` (second edit)
On focus/return — check if last visited room needs to be marked:
```typescript
// After navigating back from ReportScreen:
const updatedFloor = markRoomCleared(floorState, roomId);
updateGameStore({ mapState: JSON.stringify(updatedFloor) });
```
Make sure `dungeonGraphService.ts` has a `markRoomCleared(state, roomId)` utility.

---

## Phase 2: Sprint 4B — DnD 5e Combat Engine

### Architecture

Create `src/services/combatEngine.ts` — pure functions, no side effects, fully testable.

```typescript
// Core functions to implement:
rollInitiative(actors: CombatActor[], seed: string): CombatActor[]
resolveAttack(attacker: CombatActor, defender: CombatActor, seed: string): AttackResult
calculateDamage(attacker: CombatActor, isCritical: boolean): number
applyDamage(actor: CombatActor, damage: number): CombatActor
isCombatOver(actors: CombatActor[]): { over: boolean; partyWon: boolean }
```

### Data Types

```typescript
type CombatActor = {
  id: string;
  name: string;
  isPlayer: boolean;
  hp: number;
  maxHp: number;
  ac: number;
  attackMod: number;       // STR or DEX mod + proficiency bonus
  damageDice: string;      // e.g., '1d6', '2d4'
  damageMod: number;       // stat modifier for damage
  initiative: number;      // assigned after rollInitiative()
  speed: number;
  proficiencyBonus: number;
}

type AttackResult = {
  hit: boolean;
  critical: boolean;
  roll: number;            // d20 result (for log display)
  totalAttack: number;     // roll + attackMod + profBonus
  damage: number;          // 0 if miss
}

type CombatLog = {
  round: number;
  actorId: string;
  actorName: string;
  action: string;          // e.g., "attacks Goblin for 8 damage!"
  result: AttackResult | null;
}
```

### Combat Formulas

#### Initiative
```
initiative = d20_seeded(seed + actorId) + DEX_modifier
```
Sort descending — ties broken by DEX modifier, then by player actor (player goes first on tie).

#### Attack Roll
```
attack_roll = d20_seeded(seed + round + actorId + 'attack')
total_attack = attack_roll + attackMod  // attackMod includes proficiency bonus
hit = total_attack >= defender.ac
critical = attack_roll === 20
miss = attack_roll === 1   // auto-miss (natural 1)
```
Clamp hit probability: minimum 5%, maximum 95%.

#### Damage Calculation
```
base_damage = roll_dice(damageDice, seed + round + actorId + 'damage') + damageMod
final_damage = critical ? base_damage * 2 : base_damage
final_damage = max(final_damage, 1)  // always deal at least 1 damage
```

#### Death
```
if actor.hp <= 0:
  actor is defeated
  if isPlayer: mark as DEAD in party state
```

### Seeded RNG

Use the existing `backgroundSeed.ts` PRNG utilities. Always pass a deterministic seed to all random rolls so replays are consistent.

```typescript
import { seededRandom } from '../services/backgroundSeed';
```

### Enemy Generation

Get enemies from `monsterEvolutionService.ts`:
```typescript
import { getEnemiesForRoom } from '../services/monsterEvolutionService';

const enemies = getEnemiesForRoom({
  roomType,    // from route params
  floor: activeGame.floor,
  cycle: activeGame.cycle,
  seed: activeGame.seed,
});
```

### BattleScreen State Shape

```typescript
type BattleState = {
  phase: 'SETUP' | 'COMBAT' | 'VICTORY' | 'DEFEAT';
  round: number;
  turnOrder: string[];      // actor IDs in initiative order
  currentActorIndex: number;
  actors: Record<string, CombatActor>;
  log: CombatLog[];
}
```

### Combat Flow

```
1. SETUP: build CombatActor[] from party + enemies
2. Roll initiative → sort turnOrder
3. COMBAT phase:
   a. Current actor (player or AI) takes Action
   b. For player: show attack button, target selector
   c. For AI: auto-resolve with combatEngine.resolveAttack()
   d. Log the result
   e. Check isCombatOver() after each action
   f. Advance to next actor (cycle turnOrder)
4. VICTORY: navigate to Report({ roomId, roomWasCleared: true })
5. DEFEAT: navigate to Report({ roomId, roomWasCleared: false })
```

### XP and Gold (post-combat)

Use `monsterEvolutionService.ts` XP decay formula:
```typescript
const xpEarned = calculateXpReward(enemies, floor, cycle);
const goldEarned = Math.floor(xpEarned * 0.3);  // base ratio
```

---

## Key Files Reference

| File | Role in Combat |
|------|----------------|
| `src/screens/BattleScreen.tsx` | Combat UI, turn management |
| `src/screens/ReportScreen.tsx` | Post-combat results display |
| `src/services/combatEngine.ts` | **NEW** Pure combat logic |
| `src/services/monsterEvolutionService.ts` | Enemy stats + XP rewards |
| `src/services/characterStats.ts` | Player character stats |
| `src/services/backgroundSeed.ts` | Seeded RNG |
| `src/navigation/types.ts` | Route params for Battle + Report |
| `src/stores/gameStore.ts` | Update party HP after combat |

---

## Implementation Order (Sprint 4B)

```
Day 1: combatEngine.ts — rollInitiative, resolveAttack, calculateDamage
Day 2: BattleScreen.tsx — state shape, SETUP phase, turn order display  
Day 3: BattleScreen.tsx — COMBAT phase, player action, AI auto-resolve
Day 4: BattleScreen.tsx — VICTORY/DEFEAT, navigate to Report with results
Day 5: ReportScreen.tsx — display real results (XP, gold, casualties)
Day 6: gameStore.ts — persist updated HP/deaths to DB after combat
Day 7: Integration test + bug fixes
```
