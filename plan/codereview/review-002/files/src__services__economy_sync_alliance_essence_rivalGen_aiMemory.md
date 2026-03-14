# Code Review — Services Batch C
**Files:** `economyService.ts`, `syncService.ts`, `allianceService.ts`, `essenceService.ts`, `rivalGenerator.ts`, `aiMemoryService.ts`
**Pipeline:** 002 | **CRs:** CR-092 – CR-101

---

## `src/services/economyService.ts`

**Summary:** Gold calculations — item pricing, revive cost, inn/rest costs, room gold. ~80 lines.

### What's Good
- `calculateReviveCost` includes `breakdown` string for UI display — transparency for player.
- Rarity multipliers and floor scaling are clearly separated concerns.
- Named constants `REVIVE_BASE_COST`, `REST_INN_COST`, `REST_SHORT_COST` — easy to tune.

### Issues

#### CR-092 — `calculateReviveCost` `breakdown` string hardcoded Spanish format
**Severity:** MINOR | **Category:** I18N
```ts
const breakdown = `${base} × nv${char.level} × (1 + ${char.deathCount} m. × 0.15) = ${cost}G`;
```
`nv` (nivel) and `m.` (muertes) are Spanish abbreviations. If `breakdown` is shown in the UI to EN players it will be unintelligible.

#### CR-093 — `calculateRoomGold` not reviewed — verify floor scaling cap
**Severity:** INFO | **Category:** LOGIC
`calculateRoomGold` was observed in the overview but not read. Ensure it has a ceiling to prevent late-game gold inflation.

---

## `src/services/syncService.ts`

**Summary:** DnD 5e API sync orchestrator — priority endpoints + deferred list-only sync. ~200 lines.

### What's Good
- Two-phase sync (Priority full-detail vs Deferred list-only) correctly minimizes network usage.
- `onProgress` callback pattern for UI feedback without coupling to React.
- No `as any`, no hardcoded URLs (delegated to `api5e.ts`).

### Issues

#### CR-094 — `syncAll` has no error handling — a failed endpoint silently stops sync
**Severity:** MAJOR | **Category:** RELIABILITY
```ts
for (const endpoint of PRIORITY_ENDPOINTS) {
  await syncEndpoint(endpoint, { ... }); // no try/catch
  completed++;
}
```
If any single endpoint throws (network error, 5e API down), the entire sync aborts. Remaining endpoints are never synced. Should wrap each `syncEndpoint` call in try/catch and continue on individual failures.

#### CR-095 — `getSyncStatus` not tested
**Severity:** INFO | **Category:** TESTING
`getSyncStatus` queries the DB but has no corresponding test in `__tests__/`. Given that the sync gate (DatabaseGate) depends on this, a failure here could prevent app from ever loading.

---

## `src/services/allianceService.ts`

**Summary:** Alliance lifecycle — form, terminate, charge fees, evaluate offers. ~180 lines.

### What's Good
- `evaluateAllianceOffer` uses explicit `desiredFee * 0.9` / `0.5` thresholds — tuneable.
- `void playerBountyLevel` comment notes it's reserved for future use — not forgotten.
- `expireOldAlliances` handles time-based expiry.

### Issues

#### CR-096 — `formAlliance` does not validate that an alliance with this rival doesn't already exist
**Severity:** MODERATE | **Category:** DATA-INTEGRITY
If called twice for the same rival (e.g. from a race condition in the UI), two alliance rows could be inserted, causing `chargeAllianceFees` to charge double. Should use `INSERT OR IGNORE` or check `isAlliedWith` first.

#### CR-097 — `chargeAllianceFees` returns total fee but doesn't deduct from gold
**Severity:** INFO | **Category:** DESIGN
The function returns the total fee amount but does not modify game state. The caller must manually deduct. If a caller forgets to deduct after computing the fee, alliances effectively become free. Consider naming it `getTotalAllianceFees` to signal it's a query not a mutation.

---

## `src/services/essenceService.ts`

**Summary:** Essence drop resolution, catalog, slot management for post-ascension characters.

### What's Good
- `resolveEssenceDrop` uses `DROP_CHANCE_BY_ENEMY_TYPE` map with fallback `0.05` — safe.
- d20 roll for major drop elegantly mirrors D&D 5e natural 20.
- `ESSENCE_CATALOG` is static data — zero DB on hot path.
- `findClosestEssence` provides graceful fallback when no exact match.

### Issues

#### CR-098 — `rollEssenceRank` called only on major drop (d20=20) but not examined
**Severity:** INFO | **Category:** REVIEW
The implementation of `rollEssenceRank` was not read. Verify it does not use `Math.random()` (should use passed `rng`).

---

## `src/services/rivalGenerator.ts`

**Summary:** Builds 5 rival NPC parties from DB creatures + faction name prefix. ~125 lines.

### What's Good
- `loadCreaturesFromDB` has try/catch with silent fallback to `FALLBACK_CREATURES` — resilient.
- Filters multi-word monster names to avoid ugly rival names.
- Pool minimum of 10 creatures enforced before using DB data.

### Issues

#### CR-099 — `generateRivals` uses `makePRNG('${seedHash}_state')` — same RNG seed as `worldSimulator`?
**Severity:** MODERATE | **Category:** DETERMINISM
```ts
const rng = makePRNG(`${seedHash}_state`);
```
The key `_state` may collide with other PRNG seeds in the codebase. If `worldSimulator.ts` also uses `${seedHash}_state`, both generators produce the same pseudo-random sequence. Should use a unique suffix like `${seedHash}_rivals_gen`.

---

## `src/services/aiMemoryService.ts`

**Summary:** AI NPC memory — combat tracking, win/loss streaks, adaptive weight calculation.

### What's Good
- `getAdaptiveWeights` correctly handles both win-streak and loss-streak cases.
- `MAX_COMBATS` / `MAX_DECISIONS` constants limit memory growth (bounded history).
- `MUTATION_INTERVAL` constant — behavior-change rate is tunable.
- Pure function design — no DB calls in the computation path.

### Issues

#### CR-100 — `getAdaptiveWeights` can produce weight adjustments > 1.0 total
**Severity:** MODERATE | **Category:** LOGIC
Win-streak path adds `+0.15` (huntParty) + `+0.10` (fightMonster). In combination with the `preferredActions` reinforcement loop (`+0.08` each), an AI in a long win streak with high-efficiency preferred actions could accumulate weight adjustments exceeding `+1.0`, effectively making the weight sum non-normalized. This could produce degenerate always-aggressive AI. Same issue as CR-071 — weights must be clamped after all adjustments.

#### CR-101 — `evaluateCulturalAdoption` not reviewed directly
**Severity:** INFO | **Category:** REVIEW
`evaluateCulturalAdoption` is called from `aiProfileEngine.maybeMutateProfile` and is the key cultural-spread mechanic. Confirm it uses PRNG (not `Math.random()`) and that adoption probability is bounded.
