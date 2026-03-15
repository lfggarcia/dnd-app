# TORRE — Plan de Refactoring: Arquitectura Hexagonal

> Documento de planificación completo. Todo cambio debe cruzarse con este plan antes de ejecutarse.

---

## 0. Contexto y objetivo

**Proyecto:** TORRE (dnd3) — roguelike mobile en React Native  
**Estado actual:** arquitectura plana (screens / services / components / stores / database)  
**Objetivo:** migrar a Arquitectura Hexagonal + Atomic Design + OOP/SOLID + preparación TDD

### Reglas inamovibles del refactor

| Regla | Detalle |
|---|---|
| **STYLES** | Nunca `StyleSheet.create()` en `.tsx/.jsx`. Cada componente tiene `Component.styles.ts` |
| **DOMAIN** | Entidades como clases OOP con lógica de negocio encapsulada. Los repositorios del dominio son sólo interfaces. Sin imports de React Native, infra o presentación |
| **USE CASES** | Un archivo por use case, responsabilidad única. Sin imports de React Native |
| **HOOKS** | Bridge entre UI y use cases. Sin lógica de negocio. Use cases inyectados via Context |
| **ZUSTAND** | Los stores gestionan solo estado de UI. Sin reglas de negocio en acciones |
| **TYPES** | Interfaces y tipos compartidos en archivos `.types.ts` separados |
| **TESTS** | Carpeta `__tests__` por capa con tests unitarios de dominio y use cases |

---

## 1. Estructura objetivo

```
src/
├── domain/
│   ├── entities/
│   │   ├── Character.ts
│   │   ├── Party.ts
│   │   ├── Monster.ts
│   │   ├── Dungeon.ts
│   │   ├── Room.ts
│   │   ├── CombatSession.ts
│   │   ├── Item.ts
│   │   ├── BountyContract.ts
│   │   ├── Alliance.ts
│   │   └── WorldEvent.ts
│   ├── value-objects/
│   │   ├── AbilityScore.ts
│   │   ├── HitPoints.ts
│   │   ├── Gold.ts
│   │   ├── Level.ts
│   │   ├── DungeonFloor.ts
│   │   └── Seed.ts
│   ├── repositories/              ← interfaces / puertos
│   │   ├── IGameRepository.ts
│   │   ├── ICharacterRepository.ts
│   │   ├── IItemRepository.ts
│   │   ├── IEventRepository.ts
│   │   ├── IRivalRepository.ts
│   │   └── IEssenceRepository.ts
│   ├── services/                  ← domain services (lógica que no pertenece a una sola entidad)
│   │   ├── CombatDomainService.ts
│   │   ├── DungeonGeneratorService.ts
│   │   ├── LootDomainService.ts
│   │   └── ProgressionDomainService.ts
│   └── errors/
│       ├── DomainError.ts
│       ├── CombatError.ts
│       └── GameStateError.ts
│
├── application/
│   ├── use-cases/
│   │   ├── game/
│   │   │   ├── StartNewGameUseCase.ts
│   │   │   ├── LoadGameUseCase.ts
│   │   │   ├── SaveGameUseCase.ts
│   │   │   └── EndGameUseCase.ts
│   │   ├── party/
│   │   │   ├── CreatePartyUseCase.ts
│   │   │   ├── AddCharacterToPartyUseCase.ts
│   │   │   ├── RemoveCharacterFromPartyUseCase.ts
│   │   │   └── LaunchPartyIntoDungeonUseCase.ts
│   │   ├── combat/
│   │   │   ├── ResolveCombatRoundUseCase.ts
│   │   │   ├── CalculateInitiativeUseCase.ts
│   │   │   └── ApplyCombatResultUseCase.ts
│   │   ├── dungeon/
│   │   │   ├── GenerateDungeonUseCase.ts
│   │   │   ├── EnterRoomUseCase.ts
│   │   │   ├── AdvanceFloorUseCase.ts
│   │   │   └── ExtractFromDungeonUseCase.ts
│   │   ├── economy/
│   │   │   ├── BuyItemUseCase.ts
│   │   │   ├── SellItemUseCase.ts
│   │   │   ├── GenerateLootUseCase.ts
│   │   │   └── ReviveCharacterUseCase.ts
│   │   ├── simulation/
│   │   │   ├── RunWorldSimulationUseCase.ts
│   │   │   └── AdvanceCycleUseCase.ts
│   │   ├── bounty/
│   │   │   ├── CreateBountyUseCase.ts
│   │   │   └── ResolveBountyUseCase.ts
│   │   └── alliance/
│   │       ├── ProposeAllianceUseCase.ts
│   │       └── ResolveNegotiationUseCase.ts
│   └── ports/                     ← interfaces de servicios externos que la app necesita
│       ├── IWorldSimulatorPort.ts
│       ├── IImageServicePort.ts
│       └── IAIProfilePort.ts
│
├── infrastructure/
│   ├── repositories/              ← implementaciones concretas (SQLite)
│   │   ├── SqliteGameRepository.ts
│   │   ├── SqliteCharacterRepository.ts
│   │   ├── SqliteItemRepository.ts
│   │   ├── SqliteEventRepository.ts
│   │   ├── SqliteRivalRepository.ts
│   │   └── SqliteEssenceRepository.ts
│   ├── services/                  ← adaptadores de servicios externos
│   │   ├── GeminiImageAdapter.ts
│   │   ├── AIProfileAdapter.ts
│   │   └── SyncAdapter.ts
│   ├── database/                  ← conexión SQLite, migraciones (se mueve desde src/database/)
│   │   ├── connection.ts
│   │   ├── migrations.ts
│   │   └── index.ts
│   └── di/
│       └── AppContext.tsx          ← contenedor DI via React Context
│
└── presentation/
    ├── atoms/
    │   ├── Text/
    │   │   ├── Text.tsx
    │   │   └── Text.styles.ts
    │   ├── Button/
    │   │   ├── Button.tsx
    │   │   └── Button.styles.ts
    │   ├── Badge/
    │   │   ├── Badge.tsx
    │   │   └── Badge.styles.ts
    │   ├── ProgressBar/
    │   │   ├── ProgressBar.tsx
    │   │   └── ProgressBar.styles.ts
    │   ├── Icon/
    │   │   ├── Icon.tsx
    │   │   └── Icon.styles.ts
    │   └── Avatar/
    │       ├── Avatar.tsx
    │       └── Avatar.styles.ts
    ├── molecules/
    │   ├── CharacterBanner/
    │   │   ├── CharacterBanner.tsx
    │   │   └── CharacterBanner.styles.ts
    │   ├── StatBar/
    │   │   ├── StatBar.tsx
    │   │   └── StatBar.styles.ts
    │   ├── ItemCard/
    │   │   ├── ItemCard.tsx
    │   │   └── ItemCard.styles.ts
    │   ├── CombatLogEntry/
    │   │   ├── CombatLogEntry.tsx
    │   │   └── CombatLogEntry.styles.ts
    │   ├── RoomCard/
    │   │   ├── RoomCard.tsx
    │   │   └── RoomCard.styles.ts
    │   └── BountyCard/
    │       ├── BountyCard.tsx
    │       └── BountyCard.styles.ts
    ├── organisms/
    │   ├── PartyRoster/
    │   │   ├── PartyRoster.tsx
    │   │   └── PartyRoster.styles.ts
    │   ├── CombatPanel/
    │   │   ├── CombatPanel.tsx
    │   │   └── CombatPanel.styles.ts
    │   ├── DungeonMap/
    │   │   ├── DungeonMap.tsx
    │   │   └── DungeonMap.styles.ts
    │   ├── InventoryGrid/
    │   │   ├── InventoryGrid.tsx
    │   │   └── InventoryGrid.styles.ts
    │   ├── BountyBoard/
    │   │   ├── BountyBoard.tsx
    │   │   └── BountyBoard.styles.ts
    │   └── NarrativePanel/
    │       ├── NarrativePanel.tsx
    │       └── NarrativePanel.styles.ts
    ├── screens/
    │   ├── SeedScreen/
    │   │   ├── SeedScreen.tsx
    │   │   └── SeedScreen.styles.ts
    │   ├── MainScreen/
    │   │   ├── MainScreen.tsx
    │   │   └── MainScreen.styles.ts
    │   ├── PartyScreen/
    │   │   ├── PartyScreen.tsx
    │   │   └── PartyScreen.styles.ts
    │   ├── MapScreen/
    │   │   ├── MapScreen.tsx
    │   │   └── MapScreen.styles.ts
    │   ├── BattleScreen/
    │   │   ├── BattleScreen.tsx
    │   │   └── BattleScreen.styles.ts
    │   ├── ReportScreen/
    │   │   ├── ReportScreen.tsx
    │   │   └── ReportScreen.styles.ts
    │   ├── VillageScreen/
    │   │   ├── VillageScreen.tsx
    │   │   └── VillageScreen.styles.ts
    │   ├── CampScreen/
    │   │   ├── CampScreen.tsx
    │   │   └── CampScreen.styles.ts
    │   ├── MarketScreen/
    │   │   ├── MarketScreen.tsx
    │   │   └── MarketScreen.styles.ts
    │   ├── BlacksmithScreen/
    │   │   ├── BlacksmithScreen.tsx
    │   │   └── BlacksmithScreen.styles.ts
    │   ├── GuildScreen/
    │   │   ├── GuildScreen.tsx
    │   │   └── GuildScreen.styles.ts
    │   ├── AllianceScreen/
    │   │   ├── AllianceScreen.tsx
    │   │   └── AllianceScreen.styles.ts
    │   ├── NegotiationScreen/
    │   │   ├── NegotiationScreen.tsx
    │   │   └── NegotiationScreen.styles.ts
    │   ├── ExtractionScreen/
    │   │   ├── ExtractionScreen.tsx
    │   │   └── ExtractionScreen.styles.ts
    │   ├── LevelUpScreen/
    │   │   ├── LevelUpScreen.tsx
    │   │   └── LevelUpScreen.styles.ts
    │   ├── CharacterDetailScreen/
    │   │   ├── CharacterDetailScreen.tsx
    │   │   └── CharacterDetailScreen.styles.ts
    │   ├── CycleTransitionScreen/
    │   │   ├── CycleTransitionScreen.tsx
    │   │   └── CycleTransitionScreen.styles.ts
    │   ├── SimulationLoadingScreen/
    │   │   ├── SimulationLoadingScreen.tsx
    │   │   └── SimulationLoadingScreen.styles.ts
    │   ├── EventResolutionScreen/
    │   │   ├── EventResolutionScreen.tsx
    │   │   └── EventResolutionScreen.styles.ts
    │   ├── WorldLogScreen/
    │   │   ├── WorldLogScreen.tsx
    │   │   └── WorldLogScreen.styles.ts
    │   ├── AscensionScreen/
    │   │   ├── AscensionScreen.tsx
    │   │   └── AscensionScreen.styles.ts
    │   ├── UnificationScreen/
    │   │   ├── UnificationScreen.tsx
    │   │   └── UnificationScreen.styles.ts
    │   └── SettingsScreen/
    │       ├── SettingsScreen.tsx
    │       └── SettingsScreen.styles.ts
    ├── navigation/
    │   ├── AppNavigator.tsx        ← se mueve desde src/navigation/
    │   └── types.ts
    └── hooks/
        ├── useGame.ts
        ├── useParty.ts
        ├── useCombat.ts
        ├── useDungeon.ts
        ├── useEconomy.ts
        └── useSimulation.ts
```

---

## 2. Mapa de migración: archivos actuales → destino

### 2.1 `src/services/` → domain + application + infrastructure

| Archivo actual | Destino |
|---|---|
| `combatEngine.ts` | `domain/services/CombatDomainService.ts` + `application/use-cases/combat/` |
| `characterStats.ts` | `domain/entities/Character.ts` (métodos de clase) + `domain/value-objects/AbilityScore.ts` |
| `lootService.ts` | `domain/services/LootDomainService.ts` + `application/use-cases/economy/GenerateLootUseCase.ts` |
| `progressionService.ts` | `domain/services/ProgressionDomainService.ts` + `application/use-cases/party/` |
| `economyService.ts` | `application/use-cases/economy/` (BuyItem, SellItem, Revive) |
| `dungeonGraphService.ts` | `domain/services/DungeonGeneratorService.ts` + `application/use-cases/dungeon/GenerateDungeonUseCase.ts` |
| `worldSimulator.ts` | `application/use-cases/simulation/RunWorldSimulationUseCase.ts` + `application/ports/IWorldSimulatorPort.ts` |
| `bountyService.ts` | `application/use-cases/bounty/` |
| `allianceService.ts` | `application/use-cases/alliance/` |
| `encounterService.ts` | `domain/services/CombatDomainService.ts` (método generateEncounter) |
| `moralSystem.ts` | `domain/entities/Party.ts` (lógica moral encapsulada) |
| `culturalEvolution.ts` | `domain/entities/Party.ts` (evolución cultural) |
| `aiProfileEngine.ts` | `infrastructure/services/AIProfileAdapter.ts` + `application/ports/IAIProfilePort.ts` |
| `aiMemoryService.ts` | `infrastructure/services/AIProfileAdapter.ts` |
| `geminiImageService.ts` | `infrastructure/services/GeminiImageAdapter.ts` + `application/ports/IImageServicePort.ts` |
| `syncService.ts` | `infrastructure/services/SyncAdapter.ts` |
| `imageStorageService.ts` | `infrastructure/services/GeminiImageAdapter.ts` |
| `monsterEvolutionService.ts` | `domain/entities/Monster.ts` (método evolve) |
| `essenceService.ts` | `application/use-cases/economy/` |
| `rivalGenerator.ts` | `domain/entities/Party.ts` (rival) o `domain/services/` |
| `timeService.ts` | `application/use-cases/simulation/AdvanceCycleUseCase.ts` |
| `safeZoneService.ts` | `application/use-cases/dungeon/ExtractFromDungeonUseCase.ts` |
| `rulesConfig.ts` | `domain/` (constantes de dominio) |
| `characterCatalogService.ts` | `infrastructure/services/` (sirve assets) |
| `spriteDbService.ts` | `infrastructure/services/` |
| `enemySpriteService.ts` | `infrastructure/services/` |
| `portraitRequireMap.ts` | `infrastructure/services/` |
| `emotionalNarrativeService.ts` | `infrastructure/services/` |
| `api5e.ts` | `infrastructure/services/` |
| `backgroundSeed.ts` | `infrastructure/services/` |
| `subclassSeed.ts` | `infrastructure/services/` |
| `translationSeed.ts` | `infrastructure/services/` |
| `translationBridge.ts` | `infrastructure/services/` |
| `mapGenerator.ts` | `domain/services/DungeonGeneratorService.ts` |
| `seedUnificationService.ts` | `application/use-cases/game/StartNewGameUseCase.ts` |

### 2.2 `src/database/` → `infrastructure/database/` + repositorios concretos

| Archivo actual | Destino |
|---|---|
| `connection.ts` | `infrastructure/database/connection.ts` |
| `migrations.ts` | `infrastructure/database/migrations.ts` |
| `index.ts` | `infrastructure/database/index.ts` |
| `repository.ts` | `infrastructure/repositories/SqliteGameRepository.ts` |
| `gameRepository.ts` | `infrastructure/repositories/SqliteGameRepository.ts` |
| `itemRepository.ts` | `infrastructure/repositories/SqliteItemRepository.ts` |
| `eventRepository.ts` | `infrastructure/repositories/SqliteEventRepository.ts` |
| `rivalRepository.ts` | `infrastructure/repositories/SqliteRivalRepository.ts` |
| `essenceRepository.ts` | `infrastructure/repositories/SqliteEssenceRepository.ts` |

### 2.3 `src/components/` → `presentation/atoms/` + `molecules/` + `organisms/`

| Archivo actual | Destino |
|---|---|
| `party/atoms.tsx` | `presentation/atoms/` (dividir en archivos individuales) |
| `party/AnimatedStatBar.tsx` | `presentation/molecules/StatBar/` |
| `party/CharacterBanner.tsx` | `presentation/molecules/CharacterBanner/` |
| `party/PortraitSection.tsx` | `presentation/molecules/PortraitSection/` |
| `party/AttributesSection.tsx` | `presentation/molecules/AttributesSection/` |
| `party/RaceSection.tsx` | `presentation/molecules/RaceSection/` |
| `party/ClassAndSubclassSection.tsx` | `presentation/molecules/ClassSection/` |
| `party/SubclassAbilitiesPanel.tsx` | `presentation/organisms/SubclassAbilitiesPanel/` |
| `party/BackgroundSection.tsx` | `presentation/molecules/BackgroundSection/` |
| `party/RosterTabs.tsx` | `presentation/organisms/RosterTabs/` |
| `party/Level1SummarySection.tsx` | `presentation/organisms/Level1SummarySection/` |
| `party/AlignmentAndTraitsSection.tsx` | `presentation/molecules/AlignmentSection/` |
| `party/LaunchProgressModal.tsx` | `presentation/organisms/LaunchProgressModal/` |
| `party/CatalogPortraitPicker.tsx` | `presentation/organisms/CatalogPortraitPicker/` |
| `party/PortraitDetailModal.tsx` | `presentation/organisms/PortraitDetailModal/` |
| `BountyBoard.tsx` | `presentation/organisms/BountyBoard/` |
| `AllianceCard.tsx` | `presentation/molecules/AllianceCard/` |
| `InventoryGrid.tsx` | `presentation/organisms/InventoryGrid/` |
| `NarrativeMomentPanel.tsx` | `presentation/organisms/NarrativePanel/` |
| `CharacterActionsPanel.tsx` | `presentation/organisms/CharacterActionsPanel/` |
| `ConfirmModal.tsx` | `presentation/molecules/ConfirmModal/` |
| `SliderButton.tsx` | `presentation/atoms/SliderButton/` |
| `AppImage.tsx` | `presentation/atoms/AppImage/` |
| `Icons.tsx` | `presentation/atoms/Icon/` |
| `TypewriterText.tsx` | `presentation/atoms/TypewriterText/` |
| `TorreLogo.tsx` | `presentation/atoms/TorreLogo/` |
| `LogoIA.tsx` | `presentation/atoms/LogoIA/` |
| `CRTOverlay.tsx` | `presentation/atoms/CRTOverlay/` |
| `GlossaryModal.tsx` | `presentation/organisms/GlossaryModal/` |
| `DatabaseGate.tsx` | `presentation/organisms/DatabaseGate/` |
| `ErrorBoundary.tsx` | `presentation/organisms/ErrorBoundary/` |
| `BossRoomEntryUI.tsx` | `presentation/organisms/BossRoomEntryUI/` |
| `TutorialOverlay.tsx` | `presentation/organisms/TutorialOverlay/` |

### 2.4 `src/screens/` → `presentation/screens/` (con carpeta propia cada una)

Cada pantalla pasa de `FooScreen.tsx` a `FooScreen/FooScreen.tsx` + `FooScreen/FooScreen.styles.ts`.  
Las 20 pantallas actuales se migran todas.

### 2.5 `src/hooks/` → `presentation/hooks/`

| Archivo actual | Destino |
|---|---|
| `useDatabase.ts` | `infrastructure/` (ya no es concern de presentación) |
| `useTutorial.ts` | `presentation/hooks/useTutorial.ts` |
| `useResources.ts` | `presentation/hooks/useResources.ts` |
| `useGlossary.ts` | `presentation/hooks/useGlossary.ts` |
| `usePartyLaunch.ts` | `presentation/hooks/usePartyLaunch.ts` |
| `usePartyRoster.ts` | `presentation/hooks/usePartyRoster.ts` |

### 2.6 Migración mínima (sin tocar)

Estos archivos **no se mueven**, solo se actualiza su path en imports:

| Archivo | Razón |
|---|---|
| `src/stores/gameStore.ts` | Zustand store ya está bien delimitado; limpieza de business logic si aplica |
| `src/navigation/types.ts` | Se mueve a `presentation/navigation/types.ts` |
| `src/i18n/` | Se mantiene en `src/i18n/` sin cambio |
| `src/constants/` | Se mantiene en `src/constants/`; se revisa si algo pertenece al dominio |
| `src/theme/` | Se mantiene en `src/theme/` |
| `src/types/` | Se revisa: los tipos de dominio migran a entidades, el resto se queda |

---

## 3. Entidades de dominio a crear

### `Character`
```typescript
class Character {
  constructor(private readonly props: CharacterProps) {}
  
  get id(): string
  get name(): string
  get level(): number
  get hp(): HitPoints
  get isAlive(): boolean
  
  getAbilityModifier(ability: AbilityName): number
  getProficiencyBonus(): number
  getAttackBonus(weaponType: WeaponType): number
  takeDamage(amount: number): Character
  heal(amount: number): Character
  gainXP(xp: number): Character
  levelUp(): Character
}
```

### `Party`
```typescript
class Party {
  addMember(character: Character): Party
  removeMember(id: string): Party
  isViable(): boolean          // ≥1 alive member
  totalLevel(): number
  applyMoralImpact(event: MoralEvent): Party
  evolveCulture(event: CultureEvent): Party
}
```

### `Monster`
```typescript
class Monster {
  rollInitiative(): number
  rollAttack(target: Character): AttackResult
  evolve(floor: DungeonFloor): Monster
  isBoss(): boolean
}
```

### `CombatSession`
```typescript
class CombatSession {
  addParticipant(combatant: Combatant): CombatSession
  resolveRound(): CombatRoundResult
  isOver(): boolean
  getWinner(): CombatSide | null
}
```

### `Dungeon`
```typescript
class Dungeon {
  currentRoom(): Room
  availableExits(): Room[]
  advance(roomId: string): Dungeon
  currentFloor(): DungeonFloor
  isBossRoom(): boolean
}
```

---

## 4. Fases de ejecución

### Fase 1 — Dominio (sin tocar la app existente) ✅ prioritaria
- [ ] Crear `src/domain/errors/DomainError.ts`
- [ ] Crear `src/domain/value-objects/AbilityScore.ts`
- [ ] Crear `src/domain/value-objects/HitPoints.ts`
- [ ] Crear `src/domain/value-objects/Gold.ts`
- [ ] Crear `src/domain/value-objects/Level.ts`
- [ ] Crear `src/domain/value-objects/DungeonFloor.ts`
- [ ] Crear `src/domain/value-objects/Seed.ts`
- [ ] Crear `src/domain/entities/Character.ts`
- [ ] Crear `src/domain/entities/Party.ts`
- [ ] Crear `src/domain/entities/Monster.ts`
- [ ] Crear `src/domain/entities/Dungeon.ts`
- [ ] Crear `src/domain/entities/Room.ts`
- [ ] Crear `src/domain/entities/CombatSession.ts`
- [ ] Crear `src/domain/entities/Item.ts`
- [ ] Crear `src/domain/entities/BountyContract.ts`
- [ ] Crear `src/domain/entities/Alliance.ts`
- [ ] Crear `src/domain/entities/WorldEvent.ts`
- [ ] Crear `src/domain/repositories/IGameRepository.ts`
- [ ] Crear `src/domain/repositories/ICharacterRepository.ts`
- [ ] Crear `src/domain/repositories/IItemRepository.ts`
- [ ] Crear `src/domain/repositories/IEventRepository.ts`
- [ ] Crear `src/domain/repositories/IRivalRepository.ts`
- [ ] Crear `src/domain/repositories/IEssenceRepository.ts`
- [ ] Crear `src/domain/services/CombatDomainService.ts`
- [ ] Crear `src/domain/services/DungeonGeneratorService.ts`
- [ ] Crear `src/domain/services/LootDomainService.ts`
- [ ] Crear `src/domain/services/ProgressionDomainService.ts`

### Fase 2 — Application layer (use cases)
- [ ] Crear `src/application/ports/IWorldSimulatorPort.ts`
- [ ] Crear `src/application/ports/IImageServicePort.ts`
- [ ] Crear `src/application/ports/IAIProfilePort.ts`
- [ ] Crear use cases de `game/` (4 use cases)
- [ ] Crear use cases de `party/` (4 use cases)
- [ ] Crear use cases de `combat/` (3 use cases)
- [ ] Crear use cases de `dungeon/` (4 use cases)
- [ ] Crear use cases de `economy/` (4 use cases)
- [ ] Crear use cases de `simulation/` (2 use cases)
- [ ] Crear use cases de `bounty/` (2 use cases)
- [ ] Crear use cases de `alliance/` (2 use cases)

### Fase 3 — Infrastructure layer
- [ ] Mover `src/database/` → `src/infrastructure/database/`
- [ ] Crear `SqliteGameRepository.ts` (implementa `IGameRepository`)
- [ ] Crear `SqliteCharacterRepository.ts`
- [ ] Crear `SqliteItemRepository.ts`
- [ ] Crear `SqliteEventRepository.ts`
- [ ] Crear `SqliteRivalRepository.ts`
- [ ] Crear `SqliteEssenceRepository.ts`
- [ ] Crear `GeminiImageAdapter.ts`
- [ ] Crear `AIProfileAdapter.ts`
- [ ] Crear `SyncAdapter.ts`
- [ ] Crear `src/infrastructure/di/AppContext.tsx` (DI container)

### Fase 4 — Presentation: componentes (migración)
- [ ] Crear atoms (Text, Button, Badge, ProgressBar, Icon, Avatar, SliderButton, AppImage, TypewriterText, TorreLogo, LogoIA, CRTOverlay)
- [ ] Crear molecules (CharacterBanner, StatBar, ItemCard, CombatLogEntry, RoomCard, BountyCard, AllianceCard, ConfirmModal, PortraitSection, AttributesSection, RaceSection, ClassSection, BackgroundSection, AlignmentSection)
- [ ] Crear organisms (PartyRoster, CombatPanel, DungeonMap, InventoryGrid, BountyBoard, NarrativePanel, CharacterActionsPanel, RosterTabs, Level1SummarySection, SubclassAbilitiesPanel, LaunchProgressModal, CatalogPortraitPicker, PortraitDetailModal, GlossaryModal, DatabaseGate, ErrorBoundary, BossRoomEntryUI, TutorialOverlay)

### Fase 5 — Presentation: screens (migración)
- Cada pantalla: extraer `StyleSheet.create()` a `.styles.ts`, convertir a carpeta propia
- [ ] SeedScreen
- [ ] MainScreen
- [ ] PartyScreen
- [ ] MapScreen
- [ ] BattleScreen
- [ ] ReportScreen
- [ ] VillageScreen
- [ ] CampScreen
- [ ] MarketScreen
- [ ] BlacksmithScreen
- [ ] GuildScreen
- [ ] AllianceScreen
- [ ] NegotiationScreen
- [ ] ExtractionScreen
- [ ] LevelUpScreen
- [ ] CharacterDetailScreen
- [ ] CycleTransitionScreen
- [ ] SimulationLoadingScreen
- [ ] EventResolutionScreen
- [ ] WorldLogScreen
- [ ] AscensionScreen
- [ ] UnificationScreen
- [ ] SettingsScreen

### Fase 6 — Hooks y navigation
- [ ] Migrar hooks a `presentation/hooks/`
- [ ] Mover `src/navigation/` → `src/presentation/navigation/`
- [ ] Actualizar `AppNavigator.tsx` con nuevas rutas

### Fase 7 — Wiring final y limpieza
- [ ] Actualizar `App.tsx` para envolver con `AppContext` (DI)
- [ ] Limpiar `src/stores/gameStore.ts` (solo UI state)
- [ ] Eliminar `src/services/` (vacío tras migración)
- [ ] Eliminar `src/screens/` (vacío tras migración)
- [ ] Eliminar `src/components/` (vacío tras migración)
- [ ] Verificar `tsc --noEmit` sin errores
- [ ] Verificar `yarn test` sin regresiones

### Fase 8 — Tests por capa
- [ ] Crear `src/domain/__tests__/` con tests de entidades y value objects
- [ ] Crear `src/application/__tests__/` con tests de use cases
- [ ] Crear `src/infrastructure/__tests__/` con mocks de repositorios
- [ ] Crear `src/presentation/__tests__/` con tests de hooks

---

## 5. Invariantes de arquitectura (reglas a verificar en cada PR)

```
PROHIBIDO                          | PERMITIDO
-----------------------------------|-------------------------------------------
domain/ → import de react-native   | domain/ → import solo de TS puro
domain/ → import de infra/         | domain/ → import entre domain/
domain/ → import de application/   |
application/ → import de infra/    | application/ → import de domain/
application/ → import de presentation/ |
presentation/ → business logic     | presentation/ → import de application/ vía hooks
hooks → new UseCase()              | hooks → useContext(AppContext)
*.tsx → StyleSheet.create()        | *.styles.ts → StyleSheet.create()
```

---

## 6. Estrategia de migración sin romper la app

**Principio:** la app debe compilar y funcionar en cada commit.

1. Las nuevas capas (`domain/`, `application/`, `infrastructure/`) se crean en paralelo con la app actual.
2. Las pantallas se migran una a una: la nueva versión reemplaza a la vieja.
3. El `AppNavigator.tsx` se actualiza solo cuando la pantalla migrada está completa.
4. El código viejo en `src/services/`, `src/screens/`, `src/components/` se elimina únicamente cuando no tiene ningún import apuntando a él.
5. Usar `tsc --noEmit` después de cada fase para detectar imports rotos.

---

## 7. Archivos que NO se tocan en este refactor

| Archivo | Razón |
|---|---|
| `src/i18n/` | Sistema i18n correcto, solo se actualizan imports |
| `src/theme/` | Design tokens, se mantienen como están |
| `src/constants/monsterIllustrations.ts` | Asset map, no es lógica de negocio |
| `src/constants/dnd5eLevel1.ts` | Data config, se revisa si va a `domain/` |
| `assets/` | Sin cambios |
| `android/`, `ios/` | Sin cambios |
| `scripts/` | Sin cambios |
| `__tests__/` raíz | Se mantienen como tests de integración |

---

## 8. Orden de implementación recomendado

```
Fase 1: Domain  →  Fase 2: Application  →  Fase 3: Infrastructure
           ↓                                        ↓
        Tests unitarios de dominio          DI Container (AppContext)
                    ↓
           Fase 4+5: Presentation (componentes + pantallas)
                    ↓
           Fase 6: Navigation + App.tsx wiring
                    ↓
           Fase 7: Limpieza
                    ↓
           Fase 8: Tests por capa
```

---

*Última actualización: session de refactor — TORRE (dnd3)*
