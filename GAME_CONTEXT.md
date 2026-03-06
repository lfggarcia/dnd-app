# GAME_CONTEXT — TORRE

> Archivo de contexto central. Editarlo libremente para reflejar la visión actualizada.
> Basado en SYSTEMS.MD como documento fundacional del proyecto.

---

## ¿Qué es TORRE?

TORRE es un RPG de **simulación social con ambientación cyberpunk/CRT**, construido en React Native para iOS y Android. La premisa central:

> Una torre de 100 pisos se abre una vez por temporada. El jugador controla una o dos parties que compiten, negocian y sobreviven junto a otras ~8 parties controladas por IA, todas dentro del mismo mundo determinístico generado por un seed.

No es un roguelike de sesiones de 10 minutos. Es más cercano a un juego de **gestión y estrategia con capa táctica**: las decisiones importan durante 60 ciclos, las consecuencias son permanentes, y el mundo evoluciona aunque el jugador no esté mirando.

La estética CRT/terminal no es cosmética — la UI actúa como un sistema operativo de ficción. Todo tiene nombre de protocolo, el leaderboard es un "RIVALRY_MONITOR", los logs de combate son el "output" del sistema.

---

## El mundo del juego

### La Torre
- **100 pisos** organizados verticalmente, con enemigos que escalan en dificultad por piso.
- **60 ciclos por temporada** — cuando se cierra el ciclo 60, se calcula el ranking final.
- Ciclos alternan entre **día y noche** (condiciona encuentros y ventajas).
- Cada temporada genera un mundo diferente según el **seed**.

### Las parties
Hasta **~10 parties simultáneas** compiten dentro del mismo seed:
- 1 o 2 parties controladas por el jugador.
- El resto son IA con personalidad generada, simuladas por lotes cuando el jugador avanza ciclos.
- Todas comparten el mismo mundo: mismos pisos, mismos jefes, mismos recursos limitados.

### El Pueblo (Safe Zone)
- Zona sin combate en la base de la Torre.
- Contiene: ARMERÍA (equipo), EL GREMIO (misiones, bounties, alianzas, World Log), POSADA (descanso, recuperación).
- El descanso en el pueblo **avanza el ciclo** — tiene costo de tiempo.

### El Gremio
Entidad central del ecosistema:
- Registra eventos de la Torre (no omnisciente — solo lo que se reporta).
- Gestiona bounties activos.
- Facilita formación de alianzas.
- Publica el **World Log**: feed de eventos significativos (jefes caídos, parties eliminadas, bounties emitidos).

---

## El Loop del Jugador

### Por ciclo
```
Decidir acción del ciclo:
  ├─ Explorar (avanzar en el piso actual)
  ├─ Subir piso (intentar avanzar verticalmente)
  ├─ Descansar (recuperar HP/recursos — cuesta ciclos)
  ├─ Negociar (alianzas, protección, intercambio)
  └─ Atacar otra party (táctica — con consecuencias)

Al avanzar ciclo:
  └─ El motor simula todas las parties IA hasta este ciclo
  └─ Se resuelven eventos pendientes
  └─ Se actualiza el World Log
```

### Por temporada completa
```
SEED INPUT
  └─ Crear party (DnD 5e: raza, clase, trasfondo, stats, alineamiento, módulo)
       └─ Pueblo (preparar, comprar, ver estado del mundo)
            └─ Mapa de pisos (elegir acción del ciclo)
                 ├─ Combate (si hay encuentro)
                 ├─ Evento
                 └─ Descanso / negociación
            (Repetir por 60 ciclos máximo)
       └─ Ranking final de temporada
  └─ Nueva temporada (parties anteriores pueden convertirse en IA)
```

Un "run" no es una incursión corta — es una **temporada completa de 60 ciclos**, donde cada decisión acumula peso.

---

## Sistemas Principales

### 1. Sistema Temporal
- El tiempo avanza cuando el jugador descansa o cambia de estado (día ↔ noche).
- 60 ciclos máximo — más allá, la Torre se cierra y se calcula ranking.
- Sin presión temporal no hay tensión estratégica.

### 2. Economía y Loot
- Cada party tiene una **cuenta dimensional privada** de oro.
- El oro NO se puede robar directamente entre parties.
- Se obtiene de: monstruos nativos, eventos, jefes, objetivos de piso.
- **PvP no genera oro** — el sistema penaliza la caza de jugadores.
- Jefes tienen **loot único por seed** (primera vez solamente).
- Economía escala con progresión vertical (pisos altos = materiales raros).
- Revivir miembros: costo escala con nivel y con número de muertes previas.

### 3. Combate — Reglas DnD 5e completas
**Stats del personaje:** STR, DEX, CON, INT, WIS, CHA (6 stats DnD estándar).

El motor implementa:
- Iniciativa, Acción, Acción Bonus, Reacción, Movimiento, Spell Slots, Proficiency Bonus.
- Ataques, daño, resistencias, ventajas/desventajas, estados alterados.
- Fórmulas concretas:
  - **Hit:** `(AttackMod + ProfBonus) - EnemyAC`, clamped 5–95%
  - **Daño:** `WeaponBase + StatMod + Bonus - Resistances`, ×2 en crítico
  - **Iniciativa:** DEX + tirada seeded

**Tipos de combate:**
- **Jugador vs Monstruos** — combate táctico por turnos completo.
- **Jugador vs Party IA** — táctico si ambas partes aceptan, con opción de huir o negociar.
- **IA vs IA** — combate abstracto probabilístico, no turno por turno (performance).

**Opciones adicionales:** emboscada (ventaja posicional), huida (chequeo de habilidad), negociación.

### 4. IA, Moral y Bounty
Cada party IA tiene: personalidad generada, alineamiento, nivel de tolerancia al riesgo.

**2 capas de IA:**
- **Estratégica:** decide subir piso, explorar, descansar, evitar combate — basado en utilidad esperada.
- **Táctica (combate abstracto):** prioridades de objetivo, uso de habilidades, evaluación de ventaja.

**Sistema de Moral:**
- Si el jugador ataca frecuentemente otras parties → tensión moral interna.
- Miembros con alineamiento incompatible pueden **abandonar la party**.
- El aventurero reemplazante viene generado, no editable inicialmente.

**Sistema de Bounty:**
- Violencia acumulada activa bounty permanente en el seed.
- Con bounty: mayor probabilidad de emboscada por IA, más difícil conseguir aliados.
- Historial **no se borra** — la reputación define cómo el mundo te trata.

**Fórmula de utilidad IA:**
```
UtilityScore = (XP_esperada × Peso_XP) + (Loot_esperado × Peso_Loot)
             - (Riesgo × Peso_Riesgo) - (Costo_recursos × Peso_Costo)
```

### 5. Creación de Parties y Reglas del Jugador
- Creación con **reglas oficiales DnD 5e**: raza, clase, trasfondo, habilidades.
- **Máximo 2 parties activas** por seed — crear una tercera elimina la IA derivada más débil.
- **Herencia de nivel:** nueva party empieza con nivel máximo = promedio de la party anterior.
- Anti-abuso: sin XP por matar parties, XP con retorno decreciente en enemigos repetidos.
- Muerte permanente si no hay fondos para revivir en el pueblo.
- Al cierre de temporada: las parties del jugador pueden volverse IA en la siguiente.

### 6. Política, Alianzas y Gremio
- **Alianzas contractuales:** una party paga protección a otra; dura mientras el pago continúe.
- **No existe traición arbitraria** — la ruptura es contractual (el pago se detiene).
- **Extorsión estratégica:** parties poderosas pueden exigir pago a cambio de seguridad.
- **Negociación** en el Pueblo: intercambiar oro, materiales, protección, información.
- **World Log** visible para todas las parties — historial de eventos del mundo.

---

## Arquitectura Técnica

### Stack
| Área | Tecnología | Por qué |
|------|-----------|---------|
| UI Framework | React Native 0.84 (New Architecture / Fabric) | Cross-platform mobile |
| Estilos | NativeWind v4 (Tailwind en RN) | Desarrollo rápido, consistencia |
| Animaciones | Reanimated v4 | Flicker, transiciones, radar |
| Gestos | Gesture Handler v2 | SliderButton, futuras interacciones |
| Navegación | React Navigation Native Stack v7 | 8+ pantallas, transición fade |
| Lenguaje | TypeScript v5 | Tipado, mantenibilidad |
| Fuente | RobotoMono | Esencial para la estética terminal |
| Estado global | Zustand (propuesto) | Simulación, parties, ciclos |
| Persistencia | SQLite / Realm (propuesto) | Offline first, relacional |

### Modelo de datos (esquema principal)
```
Seed → Parties → Characters
     → Events (Combat, BossKilled, PartyEliminated, AllianceCreated, BountyIssued, ItemLooted)
     → Items
     → Alliances (partyA, partyB, protectionFee, expiresAtCycle)
     → Bounties (targetPartyId, rewardAmount, isActive)
```
Todo dato está **ligado a una seed** — seeds son ecosistemas independientes.

### Motor de Simulación
```
simulateWorld(playerCycle):
  1. Simular parties IA hasta el ciclo actual
  2. Resolver eventos pendientes
  3. Actualizar posiciones
  4. Generar World Log
```
La lógica es **determinística**: mismo seed + mismas decisiones = mismo resultado siempre.
Usa PRNG seeded (`deterministicRandom(seed + context)`), sin dependencia de tiempo real.

Designed para: 10 parties × 60 ciclos sin problema de performance.

---

## Estado Actual vs Visión Completa

**Lo que existe hoy:** 8 pantallas navegables con estética CRT consistente. Animaciones funcionando. La cáscara visual del juego.

**Lo que NO existe (y es el grueso del trabajo):**
- Motor de simulación
- Sistema de ciclos y temporadas
- Parties IA simuladas
- Combate DnD 5e real (actualmente log de texto hardcodeado)
- Sistema de moral y bounty
- Sistema político/alianzas
- World Log
- Base de datos local
- Estado global entre pantallas (nada persiste entre navigaciones)
- Creación de personaje real (stats actuales son STR/DEX/INT/VIT/SPD hardcodeados — necesitan migrar a los 6 stats DnD estándar)

**La brecha entre prototipo y visión es mayor de lo que parece.** El prototipo refleja visualmente UN ciclo/incursión. La visión completa es un ecosistema vivo de 60 ciclos con 10 parties, política y simulación.

---

## Lo que está bien (no tocar sin razón)

- La estética CRT es sólida y consistente. Mantenerla.
- El loop de 8 pantallas cubre narrativamente el flujo de un ciclo.
- `CRTOverlay`, `TypewriterText`, `SliderButton` son reutilizables y están bien construidos.
- La paleta de colores (verde terminal / ámbar de alerta / fondo casi negro) es correcta.
- RobotoMono es la decisión correcta para el mood.
- El concepto del RIVALRY_MONITOR (leaderboard de squads rivales) es válido — se convierte en el World Log.

---

## Especificación MVP (decisiones confirmadas)

### Party
- **1–4 personajes** por party. El jugador controla **todos manualmente**.
- Slots sugeridos: Tank / DPS / Utility / Support (cualquier combinación válida).

### Combate
- Táctico por turnos. Referencias: **Baldur's Gate 3 + Darkest Dungeon**.
- Cada personaje por turno: **Movement, Action, Bonus Action, Reaction**.
- Acciones DnD 5e: Attack, Cast Spell, Dash, Disengage, Dodge, Help, Hide.
- Motor calcula: hit chance, damage, status effects, saving throws.
- La IA **no** calcula resultados — solo decide qué acción tomar y qué objetivo priorizar. El motor resuelve.

### Sistema de Sugerencias IA (por personaje)
- Cada personaje tiene moral, sesgos cognitivos y traumas contra tipos de enemigo.
- Generan **sugerencias de acción** (no órdenes). El jugador puede ignorarlas.
- Ejemplo: personaje con "pacifista hacia criaturas planta" → sugerencia: buff/heal, evitar ataque directo.

### Mapa de la Torre
- 100 pisos. Cada piso es un **grafo de nodos** (no lineal).
- Tipos de nodo: Combat Encounter, Event Encounter, Safe Zone, Boss Room, Hidden Passage.
- El portal al siguiente piso está **oculto** — se descubre explorando.
- La IA no memoriza rutas por el jugador.

### Sistema Temporal
- 60 ciclos por temporada. Un ciclo = Día o Noche (alternados: Day 1, Night 1, Day 2…).
- Acciones que consumen ciclo: descansar, acampar, exploraciones largas.
- **Noche:** enemigos más fuertes, mejor loot, más XP.

### World Log
- **Pantalla dedicada propia** (`WORLD_LOG`). Se actualiza cada cambio de ciclo.
- Muestra eventos globales: jefes caídos, parties eliminadas, bounties emitidos, rutas descubiertas.
- Formato: `Day 12 – Night | Party "Iron Wolves" defeated Floor 6 Boss`

### Village Hub
- Disponible entre ciclos (mientras la Torre está abierta) y entre temporadas.
- **6 edificios:** Armory, Blacksmith, Market, Inn, Church, Guild.
- Funciones: comprar/vender equipo, revivir, negociar alianzas, reclutar.
- **No existe combate** en el pueblo. Las alianzas se negocian solo aquí.
- Opciones de alianza: Form alliance, Pay protection, Trade member, Extort party.

### Transición de Ciclo (Day/Night UI)
- Pantalla breve (**2–3 segundos**) al cambiar ciclo.
- Muestra: DAY → NIGHT o NIGHT → DAY + resumen de eventos globales del ciclo.

### Clases (MVP — 6 de 12)
`Fighter` · `Rogue` · `Wizard` · `Cleric` · `Ranger` · `Warlock`

Cada clase: base stats, core abilities, level progression, spell slots si aplica.

### Arquitectura Data-Driven (para escalar a 12 clases sin reescribir)
```
ClassDefinition { name, hitDice, primaryStats, proficiency, featuresByLevel }
SpellDefinition { name, school, level, castingTime, range, components, damage, effects }
```
Clases futuras: Barbarian, Paladin, Monk, Bard, Sorcerer, Druid — se agregan como datos.

### Progresión de Nivel
- DnD 5e oficial hasta nivel 20.
- Post-20: **Ascension Levels** (progresión infinita sin romper balance) → minor stat increases + perk points.

### XP Anti-Grind
- Primera derrota de un monstruo en la seed → XP completa.
- Derrotas posteriores → solo loot + XP reducida.
- Incentivo: siempre explorar pisos más profundos.

---

## Especificación MVP — Decisiones Finales (todas las preguntas resueltas)

### Flujo de Combate — Pantalla separada (modelo clásico)
```
Exploración → Encuentro detectado → Transición → Pantalla de combate dedicada → Victoria/Derrota → Regreso al mapa
```
Igual a BG3 / Final Fantasy X. Justificación: más fácil de implementar, UI limpia, combate controlado, mejor en mobile.

### Representación de Alineamiento y Rasgos en UI — Sistema de 3 capas

**Capa 1 — Iconos rápidos** (siempre visibles en panel de personaje, party UI y combat UI)
```
⚖ Moral: HONORABLE
🔥 Trauma: DEMONS
🌿 Bias: NATURE
🧠 Mental State: STABLE
```

**Capa 2 — Tooltip contextual** (al tocar un icono)
```
MORAL: HONORABLE
Este personaje evita atacar enemigos que no representan amenaza directa.
Puede negarse a ejecutar acciones moralmente cuestionables.
```

**Capa 3 — Codex** (pantalla de enciclopedia accesible desde menú)
Explica todos los conceptos mecánicos en profundidad. Permite que el jugador aprenda el sistema a su ritmo sin tutoriales forzados.

### Sistema de Sugerencias IA — Dungeon Narrator

El feedback del sistema de traits/moral se canaliza como narrativa a través del **Dungeon Narrator**, un sistema de UI que activa modales cuando ocurren eventos mecánicamente significativos.

**Nivel 1 — Log de combate estándar** (acciones normales)
```
Warrior attacks Goblin → Damage: 7
Goblin counterattacks → Damage: 3
```

**Nivel 2 — Narrator Event** (cuando un trait influye en el comportamiento)
```
🕯 DUNGEON_NARRATOR

The druid hesitates.
His trauma with demons affects his concentration.

Active Trait: Trauma — Demons (-2 to rolls)
```

**Nivel 3 — World Narrative Events** (para introducir mecánicas del sistema mundo)
```
🕯 DUNGEON_NARRATOR

Creatures within the Tower grow more aggressive in darkness.
Exploring at night always carries a cost.
```

El Dungeon Narrator enseña mecánicas de forma orgánica sin tutoriales explícitos y refuerza la atmósfera narrativa CRT del juego.

---

## Sin preguntas abiertas

Toda la especificación MVP está definida. Las tres capas son:
1. `SYSTEMS.MD` — reglas del sistema y fórmulas
2. `GAME_CONTEXT.md` — contexto, sistemas y especificación confirmada
3. `HANDOFF.md` — documento de entrega para retomar en cualquier sesión

