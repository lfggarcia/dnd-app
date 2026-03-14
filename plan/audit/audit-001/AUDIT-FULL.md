# TORRE (dnd3) — Full Audit Report

**Date**: 2026-03-14  
**Scope**: Architecture, Testing, Dependencies, Accessibility  
**Stack**: RN 0.84, React 19, Zustand 5, op-sqlite, NativeWind 4, React Navigation 7, Reanimated 4  
**Codebase**: 104 TS/TSX files, ~25k lines, 23 screens

---

## 1. ARCHITECTURE

### ARCH-001 — No ErrorBoundary anywhere
- **File**: `App.tsx`, entire app
- **Evidence**: `mcp_oraios_serena_search_for_pattern` for `ErrorBoundary|componentDidCatch` returned **zero hits**.
- **Problem**: Any unhandled JS error crashes the entire app silently. In a game with complex state (combat, simulation, loot), this is critical.
- **Fix**: Create `src/components/ErrorBoundary.tsx` wrapping the navigator in `App.tsx`. Log errors, show a fallback UI with "Return to Main" option.
```tsx
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    __DEV__ && console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) return <FallbackScreen onReset={() => this.setState({ hasError: false })} />;
    return this.props.children;
  }
}
```

### ARCH-002 — Silent empty catch blocks suppress real errors
- **Files**: `src/database/gameRepository.ts` (L169, L173, L250), `src/screens/ExtractionScreen.tsx` (L75), `src/screens/ReportScreen.tsx` (L68, L77), `src/screens/GuildScreen.tsx` (L305, L433), `src/screens/BattleScreen.tsx` (L647), `src/screens/MapScreen.tsx` (L157), `src/components/GlossaryModal.tsx` (L236, L243), `src/services/geminiImageService.ts` (L230, L241)
- **Snippet** (gameRepository.ts):
```ts
try { portraitsJson = JSON.parse(row.portraits_json) ... } catch { /* ignore */ }
try { expressionsJson = JSON.parse(row.expressions_json) ... } catch { /* ignore */ }
```
- **Problem**: 15+ empty catch blocks. JSON parse failures, DB errors, and navigation state corruption will silently break features. "Ignore" comments don't explain *why* it's safe to swallow.
- **Fix**: At minimum, log under `__DEV__`. For DB operations, propagate errors. For truly non-critical paths, add explicit comments explaining the recovery strategy.

### ARCH-003 — Zustand store is a monolith (1 file, ~237 lines)
- **File**: `src/stores/gameStore.ts`
- **State shape**: `GameState` (5 fields) + `GameActions` (15 methods) all in one `create()` call.
- **Problem**: Single store contains game CRUD, portrait management, cycle advancement, world simulation dispatch, and combat results. This makes testing and refactoring difficult. The `advanceCycle` and `advanceToVillage` actions contain complex async logic (dynamic imports, simulation, rival persistence) that belongs in services.
- **Fix**: Extract into slices:
  - `gameSlice` — CRUD: hydrate, startNewGame, loadGame, removeGame, clearActive
  - `progressSlice` — updateProgress, advanceCycle, advanceToVillage
  - `portraitSlice` — savePortrait, saveCharacterPortraits, saveCharacterExpressions
  - `combatSlice` — setCombatResult, setSimulationEvents

### ARCH-004 — Business logic leaking into Zustand store
- **File**: `src/stores/gameStore.ts` (L155-237, advanceCycle + advanceToVillage)
- **Snippet**:
```ts
advanceCycle: async (action) => {
  const { advanceTime } = await import('../services/timeService');
  const { newCycleRaw, newCycle } = advanceTime(activeGame.cycleRaw ?? activeGame.cycle, action);
  // ...world simulation logic, rival persistence, event merging...
}
```
- **Problem**: Store actions perform dynamic imports, run simulation, save rivals — this is service-layer logic living in the store. Makes the store untestable without mocking half the codebase.
- **Fix**: Create `src/services/cycleService.ts` that orchestrates time advancement + simulation. Store action should only call the service and `set()` result.

### ARCH-005 — No service index barrel (empty)
- **File**: `src/services/index.ts`
- **Problem**: The barrel file is empty. 34 service files with no central re-export. Each consumer imports directly from deep paths.
- **Fix**: Either populate the barrel with key exports, or delete it to avoid confusion.

### ARCH-006 — Database connection has no error handling
- **File**: `src/database/connection.ts`
- **Snippet**:
```ts
export function getDB(): DB {
  if (!db) { db = open({ name: DB_NAME }); }
  return db;
}
```
- **Problem**: If `open()` throws (corrupted DB, storage full), the error propagates uncaught. No retry, no fallback, no user feedback. Since op-sqlite runs synchronously on JS thread, this crash is immediate and fatal.
- **Fix**: Wrap in try-catch, set a module-level error state, provide `resetDB()` for recovery.

### ARCH-007 — Transaction safety inconsistent across repositories
- **Files**: `src/database/repository.ts` (L41, L131), `src/database/migrations.ts` (L262)
- **Observation**: `repository.ts` and `migrations.ts` use `BEGIN TRANSACTION / COMMIT / ROLLBACK` properly. But `gameRepository.ts`, `itemRepository.ts`, `eventRepository.ts`, `essenceRepository.ts`, and `rivalRepository.ts` perform **multi-statement writes without transactions**.
- **Example**: `createSavedGame` in gameRepository executes INSERT + potential UPDATE without transaction wrapping. `createItem`, `createBounty`, `createWorldEvent` same issue.
- **Fix**: Wrap all multi-statement write operations in transactions, or provide a `withTransaction` helper.

### ARCH-008 — usePartyRoster hook is a God Object (50+ returned values)
- **File**: `src/hooks/usePartyRoster.ts`
- **Evidence**: Returns object with 50+ properties: `roster`, `current`, `classes`, `races`, `backgrounds`, `allSubclasses`, `addCharacter`, `removeCharacter`, `updateCurrent`, `rerollStats`, `generateRandomName`, `handleGeneratePortrait`, `launchStep`, `setLaunchStep`, `portraitConfirmVisible`, `portraitDetailUri`, `portraitExpanded`, `portraitMissingCount`, `charPortraits`, `charPortraitRolls`, etc.
- **Problem**: This hook manages character creation, portrait generation, stat rolling, launch flow state, and party management all at once. Violates single responsibility. Any state change re-triggers all consumers.
- **Fix**: Split into `useCharacterCreation`, `usePortraitGenerator`, `usePartyManagement`, `useLaunchFlow`.

### ARCH-009 — TypeScript config relies on base — no project-level customization
- **File**: `tsconfig.json`
- **Content**:
```json
{ "extends": "@react-native/typescript-config", "compilerOptions": { "types": ["jest"] } }
```
- **Observation**: Base config has `strict: true` ✅ and `tsc --noEmit` produces **0 errors** ✅.
- **However**: No `noUncheckedIndexedAccess`, no `exactOptionalPropertyTypes`. For a game engine with arrays (party members, enemies, loot), unchecked index access is a common source of runtime `undefined` bugs.
- **Fix (recommended)**: Add `"noUncheckedIndexedAccess": true` to catch `array[i]` returning `T | undefined`.

### ARCH-010 — Navigation typing is well-structured ✅
- **File**: `src/navigation/types.ts`
- **Evidence**: `RootStackParamList` defines 25 screens with proper params. `ScreenProps<T>` helper type exists. All screens registered in AppNavigator match the type.
- **Status**: Good. No issues found.

### ARCH-011 — Duplicate `generateId` implementations
- **Files**: `src/database/gameRepository.ts` (L214), `src/database/itemRepository.ts` (L55), `src/database/eventRepository.ts` (L79)
- **Problem**: Three separate `generateId` functions, two use timestamp+random, one uses prefix. Should be a single utility function.
- **Fix**: Create `src/utils/generateId.ts` and import from there.

### ARCH-012 — `console.log` not gated behind `__DEV__` in production code
- **File**: `src/services/aiProfileEngine.ts` (L163)
- **Snippet**: `console.log(` — appears inside `if (__DEV__)` block ✅
- **Status**: All console calls are properly gated. No leaks found.

### ARCH-013 — No Zustand `useGameStore()` unselected calls
- **Evidence**: Search for `useGameStore()` with no selector returned zero results.
- **Status**: Good — project follows granular selector pattern as documented.

---

## 2. TESTING

### TEST-001 — Test suite inventory
| # | Test file | Tests | Status |
|---|-----------|-------|--------|
| 1 | `combatEngine.test.ts` | ~15 | ✅ Pass |
| 2 | `economyService.test.ts` | ~10 | ✅ Pass |
| 3 | `lootService.test.ts` | ~8 | ✅ Pass |
| 4 | `progressionService.test.ts` | ~8 | ✅ Pass |
| 5 | `prng.test.ts` | ~5 | ✅ Pass |
| 6 | `migrations.test.ts` | ~8 | ✅ Pass |
| 7 | `navigation.test.tsx` | ~5 | ✅ Pass |
| 8 | `NarrativeMomentPanel.test.tsx` | ~4 | ✅ Pass |
| 9 | `worldSimulator.perf.test.ts` | ~6 | ✅ Pass |
| 10 | `App.test.tsx` | 1 | ❌ Fail |
| 11 | `CampScreen.test.tsx` | ~5 | ❌ Fail |
| **Total** | | **75 pass** | **9 pass / 2 fail** |

### TEST-002 — 2 test suites fail: op-sqlite not mocked
- **Files**: `__tests__/App.test.tsx`, `__tests__/CampScreen.test.tsx`
- **Error**: `SyntaxError: Cannot use import statement outside a module` at `@op-engineering/op-sqlite/lib/module/index.js`
- **Problem**: `jest.config.js` `transformIgnorePatterns` does not include `@op-engineering`. The `migrations.test.ts` works because it manually mocks the module, but `App.test.tsx` and `CampScreen.test.tsx` import screens that transitively import `connection.ts` → op-sqlite.
- **Fix**: Add `@op-engineering` to `transformIgnorePatterns` or add a global mock in `jest.setup.js`:
```js
jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => ({
    executeSync: jest.fn(() => ({ rows: [] })),
  })),
}));
```

### TEST-003 — Overall coverage: 29% statements, 15% branches
- **Coverage breakdown**:
  - `economyService.ts`: 100% ✅
  - `lootService.ts`: 94% ✅
  - `NarrativeMomentPanel.tsx`: 100% ✅
  - `migrations.ts`: 100% ✅
  - `prng.ts`: 100% ✅
  - `combatEngine.ts`: **12%** ❌
  - `characterStats.ts`: **11%** ❌
  - `progressionService.ts`: **60%** ⚠️
  - `monsterEvolutionService.ts`: **30%** ❌
  - `rulesConfig.ts`: **52%** ⚠️
- **Problem**: Core combat engine (983 lines) has only 12% coverage. Critical paths like `resolveCombat`, `resolvePlayerAttack`, `advanceTurnLive` are largely untested.

### TEST-004 — No tests for critical subsystems
- **Untested files** (0% coverage):
  - `src/stores/gameStore.ts` — state management
  - `src/database/gameRepository.ts` — game persistence CRUD
  - `src/database/itemRepository.ts` — item/loot persistence
  - `src/database/eventRepository.ts` — bounties and world events
  - `src/services/worldSimulator.ts` — world simulation (test exists but is 100% mocked)
  - `src/services/dungeonGraphService.ts` — dungeon generation
  - `src/services/timeService.ts` — cycle system
  - `src/services/bountyService.ts` — bounty lifecycle
  - `src/services/encounterService.ts` — encounter logic
  - All 23 screens except NarrativeMomentPanel (component) and CampScreen (fails to run)
- **Fix**: Prioritize tests for: gameRepository (data integrity), combatEngine (game correctness), dungeonGraphService (level generation), timeService (cycle math).

### TEST-005 — Test quality assessment: behavioral tests ✅
- **Observation**: Existing tests are well-structured. They test **behavior** not implementation:
  - `combatEngine.test.ts`: Tests determinism, enemy generation by room type, initiative ordering
  - `economyService.test.ts`: Tests formulas, scaling, edge cases (canAfford)
  - `lootService.test.ts`: Tests determinism, required fields, boss loot claiming
  - `progressionService.test.ts`: Tests XP distribution, dead character exclusion, level caps
- **Status**: Good quality. The problem is coverage breadth, not depth.

### TEST-006 — No CI configuration
- **Evidence**: No `.github/workflows/`, `.circleci/`, `.gitlab-ci.yml`, or `Jenkinsfile` found.
- **Problem**: Tests are only run manually. No automated gate prevents regressions.
- **Fix**: Add `.github/workflows/test.yml` for PR checks:
```yaml
name: Tests
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: yarn install --frozen-lockfile
      - run: yarn test
      - run: npx tsc --noEmit
```

### TEST-007 — jest.config.js missing coverage thresholds
- **File**: `jest.config.js`
- **Content**: Only 7 lines — preset, transformIgnorePatterns, setupFiles.
- **Missing**: `coverageThreshold`, `collectCoverageFrom`, `moduleNameMapper` for asset files.
- **Fix**: Add coverage enforcement:
```js
coverageThreshold: {
  global: { branches: 20, functions: 30, lines: 30, statements: 30 },
},
collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
```

### TEST-008 — worldSimulator.perf.test fully mocked (tests nothing real)
- **File**: `__tests__/worldSimulator.perf.test.ts`
- **Problem**: The entire `simulateWorld` function is mocked. The test verifies the mock's behavior, not the actual simulator. The "performance test" passes in <1ms because it calls a mock.
- **Fix**: Create integration test that imports real `worldSimulator` with a mocked DB layer.

---

## 3. DEPENDENCIES

### DEP-001 — `react-native-fast-image` installed but never imported
- **File**: `package.json` — `"react-native-fast-image": "^8.6.3"`
- **Evidence**: Global search for `react-native-fast-image` or `FastImage` returned **zero hits** in source code.
- **Problem**: Adds native binary size (~200KB), potential build issues, unused attack surface.
- **Fix**: `yarn remove react-native-fast-image`

### DEP-002 — `@shopify/react-native-skia` installed but not used in source
- **File**: `package.json` — `"@shopify/react-native-skia": "^2.5.1"`
- **Evidence**: Only reference is in `docs/nuevas mecanicas/illustration.md` (documentation, not code).
- **Problem**: Skia is one of the heaviest RN native dependencies (~5MB binary). Increases build time, app size, and potential for native build failures.
- **Fix**: Remove if no Skia features are planned for current sprint. Re-add when needed.

### DEP-003 — `react-native-worklets` installed but not used in source
- **File**: `package.json` — `"react-native-worklets": "^0.7.4"`
- **Evidence**: Only reference is in `.github/skills/` documentation files.
- **Problem**: Unused native dependency adding build complexity.
- **Fix**: `yarn remove react-native-worklets`

### DEP-004 — `@react-native-masked-view/masked-view` installed but not imported
- **File**: `package.json` — `"@react-native-masked-view/masked-view": "^0.3.2"`
- **Evidence**: Zero imports found anywhere in source.
- **Problem**: Unused native module.
- **Fix**: `yarn remove @react-native-masked-view/masked-view`

### DEP-005 — `@react-native/new-app-screen` kept from template
- **File**: `package.json` — `"@react-native/new-app-screen": "0.84.0"`
- **Evidence**: Zero imports found. This is the default RN template welcome screen.
- **Problem**: Dead template dependency.
- **Fix**: `yarn remove @react-native/new-app-screen`

### DEP-006 — `uuid` + `@types/uuid` in dependencies but never imported
- **File**: `package.json` — `"uuid": "^13.0.0"`, `"@types/uuid": "^11.0.0"` (in dependencies, not devDependencies!)
- **Evidence**: Project uses custom `generateId()` functions (timestamp + Math.random). Zero `uuid` imports.
- **Problem**: Two unused packages. `@types/uuid` should be in devDependencies if used at all.
- **Fix**: `yarn remove uuid @types/uuid`

### DEP-007 — `react-native-dotenv` in devDependencies but unused
- **File**: `package.json` — `"react-native-dotenv": "^3.4.11"`
- **Evidence**: Zero imports. No `.env` configuration in `babel.config.js`.
- **Problem**: Unused dev dependency.
- **Fix**: `yarn remove react-native-dotenv`

### DEP-008 — Patch for `react-native-image-manipulator` replaces jcenter()
- **File**: `patches/@oguzhnatly+react-native-image-manipulator+1.0.17.patch`
- **Content**: Replaces `jcenter()` with `mavenCentral()` in build.gradle.
- **Problem**: jcenter is deprecated/sunset. This patch is a workaround for an unmaintained library. Library version 1.0.17 is old.
- **Fix**: Consider migrating to `expo-image-manipulator` (standalone) or `react-native-image-crop-picker` which are actively maintained.

### DEP-009 — No lock on exact versions for critical native modules
- **File**: `package.json`
- **Observation**: Most deps use `^` ranges. For RN native modules, minor version bumps can introduce breaking native changes.
- **Most concerning**: `"react-native-reanimated": "^4.2.2"`, `"@op-engineering/op-sqlite": "^15.2.5"`, `"react-native-gesture-handler": "^2.30.0"`
- **Fix**: Pin exact versions for native modules that have broken builds before: `"react-native-reanimated": "4.2.2"` (no caret).

### DEP-010 — Dependency audit: 0 vulnerabilities ✅
- **Evidence**: User reports `npm audit` shows 0 vulnerabilities.
- **Status**: Clean. No action needed.

---

## 4. ACCESSIBILITY

### A11Y-001 — Zero `accessibilityLabel` usage across entire app
- **Evidence**: Global search for `accessibilityLabel|accessibilityRole|accessibilityHint` returned **only** one hit: `accessible={false}` in SeedScreen (which *disables* accessibility).
- **Problem**: The entire app is unusable with screen readers (VoiceOver/TalkBack). Every `TouchableOpacity`, `Pressable`, and interactive element is unlabeled.
- **Severity**: **Critical** — violates WCAG 2.1 AA, potentially blocks app store review.
- **Fix**: Systematic pass required. Priority screens:
  1. MainScreen — main menu buttons
  2. PartyScreen — character creation flow
  3. BattleScreen — combat actions
  4. MapScreen — room navigation

### A11Y-002 — TouchableOpacity/Pressable used extensively without labels
- **Files**: Used in all 23 screens. Found in:
  - `MainScreen.tsx`, `SeedScreen.tsx`, `PartyScreen.tsx`, `VillageScreen.tsx`, `BattleScreen.tsx`, `MapScreen.tsx`, `CampScreen.tsx`, `GuildScreen.tsx`, `ReportScreen.tsx`, `CharacterDetailScreen.tsx`, `MarketScreen.tsx`, `BlacksmithScreen.tsx`, `SettingsScreen.tsx`, `NegotiationScreen.tsx`, `AllianceScreen.tsx`, `AscensionScreen.tsx`, `ExtractionScreen.tsx`, `LevelUpScreen.tsx`, `EventResolutionScreen.tsx`, `WorldLogScreen.tsx`, `CycleTransitionScreen.tsx`, `SimulationLoadingScreen.tsx`, `UnificationScreen.tsx`
- **Approximate count**: 150+ interactive elements without `accessibilityLabel`.
- **Fix**: For each `<TouchableOpacity>` and `<Pressable>`, add:
```tsx
<TouchableOpacity
  accessibilityLabel={t('attack_button')}  // Use i18n
  accessibilityRole="button"
  accessibilityHint={t('attack_hint')}
>
```

### A11Y-003 — Image components have zero accessibility
- **Evidence**: Search for `<Image` + `source` returned 80+ Image usages across the app. None have `accessibilityLabel` or `accessible` props.
- **Key files**: Character portraits in `CharacterDetailScreen.tsx`, `PartyScreen.tsx`, `BattleScreen.tsx`, monster sprites, map icons.
- **Fix**: All decorative images: `accessible={false}`. All informational images: `accessibilityLabel` describing the content.

### A11Y-004 — `accessible={false}` used to dismiss keyboard interaction
- **File**: `src/screens/SeedScreen.tsx` (L101)
- **Snippet**: `<TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>`
- **Problem**: This disables accessibility for the entire wrapper, making the seed input screen invisible to screen readers.
- **Fix**: Use `Keyboard.dismiss` on the container `View` with `onStartShouldSetResponder`, or handle dismissal differently without disabling accessibility.

### A11Y-005 — hitSlop used sparingly (only 4 components)
- **Files**: `CharacterDetailScreen.tsx` (L373), `AscensionScreen.tsx` (L131), `TutorialOverlay.tsx` (L259), `CatalogPortraitPicker.tsx` (L118)
- **Problem**: Only 4 out of 150+ touchable elements have `hitSlop`. Most touch targets likely smaller than 44×44pt minimum recommended by Apple HIG and WCAG.
- **Fix**: Add standard hitSlop to all small touchable elements:
```tsx
const STANDARD_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };
```
Or set `minHeight: 44, minWidth: 44` on touchable styles globally.

### A11Y-006 — No semantic heading hierarchy
- **Evidence**: Text components in screens use styled `<Text>` with NativeWind classes but no `accessibilityRole="header"` for section headings.
- **Problem**: Screen readers cannot navigate by headings.
- **Fix**: Add `accessibilityRole="header"` to screen titles and section headers.

---

## SUMMARY — Priority Matrix

| Priority | ID | Category | Impact | Effort |
|----------|-----|----------|--------|--------|
| 🔴 P0 | ARCH-001 | Architecture | App crashes silently | Small |
| 🔴 P0 | TEST-002 | Testing | 2 test suites broken | Small |
| 🔴 P0 | A11Y-001 | Accessibility | App unusable for impaired users | Large |
| 🟠 P1 | ARCH-002 | Architecture | Silent failures hide bugs | Medium |
| 🟠 P1 | ARCH-006 | Architecture | Fatal crash on DB failure | Small |
| 🟠 P1 | TEST-003 | Testing | 29% coverage, 12% on combat engine | Large |
| 🟠 P1 | DEP-001 | Dependencies | 5+ unused native deps add ~6MB | Small |
| 🟡 P2 | ARCH-003 | Architecture | Monolith store hard to test | Medium |
| 🟡 P2 | ARCH-004 | Architecture | Business logic in store | Medium |
| 🟡 P2 | ARCH-007 | Architecture | Inconsistent transaction safety | Medium |
| 🟡 P2 | ARCH-008 | Architecture | God hook with 50+ returns | Medium |
| 🟡 P2 | TEST-006 | Testing | No CI = no regression gate | Small |
| 🟡 P2 | A11Y-002 | Accessibility | 150+ unlabeled touchables | Large |
| 🟡 P2 | A11Y-005 | Accessibility | Small touch targets | Medium |
| 🟢 P3 | ARCH-009 | Architecture | Missing noUncheckedIndexedAccess | Small |
| 🟢 P3 | ARCH-011 | Architecture | Duplicate generateId impls | Small |
| 🟢 P3 | ARCH-005 | Architecture | Empty barrel file | Trivial |
| 🟢 P3 | DEP-008 | Dependencies | Unmaintained image-manipulator | Medium |
| 🟢 P3 | DEP-009 | Dependencies | Unpinned native versions | Small |
| 🟢 P3 | TEST-007 | Testing | No coverage thresholds | Small |
| 🟢 P3 | TEST-008 | Testing | Mock-only perf test | Medium |

### Totals
- **Architecture**: 13 findings (1 positive ✅, 12 issues)
- **Testing**: 8 findings (1 positive ✅, 7 issues)
- **Dependencies**: 10 findings (1 positive ✅, 9 issues)
- **Accessibility**: 6 findings (0 positive, 6 issues)
- **Grand total**: 37 findings, 34 actionable issues
