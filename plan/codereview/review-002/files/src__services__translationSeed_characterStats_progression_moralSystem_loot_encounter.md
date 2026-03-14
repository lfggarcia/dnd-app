# Code Review — Services Batch B
**Files:** `translationSeed.ts`, `characterStats.ts`, `progressionService.ts`, `moralSystem.ts`, `lootService.ts`, `encounterService.ts`
**Pipeline:** 002 | **CRs:** CR-079 – CR-093

---

## `src/services/translationSeed.ts`

**Summary:** Seeds Spanish translations for all DnD 5e API entities into the DB. 488 lines.

### What's Good
- `seedSpanishTranslations` calls one `upsertTranslationBatch` — single DB write, atomic.
- Each data sub-function (`classes()`, `skills()`, etc.) returns a plain array — easy to test independently.
- Covers all major DnD 5e entity categories. Comprehensive.

### Issues

#### CR-079 — No English counterpart seed
**Severity:** MODERATE | **Category:** I18N
```ts
export function seedSpanishTranslations(): void { ... } // only Spanish
```
There is a `seedSpanishTranslations` function but no `seedEnglishTranslations`. English content is expected to come from the raw 5e API data (`translationBridge.ts` falls back to raw JSON). This works but is asymmetric — EN users rely on fallback while ES users get explicit translations. Any formatting differences (capitalization, field naming) between raw API data and the expected translated output may silently produce inconsistent UI for EN users.

#### CR-080 — Translation data duplicates constants from `rulesConfig.ts`
**Severity:** MINOR | **Category:** ARCH
Class names, subclass names, and skill names are hardcoded as strings in both `translationSeed.ts` and `rulesConfig.ts`. A typo in one won't be caught by the compiler. Should derive from `ALL_CLASSES`, `ALL_SUBCLASSES` constants.

---

## `src/services/characterStats.ts`

**Summary:** Character stat generation, racial bonuses, class features. ~220 lines.

### What's Good
- `roll4d6DropLowest` correctly drops the lowest die.
- `generateValidRolledStats` retries until total ≥ 70 — guarantees playable stats without infinite loops (bounded by the probability distribution).
- `assignStandardArray` distributes `STANDARD_ARRAY` by class priority — deterministic and fair.
- Pure functions, no side effects.

### Issues

#### CR-081 — `getSubclassFeatures` returns empty array for unknown subclass silently
**Severity:** MINOR | **Category:** SAFETY
```ts
export function getSubclassFeatures(subclass: string): string[] {
  return SUBCLASS_FEATURES[subclass] ?? []; // silent empty array
}
```
An unknown subclass returns `[]` with no warning, which means a character might display "no features" without any indication of misconfiguration. Should at minimum log in `__DEV__` mode.

#### CR-082 — `computeFinalStats` has no validation of input `baseStats`
**Severity:** MINOR | **Category:** SAFETY
If `baseStats` contains a `NaN` or negative value (e.g. from a corrupt DB read), the function will propagate it silently through all derived stats (modifier, HP, etc.). A guard at the entry point would prevent silent corruption.

---

## `src/services/progressionService.ts`

**Summary:** XP award, level-up confirmation, XP formatting. ~100 lines.

### What's Good
- `awardXP` distributes XP only among alive characters — correct D&D 5e behavior.
- `confirmLevelUps` uses minimum HP of 4 per level (`Math.max(4, 5 + conMod)`) — prevents low-CON characters getting 0 HP on level up.
- `MAX_LEVEL_MVP` constant enforces MVP cap cleanly.
- No DB calls. Fully pure.

### Issues

#### CR-083 — `awardXP` uses `Math.floor` for XP split but discards remainder permanently
**Severity:** MINOR | **Category:** LOGIC
```ts
const xpPerChar = Math.floor(totalXP / aliveCount);
// Remainder (totalXP % aliveCount) is silently discarded
```
With 3 alive characters and 100 XP award, each gets 33 XP and 1 XP is lost. Over many combats this creates a small XP deficit. The DnD 5e convention is to award the full value to each character rather than splitting. This may be intentional game design, but the comment `// split` implies it isn't.

#### CR-084 — HP gain on level-up uses flat `5` base instead of class hit die
**Severity:** MODERATE | **Category:** LOGIC / DND5E
```ts
const hpPerLevel = Math.max(4, 5 + conMod);  // fixed d8 average
```
The comment says "simplified — average of the die + CON mod" but uses a fixed `5` (d8 average) for all classes. A Fighter has d10 (avg 6), a Wizard has d6 (avg 4). This means Fighters are under-powered at high levels. Should use `CLASS_HIT_DICE` from `rulesConfig.ts`.

---

## `src/services/moralSystem.ts`

**Summary:** Morale tracking, abandonment checks, replacement character generation.

### What's Good
- `checkForAbandonment` skips dead characters correctly.
- PRNG seeded on `seedHash + cycle` — deterministic abandonment (same seed = same outcome).
- `MORALE_MIN`, `MORALE_MAX`, `ABANDON_THRESHOLD` as named constants — easy to tune.

### Issues

#### CR-085 — Abandonment log strings hardcoded Spanish
**Severity:** MINOR | **Category:** I18N
```ts
log.push(`${char.name.toUpperCase()} ABANDONA LA PARTY — moral demasiado baja (${morale})`);
```
Log entries from `checkForAbandonment` are in Spanish only. These strings may be surfaced to the EN player via the UI.

#### CR-086 — `isGoodOrLawful` alignment check uses substring match on untranslated data
**Severity:** MODERATE | **Category:** BUG-RISK
```ts
export function isGoodOrLawful(alignment: string): boolean {
  return alignment.toLowerCase().includes('good') || alignment.toLowerCase().includes('lawful');
}
```
Alignment strings stored in DB may be Spanish (e.g. `"Legal Bueno"`) if they were seeded via `translationSeed`. The substring search for `'good'` and `'lawful'` would fail, making all Spanish-seeded characters ineligible for abandonment. Should compare against alignment constants or API index keys instead of display strings.

---

## `src/services/lootService.ts`

**Summary:** Room loot and boss unique loot generation. ~100 lines.

### What's Good
- `generateRoomLoot` is fully deterministic via per-room PRNG seed.
- `id` field constructed from seed + roomId + floor — ensures idempotent loot (same room always gives same loot).
- Zero DB calls. Pure.

### Issues

#### CR-087 — Loot item `name` field is English-only
**Severity:** MODERATE | **Category:** I18N
```ts
// In LOOT_TABLES:
{ name: 'Health Potion', type: 'consumable', rarity: 'common', chance: 0.6 }
```
All item names in `LOOT_TABLES` appear to be English only. ES players will see English item names in the inventory. Should be keyed identifiers that route through the i18n system.

#### CR-088 — `generateBossUniqueLoot` boss drop `id` not collision-safe across floors
**Severity:** MINOR | **Category:** LOGIC
```ts
id: `boss_${bossType}_${floor}` // no seedHash
```
If multiple runs have the same boss on the same floor (e.g. seasonal resets with different party states), item IDs could collide in the DB. Should include `seedHash`.

---

## `src/services/encounterService.ts`

**Summary:** Party encounter probability, rival combat, flee, negotiation. ~175 lines.

### What's Good
- `checkForEncounter` correctly caps encounter probability at 60% (`Math.min(..., 0.60)`) per SYSTEMS.MD.
- `resolveNegotiation` has two offer types (`free_passage`, `gold`) — extensible for future offer types.
- `estimateRivalPower` provides a rough power score for UI display without running full combat.

### Issues

#### CR-089 — Negotiation log strings hardcoded Spanish
**Severity:** MINOR | **Category:** I18N
```ts
log.push(`${rival.name} acepta paso libre`);
log.push(`${rival.name} rechaza la oferta`);
```
All negotiation outcome messages in `resolveNegotiation` are Spanish-only, which are surfaced to the user via GuildScreen/MapScreen.

#### CR-090 — `checkSecretBossForRoom` not exported in barrel index
**Severity:** MINOR | **Category:** ARCH
`checkSecretBossForRoom` is exported from `encounterService.ts` but may not be included in `src/services/index.ts` barrel. Importers using the barrel file would miss it.

#### CR-091 — `attemptFlee` has no seed parameter — uses `Math.random()`
**Severity:** MODERATE | **Category:** DETERMINISM
```ts
export function attemptFlee(...): FleeResult {
  const roll = Math.random(); // non-deterministic!
```
Unlike all other probability checks in the codebase which use `makePRNG`, `attemptFlee` uses `Math.random()` directly. This breaks replay determinism — the same combat replayed from the same seed can have different flee outcomes.
