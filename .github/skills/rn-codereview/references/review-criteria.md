# Criterios de Revisión — Sr. RN Developer

## Por cada archivo, revisar en este orden:

---

## 1. Correctness (bugs reales)

### Async / Promises
- [ ] `async` functions sin `try/catch` o sin `.catch()` en el caller
- [ ] `Promise.all` sin manejo de fallos parciales cuando debería usarse `Promise.allSettled`
- [ ] Race conditions: múltiples peticiones concurrentes que pueden llegar fuera de orden
- [ ] `setState` o `dispatch` llamado después de que el componente fue desmontado
- [ ] `await` faltante en llamadas async (el error se swallows silently)

### State y referencias
- [ ] Mutación directa de arrays: `arr.push()`, `arr[0] = x` en lugar de spread/concat
- [ ] Mutación directa de objetos en Redux/Zustand/Context
- [ ] Cierre sobre estado stale en callbacks (closure sobre valor viejo sin ref)
- [ ] `useRef` mal usado como reemplazo de estado que debería triggerear re-render
- [ ] Estado inicial que depende de props sin manejarse correctamente

### useEffect
- [ ] Array de dependencias incompleto (`eslint-plugin-react-hooks` lo detectaría)
- [ ] Dependencias que son objetos/arrays creados en render (cambian en cada render)
- [ ] Efectos que deberían limpiarse pero no retornan cleanup function
- [ ] Lógica que debería estar en un evento, no en un efecto

### Comparaciones y tipos
- [ ] `==` en lugar de `===` (coerción implícita de tipos)
- [ ] Comparar con `null` sin considerar `undefined` (o viceversa)
- [ ] `typeof` incorrecto o innecesario
- [ ] Acceso a propiedades de null/undefined sin optional chaining

### Casos borde
- [ ] Función que asume que el array nunca está vacío
- [ ] Función que asume que el objeto siempre tiene cierta propiedad
- [ ] Manejo de respuesta de API asumiendo siempre éxito
- [ ] Input numérico sin validación de NaN o Infinity

---

## 2. Performance

### React rendering
- [ ] Componente que recibe objetos/arrays como props sin memoización (se re-crea en cada render del padre)
- [ ] Handler creado inline: `onPress={() => fn(id)}` en lista con muchos items
- [ ] `useMemo`/`useCallback` usado incorrectamente (dependency array que cambia siempre = no sirve)
- [ ] Context con objeto como value que se re-crea en cada render (todos los consumers re-renderizan)
- [ ] `React.memo` en componente que recibe children — no tiene efecto

### Listas
- [ ] `ScrollView` para listas de contenido dinámico o potencialmente largo
- [ ] `FlatList` sin `keyExtractor`
- [ ] `keyExtractor` que usa `index` en lista que puede reordenarse o filtrarse
- [ ] `FlatList` sin `removeClippedSubviews` en listas largas
- [ ] Renderizar toda la lista sin paginación cuando hay muchos items

### Imágenes y assets
- [ ] `Image` de RN base para imágenes remotas sin caché configurado
- [ ] Imagen sin `width` y `height` explícitos (causa layout recalculation)
- [ ] `resizeMode` no especificado en imágenes de contenido variable

### Memoria
- [ ] Event listener sin `.remove()` en cleanup de useEffect
- [ ] `setInterval`/`setTimeout` sin `clearInterval`/`clearTimeout`
- [ ] Subscription (NetInfo, AppState, Keyboard, etc.) sin unsubscribe
- [ ] WebSocket o conexión sin cerrar al desmontar

---

## 3. Mantenibilidad

### Legibilidad
- [ ] Función de más de ~40-50 líneas sin descomposición
- [ ] Componente de más de ~200 líneas mezclando UI y lógica
- [ ] Condición ternaria anidada (`a ? b ? c : d : e`)
- [ ] Magic numbers: `if (status === 3)` sin constante nombrada
- [ ] Nombre que no comunica intención: `data`, `item`, `temp`, `x`, `flag`

### Duplicación
- [ ] Lógica idéntica o muy similar copiada en 2+ lugares
- [ ] Componente casi idéntico a otro (candidato a abstracción con props)
- [ ] Misma transformación de datos repetida en múltiples componentes

### Estructura
- [ ] Responsabilidades mezcladas: un componente que hace fetch + transforma datos + renderiza
- [ ] Lógica de negocio que debería estar en un hook o servicio
- [ ] Imports circulares potenciales
- [ ] `any` en TypeScript donde el tipo puede inferirse o definirse

### Comentarios
- [ ] Comentario que explica el "qué" (el código ya lo dice): `// increment counter` sobre `count++`
- [ ] Código comentado sin explicación de por qué está ahí
- [ ] `// TODO` o `// FIXME` sin ticket o fecha — deuda técnica invisible
- [ ] Documentación JSDoc incorrecta o desactualizada

---

## 4. Patrones React Native específicos

Ver `rn-patterns.md` para patrones detallados. Verificar:

- [ ] Uso correcto de `StyleSheet.create` vs styles inline
- [ ] Animaciones con `useNativeDriver` cuando es posible
- [ ] Platform-specific code con `Platform.OS` o archivos `.ios.ts`/`.android.ts`
- [ ] Keyboard avoiding en forms (iOS vs Android tienen comportamientos diferentes)
- [ ] Safe area handling (`useSafeAreaInsets` o `SafeAreaView`)
- [ ] Touch feedback: `TouchableOpacity` vs `Pressable` vs `TouchableHighlight`

---

## 5. Seguridad (a nivel de código)

- [ ] `console.log` con datos de usuario o tokens
- [ ] API keys, tokens, secrets hardcodeados
- [ ] URLs hardcodeadas que deberían venir de config/env
- [ ] Datos de usuario loggeados en errores: `catch (e) { console.error(user, e) }`
- [ ] `dangerouslySetInnerHTML` en WebViews sin sanitización

---

## Tipos de comentario a asignar

| Tipo | Cuándo usarlo |
|---|---|
| `Bug` | Causa o puede causar un comportamiento incorrecto |
| `Performance` | Degrada el rendimiento de forma medible |
| `Mantenibilidad` | Dificulta entender, modificar o testear el código |
| `Seguridad` | Exposición de datos o vulnerabilidad |
| `Style` | Inconsistencia con el resto del codebase, nombres |
| `Suggestion` | Mejora no obligatoria, punto de discusión |

---

## Escala de severidad por tipo

| Tipo | Severidad típica |
|---|---|
| Bug en lógica crítica | 🔴 Alta |
| Bug en lógica no crítica | 🟡 Media |
| Memory leak | 🟡 Media - 🔴 Alta |
| Performance en hot path | 🟡 Media |
| Performance menor | 🟢 Baja |
| Mantenibilidad | 🟢 Baja - 🟡 Media |
| Seguridad (cualquier nivel) | 🔴 Alta siempre |
| Style | 🟢 Baja siempre |