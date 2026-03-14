# ♿ Accesibilidad — Auditoría RN

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** Todas las pantallas (~23) y componentes  
> **Esfuerzo estimado:** 4–6 horas

---

## Resumen ejecutivo

La accesibilidad es el área con mayor deuda técnica relativa: se encontró exactamente **una propiedad de accesibilidad** en todo el codebase (`accessible={false}` en `SeedScreen.tsx` para descartar focus del fondo). No hay `accessibilityLabel`, `accessibilityRole` ni `accessibilityHint` en ningún componente ni pantalla. Para un juego con interfaz rica en botones, imágenes de personajes e información de combate, esto significa que VoiceOver/TalkBack produce una experiencia completamente inutilizable.

La mitigación es que TORRE es un juego de rol con interfaz táctil y visual, y la accesibilidad completa para juegos es un campo complejo. Sin embargo, los hallazgos básicos son de bajo esfuerzo y alto impacto.

---

## Hallazgos

### [ACC-001] Cero `accessibilityLabel` en componentes interactivos
**Archivos:** Todos los archivos en `src/screens/` y `src/components/`  
**Severidad:** 🟡 Media — VoiceOver/TalkBack anuncia "botón" sin contexto; un usuario con lector de pantalla no puede navegar la app

**Por qué es un problema:**
`TouchableOpacity` y `Pressable` sin `accessibilityLabel` hacen que el lector de pantalla diga genéricamente "botón" o lea el texto interior sin contexto. En BattleScreen, por ejemplo, el botón de ataque debería anunciarse como "Atacar a [enemigo]", no simplemente el texto del botón.

**Ejemplo de código actual (problema) — MainScreen.tsx:**
```tsx
<TouchableOpacity onPress={() => navigation.navigate('Party')}>
  <Text>NUEVA PARTIDA</Text>
  {/* ← Sin accessibilityLabel */}
</TouchableOpacity>
```

**Solución (ejemplo aplicable a todo el proyecto):**
```tsx
<TouchableOpacity
  onPress={() => navigation.navigate('Party')}
  accessibilityRole="button"
  accessibilityLabel="Nueva Partida"
  accessibilityHint="Crea una nueva partida de dungeon"
>
  <Text>NUEVA PARTIDA</Text>
</TouchableOpacity>
```

**Prioridad de implementación:**
1. `MainScreen.tsx` — Pantalla de entrada, alto impacto
2. `BattleScreen.tsx` — Botones de acción de combate
3. `CampScreen.tsx` — Tabs de descanso / party
4. `MapScreen.tsx` — Habitaciones del mapa

---

### [ACC-002] Imágenes de personaje y monstruo sin etiqueta
**Archivos:** `src/components/`, pantallas con `FastImage` o imágenes de portada  
**Severidad:** 🟢 Baja — Las imágenes decorativas deberían ser `accessible={false}`; las que transmiten información deberían tener `accessibilityLabel`

**Por qué es un problema:**
Los retratos de personajes y las imágenes de monstruos son elementos visuales que el lector de pantalla enfoca sin información útil. Una imagen decorativa sin `accessible={false}` añade ruido al flujo de VoiceOver.

**Solución:**
```tsx
{/* Imágenes decorativas (fondos, iconos UI) */}
<FastImage source={bg} style={styles.bg} accessible={false} />

{/* Imágenes de personaje con información */}
<FastImage
  source={{ uri: portraitUri }}
  style={styles.portrait}
  accessibilityLabel={`Retrato de ${character.name}, ${character.charClass} nivel ${character.level}`}
/>
```

---

### [ACC-003] Targets táctiles potencialmente pequeños
**Archivos:** `src/screens/BattleScreen.tsx`, `src/components/`  
**Severidad:** 🟢 Baja — Las recomendaciones de Apple/Google son mínimos de 44×44 pt

**Por qué es un problema:**
La UI de TORRE usa muchos botones de texto pequeños con padding ajustado para el diseño terminal/CRT. Es posible que algunos tengan áreas táctiles menores a 44×44 puntos, especialmente en la barra de acciones de combate.

**Solución:**
```tsx
// Usar hitSlop para ampliar el área táctil sin cambiar el visual
<TouchableOpacity
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  style={styles.smallButton}
>
```

O bien, aplicar `minHeight: 44, minWidth: 44` a los estilos de botones críticos.

---

### [ACC-004] Sin soporte para `reduceMotion`
**Archivos:** `src/screens/BattleScreen.tsx`, `src/screens/CampScreen.tsx`, y cualquier pantalla con animaciones  
**Severidad:** 🟢 Baja — Usuarios con epilepsia o sensibilidad al movimiento pueden verse afectados

**Por qué es un problema:**
Las animaciones de la app (efectos de combate, transiciones de CRT, parpadeos de UI) no verifican la preferencia del sistema `reduceMotion`. En iOS y Android, los usuarios pueden activar "Reducir movimiento" en Accesibilidad.

**Solución con `react-native-reanimated` (ya en el proyecto):**
```tsx
import { useReducedMotion } from 'react-native-reanimated';

function BattleEffects() {
  const reduceMotion = useReducedMotion();

  const flashAnim = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? withTiming(1, { duration: 0 })  // Sin flash
      : withSequence(
          withTiming(0, { duration: 100 }),
          withTiming(1, { duration: 100 }),
        ),
  }));
}
```

---

## Contexto de juego

Para un juego de rol con UI táctil compleja como TORRE, el nivel mínimo de accesibilidad recomendado es:

| Elemento | Prioridad | Acción mínima |
|----------|-----------|---------------|
| Botones principales (menú, combate) | 🔴 Alta | `accessibilityRole="button"` + `accessibilityLabel` |
| Imágenes decorativas (fondos, iconos) | 🟡 Media | `accessible={false}` |
| Imágenes informativas (personajes) | 🟡 Media | `accessibilityLabel` descriptivo |
| Animaciones de combate | 🟢 Baja | Respetar `reduceMotion` |
| Flujo completo con VoiceOver | 🟢 Baja | No es prioritario para MVP de juego |
