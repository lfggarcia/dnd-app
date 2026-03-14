# 🗺️ Roadmap de Auditoría — audit-001
**Fecha:** 2026-03-13  
**Proyecto:** TORRE (dnd3)  
**React Native:** 0.84.0  
**Auditoría anterior:** Primera auditoría

---

## Estado general

| Categoría | Hallazgos | Severidad | Estado |
|---|---|---|---|
| 🔒 Seguridad | 3 | 🟡 Media | Pendiente |
| ⚙️ Rendimiento | 3 | 🟡 Media | Pendiente |
| 🏗️ Arquitectura | 3 | 🟡 Media | Pendiente |
| 🧪 Testing | 4 | 🟡 Media | Pendiente |
| 📦 Dependencias | 4 | 🟡 Media | Pendiente |
| ♿ Accesibilidad | 4 | 🟡 Media | Pendiente |

**Total de hallazgos:** 21  
**Esfuerzo total estimado:** 19–34 horas  
**Severidad máxima encontrada:** 🟡 Media (sin hallazgos Críticos ni Altos)

> ✅ **Buenas noticias:** No se encontraron hallazgos críticos. El codebase es sólido, TypeScript estricto, arquitectura bien separada, y buena cobertura de lógica de negocio. Los hallazgos son mejoras de calidad y robustez, no problemas bloqueantes.

---

## Orden de ejecución recomendado

### 🚨 Fase 1 — Fixes rápidos de alto valor (1 día)
> Tiempo estimado: 3–5 horas

1. **[SEG-001]** `usesCleartextTraffic: true` en AndroidManifest — crear `network_security_config.xml`  
   📄 Ver: [`01-security.md`](./01-security.md)  
   ⏱ 30 min

2. **[TEST-001]** Dos suites de tests fallando — crear mock para `@op-engineering/op-sqlite`  
   📄 Ver: [`04-testing.md`](./04-testing.md)  
   ⏱ 30 min

3. **[ARQ-001]** Sin `ErrorBoundary` global — un crash inesperado tumba toda la app  
   📄 Ver: [`03-architecture.md`](./03-architecture.md)  
   ⏱ 1 hora

4. **[DEP-001]** Sin `package-lock.json` — `npm audit` inoperable, builds no deterministas  
   📄 Ver: [`05-dependencies.md`](./05-dependencies.md)  
   ⏱ 30 min

5. **[SEG-002]** IPs y URLs de desarrollo hardcodeadas en `imageGenerationService.ts`  
   📄 Ver: [`01-security.md`](./01-security.md)  
   ⏱ 1 hora

---

### ⚠️ Fase 2 — Mejoras importantes (próximo sprint)
> Tiempo estimado: 8–12 horas

6. **[PERF-001]** `setTimeout` sin cleanup en `NegotiationScreen`, `LevelUpScreen`, `GuildScreen` — setState over unmounted  
   📄 Ver: [`02-performance.md`](./02-performance.md)  
   ⏱ 1.5 horas

7. **[ARQ-002]** 3 pantallas con +900 líneas mezclando lógica UI y negocio (`BattleScreen`, `GuildScreen`, `VillageScreen`)  
   📄 Ver: [`03-architecture.md`](./03-architecture.md)  
   ⏱ 4–6 horas

8. **[TEST-002]** Sin CI/CD — crear `.github/workflows/ci.yml`  
   📄 Ver: [`04-testing.md`](./04-testing.md)  
   ⏱ 1 hora

9. **[ACC-001]** Cero `accessibilityLabel` en toda la app — VoiceOver/TalkBack inutilizable  
   📄 Ver: [`06-accessibility.md`](./06-accessibility.md)  
   ⏱ 2–3 horas (botones principales)

10. **[SEG-003]** `console.warn` no protegidos por `__DEV__` en múltiples pantallas  
    📄 Ver: [`01-security.md`](./01-security.md)  
    ⏱ 30 min

---

### 💡 Fase 3 — Backlog técnico (mejoras continuas)
> Tiempo estimado: 6–15 horas

11. **[PERF-002]** `FlatList` en `CatalogPortraitPicker` sin `initialNumToRender`/`maxToRenderPerBatch`  
    📄 Ver: [`02-performance.md`](./02-performance.md)  
    ⏱ 30 min

12. **[PERF-003]** Oportunidades de `react-native-reanimated` donde se usa `Animated` con JS thread  
    📄 Ver: [`02-performance.md`](./02-performance.md)  
    ⏱ 2–4 horas

13. **[ARQ-003]** Uso moderado de `as any` en servicios de imagen — mejorar tipado  
    📄 Ver: [`03-architecture.md`](./03-architecture.md)  
    ⏱ 1 hora

14. **[TEST-003]** Pantallas críticas sin tests de componente (`BattleScreen`, `MapScreen`, `VillageScreen`)  
    📄 Ver: [`04-testing.md`](./04-testing.md)  
    ⏱ 3–5 horas

15. **[TEST-004]** Sin tests E2E para flujos críticos (combate, compra, level-up)  
    📄 Ver: [`04-testing.md`](./04-testing.md)  
    ⏱ 4–8 horas (setup Maestro + 4 flows)

16. **[DEP-002]** `react-native-fast-image@8.6.3` sin mantenimiento activo — evaluar migración a fork activo  
    📄 Ver: [`05-dependencies.md`](./05-dependencies.md)  
    ⏱ 1–2 horas

17. **[DEP-003]** `@oguzhnatly/react-native-image-manipulator` fork de nicho + patch aplicado — evaluar alternativa  
    📄 Ver: [`05-dependencies.md`](./05-dependencies.md)  
    ⏱ 2–4 horas

18. **[DEP-004]** `react-native-fs@2.20.0` sin soporte documentado para New Arch  
    📄 Ver: [`05-dependencies.md`](./05-dependencies.md)  
    ⏱ 1–2 horas

19. **[ACC-002]** Imágenes decorativas sin `accessible={false}` — ruido en VoiceOver  
    📄 Ver: [`06-accessibility.md`](./06-accessibility.md)  
    ⏱ 1 hora

20. **[ACC-003]** Targets táctiles potencialmente pequeños — verificar y añadir `hitSlop`  
    📄 Ver: [`06-accessibility.md`](./06-accessibility.md)  
    ⏱ 1 hora

21. **[ACC-004]** Sin soporte `reduceMotion` en animaciones de combate  
    📄 Ver: [`06-accessibility.md`](./06-accessibility.md)  
    ⏱ 1–2 horas

---

## Resumen de deuda técnica por área

```
Seguridad     ████░░░░░░  3 hallazgos  🟡 Todos medios
Rendimiento   ████░░░░░░  3 hallazgos  🟡 Todos medios  
Arquitectura  ████░░░░░░  3 hallazgos  🟡 Todos medios
Testing       ████████░░  4 hallazgos  🟡 Medios (2 suites fallando)
Dependencias  ████░░░░░░  4 hallazgos  🟡 Todos medios
Accesibilidad ████████░░  4 hallazgos  🟡 Todas medias (cero a11y attributes)
```

---

## Fortalezas detectadas (no requieren acción)

✅ TypeScript estricto — 0 `@ts-ignore`, 0 `any` explícito en lógica de negocio  
✅ Arquitectura en capas clara — screens → services → database  
✅ Zustand 5 bien utilizado, sin prop drilling profundo  
✅ `useNativeDriver: true` en todas las animaciones revisadas  
✅ `React.memo`, `useCallback`, `useMemo` aplicados en los componentes correctos  
✅ Lazy loading de pantallas en `AppNavigator`  
✅ `react-native-fast-image` para caché de imágenes  
✅ SQLite con migraciones controladas y tests  
✅ PRNG seed-based determinista con tests  
✅ 75 tests pasando, buenos unit tests de lógica de negocio  
✅ `.gitignore` cubre correctamente `.env` y secretos  
✅ Sin API keys hardcodeadas en código de producción  

---

## Cómo usar este roadmap

1. Ir al hallazgo en el orden indicado arriba
2. Abrir el documento de la categoría referenciado
3. Seguir los pasos de solución del hallazgo
4. Actualizar la columna "Estado" de la tabla superior a `✅ Resuelto`
5. Usar `rn-fix` skill para aplicar los fixes automáticamente
