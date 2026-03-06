# CHANGELOG — CYBER_DND | Protocol DND

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versiones siguiendo [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — 2026-03-04

### Fixed
- Eliminado dead state `turn` en `BattleScreen` (declarado pero nunca leído)
- Eliminado dead state `showButton` y `useEffect` huérfano en `ReportScreen`
- Eliminado import no usado `Image` en `PartyScreen`
- Eliminado import no usado `ScrollView` en `ExtractionScreen`

### Changed
- Navegación completamente tipada: creado `RootStackParamList` y `ScreenProps<T>` en `src/navigation/types.ts`
- Todos los `{ navigation }: any` reemplazados por `ScreenProps<'ScreenName'>` en las 8 pantallas
- `GestureHandlerRootView` en `App.tsx`: inline style `{{ flex: 1 }}` extraído a `StyleSheet.create`
- `AppNavigator` tipado con `createNativeStackNavigator<RootStackParamList>()`

### Documentation
- `README.md` reescrito completamente — descripción real del proyecto, stack, flujo de navegación, setup, deuda técnica conocida

---

## [0.1.0-BETA] — pantallas iniciales (commit `e00ea5b`)

### Added
- **8 pantallas completas** con estética CRT/terminal cyberpunk:
  - `MainScreen` — menú principal con ascii art CYBER y logs de sistema
  - `SeedScreen` — input de seed con efecto Matrix animado (15 columnas de datos)
  - `PartyScreen` — creación de personaje con radar de atributos y selección de raza/módulos
  - `VillageScreen` — hub de pueblo con mapa de blueprint interactivo y leaderboard de squads
  - `MapScreen` — mapa de nodos con radar rotativo animado (Reanimated)
  - `BattleScreen` — pantalla de combate por turnos con log de acciones
  - `ReportScreen` — reporte post-incursión con TypewriterText secuencial
  - `ExtractionScreen` — liquidación de recursos con contador animado hasta 15.400G
- **3 componentes reutilizables**:
  - `CRTOverlay` — 100 scanlines + parpadeo Reanimated con secuencias `withRepeat/withSequence`
  - `TypewriterText` — texto con efecto máquina de escribir, cursor parpadeante y callback `onComplete`
  - `SliderButton` — botón deslizable con Gesture Handler + Reanimated, threshold 80% para confirmar
- `AppNavigator` con transición `fade` global entre pantallas
- Integración `GestureHandlerRootView` como root wrapper en `App.tsx`
- Fuente `RobotoMono` como fuente del sistema en todo el proyecto
- Paleta de colores cyberpunk definida en `global.css` (verde terminal `#00FF41` + ámbar `#FFB000`)

---

## [0.0.2] — sistema de color + navegación (commit `43fa0a0`)

### Added
- Paleta de colores completa via CSS variables en `global.css`:
  - `--primary: #00FF41` (verde terminal)
  - `--secondary: #FFB000` (ámbar)
  - `--background: #0A0E0A` (negro profundo)
  - Soporte para modo oscuro (clase `.dark`)
- Tokens de color expuestos en `tailwind.config.js` (19 tokens: `primary`, `secondary`, `muted`, `destructive`, etc.)
- React Navigation v7 (`@react-navigation/native` + `@react-navigation/native-stack`)
- `react-native-screens@4.24.0` con setup Android (`RNScreensFragmentFactory` en `MainActivity.kt`)
- `android:enableOnBackInvokedCallback="false"` en `AndroidManifest.xml`
- `safe-area-context` actualizado a `5.7.0`
- Nueva arquitectura activada en iOS (`RCTNewArchEnabled: true` en `Info.plist`)
- Flags de compilación iOS: `USE_HERMES`, `RCT_REMOVE_LEGACY_ARCH`, `SWIFT_ENABLE_EXPLICIT_MODULES`

---

## [0.0.1] — NativeWind + fuentes (commit `b24841b`)

### Added
- NativeWind v4 para estilos Tailwind CSS en React Native
- Familia tipográfica `RobotoMono` completa (14 variantes: Regular, Bold, Italic, Light, Thin, ExtraLight, Medium, SemiBold + sus cursivas)
- Registro de fuentes iOS en `Info.plist` (`UIAppFonts`)
- Registro de fuentes en Xcode project (`project.pbxproj`)
- `react-native-worklets@0.7.4` como base para animaciones worklet

### Changed
- Migrado de npm a Yarn como package manager
- `tailwind.config.js` actualizado con `nativewind/preset` y fontFamily `robotomono`

---

## [0.0.0] — Initial commit (commit `b51a47d`)

### Added
- Proyecto React Native 0.84.0 bootstrapped con `@react-native-community/cli`
- TypeScript 5.x
- React 19.2.x
- Jest + `react-test-renderer` para testing
- ESLint + Prettier
- `react-native-reanimated@4.2.2`
- `react-native-safe-area-context@5.5.2`
- Setup base iOS (CocoaPods) y Android (Gradle)
