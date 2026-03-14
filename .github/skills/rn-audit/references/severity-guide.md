# Guía de Severidad — React Native Audit

## Niveles de severidad

### 🔴 Alta (P1 — Crítico)
**Criterio:** Riesgo de seguridad real, crash en producción, o pérdida de datos  
**Tiempo de respuesta:** Resolver antes del próximo deploy  
**Ejemplos:**
- API key o token expuesto en código fuente
- Vulnerabilidad con CVE en dependencia crítica (score CVSS ≥ 7)
- Memory leak que causa crash en sesiones largas
- Datos de usuario guardados sin cifrado (tokens, contraseñas)
- Comunicación HTTP en lugar de HTTPS con datos sensibles

### 🟡 Media (P2 — Importante)
**Criterio:** Degrada la experiencia del usuario o crea deuda técnica significativa  
**Tiempo de respuesta:** Próximo sprint o iteración  
**Ejemplos:**
- Re-renders excesivos que causan janks visibles (< 60fps)
- Ausencia de manejo de errores en flujos críticos
- `ScrollView` con listas grandes (degradación de memoria)
- Dependencias desactualizadas sin CVE pero sin mantenimiento
- Cobertura de tests < 30% en módulos críticos
- Prop drilling profundo que dificulta cambios

### 🟢 Baja (P3 — Mejora)
**Criterio:** Buenas prácticas, mantenibilidad, o deuda técnica menor  
**Tiempo de respuesta:** Backlog, cuando haya capacidad  
**Ejemplos:**
- `console.log` en código de producción
- Falta de `accessibilityLabel` en elementos no críticos
- Uso de `any` en TypeScript en áreas no críticas
- Inconsistencia en convenciones de nombres
- Imágenes sin caché (degradación menor de UX)
- Dependencias de dev en `dependencies`

---

## Matriz de impacto vs esfuerzo

```
IMPACTO
  Alto │ Hacer YA    │ Planificar  │
       │ (P1)        │ (P1/P2)     │
       ├─────────────┼─────────────┤
  Bajo │ Quick wins  │ Evaluar si  │
       │ (P3)        │ vale        │
       └─────────────┴─────────────┘
         Bajo esfuerzo  Alto esfuerzo
```

---

## Estimación de tiempos de referencia

| Tipo de tarea | Tiempo aproximado |
|---|---|
| Mover secret a variable de entorno | 15-30 min |
| Migrar AsyncStorage a Keychain (1 módulo) | 1-2 horas |
| Reemplazar ScrollView por FlatList | 30 min - 1 hora |
| Agregar React.memo + useCallback a componente | 30-45 min |
| Configurar certificate pinning | 2-4 horas |
| Agregar ErrorBoundary global | 1 hora |
| Actualizar dependencia con breaking changes | 1-4 horas |
| Agregar tests a módulo sin cobertura | 2-8 horas |
| Refactorizar componente con prop drilling | 2-6 horas |
| Audit de accesibilidad completo | 4-8 horas |

---

## Cómo documentar la severidad en los hallazgos

Usar siempre el formato:
```
**Severidad:** 🔴 Alta — Riesgo de exposición de credenciales
**Severidad:** 🟡 Media — Degradación de rendimiento en listas largas  
**Severidad:** 🟢 Baja — Mejora de mantenibilidad
```

Incluir siempre el **porqué** de la severidad, no solo el emoji.