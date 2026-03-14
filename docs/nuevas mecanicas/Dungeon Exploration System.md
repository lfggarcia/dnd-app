# Dungeon Exploration System – Persistencia Parcial + Mutaciones

Este sistema define cómo funciona la exploración de pisos en la mazmorra utilizando **generación procedural determinística**, **persistencia de descubrimiento**, **mutaciones por ciclo** y **tiradas de percepción narrativas**.

El objetivo es mantener:

* coherencia entre incursiones
* sensación de progreso del jugador
* variación en dificultad y enemigos
* narrativa emergente mediante el narrador

---

# 1. Generación Procedural del Piso

Cada piso se genera de forma **determinística basada en seed**.

Esto garantiza que el layout sea siempre el mismo para una seed específica.

Ejemplo:

```
seed: "gods killers"

Floor 1 layout -> siempre igual
Floor 2 layout -> siempre igual
```

### Reglas

```
rooms_per_floor = RNG(seed + floorIndex)

min_rooms = 12
max_rooms = 20
```

Estructura del piso:

```
Floor
 ├─ seed
 ├─ floorIndex
 ├─ rooms (12–20)
 ├─ secretRooms (0–3)
 └─ layoutGraph
```

---

# 2. Layout del Mapa

El layout se genera como un **grafo de salas conectadas**.

Ejemplo visual simplificado:

```
[Start]
   |
[Room]--[Room]
   |
[Room]--[Boss]
```

Tipos de sala posibles:

```
START
NORMAL
ELITE
EVENT
TREASURE
BOSS
SECRET
```

---

# 3. Persistencia del Descubrimiento del Mapa (Modelo C)

El juego utiliza **persistencia parcial del mapa**.

Esto significa:

### Se conserva entre incursiones

```
room positions
room connections
boss room location
secret room entrances
```

### Puede cambiar entre ciclos

```
enemy types
enemy quantity
enemy variants
elite spawn
traps
room modifiers
mutations
```

---

# 4. Primer Descubrimiento del Piso

Cuando el jugador entra por primera vez:

El mapa inicia oculto.

```
[Start]
   |
 [?]
   |
 [?]
```

Las salas se revelan **solo cuando el jugador las visita**.

Ejemplo después de explorar:

```
[Start]
   |
[Room]--[Room]
   |
[Room]--[Boss]
```

---

# 5. Reentrada a un Piso Ya Explorado

Cuando una party vuelve a un piso ya explorado:

El mapa aparece descubierto.

```
[Start]
   |
[Room✓]--[Room✓]
   |
[Room✓]--[Boss✓]
```

Esto refleja **memoria del jugador y progreso del mundo**.

---

# 6. Sistema de Mutaciones por Ciclo

Los enemigos pueden cambiar entre ciclos.

Las mutaciones **no alteran el layout**, solo el contenido.

Ejemplo:

```
cycle = 1

Goblin
Skeleton
Slime
```

```
cycle = 4

Armored Goblin
Necrotic Skeleton
Acid Slime
```

Algoritmo base:

```
enemyTier = baseTier + cycleModifier
```

---

# 7. Detección de Mutaciones con Narrador

Cuando una party entra a un piso ya explorado:

```
if floorVisitedBefore
    checkMutation()
```

Si existe mutación:

Se ejecuta una **tirada de percepción grupal**.

```
perceptionRoll = d20 + partyPerception
```

Contra:

```
mutationDifficulty
```

---

## Resultado de la Tirada

### Éxito

El narrador advierte el cambio.

Ejemplo:

> "Entras al piso 3…
> pero algo se siente diferente.
> El aire es más denso que antes."

El mapa marca salas mutadas:

```
[Room✓⚠]
```

⚠ = posible cambio de enemigos.

---

### Fallo

No hay advertencia.

El jugador descubre el cambio durante el combate.

---

# 8. Sistema de Sigilo de Enemigos

Cada grupo enemigo tiene un valor:

```
enemyStealth
```

La party tiene:

```
partyPerception
darkvision
keenSenses
tracking
```

Se ejecuta:

```
perceptionRoll = d20 + perceptionBonus
```

Contra:

```
enemyStealth
```

---

### Resultado

Éxito:

El narrador revela información parcial.

Ejemplo:

> "Tu compañero tiefling percibe movimiento en la siguiente sala."

Revela:

```
enemyType
enemyCount (aproximado)
```

---

Fallo:

La sala parece segura.

El combate ocurre sin advertencia.

---

# 9. Salas Secretas

Cada piso genera:

```
secretRooms = RNG(seed + floorIndex) % 4
```

Resultado:

```
0–3 salas secretas
```

Características:

```
no aparecen en el mapa
no se revelan con buffs
no se muestran al revelar conexiones
```

Solo pueden descubrirse mediante:

```
perceptionRoll vs hiddenDoorDC
```

---

### Descubrimiento de sala secreta

Si la tirada es exitosa:

Narrador:

> "Notas una grieta en la pared…
> parece una puerta oculta."

Se revela:

```
[Secret Room]
```

---

# 10. Presentación Final del Mapa

Ejemplo de piso explorado con mutación detectada:

```
[Start]
   |
[Room✓]--[Room✓⚠]
   |
[Room✓]--[Boss✓]
```

Leyenda:

```
✓ = sala explorada previamente
⚠ = posible mutación detectada
```

---

# 11. Objetivos del Sistema

Este modelo permite:

* exploración persistente
* rejugabilidad mediante mutaciones
* narrativa emergente con el narrador
* coherencia entre seeds
* progresión sin frustración del jugador
* variación en cada ciclo

---

# 12. Resumen del Flujo

```
generateFloor(seed, floorIndex)

playerEnterFloor()

if firstVisit
    mapHidden()

if visitedBefore
    mapRevealed()

checkMutation()

perceptionCheck()

spawnEnemies()
```

---
