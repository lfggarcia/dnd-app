# 🕰 TORRE – SISTEMA TEMPORAL Y NÚCLEO

---

## 1️⃣ VISIÓN DEL SISTEMA

* 100 pisos máximos.
* 60 ciclos por temporada.
* Día / Noche alternados.
* Cada party tiene su propio contador de ciclos.
* Torre se cierra al ciclo 60.

El tiempo es el recurso principal.

---

## 2️⃣ AVANCE DEL TIEMPO

El tiempo avanza cuando:

* El jugador descansa.
* El jugador cambia de estado (día ↔ noche).

Cuando el jugador avanza ciclo:

1. Se simulan las parties IA hasta ese mismo ciclo.
2. Se generan eventos del World Log.

La simulación ocurre por lotes, no en tiempo real.

---

## 3️⃣ CICLOS Y SIMULACIÓN IA

Cada party IA tiene:

* Un contador independiente de ciclos.
* Decisiones simuladas cuando el sistema lo requiere.

Simulación incluye:

* Movimiento entre zonas.
* Combate abstracto.
* Descanso.
* Progreso vertical.

Todo basado en probabilidad + estadísticas.

---

## 4️⃣ RESTRICCIONES TEMPORALES

* Máximo 60 ciclos.
* Si una party no alcanza Piso 100 antes del ciclo 60 → pierde oportunidad de victoria.
* Ranking final se calcula al cierre.

---

## 5️⃣ IMPACTO EN EL META

El tiempo obliga a:

* Riesgo estratégico.
* Decisiones eficientes.
* No abusar de descanso excesivo.

Sin presión temporal, el sistema pierde tensión.

---

# FIN – MÓDULO TEMPORAL
# 💰 TORRE – ECONOMÍA Y SISTEMA DE LOOT

---

## 1️⃣ SISTEMA MONETARIO

### Oro

* Cada party posee una "cuenta dimensional" privada.
* El oro NO es físico en el mapa.
* No puede ser robado directamente.
* Solo puede usarse por los miembros de la party.

El oro sirve para:

* Revivir miembros.
* Comprar equipo.
* Pagar alianzas / protección.
* Mejoras en el pueblo.

---

## 2️⃣ GENERACIÓN DE ORO

El oro se obtiene mediante:

* Derrotar monstruos nativos.
* Completar eventos.
* Derrotar jefes.
* Completar objetivos de piso.

PvP NO genera oro.

---

## 3️⃣ SISTEMA DE LOOT

### Loot al derrotar criaturas

Se obtiene:

* Equipo no equipado.
* Consumibles.
* Materiales.
* Objetos comunes.

---

### Loot al derrotar parties

Solo se puede obtener:

* Parte del botín recolectado en el ciclo actual.
* Objetos NO equipados.

No se puede obtener:

* Oro.
* Equipo equipado.
* Objetos únicos de jefe.

---

## 4️⃣ BOTÍN ÚNICO DE JEFES

* Cada jefe tiene un botín único por seed.
* Se obtiene solo la primera vez que es derrotado.
* En temporadas futuras puede volver a obtenerse.
* Si ya fue reclamado, solo deja loot estándar.

Especialmente importante en:

* Jefes guardianes de piso.
* Jefe del Piso 100.

---

## 5️⃣ ECONOMÍA DE RIESGO

Diseño intencional:

* PvP es estratégico, no rentable económicamente.
* El verdadero ingreso viene de explorar y vencer monstruos.
* El riesgo aumenta las recompensas.

Objetivo:
Evitar que el sistema se convierta en un juego de caza de jugadores por oro.

---

## 6️⃣ INFLACIÓN Y CONTROL

Para evitar desbalance:

* Los precios de revivir escalan con nivel.
* Los equipos poderosos requieren materiales raros.
* Los materiales dependen de pisos altos.

La economía está ligada al progreso vertical.

---

# FIN – MÓDULO ECONOMÍA
# ⚔ TORRE – COMBATE Y ENCUENTROS

---

# 1️⃣ SISTEMA BASE DE COMBATE

Se utilizan las reglas oficiales de DnD 5e:

* Iniciativa.
* Acción.
* Acción Bonus.
* Reacción.
* Movimiento.
* Spell slots.
* Proficiency Bonus.

El motor calcula:

* Ataques.
* Daño.
* Resistencias.
* Ventajas / Desventajas.
* Estados alterados.

El jugador participa en combate táctico real.

---

# 2️⃣ COMBATE CONTRA CRIATURAS

## Flujo

1. Encuentro detectado.
2. Se muestra información básica del enemigo.
3. El jugador decide:

   * Atacar.
   * Negociar.
   * Huir.

Si decide combatir:

* Se inicia combate por turnos.
* Se ejecutan reglas oficiales.

Si derrota enemigos:

* Obtiene XP.
* Obtiene loot.

---

# 3️⃣ ENCUENTROS ENTRE PARTIES

Ocurren si coinciden:

* Mismo piso.
* Misma zona.
* Mismo ciclo (día/noche).

Se activa evento de interacción.

---

## IA vs IA

Combate abstracto:

* Se calcula poder promedio.
* Se calcula ventaja posicional.
* Se aplica fórmula probabilística.
* Resultado simulado sin ejecución turno por turno.

Esto mantiene bajo consumo de recursos.

---

## Jugador vs IA

Flujo:

1. Se muestra resumen de la party rival.

2. Ambas parties deciden intención:

   * Combatir.
   * Huir.
   * Negociar.

3. Si ambas aceptan combate → combate táctico real.

4. Si uno huye → chequeos usando reglas DnD.

---

# 4️⃣ EMBOSCADAS

Una party puede intentar emboscar si:

* Detecta primero a la otra.
* Tiene ventaja de posición.
* Está en zona no iluminada.

Efectos de emboscada:

* Ventaja en iniciativa.
* Primer ataque gratuito.
* Posible sorpresa.

---

# 5️⃣ HUÍDA

Huir implica:

* Chequeo de habilidad (ej. Atletismo / Sigilo).
* Riesgo de perder miembros.
* Riesgo de abandonar loot.

Si la huida falla:

* El combate continúa.

---

# 6️⃣ ZONAS SEGURAS

En el pueblo:

* No se permiten combates.
* No se permiten emboscadas.
* Interacción solo diplomática o comercial.

Las salas de jefe también bloquean entrada mientras una party esté dentro.

---

# 7️⃣ IMPACTO EN EL SISTEMA

El combate debe ser:

* Estratégico.
* Costoso si se usa mal.
* Beneficioso solo si hay ventaja real.

PvP es opcional pero peligroso.

---

# FIN – MÓDULO COMBATE Y ENCUENTROS
# 🧠 TORRE – IA, MORAL Y BOUNTY

---

# 1️⃣ SISTEMA DE IA (PARTIES CONTROLADAS POR EL MOTOR)

Las parties IA funcionan bajo simulación automática basada en:

* Estadísticas del grupo.
* Nivel promedio.
* Recursos disponibles.
* Personalidad generada.
* Situación actual del piso.

La IA no ejecuta combate táctico turno por turno.

Solo toma decisiones estratégicas.

---

## Capas de IA

### 🔵 Capa Estratégica

* Decide subir piso.
* Decide explorar.
* Decide descansar.
* Decide evitar combate.

Basado en:

* Riesgo actual.
* Probabilidad de victoria.
* Recursos restantes.

---

### 🔴 Capa Táctica (Combate)

Cuando ocurre combate abstracto:

* Selecciona prioridades de objetivo.
* Usa habilidades disponibles.
* Evalúa ventaja/desventaja.

El resultado es probabilístico.

---

# 2️⃣ MORAL INTERNA

Cada miembro tiene:

* Alineamiento.
* Personalidad.
* Nivel de tolerancia al riesgo.
* Opinión sobre violencia contra otras parties.

---

## Conflicto Moral

Si la party:

* Ataca frecuentemente otras parties.
* Participa en asesinatos de aventureros.

Entonces:

* Se evalúa tensión moral.
* Algunos miembros pueden abandonar.

---

## Abandono

Si un miembro abandona:

* Se elimina de la party.
* Se genera un pool exclusivo para el jugador.
* Nuevo personaje mismo nivel base.
* No editable inicialmente.
* Solo mejorable jugando.

Esto evita explotación de builds perfectas.

---

# 3️⃣ SISTEMA DE BOUNTY

El bounty se activa cuando una party:

* Mata repetidamente otras parties.
* Acumula comportamiento agresivo.

---

## Efectos del Bounty

Cuando una party tiene bounty:

* Se publica recompensa en el gremio.
* Se convierte en objetivo prioritario para IA.
* Las parties pueden emboscarla con mayor probabilidad.
* Aumenta la dificultad de encuentros contra ella.

---

## Recompensa

Si una party con bounty es derrotada:

* Los atacantes obtienen recompensa especial.
* Se reduce parcialmente el riesgo social.

---

## Historial Permanente

* El historial de violencia es permanente en la seed.
* El bounty NO desaparece con el tiempo.
* No existe redención automática.

La reputación define cómo el mundo te trata.

---

# 4️⃣ IA Y BOUNTY

La IA evalúa:

* Si atacar a una party con bounty es rentable.
* Si evitarla reduce riesgo.
* Si formar alianza conviene más que confrontar.

Esto crea comportamiento político emergente.

---

# 5️⃣ IMPACTO EN EL SISTEMA

Este módulo introduce:

* Dinámicas sociales.
* Consecuencias internas.
* Riesgo reputacional.
* Política entre parties.

El jugador debe considerar no solo poder, sino impacto social.

---

# FIN – MÓDULO IA MORAL Y BOUNTY
# 👥 TORRE – CREACIÓN DE PARTIES Y REGLAS DEL JUGADOR

---

# 1️⃣ CREACIÓN DE PARTIES

## Partido Inicial

El jugador:

* Crea su party desde cero.
* Usa reglas oficiales DnD 5e.
* Selecciona raza, clase, trasfondo y habilidades.
* No selecciona personajes preexistentes.

La construcción es libre pero limitada por reglas estructurales.

---

## Límite de Parties del Jugador

Máximo:

* 2 parties activas creadas por el jugador por seed.

Si crea una tercera:

* Se elimina permanentemente la party IA derivada más débil.

---

## Herencia de Nivel

Cuando el jugador crea una nueva party:

* Nivel máximo inicial = promedio de nivel de su party anterior.
* No puede superar ese valor.

Esto evita reinicios para ventaja injusta.

---

# 2️⃣ POOl DE AVENTUREROS EXCLUSIVO

Si un miembro abandona por conflicto moral:

* Se genera un aventurero nuevo.
* Mismo nivel base.
* No editable inicialmente.
* Solo mejora mediante progreso.

Este pool pertenece exclusivamente al jugador.

---

# 3️⃣ PROGRESIÓN DEL JUGADOR

El jugador progresa mediante:

* XP obtenida de monstruos.
* Derrotar jefes.
* Completar eventos.
* Exploración de pisos altos.

## Anti-Abuso

* No se gana XP por matar parties.
* No se gana ventaja por repetir monstruos.

---

# 4️⃣ DECISIONES DEL JUGADOR

En cada ciclo el jugador puede:

* Explorar.
* Descansar.
* Avanzar piso.
* Negociar alianzas.
* Atacar otras parties.
* Defenderse.

Cada acción consume tiempo y recursos.

---

# 5️⃣ MUERTE DE LA PARTY DEL JUGADOR

Si toda la party muere:

* Se termina el ciclo actual.
* Puede revivir miembros en el pueblo si tiene fondos.
* Si no puede pagar → muerte permanente.

El jugador no pierde la seed inmediatamente.

---

# 6️⃣ REINICIO DE PARTY ENTRE TEMPORADAS

Cuando la torre se cierra:

* El jugador puede crear una nueva party.
* La nueva party hereda nivel máximo previo limitado.
* Las parties anteriores pueden convertirse en IA.

Esto mantiene continuidad entre temporadas.

---

# 7️⃣ FILOSOFÍA DE DISEÑO

El jugador debe:

* Entender el sistema.
* Gestionar riesgo.
* Construir builds eficientes.
* Adaptarse al meta.

El sistema recompensa conocimiento profundo.

---

# FIN – MÓDULO PARTIES Y JUGADOR
# 🏛 TORRE – POLÍTICA, ALIANZAS Y GREMIO

---

# 1️⃣ EL GREMIO

El gremio es la entidad central que:

* Registra eventos de la torre.
* Gestiona bounties.
* Administra recompensas.
* Facilita alianzas.
* Publica el World Log.

El gremio NO tiene conocimiento absoluto.
Solo conoce información basada en:

* Reportes.
* Testimonios.
* Evidencia visible.

---

# 2️⃣ SISTEMA POLÍTICO ENTRE PARTIES

Las parties pueden interactuar políticamente mediante:

* Alianzas.
* Protección por pago.
* Acuerdos de no agresión.
* Intercambio de recursos.
* Traiciones indirectas (terminar contrato).

Esto crea estructura social emergente.

---

# 3️⃣ ALIANZAS

## Formación

Una alianza ocurre cuando:

* Una party paga protección a otra.
* Ambas aceptan términos.

Duración:

* Mientras el pago continúe.
* O hasta renegociación.

---

## Protección

El protector:

* Defiende al protegido si es atacado.
* Puede exigir mayor pago.
* Puede romper la protección al finalizar contrato.

No existe traición arbitraria.
La ruptura es contractual.

---

# 4️⃣ EXTORSIÓN ESTRATÉGICA

Una party poderosa puede:

* Exigir pago a cambio de protección.
* Ofrecer seguridad contra otras parties.

El jugador puede decidir:

* Pagar y preservar recursos.
* Rechazar y asumir riesgo.

Esto genera economía política dinámica.

---

# 5️⃣ BOUNTY Y POLÍTICA

Si una party tiene alto bounty:

* Es objetivo prioritario.
* Es más difícil conseguir aliados.
* Las IA evalúan riesgo antes de protegerla.

El historial de violencia es permanente.

---

# 6️⃣ NEGOCIACIÓN

La negociación ocurre en el pueblo.

Las partes pueden intercambiar:

* Oro.
* Materiales.
* Protección.
* Información.

El sistema puede simular acuerdos para IA automáticamente.

---

# 7️⃣ TRAICIÓN CONTROLADA

No existe traición libre dentro de alianza activa.

Pero si:

* El pago se detiene.

La alianza termina automáticamente.

Esto evita caos impredecible.

---

# 8️⃣ IMPACTO EN EL ECOSISTEMA

Este módulo permite:

* Bloques de poder.
* Diplomacia estratégica.
* Control territorial indirecto.
* Dominación económica.

La torre evoluciona como sociedad viva.

---

# FIN – MÓDULO POLÍTICA Y GREMIO
# ⚙ TORRE – ARQUITECTURA TÉCNICA Y MOTOR

---

# 1️⃣ STACK TECNOLÓGICO

## Aplicación

* React Native CLI
* TypeScript
* Arquitectura basada en módulos
* Estado gestionado con Redux Toolkit / Zustand (propuesta)

## Backend (Opcional Inicialmente Offline / Local First)

* Base de datos local (SQLite / Realm)
* Sin necesidad de servidor en MVP
* Sin dependencia online obligatoria

Esto permite:

* Juego completamente offline
* Simulación local rápida
* Menor complejidad inicial

---

# 2️⃣ MODELO DE DATOS PRINCIPAL

## Entities Principales

* Party
* Character
* Monster
* Floor
* Cycle
* Item
* Boss
* Bounty
* Alliance
* Guild

Cada entidad debe tener:

* ID único
* Seed asociada
* Estado actual
* Historial de eventos

---

# 3️⃣ ESTRUCTURA DE ESTADO GLOBAL

## GameState

Contiene:

* Current Seed
* Current Cycle
* Parties Activas
* IA Partys
* World Log
* Bounties
* Alliances
* Floor States

Debe ser persistente en almacenamiento local.

---

# 4️⃣ MOTOR DE SIMULACIÓN

El motor es el corazón del sistema.

Debe ejecutar:

* Simulación de IA por lotes
* Encuentros entre parties
* Progreso de ciclos
* Eventos dinámicos
* Resolución de combate abstracto

## Funcionamiento

Cuando el jugador avanza ciclo:

simulateWorld(playerCycle)

Se ejecuta:

1. Simulación IA hasta ese ciclo
2. Resolución de eventos pendientes
3. Actualización de posiciones
4. Generación del World Log

Todo en procesamiento síncrono local.

---

# 5️⃣ SIMULACIÓN IA – IMPLEMENTACIÓN

La IA debe funcionar como:

## Entrada

* Stats de la party
* Recursos disponibles
* Riesgo actual
* Piso actual
* Moral
* Bounty

## Salida

* Acción seleccionada
* Movimiento
* Decisión de combate
* Decisión de descanso

La lógica debe ser determinística con pseudo-random basado en seed.

Esto garantiza consistencia entre sesiones.

---

# 6️⃣ SISTEMA DE EVENTOS

Eventos se almacenan como:

Event {
type,
floor,
cycle,
involvedParties,
result,
}

Tipos:

* Combat
* BossKilled
* PartyEliminated
* AllianceFormed
* BountyIssued
* ItemFound

Eventos se agregan al World Log.

---

# 7️⃣ SISTEMA DE RENDER

UI debe reaccionar a cambios en:

* GameState
* Events
* Party Status
* Combat State

Evitar re-render innecesario.

Usar:

* Memoización
* Selectores optimizados
* Separación clara entre lógica y UI

---

# 8️⃣ PERFORMANCE OPTIMIZATION

Para 10 parties + simulación por ciclos:

* Simulación por lotes
* Cálculos matemáticos ligeros
* Sin loops infinitos
* Sin IA en tiempo real

Costo computacional bajo.

---

# 9️⃣ SEGURIDAD Y CONSISTENCIA

* Todo depende de la Seed
* Todo cálculo debe ser reproducible
* Evitar lógica basada en tiempo real externo

El sistema debe producir el mismo resultado con la misma entrada.

---

# ✅ RESULTADO

Esta arquitectura permite:

* Juego offline completo
* Simulación eficiente
* Escalabilidad futura
* Integración futura con servidor si se desea

---

# FIN – ARQUITECTURA TÉCNICA
# 🗄 TORRE – ARQUITECTURA DE DATOS

---

# 1️⃣ PRINCIPIO DE DISEÑO

* Todo es basado en Seed.
* Cada Seed contiene su propio ecosistema independiente.
* Datos no comparten progreso entre seeds.
* Estado persistente local (Offline First).

---

# 2️⃣ MODELO DE BASE DE DATOS

## TABLA: Seeds

Seed {
id,
createdAt,
difficulty,
status,
maxParties = 10,
currentCycle,
isLocked,
}

---

## TABLA: Parties

Party {
id,
seedId,
ownerType (player | ai),
ownerId,
name,
levelAvg,
goldBalance,
moralScore,
bountyLevel,
status (active | eliminated | retired),
currentFloor,
currentZone,
cycleProgress,
}

Índices recomendados:

* seedId
* ownerType
* status

---

## TABLA: Characters

Character {
id,
partyId,
name,
race,
class,
level,
xp,
stats,
alignment,
morale,
isAlive,
deathCount,
}

Stats puede almacenarse como JSON:

{
STR,
DEX,
CON,
INT,
WIS,
CHA
}

---

## TABLA: Items

Item {
id,
seedId,
ownerPartyId,
name,
type,
rarity,
equippedBy,
isUnique,
obtainedCycle,
}

---

## TABLA: Events

Event {
id,
seedId,
type,
floor,
cycle,
data,
timestamp,
}

Tipos:

* Combat
* BossKilled
* PartyEliminated
* AllianceCreated
* BountyIssued
* ItemLooted

---

## TABLA: Alliances

Alliance {
id,
seedId,
partyA,
partyB,
protectionFee,
expiresAtCycle,
status,
}

---

## TABLA: Bounties

Bounty {
id,
seedId,
targetPartyId,
issuedBy,
rewardAmount,
level,
isActive,
}

---

# 3️⃣ ESTADO GLOBAL EN APLICACIÓN

GameState {
currentSeed,
currentCycle,
parties,
events,
activeCombat,
worldLog,
}

Este estado:

* Se construye desde la DB.
* Se actualiza por el motor.
* Se guarda después de cada acción crítica.

---

# 4️⃣ PERSISTENCIA

## Estrategia

* SQLite / Realm
* Tabla por entidad
* Relaciones vía ID
* Transacciones cuando haya múltiples cambios

Guardar estado después de:

* Fin de ciclo
* Combate
* Muerte
* Formación de alianza
* Pago

---

# 5️⃣ SINCRONIZACIÓN DE SEED

Al cargar una seed:

1. Se lee Seeds
2. Se cargan Parties asociadas
3. Se cargan Characters
4. Se cargan Events
5. Se reconstruye GameState

El motor reconstruye el mundo desde datos persistidos.

---

# 6️⃣ ESCALABILIDAD FUTURA

Si algún día quieres backend online:

* Esta estructura ya es migrable
* Solo necesitas replicación de la base
* Sin cambiar el modelo

---

# ✅ RESULTADO

La arquitectura de datos está:

* Normalizada
* Escalable
* Compatible con offline
* Preparada para simulación determinística

---

# FIN – ARQUITECTURA DE DATOS
# 🧮 TORRE – MOTOR DE SIMULACIÓN Y ALGORITMOS MATEMÁTICOS

---

# 1️⃣ PRINCIPIO DEL MOTOR

El motor debe ser:

* Determinístico
* Basado en Seed
* Matemáticamente reproducible
* Computacionalmente ligero

Todo cálculo usa:

* Stats
* Nivel
* Modificadores
* Random basado en Seed

---

# 2️⃣ SISTEMA DE PROBABILIDAD

Se usa pseudo-random controlado:

function roll(seed, context) {
return deterministicRandom(seed + context)
}

Esto garantiza:

* Mismo input = mismo resultado
* Sin dependencia de tiempo real

---

# 3️⃣ CÁLCULO DE COMBATE

## Hit Chance

HitChance = (AttackModifier + ProficiencyBonus) - (EnemyArmorClass)

Clamp entre 5% y 95%.

Resultado:

if roll() <= HitChance → Hit
else → Miss

---

## Damage

Damage = WeaponBaseDamage + StatModifier + BonusDamage - Resistances

Si Critical:

Damage *= 2

---

## Turno

En cada turno:

1. Iniciativa se calcula con DEX + roll
2. Orden de acción
3. Ejecutar habilidades
4. Aplicar estados
5. Actualizar HP

---

# 4️⃣ CÁLCULO DE ENCUENTROS ENTRE PARTIES (ABSTRACTO)

Se usa fórmula de poder:

PartyPower = Σ(CharacterLevel * StatMultiplier * EquipmentFactor)

RiskFactor = PisoActual * EscaladoNocturno

ProbabilidadVictoria = PartyPower / (PartyPower + EnemyPower * RiskFactor)

Si roll() <= ProbabilidadVictoria:
Party gana
Else:
Party pierde

Esto se usa para IA vs IA.

---

# 5️⃣ IA – DECISIÓN MATEMÁTICA

La IA evalúa utilidad:

UtilityScore =
(ExpectedXP * WeightXP)

* (ExpectedLoot * WeightLoot)

- (Risk * WeightRisk)
- (ResourceCost * WeightCost)

La acción con mayor UtilityScore es seleccionada.

Esto evita decisiones aleatorias sin sentido.

---

# 6️⃣ XP CALCULATION

XP = BaseXP * (EnemyLevel / PlayerLevel)

Si enemigo ya fue derrotado antes:

XP *= 0.5

Si diferencia de nivel > 5:

XP = 0

Esto evita farm en pisos bajos.

---

# 7️⃣ BOUNTY SCALING

BountyRiskMultiplier = 1 + (BountyLevel * 0.2)

Entre más violencia acumulada:

* Más difícil escapar
* Más probable emboscada
* Más recompensa al derrotar

---

# 8️⃣ ECONOMÍA – REVIVIR

ReviveCost = BaseCost * CharacterLevel

Si personaje ha muerto múltiples veces:

ReviveCost *= (1 + DeathCount * 0.1)

Esto crea desgaste económico.

---

# 9️⃣ ESCALADO DE MONSTRUOS

MonsterStatsScale =
BaseStats * (1 + PisoActual * 0.05)

Exploración más profunda = enemigos más fuertes.

---

# 🔟 PERFORMANCE

Todas las fórmulas deben:

* Evitar loops pesados
* Evitar simulación por individuo innecesaria
* Usar cálculos vectorizados cuando sea posible

El motor debe poder simular 10 parties × 60 ciclos sin problema.

---

# ✅ RESULTADO

El sistema matemático ahora define:

* Combate
* IA
* XP
* Economía
* Escalado

Con reglas claras y reproducibles.

---

# FIN – MOTOR MATEMÁTICO
# 🗄 TORRE – MODELADO DETALLADO DE BASE DE DATOS

---

# 1️⃣ PRINCIPIOS DE DISEÑO

* Seed es el eje principal.
* Todo dato pertenece a una seed.
* Arquitectura relacional con claves foráneas.
* Índices para consultas frecuentes.
* Optimizado para simulación local.

---

# 2️⃣ RELACIONES PRINCIPALES

Seed 1 ─── N Party
Seed 1 ─── N Event
Seed 1 ─── N Item
Seed 1 ─── N Bounty
Seed 1 ─── N Alliance

Party 1 ─── N Characters
Party 1 ─── N Items (equipados o almacenados)
Party 1 ─── N Events (participación)

Character 1 ─── N DeathRecords (opcional expansión futura)

---

# 3️⃣ TABLAS PRINCIPALES

====================================================
TABLE: Seeds
============

* id (PK)
* createdAt
* difficulty
* status (active | locked | finished)
* maxParties
* currentCycle
* isLocked

Índices:

* id
* status

---

====================================================
TABLE: Parties
==============

* id (PK)
* seedId (FK)
* ownerType (player | ai)
* ownerId
* name
* levelAvg
* goldBalance
* moralScore
* bountyLevel
* status (active | eliminated | retired)
* currentFloor
* currentZone
* cycleProgress
* createdAt

Índices:

* seedId
* ownerType
* status
* bountyLevel

---

====================================================
TABLE: Characters
=================

* id (PK)
* partyId (FK)
* name
* race
* class
* level
* xp
* stats (JSON)
* alignment
* morale
* isAlive
* deathCount
* createdAt

Índices:

* partyId
* level
* isAlive

---

====================================================
TABLE: Items
============

* id (PK)
* seedId (FK)
* ownerPartyId (FK nullable)
* equippedBy (characterId nullable)
* name
* type
* rarity
* isUnique
* obtainedCycle
* isEquipped
* createdAt

Índices:

* seedId
* ownerPartyId
* equippedBy
* rarity

---

====================================================
TABLE: Events
=============

* id (PK)
* seedId (FK)
* type
* floor
* zone
* cycle
* involvedParties (JSON array)
* result (JSON)
* createdAt

Índices:

* seedId
* cycle
* floor
* type

---

====================================================
TABLE: Alliances
================

* id (PK)
* seedId (FK)
* partyA
* partyB
* protectionFee
* expiresAtCycle
* status (active | expired | broken)
* createdAt

Índices:

* seedId
* partyA
* partyB
* status

---

====================================================
TABLE: Bounties
===============

* id (PK)
* seedId (FK)
* targetPartyId
* issuedBy
* rewardAmount
* level
* isActive
* createdAt

Índices:

* seedId
* targetPartyId
* isActive

---

# 4️⃣ TABLAS OPCIONALES (ESCALABILIDAD FUTURA)

## Reputation

* id
* seedId
* partyId
* reputationScore

## GuildLogs

* id
* seedId
* message
* cycle

---

# 5️⃣ OPTIMIZACIÓN

Recomendaciones:

* Usar UUID como PK.
* Indexar campos usados en filtros frecuentes.
* Evitar joins pesados en runtime.
* Cargar datos por seed únicamente.

---

# ✅ RESULTADO

Base de datos completamente normalizada.
Relaciones claras.
Escalable.
Preparada para simulación determinística.

---

# FIN – MODELADO DETALLADO
# 🧮 TORRE – FÓRMULAS MATEMÁTICAS EXACTAS DEL MOTOR

---

# 1️⃣ PRINCIPIOS GENERALES

Todas las fórmulas deben:

* Ser determinísticas.
* Usar seed como fuente de random.
* Evitar explosión exponencial.
* Tener límites (clamps).

Formato:

Result = Clamp(Fórmula, Min, Max)

---

# 2️⃣ SISTEMA DE HIT (ACIERTO EN COMBATE)

HitChance = BaseAccuracy
+ (AttackerAttackStat × 0.5)
+ ProficiencyBonus
- (TargetDefenseStat × 0.4)

HitChance = Clamp(HitChance, 5%, 95%)

Resultado:

roll = Random(seed)

If roll <= HitChance → HIT
Else → MISS

---

# 3️⃣ DAÑO EXACTO

DamageRaw = WeaponBaseDamage
+ (AttackerMainStat × 1.2)
+ BonusDamage

DamageAfterDefense = DamageRaw - (TargetArmor × 0.3)

DamageFinal = Max(DamageAfterDefense, 1)

CRIT:

If CriticalHit:
DamageFinal *= 2

Si el enemigo tiene resistencia:

DamageFinal *= 0.5

Si tiene vulnerabilidad:

DamageFinal *= 1.5

---

# 4️⃣ INICIATIVA

InitiativeScore = Dexterity
+ Random(seed)

Orden = SortDescending(InitiativeScore)

---

# 5️⃣ XP EXACTA

BaseXP = EnemyLevel × 50

LevelDifference = PlayerLevel - EnemyLevel

If EnemyAlreadyDefeated:
XP = BaseXP × 0.5

If LevelDifference > 5:
XP = 0

Else:
XP = BaseXP × (1 + (EnemyLevel / PlayerLevel))

Clamp mínimo 10 XP.

---

# 6️⃣ XP POR PISO

FloorMultiplier = 1 + (FloorNumber × 0.05)

FinalXP = XP × FloorMultiplier

Esto incentiva explorar pisos altos.

---

# 7️⃣ ESCALADO DE MONSTRUOS

MonsterHP = BaseHP × (1 + FloorNumber × 0.07)
MonsterDamage = BaseDamage × (1 + FloorNumber × 0.05)

Esto hace que cada piso aumente dificultad progresivamente.

---

# 8️⃣ BOUNTY SCALING

BountyThreatLevel = PartyViolenceScore × 0.3

BountyMultiplier = 1 + (BountyThreatLevel × 0.2)

Impacto:

* Mayor probabilidad de emboscada.
* IA prioriza atacar esa party.
* Recompensa aumenta proporcionalmente.

---

# 9️⃣ REVIVIR COSTO

ReviveBaseCost = 100

ReviveCost = ReviveBaseCost × CharacterLevel

If DeathCount > 0:
ReviveCost *= (1 + DeathCount × 0.15)

Esto genera desgaste económico.

---

# 🔟 PROBABILIDAD DE ENCUENTRO ENTRE PARTIES

EncounterChance = BaseEncounter (10%)
+ (PartyNoiseLevel × 0.2)
+ (FloorDensity × 0.1)

Clamp entre 5% y 60%.

Si roll <= EncounterChance → Se activa evento.

---

# ✅ RESULTADO

Con estas fórmulas:

* El sistema es balanceable.
* El progreso es escalable.
* El riesgo aumenta con profundidad.
* El abuso está limitado matemáticamente.

---

# FIN – FÓRMULAS DEL MOTOR
# 🤖 TORRE – ALGORITMO DETALLADO DE SIMULACIÓN IA

---

# 1️⃣ PRINCIPIO GENERAL

La simulación IA debe ser:

* Determinística
* Ejecutada por lotes
* Basada en estadísticas
* Sin cálculo en tiempo real continuo
* Dependiente de Seed

Se ejecuta cuando:

* El jugador avanza ciclo
* Se termina la temporada
* Se requiere sincronización de estado

---

# 2️⃣ ESTRUCTURA GENERAL DEL ALGORITMO

function simulateAllAI(seed, targetCycle):

for each party where ownerType == 'ai' and seed == seed:
simulateParty(party, targetCycle)

return updatedState

---

# 3️⃣ SIMULACIÓN DE UNA PARTY IA

function simulateParty(party, targetCycle):

while party.cycleProgress < targetCycle:

```
  evaluateState(party)
  decideAction(party)
  executeAction(party)
  updateCycle(party)
```

---

# 4️⃣ EVALUACIÓN DE ESTADO

La IA calcula variables internas:

* PowerScore
* ResourceLevel
* RiskLevel
* MoralPressure
* BountyThreat
* FloorDanger

PowerScore = Σ(CharacterLevel × StatWeight × EquipmentFactor)

RiskLevel = PisoActual × 0.05

Si Bounty activo:
RiskLevel += BountyMultiplier

---

# 5️⃣ TOMA DE DECISIÓN (DECISION ENGINE)

Se calculan utilidades para cada acción posible:

Actions = [
Explore,
FightMonster,
HuntParty,
AvoidCombat,
Rest,
AdvanceFloor
]

Para cada acción:

UtilityScore =
(ExpectedReward × WeightReward)

* (ExpectedRisk × WeightRisk)
* (ResourceCost × WeightCost)

- (StrategicValue × WeightStrategic)

La acción con mayor UtilityScore se selecciona.

Randomness controlado por seed rompe empates.

---

# 6️⃣ EJECUCIÓN DE ACCIÓN

## Explore

* Mueve party a nueva zona.
* Puede revelar eventos.
* Puede activar encuentro.

## FightMonster

* Ejecuta combate abstracto o táctico.
* Calcula probabilidad victoria.
* Si gana → obtiene XP y loot.
* Si pierde → pierde miembros.

## HuntParty

* Evalúa cercanía de parties rivales.
* Calcula probabilidad de éxito.
* Si riesgo alto y recompensa baja → no ejecuta.

## Rest

* Recupera recursos.
* Avanza ciclo.

## AdvanceFloor

* Solo si portal encontrado.
* Verifica condiciones.

---

# 7️⃣ SIMULACIÓN DE ENCUENTRO ENTRE PARTIES IA

Si dos parties coinciden:

PowerA = PartyA.PowerScore
PowerB = PartyB.PowerScore

ProbabilityAWin = PowerA / (PowerA + PowerB)

roll = Random(seed)

Si roll <= ProbabilityAWin:
PartyA gana
Else:
PartyB gana

Actualizar estado:

* Perdedor pierde miembros
* Ganador obtiene loot parcial
* Posible aumento de bounty

---

# 8️⃣ SIMULACIÓN DE MUERTE ECONÓMICA

Si party no tiene fondos para revivir:

* Marcar como eliminated
* Registrar evento
* Si slots disponibles → generar nueva IA nivel 1

Esto mantiene población constante.

---

# 9️⃣ OPTIMIZACIÓN

Para evitar costo alto:

* Simular solo hasta targetCycle
* No recalcular ciclos ya procesados
* Guardar checkpoints de simulación

Checkpoint:

PartyStateSnapshot por ciclo

---

# ✅ RESULTADO

Este algoritmo permite:

* Simulación eficiente
* IA competitiva
* Ecosistema dinámico
* Bajo consumo computacional

---

# FIN – ALGORITMO IA
# 🤖 TORRE – IA AVANZADA Y MENOS PREDECIBLE

---

# 1️⃣ PROBLEMA DEL MODELO ACTUAL

La IA actual:

* Es determinística.
* Sigue utilidad matemática directa.
* Puede volverse predecible.

Necesitamos introducir:

* Variabilidad estratégica.
* Adaptación histórica.
* Comportamiento evolutivo.
* Sesgo dinámico.

Sin romper rendimiento.

---

# 2️⃣ LAYER DE INTELIGENCIA – NUEVA ARQUITECTURA

La IA ahora tiene 4 capas:

---

Capa 1 – Evaluación Estadística
Capa 2 – Memoria Histórica
Capa 3 – Perfil Estratégico
Capa 4 – Ruido Controlado
-------------------------

La decisión final = Resultado combinado de las 4 capas.

---

# 3️⃣ MEMORIA HISTÓRICA (CLAVE)

Cada party IA guarda:

* Últimos 20 ciclos de decisiones.
* Últimos 10 combates.
* Historial de victorias / derrotas.
* Tendencias de enemigos encontrados.

Se almacena como:

MemoryState {
aggressionScore,
survivalRate,
preferredActions,
enemyPatterns,
}

---

# 4️⃣ ADAPTACIÓN DINÁMICA

Si la IA pierde frecuentemente combates:

→ Aumenta su peso hacia:

* AvoidCombat
* Rest
* DefensivePlay

Si gana frecuentemente:

→ Aumenta peso hacia:

* HuntParty
* AggressiveAdvance

Esto genera evolución natural.

---

# 5️⃣ PERFIL ESTRATÉGICO

Cada party IA tiene un perfil base generado al inicio:

Profiles:

* Aggressive
* Defensive
* Opportunistic
* Expansionist
* Survivalist

Perfil afecta los pesos en UtilityScore.

Ejemplo:

Aggressive:
WeightHunt += 30%
WeightRest -= 20%

Esto evita decisiones homogéneas.

---

# 6️⃣ RUIDO CONTROLADO (NO RANDOM CAÓTICO)

Se introduce variación pequeña:

StrategyNoise = Random(seed + cycle) × 0.1

Se aplica al UtilityScore:

FinalUtility = BaseUtility × (1 + StrategyNoise)

Esto hace que:

* Dos simulaciones iguales puedan variar ligeramente.
* La IA no sea completamente predecible.

Pero sigue siendo determinística.

---

# 7️⃣ ANTICIPACIÓN DE JUGADOR

La IA puede detectar patrones:

Si jugador:

* Siempre explora de noche.
* Siempre usa cierta clase de composición.
* Siempre prioriza bosses.

Entonces IA puede:

* Cambiar ruta.
* Evitar confrontación directa.
* Tender emboscadas.

Esto se logra analizando el historial del jugador en la seed.

---

# 8️⃣ SISTEMA DE CAMBIO DE META

Cada 10 ciclos:

Se recalcula metaSeedTrend:

* Qué estrategias dominan.
* Qué clases están fuertes.
* Qué tácticas funcionan más.

IA ajusta su comportamiento base ligeramente.

Esto crea evolución estratégica entre temporadas.

---

# 🔬 SISTEMA DE COMPORTAMIENTO EMERGENTE

---

# 🚀 SISTEMA DE EVOLUCIÓN CULTURAL

Las parties IA pueden observar y copiar estrategias exitosas de otras parties dentro de la misma seed.

## 1️⃣ Observación Global

Cada ciclo, la IA evalúa:

* Qué parties tuvieron mayor éxito.
* Qué tácticas usaron.
* Qué composición de equipo tenían.
* Qué rutas tomaron.

Se calcula un CulturalSuccessScore por estrategia observada.

---

## 2️⃣ Proceso de Copia

Si una estrategia externa supera un umbral de rendimiento:

→ La IA adopta parcialmente esa estrategia.
→ Se ajustan sus pesos internos.
→ Se actualiza su perfil estratégico.

No copia todo.
Solo copia un porcentaje.

---

## 3️⃣ Difusión Estratégica

Cuando varias parties adoptan la misma estrategia:

* Se convierte en tendencia dominante.
* El sistema la marca como MetaActual.

Después de cierto tiempo:

* La estrategia pierde efectividad.
* Se genera contra-meta.

Esto crea ciclos estratégicos dinámicos.

---

# 🧬 SISTEMA DE MUTACIÓN ESTRATÉGICA

Cada cierto número de ciclos (ej: cada 15 ciclos):

Algunas IA seleccionadas aleatoriamente experimentan mutación.

## 1️⃣ Cómo Funciona

MutationFactor = Random(seed + cycle) × 0.1

La mutación puede:

* Modificar el perfil estratégico.
* Ajustar pesos de utilidad.
* Cambiar prioridad de acciones.
* Alterar agresividad.

Pero con límites para evitar caos total.

---

## 2️⃣ Selección de IA para Mutar

No todas mutan.

Se seleccionan:

* Las con bajo rendimiento.
* Las con alta variabilidad.
* Un pequeño porcentaje aleatorio.

Esto evita convergencia total del ecosistema.

---

## 3️⃣ Beneficio

La mutación introduce:

✔ Innovación estratégica
✔ Variabilidad
✔ Adaptación a nuevas metas
✔ Ruptura de metas dominantes

---

# 🔬 SISTEMA DE COMPORTAMIENTO EMERGENTE

La IA ahora no solo adapta pesos, sino que aprende patrones estructurales.

## 1️⃣ Aprendizaje por Eventos

Cada vez que ocurre un evento relevante:

* Combate
* Derrota
* Emboscada
* Traición
* Alianza

Se analiza:

* Qué acción tomó la IA
* Qué resultado obtuvo
* Qué riesgo asumió

Se calcula un Score de Eficiencia:

EfficiencyScore = Reward / RiskCost

Ese valor se guarda en memoria.

---

## 2️⃣ Refuerzo de Estrategias

Si una acción produce alto EfficiencyScore repetidamente:

→ Aumenta su peso estratégico permanentemente.

Si una acción produce pérdidas constantes:

→ Se reduce su prioridad.

Esto genera aprendizaje acumulativo.

---

## 3️⃣ Copia de Comportamiento (Meta-Observación)

La IA observa otras parties.

Si detecta que una estrategia externa tiene:

* Alta tasa de victoria
* Bajo riesgo
* Alto rendimiento

Entonces puede copiar parcialmente ese patrón.

Esto simula evolución cultural.

---

## 4️⃣ Mutación Controlada

Cada 15 ciclos:

Existe una pequeña probabilidad de mutación estratégica:

MutationFactor = Random(seed) × 0.05

Esto puede:

* Ajustar perfiles
* Cambiar prioridades
* Introducir nuevas tácticas

Pero sin romper estabilidad.

---

# 9️⃣ RESULTADO

Con comportamiento emergente:

✔ IA aprende
✔ IA adapta estrategias exitosas
✔ IA evoluciona dentro de la seed
✔ Ecosistema dinámico real

---

# FIN – IA AVANZADA
