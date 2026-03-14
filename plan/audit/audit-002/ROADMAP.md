# 🗺️ Roadmap de Auditoría — audit-002
**Fecha:** 2026-03-14  
**Proyecto:** TORRE (dnd3)  
**Auditoría anterior:** audit-001 (incompleta — solo 01-security.md)

---

## Estado general

| Categoría | Hallazgos | Severidad | Documento |
|-----------|-----------|-----------|-----------|
| 🔒 Seguridad | 2 | 🟡 Media | [01-security.md](01-security.md) |
| ⚡ Performance | 4 | 🟡 Media | [02-performance.md](02-performance.md) |
| 🏗️ Arquitectura | 4 | 🟡 Media + 🔴 1 | [03-architecture.md](03-architecture.md) |
| 🧪 Testing | 3 | 🔴 Alta | [04-testing.md](04-testing.md) |
| 📦 Dependencies | 3 | 🟢 Baja | [05-dependencies.md](05-dependencies.md) |
| 🌐 i18n | 2 | 🟡 Media | [06-i18n.md](06-i18n.md) |
| 📐 TypeScript | 1 | 🟡 Media | [07-typescript.md](07-typescript.md) |
| ♿ Accessibility | — | ✅ N/A | — |

**Total:** 19 hallazgos  
**🔴 Alta:** 3 | **🟡 Media:** 13 | **🟢 Baja:** 3

---

## Fase 1 — Crítico (hacer esta semana)

Estos items bloquean CI, producción, o causan crash en usuarios:

- [ ] **[TEST-001]** Agregar mock de `@op-engineering/op-sqlite` a jest.setup.js → CI verde
  - Esfuerzo: 30 min | Archivo: `jest.config.js`, `jest.setup.js`
- [ ] **[TEST-002]** Escribir tests para gameStore (hydrate, startNewGame, updateProgress)
  - Esfuerzo: 2 horas | Archivo nuevo: `__tests__/gameStore.test.ts`
- [ ] **[ARCH-003]** Crear ErrorBoundary y wrap App.tsx
  - Esfuerzo: 30 min | Archivos: `src/components/ErrorBoundary.tsx`, `App.tsx`

---

## Fase 2 — Importante (próximo sprint)

- [ ] **[ARCH-002]** Eliminar 15 casts `as React.ComponentType<object>` en AppNavigator
  - Esfuerzo: 2-3 horas | Archivo: `src/navigation/AppNavigator.tsx` + 15 screens
- [ ] **[PERF-001]** Reemplazar 8 selectores `s => s.activeGame` con selectores granulares
  - Esfuerzo: 2 horas | Archivos: GuildScreen, CycleTransition, LevelUp, Camp, CharacterDetail, Unification, Main, Map
- [ ] **[PERF-003]** Revisar 20 `eslint-disable exhaustive-deps` y documentar o corregir
  - Esfuerzo: 2-4 horas | Archivos: MapScreen, BattleScreen, y 8 más
- [ ] **[I18N-001]** Agregar claves faltantes y reemplazar los 38 strings hardcodeados
  - Esfuerzo: 2-3 horas | Archivos: 8 screens, es.ts, en.ts

---

## Fase 3 — Mejoras (cuando haya tiempo)

- [ ] **[ARCH-001]** Refactorizar BattleScreen.tsx (1571 líneas) en hook + subcomponentes
  - Esfuerzo: 2 días | Archivo: `src/screens/BattleScreen.tsx`
- [ ] **[TS-001]** Reemplazar 8 usos de `as any` con tipos correctos
  - Esfuerzo: 1-2 horas | Archivos: VillageScreen, GlossaryModal, geminiImageService, enemySpriteService
- [ ] **[PERF-002]** Mover inline styles estáticos a StyleSheet.create
  - Esfuerzo: 3-4 horas | Archivos: múltiples screens
- [ ] **[TEST-003]** Agregar smoke tests para todas las screens
  - Esfuerzo: 3-4 días | 22 archivos nuevos en `__tests__/`
- [ ] **[SEC-001]** Mover API key de Gemini a proxy backend
  - Esfuerzo: 2-3 horas | Archivos: geminiImageService, enemySpriteService + crear worker

---

## Fase 4 — Limpieza (backlog)

- [ ] **[DEP-001]** Evaluar fork de react-native-image-manipulator
- [ ] **[DEP-002]** Remover react-native-worklets si es redundante
- [ ] **[DEP-003]** Mover @react-native/new-app-screen a devDependencies o eliminar
- [ ] **[I18N-002]** Crear script de validación de keys i18n
- [ ] **[ARCH-004]** Agregar __DEV__ guard al console.log en aiProfileEngine
- [ ] **[SEC-002]** Reemplazar (formData as any) con cast seguro
- [ ] **[PERF-004]** ScrollViews con listas → FlatList cuando las listas crezcan

---

## Assets críticos (hereda de pipeline-001 / BRF-001)

> ⚠️  **[BRF-001] Assets de 1.3 GB** — 1322 imágenes sin comprimir.
> Este es el bloqueador principal para stores.
> Solución: pipeline de compresión + Asset Delivery diferida.
> Esfuerzo: 1 día de setup initial + pipeline automatizado.
> **No forma parte del scope de este audit de código** — es una tarea de DevOps/assets.
