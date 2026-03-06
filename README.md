# TORRE — Protocol DND

RPG de simulación social con estética CRT/cyberpunk construido en React Native. El jugador genera un mundo mediante un seed, crea una party con reglas DnD 5e, explora una torre de 100 pisos, combate enemigos y compite contra parties controladas por IA.

---

## Stack Técnico

| Tecnología | Versión |
|---|---|
| React Native | 0.84.0 (New Architecture / Fabric) |
| React | 19.2.3 |
| NativeWind | v4 (Tailwind CSS en RN) |
| React Navigation (Native Stack) | v7 |
| Reanimated | v4 |
| Gesture Handler | v2 |
| op-sqlite | v15 (SQLite) |
| react-native-svg | v15 |
| TypeScript | v5 |

---

## Estructura del Proyecto

```
src/
├── components/
│   ├── CRTOverlay.tsx         — Superposición visual CRT con scanlines y parpadeo animado
│   ├── DatabaseGate.tsx       — Wrapper que bloquea UI hasta que la DB y sync estén listos
│   ├── GlossaryModal.tsx      — Modal de glosario DnD 5e con búsqueda por categorías
│   ├── SliderButton.tsx       — Botón deslizable con gesture handler para confirmar acciones
│   ├── TorreLogo.tsx          — Logo SVG "TORRE" con efecto neón roto y flicker
│   ├── TutorialOverlay.tsx    — Overlay tutorial paso a paso con navegación (next/prev/skip)
│   └── TypewriterText.tsx     — Texto con efecto máquina de escribir
├── constants/
│   └── dnd5eLevel1.ts         — Reglas DnD 5e nivel 1: subclases, features, razas, stats
├── database/
│   ├── connection.ts          — Conexión SQLite (op-sqlite)
│   ├── migrations.ts          — Schema v1: resources, translations, sync_meta
│   ├── repository.ts          — CRUD para resources, translations, sync metadata
│   └── index.ts               — Barrel exports
├── hooks/
│   ├── useDatabase.ts         — Init DB + seed traducciones + subclases en mount
│   ├── useGlossary.ts         — Estado de visibilidad del modal de glosario
│   ├── useResources.ts        — Fetch DnD 5e con traducción automática (useRaces, useClasses, etc.)
│   └── useTutorial.ts         — Navegación de pasos del tutorial de PartyScreen
├── i18n/
│   ├── context.tsx            — I18nProvider + useI18n() hook
│   ├── index.ts               — Barrel exports
│   └── translations/
│       ├── en.ts              — Traducciones inglés
│       └── es.ts              — Traducciones español (default)
├── navigation/
│   ├── AppNavigator.tsx       — Stack navigator principal (10 pantallas)
│   └── types.ts               — RootStackParamList y ScreenProps tipados
├── screens/
│   ├── MainScreen.tsx         — Menú principal con TorreLogo SVG, boot sequence, toggle idioma
│   ├── SeedScreen.tsx         — Input del seed con efecto Matrix de fondo
│   ├── PartyScreen.tsx        — Creación de personaje con datos reales DnD 5e + tutorial + glosario
│   ├── VillageScreen.tsx      — Hub de pueblo con mapa de plano y leaderboard
│   ├── MapScreen.tsx          — Mapa de nodos con radar animado y rutas de incursión
│   ├── BattleScreen.tsx       — Pantalla de combate por turnos con log de acciones
│   ├── ReportScreen.tsx       — Reporte post-incursión con XP, integridad y alertas
│   ├── ExtractionScreen.tsx   — Liquidación final de recursos con contador animado
│   ├── WorldLogScreen.tsx     — Feed de eventos globales con filtros por categoría
│   └── CycleTransitionScreen.tsx — Transición animada entre ciclos
├── services/
│   ├── api5e.ts               — Fetch de D&D 5e API (24 endpoints)
│   ├── syncService.ts         — Orquestación de sync DB ↔ API con progreso
│   ├── translationBridge.ts   — Lookup de traducción con fallback chain
│   ├── rulesConfig.ts         — Reglas DnD 5e: subclases, XP, proficiency, hit dice
│   ├── subclassSeed.ts        — Seed de subclases custom en init
│   ├── backgroundSeed.ts      — Seed de backgrounds custom en init
│   ├── translationSeed.ts     — Seed de traducciones ES en init
│   └── index.ts               — Barrel exports
└── theme/                     — (tema via Tailwind tokens en tailwind.config.js)
assets/
└── fonts/                     — RobotoMono (fuente principal del sistema)
```

---

## Flujo de Navegación

```
Main → Seed → Party → Village → Map → Battle → Report → Extraction
                                                              ↓
                                          WorldLog ← CycleTransition
```

---

## Setup

```sh
# Instalar dependencias JS
yarn install

# iOS — instalar pods
bundle install
bundle exec pod install

# Arrancar Metro
yarn start

# Correr en iOS
yarn ios

# Correr en Android
yarn android
```

**Requisito de Node:** >= 22.11.0

---

## Tests

```sh
yarn test
```

---

## Características Implementadas

| Área | Detalle |
|---|---|
| **Creación de personaje** | Selección real de raza, clase, subclase, trasfondo y alineamiento con datos de D&D 5e API |
| **Base de datos** | SQLite local con sincronización de 24 endpoints de la API DnD 5e |
| **Internacionalización** | Sistema bilingüe ES/EN con hot-switch, traducciones seeded + dinámicas |
| **Glosario** | Modal interactivo con búsqueda por categorías (stats, razas, clases, monstruos, mecánicas) |
| **Tutorial** | Overlay paso a paso en PartyScreen para guiar la creación de personaje |
| **Estética CRT** | Scanlines animadas, neón roto, efecto Matrix, typewriter text, radar rotativo |

---

## Deuda Técnica Conocida

| Área | Detalle |
|---|---|
| **Estado global** | Sin gestión de estado global — seed, personaje y progreso no persisten entre pantallas |
| **Gameplay** | Pantallas de combate, mapa, village, report y extraction usan datos mock/hardcodeados |
| **Performance** | `CRTOverlay` genera 100 Views por pantalla para simular scanlines |
| **Testing** | Cobertura de tests: ~0% |

---

## Paleta Visual

El sistema de colores está definido en `global.css` via variables CSS y expuesto en `tailwind.config.js`:

- `primary` — Verde terminal / ámbar principal
- `secondary` — Color de acento (alertas, edificios)
- `background` — Negro profundo
- `muted` — Superficie con ligero contraste


# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
