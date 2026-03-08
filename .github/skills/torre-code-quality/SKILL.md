---
name: torre-code-quality
description: Code quality review and refactoring guide specific to TORRE codebase. Checks NativeWind patterns, Zustand usage, navigation typing, performance anti-patterns, and DnD 5e logic correctness. Use when reviewing code, refactoring a screen, or debugging a React Native rendering issue. Keywords: code-review, refactor, performance, NativeWind, Zustand, navigation, hooks, memoization, typescript.
argument-hint: [file or area to review, e.g. "MapScreen" or "all screens"]
---

# TORRE — Code Quality

---

## Step 1 — Identify target

If a specific file was provided, read it. Otherwise, scan:
```bash
# Find files with known anti-patterns
grep -r "StyleSheet.create\|useState.*\[\]\|useEffect.*\[\]" src/screens/ --include="*.tsx" -l
grep -r "any\b" src/ --include="*.ts" --include="*.tsx" -l | grep -v "\.d\.ts"
grep -n "navigate(" src/screens/ --include="*.tsx" -r | grep -v "navigation.navigate"
```

---

## Step 2 — Apply TORRE-specific quality rules

### ✅ NativeWind / Styling

```typescript
// ✅ Correct — NativeWind className
<View className="flex-1 bg-black px-4">

// ❌ Wrong — inline StyleSheet for layout
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: 'black' } });

// ✅ Exception allowed — StyleSheet for perf-critical repeated components (e.g. CRTOverlay)
```

Palette colors use Tailwind tokens from `tailwind.config.js`. Never hardcode hex unless it's a one-off dynamic value.

### ✅ Zustand State

```typescript
// ✅ Correct — single selector to prevent unnecessary re-renders
const floor = useGameStore(state => state.activeGame?.floor);
const cycle = useGameStore(state => state.activeGame?.cycle);

// ❌ Wrong — subscribes to entire store, re-renders on any change
const store = useGameStore();

// ✅ Correct — action reference is stable
const updateProgress = useGameStore(state => state.updateProgress);
```

Always use granular selectors. Aggregate only when multiple related fields change together.

### ✅ Navigation Typing

```typescript
// ✅ Correct
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';

const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
const route = useRoute<RouteProp<RootStackParamList, 'Battle'>>();

// ❌ Wrong — untyped navigation
const navigation = useNavigation();

// ❌ Wrong — reading params without route typing
const params = (route as any).params;
```

Always verify param types match `RootStackParamList` in `src/navigation/types.ts`.

### ✅ Hooks Rules

```typescript
// ✅ Extract complex logic to hooks
// hooks/useFloorExploration.ts — map state + room actions
// hooks/usePartyRoster.ts — already exists ✅

// ❌ Don't put business logic in screens — screens should only wire UI to hooks/store
// ❌ Don't call useGameStore inside callbacks (it breaks rules of hooks)
```

### ✅ Performance Anti-Patterns

```typescript
// ❌ CRTOverlay renders 100 Views — known perf issue, slated for Sprint 7
// Don't add MORE Views inside CRTOverlay — add content around it

// ❌ Don't create functions inside render without useCallback if passed as props
const handler = useCallback(() => { ... }, [deps]);

// ❌ Don't create objects/arrays inline as props
// ❌: <Component style={{ margin: 8 }} />
// ✅: const style = useMemo(() => ({ margin: 8 }), []);

// ✅ FlatList keyExtractor must be stable
keyExtractor={(item) => item.id}  // never use index
```

### ✅ Database Access

```typescript
// ✅ Always via gameRepository.ts
import { saveGame, loadGame } from '../database/gameRepository';

// ❌ Never access op-sqlite connection directly from screens or stores
// ❌ Never run SQL in components
```

### ✅ i18n

```typescript
// ✅ Always
const { t } = useI18n();
<Text>{t('battle.victory_title')}</Text>

// ❌ Never
<Text>Victoria</Text>
<Text>Victory!</Text>
```

### ✅ TypeScript

```typescript
// ❌ Never use `any` — use `unknown` and narrow, or define proper types
// ✅ Prefer type unions over boolean flags
type CombatPhase = 'SETUP' | 'COMBAT' | 'VICTORY' | 'DEFEAT';  // ✅
type BattleState = { isVictory: boolean; isSetup: boolean };    // ❌ fragile

// ✅ Use optional chaining safely
const hp = activeGame?.party?.[0]?.hp ?? 0;
```

### ✅ DnD 5e Logic

When implementing combat or character mechanics:
- Use `characterStats.ts` utilities — don't reimplement stat calculation
- Use `monsterEvolutionService.ts` for ALL enemy generation — never hardcode enemy stats
- All random rolls MUST use seeded RNG from `backgroundSeed.ts`
- Proficiency bonus formula: `Math.floor((level - 1) / 4) + 2`
- Ability modifier formula: `Math.floor((score - 10) / 2)`

---

## Step 3 — Report findings

Structure the report as:

```
## Code Quality Report: [filename]

### 🔴 Critical Issues (fix now)
- [issue] → [fix]

### 🟡 Warnings (fix this sprint)
- [issue] → [fix]

### 🟢 Suggestions (backlog)
- [issue] → [fix]

### ✅ Good patterns found
- [pattern] — keep this
```

---

## Step 4 — Apply fixes

For each critical or warning issue:
1. Read the relevant lines in the file
2. Apply the fix directly using file editing tools
3. Verify no TypeScript errors introduced

After fixing, run:
```bash
cd /Users/lfgg/personal-projects/dnd3 && npx tsc --noEmit 2>&1 | head -30
```

---

## Common TORRE-specific bugs to check

| Pattern | Problem | Fix |
|---------|---------|-----|
| `navigation.navigate('Battle')` without params | TypeScript allows it if params not typed yet | Add params to `RootStackParamList` |
| `JSON.parse(mapState)` without try/catch | Crashes if mapState is null or malformed | Wrap in try/catch with `|| defaultFloorState` fallback |
| `party.map(...)` without null check | Crashes if party is empty array or undefined | Use `party?.map(...)` or guard |
| `useEffect` dep array missing store selectors | Stale closures | Add all referenced state to dep array |
| Floor state modification without deep clone | Zustand mutation bug | Always spread: `{ ...floor, rooms: [...floor.rooms] }` |
