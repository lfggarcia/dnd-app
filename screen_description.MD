# UI / UX Diseño Completo – Tower RPG

Este documento define todas las interfaces principales del juego para implementación en React Native CLI.

---

# 1. PRINCIPIOS DE DISEÑO

Objetivos:

* Interfaz clara en móvil
* Navegación rápida
* Información crítica visible
* Estética dark fantasy

Reglas:

* Máximo 3 niveles de navegación
* Botones grandes
* Texto legible

---

# 2. MAIN MENU

Elementos:

Logo del juego

Botones:

Continue
New Seed
Load Seed
Settings
Credits

Diseño:

Fondo: torre oscura
Animación leve de niebla

---

# 3. SEED CREATION

Campos:

Seed Name
Difficulty (fixed cruel)
Create Party

Botón:

Start Expedition

---

# 4. PARTY CREATION

Pantalla estilo panel RPG.

Columnas:

Lista de personajes
Editor de personaje

Datos configurables:

Race
Class
Background
Stats
Portrait

Botón:

Add Character
Remove Character

Máximo 4 miembros.

---

# 5. VILLAGE HUB

Vista central del pueblo.

Edificios interactivos:

Guild
Market
Blacksmith
Armory
Inn
Church

Cada edificio es un botón grande.

Parte superior:

Oro actual
Día actual

---

# 6. GUILD SCREEN

Opciones:

View Rankings
Recruit
Bounties
World Log

Panel lateral con noticias.

---

# 7. TOWER MAP

Mapa tipo grafo.

Nodo actual resaltado.

Tipos de nodo:

Combat
Event
Safe Zone
Boss
Unknown

Botones:

Explore Node
Return

---

# 8. COMBAT SCREEN

Layout dividido.

Parte superior:

Retratos enemigos

Centro:

Ilustración del combate

Parte inferior:

Barra de acciones

Botones:

Attack
Spell
Item
Move
Defend

Panel lateral:

Log de combate

---

# 9. CHARACTER PANEL

Se abre al tocar retrato.

Tabs:

Stats
Inventory
Skills
Traits

---

# 10. INVENTORY

Sistema por slots.

Grid:

5 x 6 slots

Stack máximo configurable.

---

# 11. WORLD LOG

Pantalla de eventos globales.

Lista cronológica:

Party defeated
Boss killed
Alliance formed
Bounty issued

---

# 12. DAY NIGHT TRANSITION

Animación breve.

Texto grande:

DAY -> NIGHT

Mostrar resumen de eventos.

---

# 13. BOUNTY BOARD

Lista de objetivos.

Datos:

Party name
Reward
Reason

---

# 14. ALLIANCE SCREEN

Opciones:

Offer alliance
Request protection
Pay tribute

---

# 15. SAFE ZONE CAMP

Opciones:

Short Rest
Long Rest
Cook Food
Repair Gear

---

# 16. BOSS ROOM UI

Entrada especial.

Mostrar:

Boss illustration
Warning message
Party readiness

Botón:

Enter Boss Room

---

# 17. RANKING SCREEN

Leaderboard de la temporada.

Columnas:

Party Name
Floor Reached
Members Alive
Bosses Killed

---

# 18. GAME OVER SCREEN

Texto:

Your party failed to conquer the tower.

Opciones:

Start New Season
View Tower History

---

# 19. SETTINGS

Audio
Graphics
Text Speed
Accessibility

---

# 20. FUTURE UI EXPANSION

El diseño debe permitir añadir:

Crafting
Guild Upgrades
Tower Events
Faction Politics

Arquitectura recomendada:

Componentes reutilizables.

Button
Panel
Card
Modal
Grid

Esto permitirá escalar la UI sin rehacer pantallas.
