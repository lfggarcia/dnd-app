# Sistema de Evolución de Monstruos y Balance de Progresión

Este sistema define cómo los monstruos evolucionan con los ciclos de la torre sin romper el balance del juego ni permitir XP infinita.

---

# 1. Evolución de Monstruos por Ciclos

Los monstruos no aumentan en cantidad con los ciclos.

En su lugar se aplica un sistema de **Evolución Sustitutiva**.

Los enemigos se reemplazan por versiones más avanzadas con el paso de los ciclos.

Ejemplo:

Ciclo 1

Goblin  
Goblin  
Goblin  
Rat  
Rat

Ciclo 5

Goblin Veteran  
Goblin Raider  
Rat  
Rat

Ciclo 10

Goblin Champion  
Goblin Shaman  
Dire Rat

La cantidad de encuentros permanece estable.

Solo cambia:

- tipo de enemigo
- dificultad
- comportamiento

---

# 2. Fórmula de Evolución

La evolución se calcula usando el ciclo global de la torre.

evolutionTier = floor(currentCycle / 5)

Ejemplo:

Ciclo 1 → Tier 0  
Ciclo 5 → Tier 1  
Ciclo 10 → Tier 2  
Ciclo 15 → Tier 3  

Luego se aplica a los monstruos base:

monsterTier = baseTier + evolutionTier


---

# 3. Límite por Piso

Para evitar monstruos absurdos en pisos bajos se define un límite por piso.

maxTier = floorNumber / 10

Ejemplo:

Piso 8 → maxTier 0  
Piso 30 → maxTier 3

El tier final del enemigo será:

finalTier = min(monsterTier, maxTier)

---

# 4. Sistema de XP para evitar grind infinito

Los monstruos solo dan XP completa la primera vez que se derrotan.

Sistema:

Primera vez

XP = 100%

Segunda vez

XP = 30%

Tercera vez

XP = 10%

Cuarta vez en adelante

XP = 0

Los monstruos siguen soltando loot aunque ya no otorguen experiencia.

Esto evita el grindeo infinito.

---

# 5. Variaciones sin crear sprites nuevos

Las variaciones de enemigos no requieren sprites nuevos.

Se usan modificadores visuales.

Ejemplos:

Goblin normal

sprite: goblin_base

Goblin de fuego

sprite: goblin_base  
overlay: fire_shader

Goblin venenoso

sprite: goblin_base  
overlay: poison_shader

Goblin elite

sprite: goblin_base  
scale: 1.2  
glow: red

Esto permite generar muchas variantes visuales usando pocos assets.

La implementación se realiza usando **React Native Skia**.

---

# 6. Sistema de Bosses Secretos

Los bosses secretos no aparecen aleatoriamente.

Se activan mediante combinaciones específicas de eventos.

Estos bosses nunca reemplazan al jefe del piso.

Se activan mediante portales ocultos o eventos especiales.

---

# 7. Ejemplo de Trigger de Boss Secreto

Boss: The Forgotten Lich

Condiciones:

- matar 30 skeletons
- no usar fuego contra undead
- alcanzar piso 20

Si las condiciones se cumplen:

Se abre un portal secreto.

---

# 8. Ejemplo adicional

Boss: Goblin Emperor

Condiciones:

- matar Goblin King
- matar Goblin Champion
- permitir que una party goblin sobreviva múltiples ciclos

Evento generado:

Goblin Empire invasion

---

# 9. Reglas de diseño de Bosses Secretos

Los bosses secretos deben cumplir las siguientes reglas:

- ser raros
- no dar XP exagerada
- dar loot único
- no ser necesarios para ganar la torre

Esto mantiene el balance del juego.

---

# 10. Impacto en el World Log

Cuando un boss secreto es derrotado el evento se registra en el World Log.

Ejemplo:

"Una presencia antigua fue derrotada en lo profundo de la torre."

Las otras parties pueden reaccionar a este evento.