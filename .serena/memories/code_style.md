# TORRE — Code Style and Conventions

## TypeScript
- Strict TypeScript throughout (tsconfig.json strict mode)
- Types declared as `type` (not `interface`) for most cases; `interface` used in services
- No `any` types
- Props typed inline as `React.FC<Props>` or function with typed params

## React / React Native
- Functional components only (no class components)
- NativeWind className for styling (Tailwind syntax)
- StyleSheet.create() for dynamic or complex styles
- useMemo / useCallback used for memoization of expensive computations and handlers
- React.memo on pure/presentational components
- Granular Zustand selectors (never subscribe to whole activeGame object)

## Naming Conventions
- Components: PascalCase (MapScreen, GlossaryModal)
- Functions/hooks: camelCase (handleNextFloor, usePartyRoster)
- Constants at module level: UPPER_SNAKE_CASE (CANVAS_W, ROOM_STYLES)
- Files: PascalCase for components/screens, camelCase for services/hooks

## Patterns
- DB queries in useEffect (not useMemo), results stored in local useState
- Derived values computed with useMemo over local state
- Interval/timeout refs stored in useRef and cleared on unmount
- console.log always gated with `__DEV__ &&`
- i18n via useI18n() hook providing t() function

## Imports
- React imported as `import React from 'react'` only when needed for JSX
- NativeWind className via string props
- SVG via react-native-svg (Svg, Line, Circle, etc.)
