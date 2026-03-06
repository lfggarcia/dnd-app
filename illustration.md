# Sistema de Sprites 2D con Nano Banana + React Native Skia

Este documento describe la arquitectura para generar y renderizar sprites dinámicos para enemigos en un dungeon crawler usando:

* **Nano Banana** para generación de sprites
* **React Native Skia** para renderizado GPU
* **Sprite Sheets** para animaciones
* Generación automática **cuando se carga un piso**

---

# 1. Arquitectura General

Cuando el jugador entra a un piso:

```
enterFloor()
   │
   ├─ generar enemigos del piso
   │
   ├─ verificar si cada enemigo tiene sprites
   │
   ├─ si no existen → generarlos con Nano Banana
   │
   └─ cargar sprites en memoria
```

Resultado:

```
combate instantáneo
sin generación de imágenes durante el combate
```

---

# 2. Dependencias del Motor 2D

Librerías principales:

* React Native
* React Native Skia
* almacenamiento de sprites
* API de generación Nano Banana

React Native Skia permite:

* renderizado GPU
* animaciones suaves
* mejor rendimiento que Image/View

---

# 3. Interfaces del Sistema

```ts
/**
 * Tipos de enemigos del juego
 */
export type EnemyType =
  | "skeleton"
  | "cultist"
  | "rat"
  | "knight"
  | "demon"

/**
 * Set de sprites requeridos
 */
export interface SpriteSet {
  idle: string
  run: string
  attack: string
  damage: string
  death: string
}
```

---

# 4. Generador de Sprites con Nano Banana

Este servicio genera sprites solo si no existen en cache.

```ts
export async function generateEnemySprites(enemy: EnemyType): Promise<SpriteSet> {

  const cached = await spriteStorage.get(enemy)

  if (cached) {
    return cached
  }

  // Generar sprite base
  const baseSprite = await nanoBanana.generate({
    prompt: `
      brutal dungeon monster
      dark fantasy creature
      dnd inspired enemy
      gritty dungeon crawler style
      full body character sprite
      neutral pose
    `,
    size: "512x512"
  })

  const baseUrl = await storage.upload(baseSprite)

  const animations = [
    "idle",
    "run",
    "attack",
    "damage",
    "death"
  ]

  const spriteSet: Partial<SpriteSet> = {}

  for (const anim of animations) {

    const sprite = await nanoBanana.generate({
      prompt: `
        same character as reference image
        ${anim} combat animation pose
        dungeon rpg sprite frame
      `,
      referenceImage: baseUrl
    })

    spriteSet[anim] = await storage.upload(sprite)
  }

  await spriteStorage.save(enemy, spriteSet)

  return spriteSet as SpriteSet
}
```

---

# 5. Generación de Enemigos al Cargar el Piso

Los sprites se generan cuando se carga el piso, nunca durante combate.

```ts
export async function loadFloorEnemies(floorNumber: number) {

  const enemies: EnemyType[] = generateFloorEnemies(floorNumber)

  const enemyEntities = []

  for (const enemy of enemies) {

    const sprites = await generateEnemySprites(enemy)

    enemyEntities.push({
      type: enemy,
      sprites
    })
  }

  return enemyEntities
}
```

---

# 6. Render de Sprites con Skia

```tsx
import { Canvas, Image, useImage } from "@shopify/react-native-skia"

export function EnemySprite({ spriteUrl }) {

  const image = useImage(spriteUrl)

  return (
    <Canvas style={{ width: 128, height: 128 }}>
      {image && (
        <Image
          image={image}
          x={0}
          y={0}
          width={128}
          height={128}
        />
      )}
    </Canvas>
  )
}
```

---

# 7. Sistema de Animación de Sprites

Hook para manejar frames de animación.

```ts
import { useEffect, useState } from "react"

export function useSpriteAnimation(frameCount = 6, speed = 120) {

  const [frame, setFrame] = useState(0)

  useEffect(() => {

    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frameCount)
    }, speed)

    return () => clearInterval(interval)

  }, [])

  return frame
}
```

---

# 8. Render de Sprite Animado

Usando sprite sheets.

```tsx
export function AnimatedEnemy({ spriteSheet }) {

  const frame = useSpriteAnimation(6, 100)

  const image = useImage(spriteSheet)

  const frameWidth = 64
  const frameHeight = 64

  return (
    <Canvas style={{ width: frameWidth, height: frameHeight }}>
      {image && (
        <Image
          image={image}
          x={frame * frameWidth}
          y={0}
          width={frameWidth}
          height={frameHeight}
        />
      )}
    </Canvas>
  )
}
```

---

# 9. Flujo Completo del Sistema

```
player enters floor
        │
        ▼
generate enemies
        │
        ▼
check sprite cache
        │
        ▼
generate missing sprites (nano banana)
        │
        ▼
store sprites
        │
        ▼
load with skia
        │
        ▼
combat ready
```

---

# 10. Reglas de Optimización

Nunca generar sprites durante combate.

Generación solo en:

```
fase de carga del piso
```

---

# 11. Estrategia de Escalado de Enemigos

Para evitar generar cientos de sprites:

Generar máximo:

```
20 tipos base de enemigos
```

Variar usando:

```
color variants
armor variants
weapon variants
size variants
```

Ejemplo:

```
Skeleton
Skeleton Archer
Skeleton Knight
Skeleton Mage
```

Todos usando el mismo sprite base.

---

# 12. Beneficios del Sistema

Ventajas:

* generación automática de contenido
* bajo costo de assets
* escalabilidad infinita
* combate rápido
* bajo consumo de memoria

---

# 13. Extensión futura

Este sistema permite migrar en el futuro a:

* combate action RPG
* físicas más complejas
* animaciones avanzadas
* efectos visuales adicionales
