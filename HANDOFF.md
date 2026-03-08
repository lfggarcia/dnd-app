# HANDOFF — TORRE (CYBER_DND)

> Documento de transferencia de sesión. Autosuficiente — no requiere leer otros archivos para continuar.
> Fuente de verdad: `SYSTEMS.MD` (diseño) · `GAME_CONTEXT.md` (contexto) · `PROJECT_STATUS.md` (estado técnico)

---

## TL;DR

TORRE es un **RPG de simulación social con estética CRT/cyberpunk** en React Native. Una torre de 100 pisos, 60 ciclos por temporada, ~10 parties simultáneas (1-2 jugador + resto IA), combate táctico DnD 5e, sistema de política y alianzas, motor de simulación determinístico por seed.

**Estado hoy:** 11 pantallas navegables, SQLite schema v6, portraits via Gemini, expresiones via ComfyUI, `dungeonGraphService` con 12–20 habitaciones + fog-of-war + navegación integrado en MapScreen. MapScreen UX pulida (node select + action panel `▶ ENTRAR`, overlay de descenso, visual overhaul completo, fix node overlap y premature reveal). La lógica de combate (BattleScreen, ReportScreen) sigue siendo mock; el game loop aún no está cerrado (params Battle/Report pendientes).

**Lo más urgente:** cerrar el flow Battle → Report → Map (pasar params, marcar sala visited, boss clearable), luego motor de combate DnD 5e real.

---

## El Juego en 5 Frases

1. El jugador ingresa un **seed** que genera un mundo determinístico completo.
2. Controla una party de hasta 4 personajes (creados con reglas DnD 5e) dentro de una torre de 100 pisos.
3. Compite contra ~8 parties IA, todas simuladas por el motor cuando el jugador avanza ciclos.
4. La temporada dura **60 ciclos** (día/noche alternados) — quien no llega al piso 100 antes del ciclo 60 pierde su oportunidad.
5. Entre ciclos: política, alianzas, bounty, World Log de eventos globales, pueblo con 6 edificios.

---

## Estado Actual del Código

```
/src
  components/
    CharacterActionsPanel.tsx → panel de acciones DnD 5e (combat/class/race/subclass), choices, badges por tipo. ✅ Funcional
    ConfirmModal.tsx          → diálogo de confirmación reutilizable con tema CRT. ✅ Funcional
    CRTOverlay.tsx            → overlay visual CRT (scanlines + flicker Reanimated). ✅ Funcional
    DatabaseGate.tsx          → wrapper que bloquea UI hasta que la DB esté lista + sync API. ✅ Funcional
    GlossaryModal.tsx         → modal de glosario DnD 5e con búsqueda, categorías. ✅ Funcional
    Icons.tsx                 → librería SVG: 20+ iconos (SwordIcon, GuildIcon, etc.). ✅ Funcional
    SliderButton.tsx          → botón deslizable (Gesture Handler). ✅ Funcional
    TorreLogo.tsx             → logo SVG "TORRE" con neón roto + flicker. ✅ Funcional
    LogoIA.tsx                → logo generado por IA; usado en MainScreen. ✅ Funcional
    TutorialOverlay.tsx       → overlay paso a paso con navegación (next/prev/skip). ✅ Funcional
    TypewriterText.tsx        → texto carácter por carácter. ✅ Funcional
    party/
      LaunchProgressModal.tsx → modal de progreso de lanzamiento de expedición. ✅ Funcional
      PortraitSection.tsx     → sección colapsable de portrait en PartyScreen. ✅ Funcional
      PortraitDetailModal.tsx → modal de zoom/detalle de portrait. ✅ Funcional
      RosterTabs.tsx          → tabs del roster de party. ✅ Funcional
  constants/
    dnd5eLevel1.ts            → reglas DnD5e nivel 1: subclases, features, razas, acciones, COMBAT_ACTIONS. ✅ Completo
  database/
    connection.ts             → conexión SQLite (op-sqlite). ✅ Funcional
    migrations.ts             → schema v6: resources/translations/sync_meta/saved_games/portraits/expressions. ✅ Funcional
    gameRepository.ts         → SavedGame CRUD: seed, party, floor, cycle, mapState, portraits, expressions. ✅ Funcional
    repository.ts             → CRUD: resources, translations, sync_meta. ✅ Funcional
    index.ts                  → barrel exports. ✅
  hooks/
    useDatabase.ts            → init DB + seed traducciones + subclases en mount. ✅ Funcional
    useGlossary.ts            → estado de visibilidad del modal de glosario. ✅ Funcional
    usePartyRoster.ts         → gestión del roster de party (extraído de PartyScreen). ✅ Funcional
    useResources.ts           → fetch DnD 5e con traducción automática. ✅ Funcional
    useTutorial.ts            → navegación de pasos del tutorial. ✅ Funcional
  i18n/
    context.tsx               → I18nProvider + useI18n() hook. ✅ Funcional
    translations/en.ts        → inglés (~120+ keys). ✅ Completo
    translations/es.ts        → español (default). ✅ Completo
  services/
    api5e.ts                  → fetch DnD 5e API (24 endpoints). ✅ Funcional
    backgroundSeed.ts         → seed de backgrounds custom en init. ✅ Funcional
    characterStats.ts           → utilidades puras DnD 5e: `assignStandardArray`, `generateValidRolledStats`, `getRacialBonuses`, `computeFinalStats`, `pickRaceName`, `CLASS_STAT_PRIORITY` (12 clases). ✅ Funcional
    dungeonGraphService.ts    → grafos dungeon 12–20 rooms, fog-of-war, salas secretas, mutaciones; integrado en MapScreen. ✅ CONECTADO
    enemySpriteService.ts     → catálogo 35+ enemigos, 5 animaciones, SpriteSet types. ✅ Funcional
    geminiImageService.ts     → generateCharacterPortrait() vía Gemini; prompts por raza/clase/trasfondo/alineamiento. ✅ Funcional
    mapGenerator.ts           → 8 nodos DAG por seed+floor (usado en MapScreen). ✅ Funcional
    monsterEvolutionService.ts→ tiers de evolución, stats 35+ monstruos, XP decay, jefes secretos. ✅ Implementado
    rivalGenerator.ts         → PRNG/LCG determinístico; 10 grupos rivales por seed. ✅ Funcional
    rulesConfig.ts            → reglas DnD 5e (subclases, XP, proficiency, hit dice). ✅ Completo
    spriteDbService.ts        → lector del índice de sprites bundleados (Metro asset). ✅ Funcional
    subclassSeed.ts           → seed de subclases custom en init. ✅ Funcional
    syncService.ts            → orquestación de sync DB ↔ API con progreso. ✅ Funcional
    translationBridge.ts      → lookup traducción con fallback chain. ✅ Funcional
    translationSeed.ts        → seed de traducciones ES en init. ✅ Funcional
    index.ts                  → barrel exports. ✅
  navigation/
    AppNavigator.tsx          → stack de 11 pantallas, transición fade. ✅ Funcional
    types.ts                  → RootStackParamList tipado (11 rutas). ✅ Funcional
  stores/
    gameStore.ts              → Zustand + SQLite; startNewGame, loadGame, updateProgress, endGame, hydrate, clearActive. ✅ Funcional
  screens/
    MainScreen.tsx            → menú LogoIA (reemplazó TorreLogo), boot sequence, toggle idioma; enruta Map/Village según location. ✅
    SeedScreen.tsx            → input seed + efecto Matrix. ⚠️ Sin validación avanzada de seed
    PartyScreen.tsx           → creación personaje real; portrait Gemini; CharacterActionsPanel; ConfirmModal "Retratos pendientes". ✅ FUNCIONAL
    VillageScreen.tsx         → useGameStore (gold/cycle/phase/floor); rivals/market/amenazas por seed; BackHandler; iconos SVG. ✅ FUNCIONAL
    GuildScreen.tsx           → roster con portraits, HP bar, stats, badges ACTIVO/HERIDO/MUERTO. ✅ FUNCIONAL
    MapScreen.tsx             → dungeonGraphService integrado: 12-20 rooms, fog-of-war, backtracking, avance de piso; persistencia en map_state; transición BOSS/ELITE/NORMAL → BattleScreen. ✅ FUNCIONAL ⚠️ GAME LOOP ROTO (ver pendiente crítico)
    BattleScreen.tsx          → banner portrait grupo + portraits individuales; log de combate estático. ⚠️ MOCK — sin params de sala, sin room clearing
    ReportScreen.tsx          → TypewriterText con valores hardcodeados. ⚠️ MOCK
    ExtractionScreen.tsx      → contador animado + "Volver a la villa" en ciclo 60. ✅ CONECTADO
    WorldLogScreen.tsx        → feed de eventos con filtros ALL/COMBAT/LORE/SYSTEM. ⚠️ MOCK DATA
    CycleTransitionScreen.tsx → transición animada Day/Night. ⚠️ MOCK
```

### Sistemas implementados
- **Base de datos SQLite** (op-sqlite v15) — schema v6: resources, translations, sync_meta, saved_games, party_portrait (v4), portraits_json (v5), expressions_json (v6)
- **Persistencia de partida** — `useGameStore` (Zustand) persiste `activeGame` + `savedGames`; campos: seed, party, floor, cycle, phase, gold, status, location, mapState, partyPortrait, portraitsJson, expressionsJson
- **Sistema de retratos IA** — `geminiImageService.ts` genera portraits por personaje vía Gemini API; expresiones faciales (6 variantes) via ComfyUI img2img
- **Catálogo de enemigos** — `enemySpriteService.ts`: 35+ tipos, 5 animaciones; `monsterEvolutionService.ts`: tiers, XP decay, secret bosses; sprites bundleados con Metro
- **Dungeon graphs** — `dungeonGraphService.ts`: DAG 12–20 rooms, fog-of-war, mutaciones por ciclo; **conectado a MapScreen** ✅
- **Routing por estado** — MainScreen enruta a MapScreen o VillageScreen según `location` guardado
- **Generador determinístico** — PRNG djb2+LCG: rivals, market, amenazas, nodos de mapa
- **i18n bilingüe** — ES/EN, fallback chain: translations DB → raw API data

### Pendiente crítico (próximo sprint — Sprint 4A + 4B)
1. **🔴 CRÍTICO — Game loop roto**: `Battle: undefined` en `RootStackParamList` → BattleScreen no recibe ni `roomId` ni `roomType`. Al terminar combate (mock "Force End"), ReportScreen navega a `Extraction`, no de vuelta al mapa. La sala **nunca** se marca `visited: true` → el BOSS nunca se limpia → nunca se puede avanzar de piso. **Sprint 4A** arregla esto antes del motor real.
2. **Motor de combate DnD 5e** — BattleScreen sin tiradas, sin HP dinámico, sin turnos reales (**Sprint 4B**)
3. **`simulateWorld(cycle)`** — parties IA no simulan progreso real aún
4. **ReportScreen** — conectada a resultados reales de combate (actualmente hardcodeada)
5. **HP dinámico de personajes** — el campo `alive` existe en `CharacterSave` pero HP no se reduce en combate

---

## Especificación MVP Completa

### Sistema de Parties
| Item | Valor |
|------|-------|
| Tamaño party | 1–4 personajes |
| Control | Jugador controla TODOS manualmente |
| Slots | Tank · DPS · Utility · Support (cualquier combinación) |
| Máx. parties jugador | 2 por seed |
| Crear 3ra party | Elimina permanentemente la IA derivada más débil |
| Herencia de nivel | Nueva party: nivel máx = promedio de party anterior |

### Stats de Personaje (DnD 5e estándar)
`STR · DEX · CON · INT · WIS · CHA` — ✅ Ya implementado en PartyScreen con datos reales.

### Clases (13 clases DnD 5e completas)
`Barbarian · Bard · Cleric · Druid · Fighter · Monk · Paladin · Ranger · Rogue · Sorcerer · Warlock · Wizard` + datos de API
- 2 subclases por clase definidas en `rulesConfig.ts` (26 total)
- Features de subclase con traducciones ES/EN en `dnd5eLevel1.ts`

Arquitectura data-driven: datos vienen de la API DnD 5e + DB local.

### Flujo de Combate — Pantalla separada (confirmado)
```
Exploración → Encuentro → Transición → BattleScreen dedicado → Victoria/Derrota → Regreso al mapa
```
Modelo clásico (BG3 / FFX). No hay combate in-map. `BattleScreen` ya existe como pantalla navegada.

### Combate (BG3 + Darkest Dungeon)
Por turno cada personaje tiene: **Movement · Action · Bonus Action · Reaction**

Acciones: Attack, Cast Spell, Dash, Disengage, Dodge, Help, Hide.

Motor calcula: hit chance, damage, status effects, saving throws.

**LA IA NO CALCULA RESULTADOS** — la IA solo decide qué acción y qué objetivo. El motor resuelve.

### Representación de Alineamiento y Traits — 3 capas

| Capa | Qué es | Dónde aparece |
|------|--------|---------------|
| 1 — Iconos | `⚖ HONORABLE · 🔥 TRAUMA:DEMONS · 🌿 BIAS:NATURE · 🧠 STABLE` | Panel personaje, party UI, combat UI |
| 2 — Tooltip | Explicación breve al tocar el icono | In-context, sin salir de la pantalla |
| 3 — Codex | Pantalla enciclopedia: explica todos los conceptos mecánicos en detalle | Menú accesible desde cualquier pantalla |

### Sistema de Sugerencias IA — Dungeon Narrator
Toda la retroalimentación de traits/moral/sesgos se canaliza como narrativa a través del **Dungeon Narrator**.

| Nivel | Cuándo se activa | Formato |
|-------|-----------------|---------|
| 1 — Log estándar | Acciones normales | `Warrior attacks Goblin → Damage: 7` |
| 2 — Narrator Event | Cuando un trait influye en el turno | Modal: `🕯 DUNGEON_NARRATOR / The druid hesitates. / Trauma: Demons (-2 to rolls)` |
| 3 — World Narrative | Para introducir mecánicas del mundo | Modal: `🕯 DUNGEON_NARRATOR / Creatures grow more aggressive in darkness.` |

El Narrator no es tutorial — enseña mecánicas de forma orgánica y refuerza la atmósfera CRT.

### Tipos de Combate
| Tipo | Método |
|------|--------|
| Jugador vs Monstruos | Táctico turno por turno completo |
| Jugador vs Party IA | Táctico si ambos aceptan; opciones: combatir / huir / negociar |
| IA vs IA | Abstracto probabilístico (fórmula de poder) |

### Mapa de la Torre
- 100 pisos, cada uno como **grafo de nodos** (no lineal).
- Nodos: Combat Encounter · Event Encounter · Safe Zone · Boss Room · Hidden Passage.
- Portal al siguiente piso: **oculto, debe descubrirse explorando**.
- La IA no memoriza rutas por el jugador.

### Sistema Temporal
- 60 ciclos por temporada. Ciclo = Día o Noche (Day 1, Night 1, Day 2…).
- **Noche:** enemigos +fuertes, +loot, +XP.
- Ciclo se consume al: descansar, acampar, exploraciones largas.
- Al avanzar ciclo → `simulateWorld(cycle)` ejecuta el motor.

### Transición de Ciclo (UI)
- Pantalla breve 2–3 segundos: `DAY → NIGHT` o `NIGHT → DAY`.
- Muestra resumen de eventos globales del ciclo.

### World Log
- **Pantalla dedicada propia** (`WORLD_LOG`).
- Se actualiza cada cambio de ciclo.
- Formato: `Day 12 – Night | Party "Iron Wolves" defeated Floor 6 Boss`

### Village Hub — 6 Edificios
`Armory · Blacksmith · Market · Inn · Church · Guild`

Funciones: comprar/vender equipo · revivir · negociar alianzas · reclutar.
**No existe combate en el pueblo.** Alianzas solo se negocian aquí.

### Alianzas
Opciones: Form alliance · Pay protection · Trade member · Extort party.
Duración: mientras se cumplan pagos. No existe traición arbitraria.

### Progresión de Nivel
- DnD 5e oficial hasta nivel 20.
- Post-20: **Ascension Levels** (minor stat increases + perk points).

### XP Anti-Grind
- Primera derrota por enemy type en seed → XP completa.
- Derrotas posteriores → loot + XP reducida.

---

## Motor de Simulación

```
simulateWorld(playerCycle):
  1. Para cada party IA → simular decisiones hasta playerCycle
  2. Resolver encuentros entre parties (abstracto)
  3. Actualizar posiciones en la Torre
  4. Generar eventos → World Log
  5. Persistir estado
```

**Determinístico:** `deterministicRandom(seed + context)` — mismo input = mismo output siempre.

### Fórmulas Clave

```
// Combate táctico
HitChance = (AttackMod + ProfBonus) - EnemyAC  [clamp 5%–95%]
Damage    = WeaponBase + StatMod + Bonus - Resistances  [×2 en crit]
Initiative = DEX_mod + deterministicRoll(seed)

// Combate abstracto IA vs IA
PartyPower = Σ(CharLevel × StatMultiplier × EquipFactor)
WinProb    = PartyPower / (PartyPower + EnemyPower × RiskFactor)
RiskFactor = Floor × NightMultiplier

// IA — decisión
UtilityScore = (XP_esperada × wXP) + (Loot_esperado × wLoot)
             - (Risk × wRisk) - (ResourceCost × wCost)

// Escalado de monstruos
MonsterStats = BaseStats × (1 + floor × 0.05)

// Anti-grind XP
XP = BaseXP × (EnemyLevel / PlayerLevel)
XP × 0.5 si ya fue derrotado en esta seed
XP = 0    si level diff > 5

// Economía
ReviveCost = BaseCost × CharLevel × (1 + DeathCount × 0.1)
BountyMult = 1 + (BountyLevel × 0.2)
```

---

## Modelo de Datos (esquema completo)

```
Seeds         { id, createdAt, difficulty, status, maxParties=10, currentCycle, isLocked }
Parties       { id, seedId, ownerType(player|ai), name, levelAvg, goldBalance,
                moralScore, bountyLevel, status(active|eliminated|retired),
                currentFloor, currentZone, cycleProgress }
Characters    { id, partyId, name, race, class, level, xp,
                stats{STR,DEX,CON,INT,WIS,CHA}, alignment, morale, isAlive, deathCount }
Items         { id, seedId, ownerPartyId, equippedBy, name, type, rarity,
                isUnique, isEquipped, obtainedCycle }
Events        { id, seedId, type, floor, zone, cycle, involvedParties[], result{} }
  Tipos: Combat · BossKilled · PartyEliminated · AllianceCreated · BountyIssued · ItemLooted
Alliances     { id, seedId, partyA, partyB, protectionFee, expiresAtCycle,
                status(active|expired|broken) }
Bounties      { id, seedId, targetPartyId, issuedBy, rewardAmount, level, isActive }
```

**Regla global:** todo dato está ligado a un `seedId`. Seeds son ecosistemas independientes.

**Persistencia:** SQLite o Realm. Offline first. Sin servidor necesario para MVP.

**Estado en app (memoria):**
```ts
GameState { currentSeed, currentCycle, parties[], events[], activeCombat, worldLog[] }
```

---

## Tech Stack

| Tecnología | Versión | Rol |
|-----------|---------|-----|
| React Native | 0.84 (New Architecture / Fabric) | UI framework |
| TypeScript | v5 | Lenguaje |
| NativeWind | v4 (Tailwind) | Estilos |
| Reanimated | v4 | Animaciones |
| Gesture Handler | v2 | Gestos (SliderButton) |
| React Navigation | v7 Native Stack | Navegación |
| op-sqlite | v15 | Base de datos SQLite |
| react-native-svg | v15 | SVG para logo y gráficos |
| Zustand | (por instalar) | Estado global |
| RobotoMono | custom font | Estética terminal |

### Decisión de arquitectura crítica
**New Architecture (Fabric) activo.** Implicaciones:
- `pointerEvents` en Views absolutas/transformadas debe declararse explícitamente — no se hereda de forma confiable por hijos Reanimated.
- Hit-testing usa bounds transformados — vistas decorativas absolutas DEBEN tener `pointerEvents="none"`.

---

## Estética — Reglas No Negociables

| Elemento | Regla |
|----------|-------|
| Fuente | RobotoMono en todo texto |
| Fondo | `#0A0E0A` (casi negro) |
| Color primario | `#00FF41` (verde terminal) |
| Color alerta/secundario | `#FFB000` (ámbar) |
| Acento | `#00E5FF` (cyan) |
| Destructivo | `#FF3E3E` |
| Nombres en UI | ALL_CAPS_UNDERSCORE (nombrar como protocolo de sistema) |
| Estilo narrativo | La UI actúa como un OS ficticio |

---

## Pantallas Actuales y Proyectadas

| Pantalla | Estado hoy | Descripción |
|----------|-----------|-------------|
| MainScreen | ✅ Funcional | Menú principal con TorreLogo SVG, boot sequence, toggle idioma |
| SeedScreen | ⚠️ UI lista | Input seed (seed se descarta) |
| PartyScreen | ✅ Funcional | Creación de personaje con datos reales DnD 5e + tutorial + glosario |
| VillageScreen | ⚠️ Mock | Hub pueblo con edificios y leaderboard hardcodeado |
| MapScreen | ⚠️ Parcial | Mapa dungeon real (12–20 rooms, fog-of-war, backtrack); UX node select + action panel; visual overhaul; fix overlap+reveal; falta cerrar flow de combate (params) |
| BattleScreen | ⚠️ Mock | Combate táctico (log estático) |
| ReportScreen | ⚠️ Mock | Resumen post-batalla (hardcoded) |
| ExtractionScreen | ⚠️ Mock | Loot + retorno (hardcoded) |
| WorldLogScreen | ⚠️ Mock data | Feed de eventos con filtros (ALL/COMBAT/LORE/SYSTEM) |
| CycleTransitionScreen | ⚠️ Mock | Transición de ciclo animada |
| AllianceScreen | ❌ no existe | Negociación en el pueblo |
| CharacterDetailScreen | ❌ no existe | Stats full de un personaje |

---

## Prioridades de Desarrollo (en orden)

### 1. Estado global (Zustand) — BLOQUEANTE
Sin esto, nada más funciona. Debe persistir:
`seed · partyId · characters[] · currentFloor · currentCycle · gameLog[]`

### 2. Modelo de datos de partida
Extender schema SQLite con tablas: Seeds, Parties, Characters. Items y Events después.
(La DB ya existe con op-sqlite — extender migrations.ts)

### 3. ✅ Creación de personaje real — COMPLETADO
Stats DnD 5e reales, 13 clases, 26 subclases, 9 razas, trasfondos, alineamientos.
Datos de API DnD 5e + traducciones ES/EN.

### 4. Generador determinístico por seed
PRNG seeded para: stats iniciales, mapa de nodos, tabla de enemigos, loot.

### 5. Motor de combate DnD 5e básico
Hit/miss, damage, HP, turnos por iniciativa, log dinámico. Sin spells primero.

### 6. simulateWorld() — motor de IA
Sistema de ciclos + batch simulation de parties IA.

### 7. ✅ World Log + CycleTransitionScreen — COMPLETADO (UI)
Pantallas creadas con mock data. Falta conectar a datos reales.

---

## Lo que NO Tocar Sin Razón

- `CRTOverlay`, `TypewriterText`, `SliderButton` — funcionan bien, no refactorizar.
- Paleta de colores — definida en `global.css` como CSS variables + tailwind tokens.
- Navegación `fade` entre pantallas — mantener.
- RobotoMono como única fuente — no añadir otras.

---

## Especificación Completa

Todas las decisiones de diseño MVP están confirmadas. No hay preguntas abiertas.

Para profundidad completa de reglas y fórmulas: `SYSTEMS.MD`
Para contexto narrativo y diseño: `GAME_CONTEXT.md`
Este archivo (`HANDOFF.md`) es el punto de entrada para retomar desarrollo.
