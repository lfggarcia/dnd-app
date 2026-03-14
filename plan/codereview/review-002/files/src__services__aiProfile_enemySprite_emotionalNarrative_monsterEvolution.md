# Code Review — Services Batch A
**Files:** `aiProfileEngine.ts`, `enemySpriteService.ts`, `emotionalNarrativeService.ts`, `monsterEvolutionService.ts`
**Pipeline:** 002 | **CRs:** CR-070 – CR-081

---

## `src/services/aiProfileEngine.ts`

**Summary:** Pure deterministic profile engine for NPC AI. 4 exported functions. ~170 lines.

### What's Good
- `deriveBaseProfile` is fully deterministic via PRNG seed — replay safe.
- `maybeMutateProfile` only runs on `cycle % MUTATION_INTERVAL === 0` — efficient.
- `console.log` at line 163 confirmed guarded by `if (__DEV__)` — **ARCH-004 in audit is incorrect**.
- No `as any`. No DB calls. No side effects on hot path.

### Issues

#### CR-070 — `getBaseWeights` redundant with `BASE_WEIGHTS` constant
**Severity:** MINOR | **Category:** ARCH
```ts
// Current: a function that just returns the constant
export function getBaseWeights(): typeof BASE_WEIGHTS { return BASE_WEIGHTS; }
```
Adding a function wrapper around a constant adds indirection with no benefit. Callers can import `BASE_WEIGHTS` directly.

#### CR-071 — `getActionWeights` merges adaptive weights but has no clamp
**Severity:** MINOR | **Category:** LOGIC
```ts
// No clamp after adding adaptive weights — result can go negative or >1
const merged = { ...base, ...adapted };
```
Weights should be clamped to `[0, 1]` range after merging to prevent negative probabilities in the downstream decision engine.

---

## `src/services/enemySpriteService.ts`

**Summary:** ComfyUI integration for enemy sprite generation (txt2img + img2img). 417 lines. Heavy async work.

### What's Good
- `spriteCache` prevents redundant generation calls per session.
- `POLL_MAX_ATTEMPTS × POLL_INTERVAL_MS` (30 × 1000ms) = 30s timeout baked in — graceful degradation via fallback sprite.
- `preloadFloorSprites` is called ahead of time, not on first render.
- `(formData as any).append(...)` at line 223 is the known RN FormData typing limitation — justified.

### Issues

#### CR-072 — `COMFY_HOST` hardcoded to `localhost:8188`
**Severity:** MAJOR | **Category:** CONFIG
```ts
export const COMFY_HOST = 'localhost:8188';
export const COMFY_BASE_URL = `http://${COMFY_HOST}`;
```
This should be read from an environment variable or app config (e.g. `process.env.COMFY_HOST`). Hardcoded localhost breaks any device testing over LAN (tablet/phone connected to same network as ComfyUI host).

#### CR-073 — `fetchImageAsBase64` has no timeout
**Severity:** MINOR | **Category:** RELIABILITY
The HTTP fetch for the generated image has no timeout set. On a slow network this could hang indefinitely. Should use `AbortController` or set a timeout in config.

#### CR-074 — `copyOutputToInput` side-effect silent failure
**Severity:** MINOR | **Category:** ERROR-HANDLING
`copyOutputToInput` calls filesystem ops but swallows errors silently (try/catch with no rethrow or log). If this fails, `buildImg2ImgWorkflow` will use a stale input file with no indication.

---

## `src/services/emotionalNarrativeService.ts`

**Summary:** Emotion state machine + narrative text generation. 381 lines. Pure functions.

### What's Good
- `NARRATIVE_POOLS` are all in-memory — zero DB dependency.
- `buildNarrativeText` uses a seedless inline LCG for determinism per `charName + eventType` — replay consistent.
- `tickEmotionDurations` returns new array (immutable). No mutations.
- No `console.log`, no `as any`.

### Issues

#### CR-075 — `NARRATIVE_POOLS` strings are Spanish-only
**Severity:** MODERATE | **Category:** I18N
```ts
// All narrator lines and dialogue are in Spanish
narrator: ['La batalla clama su sacrificio...', ...],
dialogue: { fighter: ['¡Aguanto, por mis compañeros!', ...], ... }
```
There is no `lang` parameter in `buildNarrativeText`. All generated narrative text will always be in Spanish regardless of language setting. This affects any screen that shows combat narrative (BattleScreen, ReportScreen).

#### CR-076 — Inline LCG in `buildNarrativeText` not using `makePRNG`
**Severity:** MINOR | **Category:** CONSISTENCY
The file uses an inline hash + LCG while the rest of the codebase uses `makePRNG`. This creates two separate PRNG implementations to maintain.

---

## `src/services/monsterEvolutionService.ts`

**Summary:** Monster evolution chains, XP, secret boss conditions. 391 lines.

### What's Good
- `recordKill` is pure / immutable — no mutations.  
- `EVOLUTION_CHAINS` bound-checked: `chain[Math.min(tier, chain.length - 1)]` — safe.
- Fallback to `MONSTER_STATS.goblin` in `getEvolvedMonster` prevents crashes for unknown types.
- `checkSecretBossTriggers` / `checkSecretBossUnlock` use separate pure check + DB-write split — testable.

### Issues

#### CR-077 — `getMonsterStats` returns `undefined` for unknown key without fallback
**Severity:** MINOR | **Category:** SAFETY
```ts
export function getMonsterStats(type: string): MonsterStats | undefined {
  return MONSTER_STATS[type]; // no fallback
}
```
Unlike `getEvolvedMonster` which falls back to `goblin`, `getMonsterStats` returns `undefined`. Callers (e.g. combatEngine) must handle `undefined` — a missed check could crash combat.

#### CR-078 — Secret boss condition check uses hardcoded Spanish string in log
**Severity:** MINOR | **Category:** I18N
```ts
log: [`${condition.bossKey.toUpperCase()} DESBLOQUEADO — ${condition.description}`]
```
Log strings from `checkSecretBossUnlock` are Spanish only. If these are shown to the user they will not be translated. Should route through i18n or keep as internal debug logs only.
