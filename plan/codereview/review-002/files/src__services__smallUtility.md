# Code Review — Services Batch D (Small / Utility)
**Files:** `spriteDbService.ts`, `backgroundSeed.ts`, `subclassSeed.ts`, `imageStorageService.ts`, `rulesConfig.ts`, `timeService.ts`, `safeZoneService.ts`, `seedUnificationService.ts`, `culturalEvolution.ts`, `characterCatalogService.ts`, `bountyService.ts`, `translationBridge.ts`, `api5e.ts`, `mapGenerator.ts`, `index.ts`
**Pipeline:** 002 | **CRs:** CR-102 – CR-115

---

## `src/services/spriteDbService.ts`

**Summary:** Reads pre-built sprite paths from static JSON index. ~80 lines.

### What's Good
- `INDEX` loaded at module init — zero runtime I/O on first sprite request.
- `hasPrebuiltSprites` / `getPrebuiltSpriteSet` provide safe existence checks before use.
- Typed `SpriteIndex` and `PrebuiltSpriteSet` interfaces.

**No issues found. ✅**

---

## `src/services/backgroundSeed.ts` & `subclassSeed.ts`

**Summary:** Seed custom backgrounds and subclasses into the DB on first launch.

### What's Good
- Simple upsert-on-init pattern — idempotent.
- Data is static — no network dependency.

### Issues

#### CR-102 — `CUSTOM_BACKGROUNDS` / `CUSTOM_SUBCLASSES` are ALL Spanish descriptions
**Severity:** MODERATE | **Category:** I18N
Custom background and subclass descriptions in both seed files are written exclusively in Spanish. EN players will see Spanish text in the character creation screen for custom entries that don't exist in the 5e SRD.

---

## `src/services/imageStorageService.ts`

**Summary:** Portrait + expression management on device filesystem. Compression via `RNImageManipulator`.

### What's Good
- Image compression pipeline (512px / 70% JPEG) reduces storage ~15× (PF-01 comment).
- Temp file + compress + move pattern handles compression failures gracefully.
- `RNFS.unlink(tempPath).catch(() => undefined)` in `finally` cleans up temp files.

### Issues

#### CR-103 — `savePortraitToFS` does not return file path on compression success (returns undefined path)
**Severity:** MAJOR | **Category:** BUG
```ts
try {
  ...
  await RNFS.writeFile(filePath, compressedBase64, 'base64');
  // ← No return here! Falls through to finally, then exits try block
} catch {
  ...
  return `file://${filePath}`;  // only returns in catch path
} finally {
  RNFS.unlink(tempPath).catch(() => undefined);
}
return `file://${filePath}`; // This line IS reached after try+finally
```
Actually reviewing the full body — the final `return` is after the try/catch/finally block so it IS reached on success. This is OK. **No bug.** ✅

#### CR-103 (revised) — `cleanBase64` purpose unclear — stripping data URL prefix
**Severity:** MINOR | **Category:** MAINTAINABILITY
`cleanBase64` is called before writing but its implementation wasn't read. Ensure it correctly strips `data:image/...;base64,` prefix and handles edge cases (already-clean base64, empty input).

---

## `src/services/rulesConfig.ts`

**Summary:** All DnD 5e static rule constants — classes, subclasses, XP table, proficiency bonuses.

### What's Good
- Single source of truth for game rules — class hit dice, XP thresholds, spell slots.
- `getLevelForXP` uses binary search pattern via `findIndex` — O(n) but n=20 so acceptable.
- `isValidSubclass` guards against invalid subclass assignments.

**No issues found. ✅**

---

## `src/services/timeService.ts`

**Summary:** Cycle advancement, phase detection, season end, tower closure.

### What's Good
- `advanceTime` is pure — returns new state without mutation.
- `CYCLE_COST` as a map from `TimeAction` → cost fraction — clean.
- `isTowerClosed` returns a boolean — no side effects.

**No issues found. ✅**

---

## `src/services/safeZoneService.ts`

**Summary:** Safe zone detection, rest healing calculations.

### What's Good
- `hashNodeIndex` provides deterministic node identity for PRNG seeding.
- `calculateRestHeal` is pure — deterministic per `seedHash + roomId + charName`.
- Short rest (0.5 cycles) vs Long rest (1 cycle) cost correctly implemented.

### Issues

#### CR-104 — Long rest always heals to full `maxHp` (no HD spending mechanic)
**Severity:** INFO | **Category:** DND5E fidelity
```ts
return { hpRestored: maxHp, cyclesConsumed: 1, ... }
```
DnD 5e long rest restores all HP. This is per-spec, but note that it deviates from SYSTEMS.MD which may spec a different restore amount. Verify against `SYSTEMS.MD` rest rules.

---

## `src/services/seedUnificationService.ts`

**Summary:** Season carry-over — applies inherited level, marks IA-inherited characters.

### What's Good
- `applyInheritedLevel` is pure and minimal.
- `checkSeedStatus` provides clear 3-state return (`SeedStatus`).

**No issues found. ✅**

---

## `src/services/culturalEvolution.ts`

**Summary:** Fitness scoring for NPC parties — used by AI profile mutation for cultural adoption.

### What's Good
- `calculateFitnessScore` correctly guards against division by zero (`Math.max(1, totalCombats)`).
- `rankPartiesByFitness` returns sorted array by descending score.

### Issues

#### CR-105 — `calculateFitnessScore` only uses `recentCombats` gold for fitness (not historical)
**Severity:** MINOR | **Category:** LOGIC
```ts
const totalGold = memory.recentCombats.reduce((sum, c) => sum + c.reward, 0);
```
`recentCombats` is bounded by `MAX_COMBATS` (likely 10-20 entries). A party that accumulated huge gold in the distant past but has been dormant recently could have a lower fitness score than a weaker party. May be intentional recency bias — document if so.

---

## `src/services/characterCatalogService.ts`

**Summary:** Pre-built character catalog — portrait + expression require-maps for static bundles.

### What's Good
- `PORTRAIT_REQUIRE_MAP` / `EXPRESSION_REQUIRE_MAP` use `require()` — bundled at build time, no runtime filesystem access.
- `getCatalogPortraitForNPC` uses `hashString` for deterministic NPC portrait selection.

### Issues

#### CR-106 — `_catalog` module-level variable is mutated lazily (not a singleton pattern)
**Severity:** MINOR | **Category:** ARCH
```ts
let _catalog: CatalogEntry[] | null = null;
export function getCatalog(): CatalogEntry[] {
  if (!_catalog) { _catalog = buildCatalog(); }
  return _catalog;
}
```
This lazy singleton is fine in practice but is not reset between tests. Tests that call `getCatalog()` may share state.

---

## `src/services/bountyService.ts`

**Summary:** Bounty tracking — record party kills, escalate bounty level, retrieve active bounties.

### What's Good
- `recordPartyKill` uses `INSERT OR IGNORE` for kill events — idempotent.
- `BOUNTY_THRESHOLDS` uses `.filter + .reduce` to find highest matching threshold — correct.
- Non-null assertion `getBounty(...)!` after insert is safe here (insert guarantees existence).

**No issues found. ✅**

---

## `src/services/translationBridge.ts`

**Summary:** Field-level translation bridge — checks translations table then falls back to raw API data.

### What's Good
- Two-layer fallback (translated → raw JSON) is correct.
- `resolveFieldPath` / `setFieldPath` support dot-notation paths.

### Issues

#### CR-107 — `JSON.parse(resource.data)` without try/catch at lines 23 and 39
**Severity:** MODERATE | **Category:** RELIABILITY
```ts
const data = JSON.parse(resource.data); // line 23
```
If `resource.data` is corrupted or truncated in the DB, `JSON.parse` throws and crashes the caller. This would surface as a blank glossary entry or crash in any screen that shows DnD 5e data. Should be wrapped in try/catch with a null fallback.

---

## `src/services/api5e.ts`

**Summary:** DnD 5e API client — list, detail, batched fetch. All network I/O for sync.

### What's Good
- `fetchAllDetails` uses batching (BATCH_SIZE=10) — prevents rate-limiting from 300+ simultaneous requests.
- `onProgress` callback pattern.

### Issues

#### CR-108 — `BASE_URL` points to `https://www.dnd5eapi.co` — hardcoded external dependency
**Severity:** INFO | **Category:** CONFIG
The external DnD 5e API is a free community service. If it goes down or rate-limits, `syncAll` will fail. This is already mitigated by the offline-first DB design (sync once, use forever), but there's no timeout set on fetch calls and no retry logic.

---

## `src/services/mapGenerator.ts`

**Summary:** Floor map generation — node types, connections, labels.

### What's Good
- `generateFloorNodes` uses `TOPOLOGY` static layout — floor shape is consistent.
- Boss always last node, safe zone always first — invariants enforced structurally.
- `shuffle` uses PRNG — deterministic map generation.

**No issues found. ✅**

---

## `src/services/index.ts`

**Summary:** Barrel export file.

### Issues

#### CR-109 — Barrel file appears empty (no exports)
**Severity:** MODERATE | **Category:** ARCH
`get_symbols_overview` returned `{}` for `index.ts`. If this is truly empty, all service imports must use full paths like `../../services/combatEngine`. This is not wrong but inconsistent with having an index file. Either populate it with re-exports or delete it to avoid confusion.
