# 🗺️ Roadmap de Auditoría — audit-001
**Fecha:** 2026-03-14  
**Proyecto:** TORRE (dnd3) — React Native 0.84.0  
**Auditoría anterior:** Primera auditoría

---

## Estado general

| Categoría | Hallazgos | Severidad | Estado |
|---|---|---|---|
| 🔒 Seguridad | 7 | 🟡 Media | Pendiente |
| ⚙️ Rendimiento | 11 | 🔴 Alta | Pendiente |
| 🏗️ Arquitectura | 7 | 🔴 Alta | Pendiente |
| 🧪 Testing | 4 | 🔴 Alta | Pendiente |
| 📦 Dependencias | 9 | 🟡 Media | Pendiente |
| ♿ Accesibilidad | 3 | 🔴 Alta | Pendiente |

**Total de hallazgos:** 41  
**Esfuerzo total estimado:** 25-40 horas

---

## Orden de ejecución recomendado

### 🚨 Fase 1 — Crítico (hacer YA, antes del próximo deploy)
> Tiempo estimado: 4-5 horas

1. **[ARCH-001]** Sin ErrorBoundary — crash sin recovery  
   📄 Ver: [`03-architecture.md#arch-001`](./03-architecture.md#arch-001)  
   ⏱ 30 min

2. **[SEG-009]** JSON.parse sin try/catch crashea con datos corruptos  
   📄 Ver: [`01-security.md#seg-009`](./01-security.md#seg-009)  
   ⏱ 30 min

3. **[SEG-005]** console.warn sin __DEV__ guard filtra datos  
   📄 Ver: [`01-security.md#seg-005`](./01-security.md#seg-005)  
   ⏱ 10 min

4. **[PERF-003]** ReportScreen bloquea JS thread en mount  
   📄 Ver: [`02-performance.md#perf-003`](./02-performance.md#perf-003)  
   ⏱ 30 min

5. **[PERF-010]** ExtractionScreen 30ms interval = 33 renders/seg  
   📄 Ver: [`02-performance.md#perf-010`](./02-performance.md#perf-010)  
   ⏱ 30 min

6. **[TEST-001]** 2 test suites fallan (op-sqlite mock)  
   📄 Ver: [`04-testing.md#test-001`](./04-testing.md#test-001)  
   ⏱ 30 min

7. **[DEP-002]** @shopify/react-native-skia sin usar (~5 MB de binary)  
   📄 Ver: [`05-dependencies.md#dep-002`](./05-dependencies.md#dep-002)  
   ⏱ 5 min

8. **[DEP-007]** react-native-dotenv sin usar + riesgo de exposición  
   📄 Ver: [`05-dependencies.md#dep-007`](./05-dependencies.md#dep-007)  
   ⏱ 10 min

9. **[DEP-001]** react-native-fast-image sin usar  
   📄 Ver: [`05-dependencies.md#dep-001`](./05-dependencies.md#dep-001)  
   ⏱ 5 min

---

### ⚠️ Fase 2 — Importante (próximo sprint)
> Tiempo estimado: 8-10 horas

10. **[SEG-002]** IPs LAN hardcodeadas en servicios ComfyUI  
    📄 Ver: [`01-security.md#seg-002`](./01-security.md#seg-002)  
    ⏱ 30 min

11. **[PERF-006]** React.memo faltante en CRTOverlay y otros  
    📄 Ver: [`02-performance.md#perf-006`](./02-performance.md#perf-006)  
    ⏱ 30 min

12. **[PERF-007]** FlatList sin optimización en CatalogPortraitPicker  
    📄 Ver: [`02-performance.md#perf-007`](./02-performance.md#perf-007)  
    ⏱ 20 min

13. **[PERF-011]** SQLite sync en VillageScreen mount  
    📄 Ver: [`02-performance.md#perf-011`](./02-performance.md#perf-011)  
    ⏱ 15 min

14. **[PERF-012]** Portrait assignment loop en GuildScreen  
    📄 Ver: [`02-performance.md#perf-012`](./02-performance.md#perf-012)  
    ⏱ 20 min

15. **[PERF-001]** Migrar 4 componentes de Animated → Reanimated  
    📄 Ver: [`02-performance.md#perf-001`](./02-performance.md#perf-001)  
    ⏱ 2 horas

16. **[ARCH-002]** Empty catch blocks — documentar o agregar logging  
    📄 Ver: [`03-architecture.md#arch-002`](./03-architecture.md#arch-002)  
    ⏱ 1 hora

17. **[ARCH-005]** Casts `as React.ComponentType<object>` en navegación  
    📄 Ver: [`03-architecture.md#arch-005`](./03-architecture.md#arch-005)  
    ⏱ 2 horas

18. **[ARCH-007]** Transacciones faltantes en repositorios secundarios  
    📄 Ver: [`03-architecture.md#arch-007`](./03-architecture.md#arch-007)  
    ⏱ 1 hora

19. **[TEST-004]** Configurar CI (GitHub Actions)  
    📄 Ver: [`04-testing.md#test-004`](./04-testing.md#test-004)  
    ⏱ 30 min

20. **[DEP-003]** react-native-worklets verificar/remover  
    📄 Ver: [`05-dependencies.md#dep-003`](./05-dependencies.md#dep-003)  
    ⏱ 10 min

21. **[DEP-005]** @react-native/new-app-screen remover  
    📄 Ver: [`05-dependencies.md#dep-005`](./05-dependencies.md#dep-005)  
    ⏱ 2 min

---

### 💡 Fase 3 — Mejoras (backlog técnico)
> Tiempo estimado: 12-20 horas

22. **[BRF-001]** Assets de 1.3 GB — comprimir o mover a CDN  
    📄 Ver: [`plan/BRIEFING.md#brf-001`](../../BRIEFING.md#brf-001)  
    ⏱ 3-5 días

23. **[BRF-002]** Strings hardcodeados sin i18n en 12+ pantallas  
    📄 Ver: [`plan/BRIEFING.md#brf-002`](../../BRIEFING.md#brf-002)  
    ⏱ 4+ horas

24. **[A11Y-001]** Zero accessibility props en la app completa  
    📄 Ver: [`06-accessibility.md#a11y-001`](./06-accessibility.md#a11y-001)  
    ⏱ 3 horas

25. **[ARCH-003]** Archivos masivos — extraer hooks y sub-componentes  
    📄 Ver: [`03-architecture.md#arch-003`](./03-architecture.md#arch-003)  
    ⏱ 4+ horas por pantalla

26. **[TEST-002]** Aumentar cobertura de combatEngine  
    📄 Ver: [`04-testing.md#test-002`](./04-testing.md#test-002)  
    ⏱ 4+ horas

27. **[PERF-002]** BattleScreen useEffect chain refactor  
    📄 Ver: [`02-performance.md#perf-002`](./02-performance.md#perf-002)  
    ⏱ 4+ horas

---

### 💅 Fase 4 — Estilo y convenciones
> Tiempo estimado: 2-4 horas

28. **[BRF-006]** Unificar StyleSheet.create → NativeWind  
29. **[BRF-008]** Reducir `as any` en GlossaryModal  
30. **[DEP-006]** Remover uuid  
31. **[DEP-008]** Documentar parche de image-manipulator  
32. **[SEG-004]** Documentar URL hardcodeada de DnD 5e API  

---

## Cómo usar este roadmap

1. Ir al hallazgo en el orden indicado
2. Abrir el documento de la categoría referenciado
3. Seguir los pasos de solución
4. Marcar el checkbox en el documento de categoría
5. Actualizar la columna "Estado" en la tabla de arriba
