# Code Review ROADMAP — Review 002
**Project:** TORRE (dnd3)
**Date:** 2026-03-14
**Total CRs:** CR-001 to CR-120

> **Status key:** 🔴 MAJOR · 🟡 MODERATE · 🔵 MINOR · ⚪ INFO

---

## Phase 1 — Critical Bugs & Reliability (Do First)

| CR | Severity | File | Issue | Category |
|---|---|---|---|---|
| CR-091 | 🔴 | `encounterService.ts` | `attemptFlee` uses `Math.random()` — breaks determinism/replay | DETERMINISM |
| CR-094 | 🔴 | `syncService.ts` | `syncAll` has no per-endpoint error handling — partial failure aborts all sync | RELIABILITY |
| CR-103 | 🔴 | `imageStorageService.ts` | `cleanBase64` purpose unclear — verify edge cases | BUG-RISK |
| CR-072 | 🔴 | `enemySpriteService.ts` | `COMFY_HOST` hardcoded to `localhost:8188` — breaks device testing | CONFIG |

---

## Phase 2 — Logic & Correctness

| CR | Severity | File | Issue | Category |
|---|---|---|---|---|
| CR-084 | 🟡 | `progressionService.ts` | Level-up HP uses fixed `5` (d8 avg) for all classes — Fighters/Wizards wrong HP | DND5E |
| CR-086 | 🟡 | `moralSystem.ts` | `isGoodOrLawful` substring match fails on Spanish alignment strings | BUG |
| CR-096 | 🟡 | `allianceService.ts` | `formAlliance` doesn't check for existing alliance — double-charge risk | DATA-INTEGRITY |
| CR-100 | 🟡 | `aiMemoryService.ts` | `getAdaptiveWeights` weight adjustments can exceed 1.0 — degenerate AI | LOGIC |
| CR-071 | 🟡 | `aiProfileEngine.ts` | `getActionWeights` merged weights not clamped — negative probability possible | LOGIC |
| CR-099 | 🟡 | `rivalGenerator.ts` | PRNG seed key `_state` may collide with other generators | DETERMINISM |
| CR-107 | 🟡 | `translationBridge.ts` | `JSON.parse` without try/catch x2 — corrupted DB row crashes caller | RELIABILITY |
| CR-111 | 🟡 | `GlossaryModal.tsx` | `JSON.parse(r.data)` without try/catch — crashes glossary on bad DB data | RELIABILITY |

---

## Phase 3 — I18N Debt (Systematic)

| CR | Severity | File | Issue | Category |
|---|---|---|---|---|
| CR-049* | 🔴 | `CampScreen.tsx` | ~20 hardcoded `lang === 'es'` strings (WORST offender) | I18N |
| CR-057* | 🟡 | `EventResolutionScreen.tsx` | `EVENT_CONFIGS`: 30 strings (6 types × 5 fields) ES-only | I18N |
| CR-075 | 🟡 | `emotionalNarrativeService.ts` | `NARRATIVE_POOLS` — all combat narrative Spanish only | I18N |
| CR-118 | 🔵 | `components/party/` | 15+ `lang === 'es'` occurrences across all 5 party components | I18N |
| CR-085 | 🔵 | `moralSystem.ts` | Abandonment log strings Spanish-only | I18N |
| CR-089 | 🔵 | `encounterService.ts` | Negotiation log strings Spanish-only | I18N |
| CR-087 | 🟡 | `lootService.ts` | Loot item names in `LOOT_TABLES` English-only | I18N |
| CR-092 | 🔵 | `economyService.ts` | Revive `breakdown` string uses Spanish abbreviations | I18N |
| CR-078 | 🔵 | `monsterEvolutionService.ts` | Secret boss unlock log hardcoded Spanish | I18N |
| CR-116 | 🔵 | `BossRoomEntryUI.tsx` | 8 hardcoded `lang === 'es'` strings | I18N |
| CR-117 | 🔵 | `BountyBoard.tsx`, `AllianceCard.tsx` | 6 hardcoded `lang === 'es'` strings | I18N |
| CR-114 | 🔵 | `CharacterActionsPanel.tsx` | Category labels use `labelEs`/`labelEn` instead of `t()` | I18N |
| CR-102 | 🟡 | `backgroundSeed.ts`, `subclassSeed.ts` | Custom background/subclass descriptions Spanish-only | I18N |
| CR-079 | 🟡 | `translationSeed.ts` | No `seedEnglishTranslations` — EN users fall back to raw API silently | I18N |

---

## Phase 4 — Architecture & Design Debt

| CR | Severity | File | Issue | Category |
|---|---|---|---|---|
| CR-003* | 🟡 | `AppNavigator.tsx` | 15 `as any` / `as unknown` type casts for navigation params | TYPE-SAFETY |
| CR-011* | 🟡 | `BattleScreen.tsx` | 6 stale closures in combat hooks | CORRECTNESS |
| CR-054* | 🟡 | `ReportScreen.tsx` | Loot `useEffect` with `[]` deps — potential double-run on re-mount | BUG |
| CR-065* | 🟡 | `db layer` | `null as unknown as string` pattern in DB functions | TYPE-SAFETY |
| CR-065* | 🟡 | `savedGameService.ts` | `updateSavedGame` 110-line if-chain — refactor needed | ARCH |
| CR-119 | 🟡 | `PortraitSection.tsx` | Generation logic in presentational component — lift to screen | ARCH |
| CR-109 | 🟡 | `services/index.ts` | Barrel file is empty — misleading | ARCH |
| CR-083 | 🔵 | `progressionService.ts` | XP split discards remainder — small deficit per combat | LOGIC |
| CR-088 | 🔵 | `lootService.ts` | Boss drop ID not collision-safe (no seedHash) | LOGIC |
| CR-097 | 🔵 | `allianceService.ts` | `chargeAllianceFees` naming implies mutation but is a query | DESIGN |
| CR-070 | 🔵 | `aiProfileEngine.ts` | `getBaseWeights` function wraps constant unnecessarily | ARCH |
| CR-113 | 🔵 | `GlossaryModal.tsx` | Unmount on close resets all state — glossary re-queries DB on every open | PERF |

---

## Phase 5 — Minor / Polish

| CR | Severity | File | Issue | Category |
|---|---|---|---|---|
| CR-073 | 🔵 | `enemySpriteService.ts` | `fetchImageAsBase64` has no timeout | RELIABILITY |
| CR-074 | 🔵 | `enemySpriteService.ts` | `copyOutputToInput` silent failure | ERROR-HANDLING |
| CR-076 | 🔵 | `emotionalNarrativeService.ts` | Inline LCG instead of `makePRNG` — inconsistency | CONSISTENCY |
| CR-077 | 🔵 | `monsterEvolutionService.ts` | `getMonsterStats` returns `undefined` without fallback | SAFETY |
| CR-080 | 🔵 | `translationSeed.ts` | Class/subclass names duplicated vs `rulesConfig.ts` constants | ARCH |
| CR-081 | 🔵 | `characterStats.ts` | `getSubclassFeatures` silent empty return for unknown subclass | SAFETY |
| CR-082 | 🔵 | `characterStats.ts` | `computeFinalStats` no input validation | SAFETY |
| CR-090 | 🔵 | `encounterService.ts` | `checkSecretBossForRoom` may not be in barrel export | ARCH |
| CR-106 | 🔵 | `characterCatalogService.ts` | `_catalog` singleton not reset between tests | TESTING |
| CR-108 | ⚪ | `api5e.ts` | `BASE_URL` hardcoded — no timeout/retry on fetch | CONFIG |
| CR-110 | 🔵 | `NarrativeMomentPanel.tsx` | `eslint-disable` for `onDismiss` dep — needs `useCallback` in parent | CORRECTNESS |
| CR-112 | 🔵 | `GlossaryModal.tsx` | `as any[]` casts in `DESC_BUILDERS` | TYPE-SAFETY |
| CR-115 | 🔵 | `InventoryGrid.tsx` | `key={idx}` — index key (acceptable but fragile) | PERFORMANCE |

---

## Audit Corrections (From rn-audit round)

| Finding | Status | Note |
|---|---|---|
| SEC-001 `geminiImageService.ts` API key bundled | ❌ INVALIDATED | File is ComfyUI wrapper — no Gemini API, no key |
| ARCH-004 `aiProfileEngine.ts` unguarded `console.log` | ❌ INCORRECT | Line 163 is inside `if (__DEV__)` block — confirmed by source read |

---

## CRs Already Covered in Earlier Review Files

> These CRs were assigned in previous review files (screens, DB layer, i18n). Listed here for completeness only.

`CR-001 to CR-069` — See review files: `App.md`, `AppNavigator.md`, `gameStore.md`, `BattleScreen.md`, `MapScreen.md`, `VillageScreen.md`, `DatabaseGate.md`, `migrations.md`, `GuildScreen.md`, `CharacterDetailScreen.md`, `combatEngine.md`, `PartyScreen.md`, `geminiImageService.md`, `worldSimulator.md`, `dungeonGraphService.md`, `CampScreen.md`, `MainScreen.md`, `ReportScreen.md`, `EventResolutionScreen.md`, `CycleTransition_LevelUp_Unification.md`, `remaining_clean.md`, `database_layer.md`, `i18n_hooks_utils.md`

---

## Total Issue Count by Category

| Category | Count |
|---|---|
| I18N | 24 |
| LOGIC / DND5E | 10 |
| RELIABILITY | 8 |
| ARCH | 8 |
| TYPE-SAFETY | 6 |
| DETERMINISM | 3 |
| CONFIG | 2 |
| PERFORMANCE | 2 |
| TESTING | 2 |
| SAFETY | 4 |
| **TOTAL** | **~69 new CRs (CR-070 to CR-120 + earlier)** |
