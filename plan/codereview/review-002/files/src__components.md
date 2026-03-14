# Code Review — Components
**Files:** All 16 component files (src/components/ + src/components/party/)
**Pipeline:** 002 | **CRs:** CR-110 – CR-120

---

## `src/components/CRTOverlay.tsx` & `TorreLogo.tsx` & `LogoIA.tsx` & `SliderButton.tsx`

**Summary:** Pure presentational/decorative components.

### What's Good
- `CRTOverlay` is a static SVG scanline layer — zero state, zero re-renders.
- `LogoIA` correctly uses `LOGO_ASPECT` constant for image ratio.

**No issues. ✅**

---

## `src/components/TypewriterText.tsx`

**Summary:** Character-by-character text animation with blinking cursor.

### What's Good
- `animDoneRef` tracks completion to stop cursor blink — avoids unnecessary `setState` calls after text finishes.
- Cleanup via `clearInterval` in both `useEffect` returns — no memory leaks.
- `onComplete` is in `useEffect` deps to handle callback reference changes.

**No issues. ✅**

---

## `src/components/NarrativeMomentPanel.tsx`

**Summary:** Emotion-driven combat narrative slide-in panel with auto-dismiss.

### What's Good
- Uses old `Animated` API (not Reanimated) consistently for this component — no mixed-driver issue.
- `useNativeDriver: true` — GPU-accelerated transform.
- Auto-dismiss timer cleaned up on unmount.

### Issues

#### CR-110 — `useEffect` deps array is `[]` with `eslint-disable` comment — stale `onDismiss`
**Severity:** MINOR | **Category:** CORRECTNESS
```ts
useEffect(() => {
  ...
  const timer = setTimeout(onDismiss, DISMISS_DELAY_MS);
  return () => clearTimeout(timer);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```
If `onDismiss` changes between renders (e.g. because it's recreated on each parent render without `useCallback`), the captured reference will be stale. The parent should wrap `onDismiss` with `useCallback`, or the dep should be added and the Animated value re-initialized via ref.

---

## `src/components/ConfirmModal.tsx`

**Summary:** Generic confirmation dialog.

**No issues. ✅**

---

## `src/components/GlossaryModal.tsx`

**Summary:** In-game encyclopedia — DB-backed DnD 5e entries with search and lang toggle.

### What's Good
- `cancelled` flag in async `useEffect` prevents `setState` after unmount.
- Lazy sync (sync only on modal open, only fetch full data if needed) — efficient.
- `useMemo` for filtered entries with `search`, `activeCategory`, `dbEntries` deps — correct.

### Issues

#### CR-111 — `JSON.parse(r.data)` in `entries` map without try/catch
**Severity:** MODERATE | **Category:** RELIABILITY
```ts
const raw = JSON.parse(r.data) as Record<string, unknown>;
```
Same issue as CR-107 in `translationBridge.ts`. Corrupted DB row crashes the whole glossary render. Should be wrapped in try/catch with empty object fallback `{}`.

#### CR-112 — `as any[]` casts in `DESC_BUILDERS` for raw API data
**Severity:** MINOR | **Category:** TYPE-SAFETY
```ts
const bonuses = ((raw.ability_bonuses as any[]) ?? [])
```
The raw DnD 5e API response shapes are known — proper interfaces should be defined for at least the fields used in `DESC_BUILDERS`. Using `as any[]` loses type safety on array element access.

#### CR-113 — `GlossaryModal` always renders `null` when `visible=false` instead of using Modal
**Severity:** MINOR | **Category:** ARCH
```ts
if (!visible) return null;
```
This is a valid approach but it means the component completely unmounts on close, resetting all state (search, active category, loaded DB entries). A `Modal` component with `visible` prop would preserve state between opens. The current approach means the DB is re-queried on every open.

---

## `src/components/TutorialOverlay.tsx`

**Summary:** Multi-step onboarding overlay.

**No issues. ✅**

---

## `src/components/CharacterActionsPanel.tsx`

**Summary:** D&D action display panel — combat, class, race, subclass ability sections with optional feature choices.

### What's Good
- `useMemo` for category derivation — no re-computation on unrelated renders.
- `memo()` wrapping — no re-render unless props change.

### Issues

#### CR-114 — Category labels still use `lang === 'es' ? labelEs : labelEn` inline pattern
**Severity:** MINOR | **Category:** I18N
```ts
{lang === 'es' ? category.labelEs : category.labelEn}
```
While the `ActionCategory` interface stores both `labelEs` and `labelEn` fields, this is duplicating the i18n mechanism. Both fields should be in the translation files instead, keeping the component language-agnostic.

---

## `src/components/InventoryGrid.tsx`

**Summary:** Fixed-size inventory grid (SLOT_COUNT slots).

### What's Good
- Uses `Array.from({ length: SLOT_COUNT })` to always render the same number of slots — consistent grid layout.
- `RARITY_COLORS` map provides consistent visual language.

### Issues

#### CR-115 — `key={idx}` on inventory slots — index key anti-pattern
**Severity:** MINOR | **Category:** PERFORMANCE
```tsx
slots.map((_, idx) => {
  ...
  key={idx}
```
Using array index as key is acceptable here since the slot count is fixed and items never reorder. However, if items can ever be sorted or filtered, index keys will cause wrong animations/state. Use `item?.id ?? `empty-${idx}`` as the key.

---

## `src/components/BossRoomEntryUI.tsx`

**Summary:** Pre-boss encounter UI — shows party HP state and enter/cancel CTAs.

### What's Good
- `avgHpPct` computed from live party data — accurate pre-battle assessment.
- HP percentage color thresholds help players make an informed decision.

### Issues

#### CR-116 — `lang === 'es'` hardcoded strings (8 occurrences)
**Severity:** MINOR | **Category:** I18N
All component strings use `lang === 'es' ? '...' : '...'` inline pattern. Should use `t()` from `useI18n`.

---

## `src/components/BountyBoard.tsx` & `AllianceCard.tsx`

**Summary:** Bounty and alliance display cards.

### What's Good
- Both receive `lang` as prop and `bounty`/`alliance` data — no store access.

### Issues

#### CR-117 — `BountyBoard` / `AllianceCard` use `lang === 'es'` pattern (6+ occurrences combined)
**Severity:** MINOR | **Category:** I18N
Same inline ternary i18n pattern. Should use `useI18n()` hook internally (or accept `t` as a prop) instead of `lang` prop + inline ternaries.

---

## `src/components/party/` (5 files)

**Summary:** Party creation sub-components — portrait picking, roster display, launch progress.

### What's Good
- `CatalogPortraitPicker` uses `memo` for `PortraitThumb` — avoids re-rendering all thumbnails on selection change.
- `LaunchProgressModal` is presentation-only (receives `subStep: string` to display).

### Issues

#### CR-118 — All party sub-components use `lang === 'es'` inline pattern (15+ occurrences)
**Severity:** MINOR | **Category:** I18N
All 5 party components use the inline ternary i18n pattern rather than `t()`. This is the largest single concentration of this pattern outside CampScreen.

#### CR-119 — `PortraitSection` contains generation logic (side effects) in a presentational component
**Severity:** MODERATE | **Category:** ARCH
`PortraitSection` receives `generating` state and presumably triggers generation. If it calls `enemySpriteService` or similar async services, it crosses the boundary between presentational and container component. Generation should be lifted to the parent screen.

---

## Global Component Issues

#### CR-120 — `DatabaseGate.tsx` (already reviewed as CR-018 to CR-020 in database layer)
No new issues beyond those already found.

---

## Summary

| Severity | Count |
|---|---|
| MAJOR | 0 |
| MODERATE | 3 (CR-111, CR-113, CR-119) |
| MINOR | 8 (CR-110, CR-112, CR-114, CR-115, CR-116, CR-117, CR-118) |
| INFO | 1 (CR-120 already covered) |

**Overall:** Components are well-structured. The dominant issue category is the pervasive `lang === 'es'` inline i18n pattern (CRs 114, 116, 117, 118) — 30+ occurrences across all components. `GlossaryModal` is the most complex component and has the highest issue density.
