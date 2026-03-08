---
name: torre-context
description: Background context for TORRE (dnd3) project. Auto-loads full project architecture, game design, current sprint status, known bugs, file map, and conventions. Use when working on any TORRE feature, bug, or planning task. Keywords: torre, dnd3, dungeon, combate, party, dungeon graph, game loop, sprint.
user-invocable: false
---

# TORRE — Project Context

TORRE is a **React Native RPG** with CRT/cyberpunk aesthetics. A social simulation RPG where ~10 parties (1-2 player + rest AI) compete inside a 100-floor tower over 60 cycles per season. DnD 5e combat rules. Deterministic world via seed.

---

## Tech Stack

- React Native 0.84, TypeScript
- NativeWind v4 (Tailwind className for styles)
- Zustand (global state, persisted to SQLite)
- op-sqlite v15 (SQLite, schema v6)
- React Navigation (Stack, 11 screens, typed `RootStackParamList`)
- Reanimated v4, Gesture Handler v2, react-native-svg v15
- Google Gemini API (portrait generation)
- ComfyUI (facial expression generation, local)
- i18n: ES/EN via Context + `useI18n()` hook

---

## Current Sprint: 4A — Cerrar el Game Loop 🔴 ACTIVO

**See `PROJECT_PLAN.md` at project root for full sprint details.**

### Sprint Status Summary
- ✅ Sprint 1: Foundation (11 screens, DB, i18n, navigation)
- ✅ Sprint 2: Visual Pipeline (Gemini portraits, ComfyUI expressions, enemy sprites)
- ✅ Sprint 3: Dungeon Engine (dungeonGraphService, fog-of-war, monsterEvolution, characterStats)
- 🔴 Sprint 4A: Close Game Loop — **NEXT TO DO**
- ⬜ Sprint 4B: DnD 5e Combat Engine
- ⬜ Sprint 5: World Simulation (AI parties)
- ⬜ Sprint 6: Social Layer (politics, bounties, alliances)
- ⬜ Sprint 7: Optimization & Release

---

## 🐛 Critical Bugs (block everything)

1. **`Battle: undefined`** — `MapScreen` navigates to BattleScreen without passing `roomId`/`roomType` params
2. **Rooms never marked `visited`** — MapScreen doesn't receive the result back from ReportScreen
3. **Boss can't be cleared → floor can't advance** — depends on bug #2
4. **`ReportScreen` navigates to Extraction** instead of back to Map after combat
5. **iOS save/party deletion bug** — `gameRepository.ts` / `gameStore.ts`

---

## Source Structure

```
src/
  screens/
    MainScreen.tsx         # Entry, routes by saved location
    SeedScreen.tsx         # Seed input + Matrix effect
    PartyScreen.tsx        # Full DnD 5e character creation
    VillageScreen.tsx      # Safe zone hub
    MapScreen.tsx          # Dungeon exploration (dungeonGraphService)
    BattleScreen.tsx       # Combat UI (currently mock)
    ReportScreen.tsx       # Post-combat results (currently mock)
    GuildScreen.tsx        # Roster + portraits
    WorldLogScreen.tsx     # Events feed
    ExtractionScreen.tsx   # Exit button (unlocks at cycle 60)
    CycleTransitionScreen.tsx
  components/
    CRTOverlay.tsx         # 100 Views scanline effect (perf risk)
    TypewriterText.tsx     # Animated text reveal
    ConfirmModal.tsx
    GlossaryModal.tsx      # DnD 5e glossary with search
    TutorialOverlay.tsx
    CharacterActionsPanel.tsx
    SliderButton.tsx
    Icons.tsx              # Full SVG icon library
    TorreLogo.tsx          # SVG neon logo
    LogoIA.tsx             # AI-generated logo (used in MainScreen)
    DatabaseGate.tsx       # DB sync wrapper
    party/
      LaunchProgressModal.tsx
      PortraitSection.tsx
      PortraitDetailModal.tsx
      RosterTabs.tsx
  services/
    dungeonGraphService.ts    # Floor graphs: 12-20 rooms, fog-of-war, secrets, mutations
    monsterEvolutionService.ts # 35+ enemy stats by tier, XP decay, secret bosses
    characterStats.ts         # Pure DnD 5e stat utils: assignStandardArray, computeFinalStats
    geminiImageService.ts     # Portrait generation via Google Gemini
    enemySpriteService.ts     # 35+ enemy types, 5 animations each
    spriteDbService.ts        # Bundled sprite DB access
    mapGenerator.ts           # Legacy 8-node DAG (replaced by dungeonGraphService)
    rivalGenerator.ts         # Deterministic AI party generation
    api5e.ts                  # DnD 5e API sync (24 endpoints)
    syncService.ts            # DB sync orchestration
    backgroundSeed.ts         # Seeded PRNG utilities
    translationBridge.ts      # Translation with fallback chain (DB → API → raw)
    translationSeed.ts        # Translation DB seeder
    subclassSeed.ts           # 26 custom subclasses seeder
    rulesConfig.ts            # DnD 5e rule configuration
  stores/
    gameStore.ts              # Zustand store: activeGame, savedGames, all game actions
  hooks/
    usePartyRoster.ts         # Party roster logic extracted from PartyScreen
  database/
    connection.ts             # SQLite connection
    migrations.ts             # Schema v1→v6
    gameRepository.ts         # SavedGame + CharacterSave CRUD
    index.ts
  navigation/
    types.ts                  # RootStackParamList (add Battle/Report params in Sprint 4A)
  i18n/                       # ES/EN translations, useI18n hook
  constants/
    dnd5eLevel1.ts            # 13 classes, 26 subclasses, 9 races, features + translations
  theme/                      # CRT/cyberpunk color palette
  types/                      # Global TypeScript types
```

---

## Key Data Types

```typescript
// Navigation params (needs Sprint 4A update)
type RootStackParamList = {
  // ... existing screens
  Battle: { roomId: string; roomType: RoomType }; // ADD THIS
  Report: { roomId: string; roomWasCleared: boolean }; // ADD THIS
}

// Dungeon graph
type RoomType = 'START' | 'NORMAL' | 'ELITE' | 'BOSS' | 'TREASURE' | 'REST' | 'SECRET' | 'SAFE_ZONE'
type Room = { id: string; type: RoomType; visited: boolean; cleared: boolean; connections: string[] }
type FloorExplorationState = { rooms: Room[]; currentRoomId: string; startRoomId: string; bossRoomId: string }

// Saved game
type SavedGame = {
  seed: string; party: CharacterSave[]; floor: number; cycle: number;
  phase: string; gold: number; status: string; location: string;
  mapState: string; // JSON of FloorExplorationState
  partyPortrait: string; portraitsJson: string; expressionsJson: string;
}
```

---

## Conventions

| Topic | Convention |
|-------|------------|
| Styles | NativeWind className; NO StyleSheet.create except perf-critical |
| State | Zustand; NO useState for shared/derived logic |
| Navigation | `useNavigation<NativeStackNavigationProp<RootStackParamList>>()` always typed |
| Route params | `useRoute<RouteProp<RootStackParamList, 'ScreenName'>>()` |
| i18n | Always `t('key')` via useI18n(); NO hardcoded user-facing strings |
| DB access | Always via `gameRepository.ts`; never direct from screens |
| Code language | Variables/functions in English; comments in Spanish OK |
| Commit format | `feat(scope):`, `fix(scope):`, `chore(scope):` |

---

## Game Design Reference

### The Tower (La Torre)
- 100 floors, difficulty scales by floor
- 60 cycles per season — cycle 60 triggers final ranking
- Cycles alternate Day/Night (affects encounters and bonuses)
- Each season = unique world via seed

### Parties
- ~10 simultaneous parties: 1-2 player-controlled + rest AI
- All share same world: same floors, same bosses, same limited resources
- AI parties simulated in batches when player advances cycles

### Safe Zone (El Pueblo)
- No combat — base hub at tower entrance
- ARMERÍA (equipment), EL GREMIO (missions/bounties/alliances), POSADA (rest/recovery)
- Resting **advances the cycle** — has time cost

### Player Loop (Per Cycle)
```
Decide cycle action:
  ├── Explore (advance in current floor)
  ├── Ascend floor (try to advance vertically)
  ├── Rest (recover HP/resources — costs cycles)
  ├── Negotiate (alliances, protection, trade)
  └── Attack another party (tactical — with consequences)

On cycle advance:
  └── Engine simulates all AI parties up to current cycle
```

---

## Skills de Sistemas TORRE

Cada sistema del juego tiene su propio skill con detalles completos:

| Skill | Sistema | Cuándo usar |
|---|---|---|
| `torre-combat-engine` | Combate DnD 5e | BattleScreen, ReportScreen, combate por turnos |
| `torre-math-engine` | Fórmulas exactas | Hit/damage/XP/iniciativa/escalado/probabilidades |
| `torre-ai-system` | IA + Bounty + Moral | Simulación IA, decision engine, bounty, perfil estratégico |
| `torre-time-system` | Ciclos + Temporada | Avance de ciclo, simulación batch, día/noche |
| `torre-economy` | Economía + Loot | Oro, drops, loot de jefe, costo de revivir |
| `torre-party-rules` | Parties + Jugador | Creación de personajes, herencia de nivel, muerte |
| `torre-politics` | Gremio + Alianzas | Guild, alianzas, extorsión, world log, bounty diplomático |
| `torre-tech-arch` | Arquitectura + DB | SQLite schema, GameState, Zustand, seed model, persistencia |
| `torre-code-quality` | Calidad de código | NativeWind, hooks, memoización, anti-patrones RN |
| `torre-doc-sync` | Documentación | Actualizar PROJECT_PLAN.md, HANDOFF.md, CHANGELOG.md |
| `torre-sprint` | Sprint / Planning | Qué sigue, estado del sprint, próximas tareas |

---

## Agents TORRE

Agentes especializados para flujos de trabajo completos (`.github/agents/`):

| Agent | Propósito | Cuándo usar |
|---|---|---|
| `torre-implementer` | Implementar features del sprint | Escribir código, wiring de pantallas, crear servicios |
| `torre-debugger` | Encontrar y fixear bugs | Crashes, navegación rota, estado no persistido |
| `torre-game-designer` | Validar diseño de juego | Nuevas mecánicas, balance, reglas DnD 5e |
| `torre-session-starter` | Arrancar sesión de trabajo | "¿Qué hacemos hoy?", inicio de sesión, siguiente tarea |
