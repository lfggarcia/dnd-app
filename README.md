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
│   ├── CharacterActionsPanel.tsx — Panel DnD 5e de acciones por personaje (combat/class/race/subclass)
│   ├── ConfirmModal.tsx        — Diálogo de confirmación reutilizable con tema CRT
│   ├── CRTOverlay.tsx          — Superposición visual CRT con scanlines y parpadeo animado
│   ├── DatabaseGate.tsx        — Wrapper que bloquea UI hasta que la DB y sync estén listos
│   ├── GlossaryModal.tsx       — Modal de glosario DnD 5e con búsqueda por categorías
│   ├── Icons.tsx               — Librería de iconos SVG (20+ iconos: combate, edificios, UI)
│   ├── SliderButton.tsx        — Botón deslizable con gesture handler para confirmar acciones
│   ├── TorreLogo.tsx           — Logo SVG "TORRE" con efecto neón roto y flicker
│   ├── TutorialOverlay.tsx     — Overlay tutorial paso a paso con navegación (next/prev/skip)
│   └── TypewriterText.tsx      — Texto con efecto máquina de escribir
├── constants/
│   └── dnd5eLevel1.ts          — Reglas DnD 5e nivel 1: subclases, features, razas, stats, acciones
├── database/
│   ├── connection.ts           — Conexión SQLite (op-sqlite)
│   ├── migrations.ts           — Schema v6: resources, translations, sync_meta, saved_games, portraits, expressions
│   ├── gameRepository.ts       — SavedGame CRUD con portraits, expressions, mapState
│   ├── repository.ts           — CRUD para resources, translations, sync metadata
│   └── index.ts                — Barrel exports
├── hooks/
│   ├── useDatabase.ts          — Init DB + seed traducciones + subclases en mount
│   ├── useGlossary.ts          — Estado de visibilidad del modal de glosario
│   ├── useResources.ts         — Fetch DnD 5e con traducción automática (useRaces, useClasses, etc.)
│   └── useTutorial.ts          — Navegación de pasos del tutorial de PartyScreen
├── i18n/
│   ├── context.tsx             — I18nProvider + useI18n() hook
│   ├── index.ts                — Barrel exports
│   └── translations/
│       ├── en.ts               — Traducciones inglés (~120+ keys)
│       └── es.ts               — Traducciones español (default)
├── navigation/
│   ├── AppNavigator.tsx        — Stack navigator principal (11 pantallas)
│   └── types.ts                — RootStackParamList y ScreenProps tipados
├── screens/
│   ├── MainScreen.tsx          — Menú principal con TorreLogo SVG, boot sequence, toggle idioma
│   ├── SeedScreen.tsx          — Input del seed con efecto Matrix de fondo
│   ├── PartyScreen.tsx         — Creación de personaje real + portrait Gemini + CharacterActionsPanel
│   ├── VillageScreen.tsx       — Hub de pueblo conectado a useGameStore; rivals/market/amenazas por seed
│   ├── GuildScreen.tsx         — Roster con portraits, HP bar, stats, badges; navegación WorldLog
│   ├── MapScreen.tsx           — 8 nodos por seed+floor, radar Reanimated, SAFE_ZONE interactiva
│   ├── BattleScreen.tsx        — Banner portrait de grupo + portraits individuales (mock)
│   ├── ReportScreen.tsx        — Reporte TypewriterText post-incursión (mock)
│   ├── ExtractionScreen.tsx    — Contador animado + "Volver a la villa" en ciclo 60
│   ├── WorldLogScreen.tsx      — Feed de eventos con filtros ALL/COMBAT/LORE/SYSTEM
│   └── CycleTransitionScreen.tsx — Transición animada Day/Night entre ciclos
├── services/
│   ├── api5e.ts                — Fetch de D&D 5e API (24 endpoints)
│   ├── backgroundSeed.ts       — Seed de backgrounds custom en init
│   ├── dungeonGraphService.ts  — Grafos de dungeon 12–20 habitaciones con fog-of-war y mutaciones
│   ├── enemySpriteService.ts   — Catálogo de 35+ tipos de enemigo con 5 animaciones cada uno
│   ├── geminiImageService.ts   — Generación de portraits via Google Gemini API
│   ├── mapGenerator.ts         — 8 nodos DAG por seed+floor (mapa simple de piso)
│   ├── monsterEvolutionService.ts — Tiers de evolución, stats de monstruos, XP decay, jefes secretos
│   ├── rivalGenerator.ts       — Genera hasta 10 grupos rivales determinísticos por seed
│   ├── rulesConfig.ts          — Reglas DnD 5e: subclases, XP, proficiency, hit dice
│   ├── spriteDbService.ts      — Lee sprites pre-generados bundleados con Metro
│   ├── subclassSeed.ts         — Seed de subclases custom en init
│   ├── syncService.ts          — Orquestación de sync DB ↔ API con progreso
│   ├── translationBridge.ts    — Lookup de traducción con fallback chain
│   ├── translationSeed.ts      — Seed de traducciones ES en init
│   └── index.ts                — Barrel exports
├── stores/
│   └── gameStore.ts            — Zustand con SQLite persistence (activeGame, savedGames)
└── theme/                      — (tema via Tailwind tokens en tailwind.config.js)
assets/
├── fonts/                      — RobotoMono (fuente principal)
├── images/monsters/            — Ilustraciones de monstruos generadas
└── sprites/enemies/            — Sprites animados pre-generados (index.json)
scripts/
├── generate-characters.js      — Generación batch de portraits via Gemini
├── generate-sprites.js         — Generación batch de sprites via ComfyUI
├── test-sprite-gen.js          — Test de integridad del pipeline de sprites
└── comfyui-workflows/
    ├── 01-base-sprite.json     — Workflow base para sprites de monstruos
    └── 02-expression-inpaint.json — Inpainting de expresiones con FaceDetailer
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
| **Creación de personaje** | Raza, clase, subclase, trasfondo, alineamiento con datos reales de D&D 5e API; CharacterActionsPanel con choices de features |
| **Retratos IA** | Portraits generados por Google Gemini por personaje; variantes de expresión (neutral/happy/angry/sad/surprised/wounded) via ComfyUI img2img |
| **Sprites de enemigos** | 35+ tipos de enemigo, 5 animaciones cada uno (idle/run/attack/damage/death), generados via ComfyUI y bundleados con Metro |
| **Motor de dungeon** | Grafos determinísticos de 12–20 habitaciones por piso; fog-of-war; salas secretas; mutaciones por ciclo |
| **Evolución de monstruos** | Tiers de evolución por ciclo/piso; XP decay; sistema de jefes secretos |
| **Base de datos** | SQLite local (op-sqlite v15), schema v6, sincronización de 24 endpoints de la API DnD 5e |
| **Persistencia de partida** | `useGameStore` (Zustand) persiste seed, party, floor, cycle, gold, portraits y mapState |
| **Internacionalización** | Sistema bilingüe ES/EN con hot-switch, ~120+ claves, traducciones seeded + dinámicas |
| **Generador determinístico** | PRNG djb2+LCG para rivals, market, amenazas, nodos de mapa y dungeon layout |
| **Glosario** | Modal interactivo con búsqueda por categorías |
| **Estética CRT** | Scanlines animadas, neón roto, efecto Matrix, TypewriterText, radar rotativo |

---

## Deuda Técnica Conocida

| Área | Detalle |
|---|---|
| **Motor de combate** | BattleScreen es mock — sin tiradas d20, sin HP dinámico, sin turnos reales |
| **Motor de simulación** | `simulateWorld(cycle)` no existe — las parties IA no avanzan realmente |
| **Dungeon Graph → MapScreen** | `dungeonGraphService.ts` implementado pero no conectado a MapScreen aún |
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
