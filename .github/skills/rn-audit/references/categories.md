# Checklist por Categoría — React Native Audit

## 🔒 Seguridad (`01-security.md`)

### Almacenamiento de datos
- [ ] Tokens JWT / sesión guardados en `AsyncStorage` (debería ser `react-native-keychain` o `expo-secure-store`)
- [ ] Contraseñas o datos PII almacenados en texto plano
- [ ] Uso de `MMKV` o `redux-persist` sin cifrado para datos sensibles

### Credenciales en código
- [ ] API keys hardcodeadas en archivos `.ts/.tsx/.js`
- [ ] Claves en `app.json` o `app.config.js` expuestas al bundle
- [ ] Archivos `.env` commiteados al repositorio (verificar `.gitignore`)
- [ ] Secrets visibles en logs: `console.log(token)`, `console.log(user)`

### Red y comunicación
- [ ] Llamadas HTTP en lugar de HTTPS
- [ ] Certificate pinning ausente en apps con datos sensibles
- [ ] Headers de autorización loggeados en interceptores de Axios/Fetch
- [ ] `clearTextTraffic` habilitado en Android (`AndroidManifest.xml`)
- [ ] `NSAllowsArbitraryLoads: true` en iOS (`Info.plist`)

### Código nativo y configuración
- [ ] Modo debug habilitado en builds de producción (`__DEV__` checks)
- [ ] Hermes / Flipper con datos sensibles accesibles en producción
- [ ] Deep links sin validación de origen (Universal Links / App Links)
- [ ] Permisos excesivos declarados que no se usan

### Patrones peligrosos
- [ ] Uso de `eval()` o `new Function()`
- [ ] Renderizado de HTML con `dangerouslySetInnerHTML` (en WebViews)
- [ ] URLs dinámicas en WebView sin sanitización

---

## ⚙️ Rendimiento (`02-performance.md`)

### Renders innecesarios
- [ ] Componentes que se re-renderizan sin cambio de props (falta `React.memo`)
- [ ] Funciones inline en props: `onPress={() => handler()}` dentro de render
- [ ] Objetos/arrays creados en render sin `useMemo`
- [ ] Callbacks sin `useCallback` pasados a listas o componentes hijos

### Listas y scroll
- [ ] `ScrollView` usado para listas de más de ~20 items (usar `FlatList`/`FlashList`)
- [ ] `FlatList` sin `keyExtractor` o con keys inestables
- [ ] `FlatList` sin `initialNumToRender`, `maxToRenderPerBatch`, `windowSize` configurados
- [ ] Falta de `getItemLayout` en listas con items de altura fija

### Imágenes
- [ ] Imágenes sin dimensiones definidas (causa layout shifts)
- [ ] Imágenes remotas sin caché (`react-native-fast-image` vs `Image` base)
- [ ] Imágenes de alta resolución no redimensionadas para mobile
- [ ] Múltiples imágenes animadas simultáneas en pantalla

### useEffect y memoria
- [ ] `useEffect` con subscripciones que no retornan cleanup
- [ ] Listeners de eventos (AppState, NetInfo, Keyboard) sin `.remove()`
- [ ] Timers (`setTimeout`/`setInterval`) sin `clearTimeout`/`clearInterval`
- [ ] Websockets o streams sin cerrar al desmontar

### Bundle y carga
- [ ] Todas las pantallas importadas en el bundle principal (sin lazy loading)
- [ ] Librerías pesadas importadas completas (ej: `import _ from 'lodash'`)
- [ ] Assets estáticos grandes no optimizados

### Animaciones
- [ ] Animaciones en JS thread en lugar de `useNativeDriver: true`
- [ ] `Animated` donde podría usarse `react-native-reanimated`

---

## 🏗️ Arquitectura (`03-architecture.md`)

### Separación de responsabilidades
- [ ] Lógica de negocio dentro de componentes de UI
- [ ] Llamadas a API directas en componentes (sin capa de servicios/hooks)
- [ ] Estado global mezclado con estado local de forma inconsistente

### Manejo de estado
- [ ] Prop drilling de más de 2-3 niveles (candidato a Context o estado global)
- [ ] Múltiples librerías de estado sin justificación (Redux + Zustand + Context)
- [ ] Estado derivado guardado en lugar de calculado
- [ ] Sincronización manual de estados que deberían ser una sola fuente de verdad

### Manejo de errores
- [ ] Ausencia de `ErrorBoundary` en el root de la app
- [ ] Llamadas API sin manejo de error (`try/catch` o `.catch()`)
- [ ] Estados de error no comunicados al usuario (fallos silenciosos)
- [ ] No hay diferencia entre errores de red, errores de servidor, y errores de validación

### TypeScript
- [ ] Uso excesivo de `any` o `// @ts-ignore`
- [ ] Props sin tipar (`props: any` en componentes)
- [ ] Enums de strings no tipados (ej: status como `string` libre)
- [ ] Ausencia total de TypeScript en proyecto que debería tenerlo

### Navegación
- [ ] Lógica de negocio en el stack de navegación
- [ ] Parámetros de ruta sin tipado (React Navigation permite tiparlos)
- [ ] Deep links no configurados o incompletos

### Estructura de carpetas
- [ ] Archivos de más de ~300 líneas sin justificación
- [ ] Inconsistencia en convenciones de nombres (camelCase vs PascalCase vs kebab-case)
- [ ] Ausencia de estructura definida (todo en `/src` plano)

---

## 🧪 Testing (`04-testing.md`)

### Cobertura
- [ ] Cobertura total inferior al 30% (crítico), 30-60% (mejorable), 60%+ (aceptable)
- [ ] Funciones críticas de negocio sin tests (autenticación, pagos, formularios)
- [ ] Ausencia total de tests en el proyecto

### Calidad de tests
- [ ] Tests que testean implementación en lugar de comportamiento
- [ ] Mocks demasiado agresivos que hacen el test trivial
- [ ] Tests con `expect(true).toBe(true)` o assertions vacías
- [ ] Tests que dependen del orden de ejecución

### Tipos de tests
- [ ] Sin tests unitarios de lógica de negocio (utils, hooks, reducers)
- [ ] Sin tests de componentes con React Native Testing Library
- [ ] Sin tests de integración para flujos críticos
- [ ] Sin E2E básico (Detox o Maestro) para happy paths

### CI/CD
- [ ] Tests no corren en CI (solo localmente)
- [ ] Pipeline sin validación de tipos TypeScript
- [ ] Sin lint automático en PRs

---

## 📦 Dependencias (`05-dependencies.md`)

### Seguridad
- [ ] Vulnerabilidades críticas o altas en `npm audit`
- [ ] Dependencias con CVEs conocidos sin parchear

### Mantenimiento
- [ ] Dependencias sin actualización en más de 12 meses con alternativas activas
- [ ] Librerías deprecadas (ej: `@react-native-community/async-storage` viejo)
- [ ] Dependencias que ya no tienen soporte para la versión de RN usada
- [ ] Fork de una librería abandonada sin justificación

### Calidad
- [ ] Múltiples librerías resolviendo el mismo problema (ej: 2 clientes HTTP)
- [ ] Librerías pesadas para funcionalidad simple (ej: `moment.js` para una fecha)
- [ ] Dependencias de desarrollo en `dependencies` en lugar de `devDependencies`
- [ ] Librerías con pocas stars/downloads sin justificación

### Compatibilidad
- [ ] Versión de React Native desactualizada en más de 2 versiones major
- [ ] Dependencias nativas sin configuración para New Architecture (si aplica)
- [ ] Mismatches entre versión de Expo y librerías (si usa Expo)

---

## ♿ Accesibilidad (`06-accessibility.md`)

### Semántica básica
- [ ] Botones/Touchables sin `accessibilityLabel`
- [ ] Imágenes sin `accessibilityLabel` o sin `accessible={false}` si son decorativas
- [ ] Inputs sin `accessibilityLabel` o `accessibilityHint`
- [ ] Ausencia de `accessibilityRole` en elementos interactivos

### Navegación con lector de pantalla
- [ ] Orden de lectura no lógico (VoiceOver/TalkBack no sigue el flujo visual)
- [ ] Elementos no interactivos recibiendo foco innecesariamente
- [ ] Grupos de elementos sin `accessible={true}` en el contenedor padre

### Visual
- [ ] Contraste de texto inferior a 4.5:1 (normal) o 3:1 (grande)
- [ ] Elementos táctiles menores a 44x44 puntos
- [ ] Información transmitida solo por color (sin texto o icono alternativo)

### Dinámica
- [ ] Cambios de contenido sin notificar al lector (`AccessibilityInfo.announceForAccessibility`)
- [ ] Modales sin trampa de foco
- [ ] Animaciones sin respetar `reduceMotion` (`useReducedMotion`)