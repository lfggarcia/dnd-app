# Dungeon Graph Generator

Este sistema genera la **estructura de salas de cada piso** de la torre.

El mapa se modela como un **grafo dirigido acíclico (DAG)** para evitar loops infinitos y garantizar progresión hacia el jefe.

El objetivo del algoritmo es generar mapas que se sientan:

* coherentes
* explorables
* variados
* justos

---

# 1. Parámetros del generador

Cada piso define:

```
minRooms = 12
maxRooms = 20

minBranches = 2
maxBranches = 4

maxDepth = 6
```

Esto evita:

* pisos demasiado cortos
* mapas excesivamente complejos
* caminos infinitos

---

# 2. Estructura del piso

Cada piso tiene:

```
Floor
 ├ seed
 ├ floorIndex
 ├ rooms[]
 ├ connections[]
 └ bossRoomId
```

Cada sala:

```
Room
 ├ id
 ├ type
 ├ connections[]
 ├ discovered
 ├ mutated
```

---

# 3. Tipos de sala

```
START
NORMAL
ELITE
TREASURE
EVENT
BOSS
SECRET
```

Reglas importantes:

```
START = 1
BOSS = 1
ELITE = 1–3
TREASURE = 1–2
EVENT = 1–2
SECRET = 0–3
```

El resto son `NORMAL`.

---

# 4. Paso 1 — Generar número de salas

```
rooms = RNG(seed + floorIndex)

totalRooms = clamp(
    rooms % maxRooms,
    minRooms,
    maxRooms
)
```

Resultado típico:

```
14
17
19
12
```

---

# 5. Paso 2 — Crear sala inicial

Siempre existe una sala inicial.

```
startRoom = createRoom(type = START)
```

Esta sala representa:

```
portal de entrada
zona segura
```

---

# 6. Paso 3 — Generar ramas principales

El dungeon se genera con **ramas principales**.

Ejemplo:

```
Start
  |
 / \
A   B
|   |
C   D
 \ /
  Boss
```

Algoritmo:

```
branchCount = RNG(seed) % maxBranches
branchCount = clamp(branchCount, minBranches, maxBranches)
```

Cada rama genera una cadena de salas.

---

# 7. Paso 4 — Generar profundidad de ramas

Cada rama tiene una profundidad distinta.

```
branchDepth = RNG(seed + branchIndex)

depth = clamp(
    branchDepth % maxDepth,
    3,
    maxDepth
)
```

Ejemplo:

```
Branch A -> 5 salas
Branch B -> 3 salas
Branch C -> 6 salas
```

---

# 8. Paso 5 — Generar conexiones

Cada sala se conecta con la siguiente en la rama.

```
Start
 |
Room1
 |
Room2
 |
Room3
```

Después se agregan **conexiones laterales**.

Ejemplo:

```
Room2 -> Room5
Room3 -> Room6
```

Esto genera **atajos y decisiones tácticas**.

Probabilidad:

```
sideConnectionChance = 25%
```

---

# 9. Paso 6 — Selección de Boss Room

El jefe siempre se ubica en:

```
la sala más profunda del grafo
```

Algoritmo:

```
bossRoom = roomWithMaxDepth()
bossRoom.type = BOSS
```

Esto garantiza:

* exploración previa
* dificultad creciente

---

# 10. Paso 7 — Distribución de salas especiales

Se asignan tipos especiales.

Algoritmo:

```
shuffle(roomsWithoutStartAndBoss)

assignEliteRooms(1-3)
assignTreasureRooms(1-2)
assignEventRooms(1-2)
```

Reglas:

```
no poner treasure junto a start
no poner elite antes de depth 2
no poner event antes de depth 1
```

Esto evita dificultad injusta.

---

# 11. Paso 8 — Generación de salas secretas

Las salas secretas **no pertenecen al grafo principal**.

Se conectan mediante puertas ocultas.

```
secretRoomCount = RNG(seed + floorIndex) % 4
```

Resultado:

```
0
1
2
3
```

Creación:

```
secretRoom = createRoom(type = SECRET)

connectHidden(
    randomNormalRoom,
    secretRoom
)
```

Las conexiones ocultas no aparecen en el mapa.

---

# 12. Visualización del grafo

Ejemplo generado:

```
        [Treasure]
           |
[Start]--[Room]--[Elite]
           |
        [Room]
           |
        [Boss]
```

Salas secretas:

```
        [Treasure]
           |
[Start]--[Room]--[Elite]
           |
        [Room]
           |
        [Boss]

            |
        [Secret]
```

---

# 13. Persistencia del Layout

El layout se guarda:

```
seed
floorIndex
roomGraph
```

Esto permite:

```
mismo mapa entre ciclos
misma posición de salas
misma estructura
```

Pero el contenido puede cambiar.

---

# 14. Integración con el sistema de mutaciones

Las mutaciones afectan:

```
enemy type
enemy quantity
room modifiers
traps
elite chance
```

No afectan:

```
room connections
room positions
boss location
```

Esto mantiene **consistencia mental del jugador**.

---

# 15. Flujo completo del generador

```
generateFloor(seed, floorIndex)

createStartRoom()

generateBranches()

generateRooms()

connectRooms()

placeBossRoom()

assignSpecialRooms()

generateSecretRooms()

saveGraph()
```

---

# 16. Objetivo de diseño

Este generador busca crear mapas que:

```
se sientan únicos
tengan decisiones tácticas
premien exploración
permitan rutas alternativas
mantengan coherencia entre ciclos
```

Inspiraciones del sistema:

```
Hades
Slay the Spire
Darkest Dungeon
Path of Exile
```

---
