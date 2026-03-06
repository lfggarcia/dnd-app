# CHANGELOG — CYBER_DND | Protocol DND

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versiones siguiendo [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — 2026-03-06

### Added (Fase 1 — navegación de regreso al menú)

- **Zona Segura interactiva en MapScreen** — al tocar un nodo SAFE_ZONE disponible se despliega un panel de acciones en la parte inferior con el botón "Volver a la villa"; al confirmar se serializa el estado de nodos en `mapState` y se navega directamente a `VillageScreen` actualizando `location = 'village'`
- **Return to Village habilitado en ExtractionScreen** — el botón "Volver a la villa" ahora se habilita automáticamente cuando `activeGame.cycle >= 60`; cuando está bloqueado sigue mostrando la nota `lockedNotice`; cuando está activo navega al village reseteando el stack y actualizando `location = 'village'`
- **Traducciones** — clave `map.safeZoneDesc` añadida en ES (`'Zona segura alcanzada. Puedes regresar a la villa desde aquí.'`) y EN (`'Safe zone reached. You can return to the village from here.'`)

### Changed (Fase 1 — navegación de regreso al menú)

- **MapScreen** — `handleNodePress` ahora gestiona nodos SAFE_ZONE mostrando el panel de acción; el nuevo handler `handleReturnToVillageFromSafeZone` guarda el estado del mapa antes de navegar a vila; añadido estado `selectedSafeZone`
- **ExtractionScreen** — conectado a `useGameStore`; `canReturnToVillage` derivado del ciclo actual; el botón cambia de estilo y se habilita cuando el ciclo llega a 60

- **useGameStore (Zustand + SQLite)** — `src/stores/gameStore.ts`; persiste `activeGame` y `savedGames` en SQLite; acciones: `startNewGame`, `loadGame`, `updateProgress`, `endGame`, `hydrate`, `clearActive`
- **gameRepository** — `src/database/gameRepository.ts`; tipos `SavedGame` + `CharacterSave` + `Stats`; CRUD completo (`createSavedGame`, `updateSavedGame`, `getSavedGame`, `getActiveSavedGame`, `getAllSavedGames`, `deleteSavedGame`)
- **DB migración v2** — tabla `saved_games` con campos: id, seed, seed_hash, party_data, floor, cycle, phase, gold, status, created_at, updated_at
- **DB migración v3** — columnas `location TEXT DEFAULT 'village'` y `map_state TEXT` en `saved_games` para persistir dónde está el jugador y el estado de nodos del mapa
- **GuildScreen** — pantalla de gremio (`src/screens/GuildScreen.tsx`): roster completo con `CharacterCard` (HP bar, stats grid 6 atributos, badges ACTIVO/HERIDO/MUERTO), opciones de navegación (Rankings, Bounty Board, WorldLog)
- **rivalGenerator** — `src/services/rivalGenerator.ts`: PRNG/LCG determinístico por seed; genera hasta 10 grupos rivales con nombre, piso, reputación y estado; también exporta `buildRivalPool`
- **ConfirmModal** — componente reutilizable `src/components/ConfirmModal.tsx` para diálogos de confirmación con título, mensaje, botón confirmar/cancelar, estilo CRT

### Added (Fase 1 — generador de mapas)

- **mapGenerator** — `src/services/mapGenerator.ts`: generador determinístico de layouts de piso; 8 nodos en DAG ramificado (entrada → 2 caminos → convergencia → jefe); tipos de nodo (COMBAT/EVENT/SAFE_ZONE/UNKNOWN) y labels asignados por PRNG djb2+LCG igual que `rivalGenerator.ts`; distribución de tipos ajustada por piso (1–25 / 26–60 / 61–100); 15 labels COMBAT, 9 EVENT, 7 SAFE_ZONE, 8 BOSS
- **services/index.ts** — añadidos barrel exports para `generateFloorNodes`, `MapNode`, `NodeType` (mapGenerator) y `generateRivals`, `buildRivalPool`, `RivalEntry` (rivalGenerator)

### Changed (Fase 1 — generador de mapas)

- **MapScreen** — nodos del mapa ahora generados por `generateFloorNodes(seedHash, floor)` en lugar de `FLOOR_NODES` hardcodeados; header muestra piso y ciclo reales desde `activeGame`; líneas de conexión usan estado `nodes` en lugar de constante eliminada; `NodeType` + `MapNode` importados desde `mapGenerator`

### Changed (Fase 1 — post-beta)

- **VillageScreen** — conectada a `useGameStore` real: muestra gold, cycle, phase, maxFloor del estado activo; rivals generados deterministicamente por seedHash; market items y amenazas seeded; disclaimer modal antes de entrar a la Torre; `BackHandler` con modal de confirmación de salida a menú principal; `updateProgress({ location: 'village' })` al montar
- **MapScreen** — botón X en header abre `ConfirmModal` para guardar y salir; al confirmar: serializa estado de nodos a `mapState` via `updateProgress` y navega al menú; restaura estado de nodos desde `mapState` al re-entrar; `BackHandler` bloqueado mientras se está en la Torre; `updateProgress({ location: 'map' })` al montar
- **MainScreen** — "Continuar expedición" enruta a `MapScreen` si `activeGame.location === 'map'`, a `VillageScreen` si `location === 'village'`; muestra lista de partidas guardadas en modal de carga; botón eliminar partida con confirmación; `hydrate()` en `useFocusEffect` para refrescar al volver al menú
- **AppNavigator** — añadida ruta `Guild: undefined` y registro de `GuildScreen`
- **navigation/types.ts** — añadida `Guild: undefined` a `RootStackParamList`

### Added (base — ya documentado)
- **Base de datos SQLite** — `@op-engineering/op-sqlite` v15 integrado con schema v1 (tables: `resources`, `translations`, `sync_meta`)
- **Sincronización DnD 5e API** — `syncService.ts` orquesta fetch de 24 endpoints de `dnd5eapi.co` con tracking de progreso
- **DatabaseGate** — componente wrapper que bloquea la UI hasta que la DB esté inicializada y los datos de la API sincronizados, con barra de progreso
- **Sistema i18n bilingüe** — `I18nProvider` + `useI18n()` hook con ES (default) / EN, dot-notation keys, ~100+ claves de traducción
- **Traducciones seeded** — `translationSeed.ts` siembra traducciones ES al iniciar la app
- **Translation bridge** — `translationBridge.ts` con fallback chain: translations DB → raw API data
- **Creación de personaje real** — `PartyScreen` con selección de raza, clase, subclase, trasfondo y alineamiento usando datos reales de la API DnD 5e
- **Sub-hooks de recursos** — `useRaces()`, `useClasses()`, `useSubclasses()`, `useBackgrounds()`, `useAlignments()` en `useResources.ts`
- **Constantes DnD 5e nivel 1** — `dnd5eLevel1.ts` con features de 26 subclases, traits de 9 razas, features de 13 clases, reglas de stats
- **Reglas DnD 5e** — `rulesConfig.ts` con CLASS_SUBCLASS_MAP, XP tables, proficiency bonuses, hit dice, primary abilities, saving throws, spellcasting classes
- **Subclass seed** — `subclassSeed.ts` para subclases custom en init
- **Background seed** — `backgroundSeed.ts` para backgrounds custom en init
- **GlossaryModal** — modal interactivo con búsqueda por categorías (stats, razas, clases, monstruos, mecánicas, alineamientos), datos de DB
- **useGlossary** — hook de estado de visibilidad del glosario
- **TutorialOverlay** — overlay paso a paso con navegación (next/prev/skip) para guiar creación de personaje
- **useTutorial** — hook de navegación de pasos del tutorial con `PARTY_TUTORIAL_STEPS` predefinidos
- **TorreLogo** — logo SVG "TORRE" con efecto neón roto + flicker dual (blur glow + crisp text)
- **WorldLogScreen** — feed de eventos globales con filtros (ALL/COMBAT/LORE/SYSTEM), entradas multilingües
- **CycleTransitionScreen** — transición animada entre ciclos (Floor N → N+1) con fases de animación
- **Toggle de idioma** — botón ES/EN en MainScreen para cambiar idioma en caliente
- **react-native-svg** v15 para soporte SVG (TorreLogo)

### Changed
- **Navegación** — expandida de 8 a 10 pantallas (`WorldLogScreen`, `CycleTransitionScreen`)
- **PartyScreen** — reescrita completamente: de stats hardcodeados a datos reales DnD 5e con selectores de búsqueda, subclase con preview de habilidad, tutorial integrado
- **MainScreen** — reemplazada ASCII art por TorreLogo SVG animada, añadido toggle de idioma
- **App.tsx** — envuelve app en `I18nProvider` y `DatabaseGate`
- Migrado de npm a yarn como package manager preferido en documentación

### Fixed
- Eliminado dead state `turn` en `BattleScreen` (declarado pero nunca leído)
- Eliminado dead state `showButton` y `useEffect` huérfano en `ReportScreen`
- Eliminado import no usado `Image` en `PartyScreen`
- Eliminado import no usado `ScrollView` en `ExtractionScreen`
- NativeWind opacity bug: reemplazado `/` opacity modifier por inline `rgba()` donde necesario
- `PartyScreen`: stat Views absolutas sin `pointerEvents="none"` bloqueaban toques en New Architecture (Fabric)
- Safe area handling en iOS para todas las pantallas

### Documentation
- `README.md` reescrito — stack actualizado, estructura completa del proyecto, características implementadas
- `HANDOFF.md` actualizado — refleja estado real del código con DB, i18n, servicios, 10 pantallas
- `PROJECT_STATUS.md` actualizado — roadmap con items completados marcados, métricas actualizadas
- Navegación completamente tipada: `RootStackParamList` con 10 rutas y `ScreenProps<T>` en todas las pantallas

---

## [0.1.0-BETA] — pantallas iniciales (commit `e00ea5b`)

### Added
- **8 pantallas completas** con estética CRT/terminal cyberpunk:
  - `MainScreen` — menú principal con ascii art CYBER y logs de sistema
  - `SeedScreen` — input de seed con efecto Matrix animado (15 columnas de datos)
  - `PartyScreen` — creación de personaje con radar de atributos y selección de raza/módulos
  - `VillageScreen` — hub de pueblo con mapa de blueprint interactivo y leaderboard de squads
  - `MapScreen` — mapa de nodos con radar rotativo animado (Reanimated)
  - `BattleScreen` — pantalla de combate por turnos con log de acciones
  - `ReportScreen` — reporte post-incursión con TypewriterText secuencial
  - `ExtractionScreen` — liquidación de recursos con contador animado hasta 15.400G
- **3 componentes reutilizables**:
  - `CRTOverlay` — 100 scanlines + parpadeo Reanimated con secuencias `withRepeat/withSequence`
  - `TypewriterText` — texto con efecto máquina de escribir, cursor parpadeante y callback `onComplete`
  - `SliderButton` — botón deslizable con Gesture Handler + Reanimated, threshold 80% para confirmar
- `AppNavigator` con transición `fade` global entre pantallas
- Integración `GestureHandlerRootView` como root wrapper en `App.tsx`
- Fuente `RobotoMono` como fuente del sistema en todo el proyecto
- Paleta de colores cyberpunk definida en `global.css` (verde terminal `#00FF41` + ámbar `#FFB000`)

---

## [0.0.2] — sistema de color + navegación (commit `43fa0a0`)

### Added
- Paleta de colores completa via CSS variables en `global.css`:
  - `--primary: #00FF41` (verde terminal)
  - `--secondary: #FFB000` (ámbar)
  - `--background: #0A0E0A` (negro profundo)
  - Soporte para modo oscuro (clase `.dark`)
- Tokens de color expuestos en `tailwind.config.js` (19 tokens: `primary`, `secondary`, `muted`, `destructive`, etc.)
- React Navigation v7 (`@react-navigation/native` + `@react-navigation/native-stack`)
- `react-native-screens@4.24.0` con setup Android (`RNScreensFragmentFactory` en `MainActivity.kt`)
- `android:enableOnBackInvokedCallback="false"` en `AndroidManifest.xml`
- `safe-area-context` actualizado a `5.7.0`
- Nueva arquitectura activada en iOS (`RCTNewArchEnabled: true` en `Info.plist`)
- Flags de compilación iOS: `USE_HERMES`, `RCT_REMOVE_LEGACY_ARCH`, `SWIFT_ENABLE_EXPLICIT_MODULES`

---

## [0.0.1] — NativeWind + fuentes (commit `b24841b`)

### Added
- NativeWind v4 para estilos Tailwind CSS en React Native
- Familia tipográfica `RobotoMono` completa (14 variantes: Regular, Bold, Italic, Light, Thin, ExtraLight, Medium, SemiBold + sus cursivas)
- Registro de fuentes iOS en `Info.plist` (`UIAppFonts`)
- Registro de fuentes en Xcode project (`project.pbxproj`)
- `react-native-worklets@0.7.4` como base para animaciones worklet

### Changed
- Migrado de npm a Yarn como package manager
- `tailwind.config.js` actualizado con `nativewind/preset` y fontFamily `robotomono`

---

## [0.0.0] — Initial commit (commit `b51a47d`)

### Added
- Proyecto React Native 0.84.0 bootstrapped con `@react-native-community/cli`
- TypeScript 5.x
- React 19.2.x
- Jest + `react-test-renderer` para testing
- ESLint + Prettier
- `react-native-reanimated@4.2.2`
- `react-native-safe-area-context@5.5.2`
- Setup base iOS (CocoaPods) y Android (Gradle)
