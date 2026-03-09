# TORRE (dnd3) — Project Overview

## Purpose
TORRE is a mobile roguelike dungeon-crawling game based on D&D 5e mechanics,
built with React Native. Players create a party of adventurers, explore procedurally
generated dungeons, battle enemies, level up, manage gold/loot,
and progress through cycles (day/night seasons).

## Tech Stack
- React Native 0.84 + React 19
- TypeScript 5.8
- NativeWind 4 (Tailwind CSS for RN)
- React Navigation 7 (native-stack)
- Zustand 5 (state management)
- op-sqlite (SQLite local DB, runs on JS thread synchronously)
- react-native-svg (SVG map rendering)
- react-native-reanimated 4 (animations)
- Jest 29 (testing)
- ESLint + Prettier 2.8.8

## Key Commands
- yarn ios — run on iOS simulator
- yarn android — run on Android emulator
- yarn start — start Metro bundler
- yarn test — run Jest tests
- yarn lint — ESLint

## Folder Structure
src/
  screens/       — 11 screens (MapScreen, BattleScreen, VillageScreen, etc.)
  components/    — shared UI (GlossaryModal, TypewriterText, CRTOverlay, etc.)
  services/      — business logic (dungeonGraphService, characterStats, etc.)
  stores/        — Zustand stores (gameStore.ts)
  database/      — SQLite layer (connection, migrations, repository, gameRepository)
  hooks/         — custom hooks (usePartyRoster, etc.)
  navigation/    — AppNavigator.tsx (React Navigation native-stack)
  i18n/          — internationalization (context.tsx with t(), lang)
  types/         — TypeScript types
  constants/     — shared constants
  theme/         — design tokens
assets/ — fonts, images, sprites

## State Management Pattern
- Zustand store: useGameStore in src/stores/gameStore.ts
- Main state: activeGame: SavedGame | null, savedGames: SavedGame[]
- Key actions: hydrate, startNewGame, loadGame, updateProgress, savePortrait, endGame
- IMPORTANT: use granular field selectors, NOT s => s.activeGame whole object
