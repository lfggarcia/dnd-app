# TORRE — Suggested Commands

## Development
- yarn start                          # Start Metro bundler
- yarn ios                            # Run on iOS simulator (default)
- yarn ios --simulator="iPhone 16 Plus" --verbose  # Run on specific simulator
- yarn android                        # Run on Android emulator

## Testing
- yarn test                           # Run all Jest tests
- yarn test --watchAll                # Watch mode

## Linting / Formatting
- yarn lint                           # ESLint check
- npx prettier --write src/           # Auto-format with Prettier

## Sprites / Assets
- yarn sprites:generate               # Generate sprites (resume mode)
- yarn sprites:generate:fresh         # Generate sprites from scratch
- yarn sprites:test                   # Test sprite generation

## Useful system commands (macOS/Darwin)
- find src -name "*.tsx" | xargs grep "pattern"  # Search in source
- cat src/screens/MapScreen.tsx | head -80        # Preview file
