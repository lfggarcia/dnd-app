# HANDOFF — TORRE (CYBER_DND)

> Documento de transferencia de sesión. Autosuficiente — no requiere leer otros archivos para continuar.
> Fuente de verdad: `SYSTEMS.MD` (diseño) · `GAME_CONTEXT.md` (contexto) · `PROJECT_STATUS.md` (estado técnico)

---

## TL;DR

TORRE es un **RPG de simulación social con estética CRT/cyberpunk** en React Native. Una torre de 100 pisos, 60 ciclos por temporada, ~10 parties simultáneas (1-2 jugador + resto IA), combate táctico DnD 5e, sistema de política y alianzas, motor de simulación determinístico por seed.

**Estado hoy:** prototipo visual de 8 pantallas completamente navegable, estética funcional, cero mecánicas implementadas. Todo el gameplay es mock/hardcoded.

**Lo más urgente:** estado global (nada persiste entre pantallas), motor de simulación (corazón del juego), combate DnD 5e real.

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
    CRTOverlay.tsx     → overlay visual CRT (scanlines + flicker Reanimated). ✅ Funcional
    TypewriterText.tsx → texto carácter por carácter. ✅ Funcional
    SliderButton.tsx   → botón deslizable (Gesture Handler). ✅ Funcional
  navigation/
    AppNavigator.tsx   → stack de 8 pantallas, transición fade. ✅ Funcional
    types.ts           → RootStackParamList tipado. ✅ Funcional
  screens/
    MainScreen.tsx     → menú, ASCII art, NEW_REPLICATION funcional. ✅
    SeedScreen.tsx     → input seed + efecto Matrix. Seed se ingresa pero se DESCARTA. ⚠️
    PartyScreen.tsx    → UI de personaje, raza seleccionable, stats HARDCODEADOS. ⚠️
    VillageScreen.tsx  → blueprint con edificios, leaderboard hardcodeado. ⚠️
    MapScreen.tsx      → 4 nodos fijos, radar animado. Solo ENEMY navega a Battle. ⚠️
    BattleScreen.tsx   → log de combate ESTÁTICO (4 strings hardcodeados). ⚠️
    ReportScreen.tsx   → TypewriterText con valores HARDCODEADOS. ⚠️
    ExtractionScreen.tsx → contador animado siempre = 15400G. ⚠️
```

**Sin estado global.** Zustand/Context: no existe. Cada pantalla vive aislada.
**Sin persistencia.** LOAD_STATE no funciona.
**Sin motor.** Toda lógica de juego = texto fijo.

### Bug conocido activo
- `MapScreen`: LOOT, BOSS, START tienen `onPress={() => false && navigate(...)}` — visualmente tappable, sin acción.

### Bug ya corregido (esta sesión)
- `PartyScreen`: stat Views absolutas sin `pointerEvents="none"` bloqueaban todos los toques en New Architecture (Fabric). Ya corregido.

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
`STR · DEX · CON · INT · WIS · CHA`

⚠️ El prototipo usa STR/DEX/INT/VIT/SPD — **migrar cuando se implemente gameplay**.

### Clases MVP (6 de 12)
`Fighter · Rogue · Wizard · Cleric · Ranger · Warlock`

Arquitectura data-driven para escalar sin reescribir:
```ts
ClassDefinition { name, hitDice, primaryStats, proficiency, featuresByLevel }
SpellDefinition { name, school, level, castingTime, range, components, damage, effects }
```
Clases futuras: Barbarian, Paladin, Monk, Bard, Sorcerer, Druid.

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
| Zustand | (por instalar) | Estado global |
| SQLite/Realm | (por instalar) | Persistencia |
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

## Pantallas Proyectadas (MVP completo)

| Pantalla | Estado hoy | Descripción |
|----------|-----------|-------------|
| MainScreen | ✅ UI lista | Menú principal |
| SeedScreen | ⚠️ UI lista | Input seed (seed se descarta) |
| PartyScreen | ⚠️ UI lista | Crear/ver personaje |
| VillageScreen | ⚠️ UI lista | Hub pueblo (6 edificios) |
| MapScreen | ⚠️ UI lista | Mapa de nodos del piso actual |
| BattleScreen | ⚠️ UI lista | Combate táctico (log estático) |
| ReportScreen | ⚠️ UI lista | Resumen post-batalla |
| ExtractionScreen | ⚠️ UI lista | Loot + retorno (hardcoded) |
| WorldLogScreen | ❌ no existe | Feed de eventos globales |
| CycleTransitionScreen | ❌ no existe | DAY → NIGHT (2-3s) |
| AllianceScreen | ❌ no existe | Negociación en el pueblo |
| CharacterDetailScreen | ❌ no existe | Stats full de un personaje |

---

## Prioridades de Desarrollo (en orden)

### 1. Estado global (Zustand) — BLOQUEANTE
Sin esto, nada más funciona. Debe persistir:
`seed · partyId · characters[] · currentFloor · currentCycle · gameLog[]`

### 2. Modelo de datos + SQLite/Realm
Implementar tablas: Seeds, Parties, Characters. Items y Events después.

### 3. Creación de personaje real
Stats DnD 5e (STR/DEX/CON/INT/WIS/CHA), clase (6 MVP), raza, alineamiento.

### 4. Generador determinístico por seed
PRNG seeded para: stats iniciales, mapa de nodos, tabla de enemigos, loot.

### 5. Motor de combate DnD 5e básico
Hit/miss, damage, HP, turnos por iniciativa, log dinámico. Sin spells primero.

### 6. simulateWorld() — motor de IA
Sistema de ciclos + batch simulation de parties IA.

### 7. World Log + CycleTransitionScreen
Pantallas nuevas que dan vida al mundo.

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
