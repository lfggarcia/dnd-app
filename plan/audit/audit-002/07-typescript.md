# 📐 TypeScript — Auditoría TORRE (dnd3) — audit-002

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** 5 archivos  
> **Esfuerzo estimado:** 2-3 horas  
> **Fecha:** 2026-03-14

---

## Resumen ejecutivo

El codebase está en TypeScript estricto y `npx tsc --noEmit` pasa sin errores — buen punto
de partida. Los issues de TypeScript son de dos tipos: (1) casts `as any` que silencian
el compilador, y (2) la inconsistencia de tipo en el `VillageScreen` donde una navegación
usa `as any` para un route name. Nada crítico, pero limpiarlo mejora la seguridad de tipos.

---

## Hallazgos

### [TS-001] 8 usos de `as any` — silencian el compilador en puntos clave

**Archivo(s):** 5 archivos  
**Severidad:** 🟡 Media  
**Impacto:** Los casts `as any` deshabilitan el verificador de tipos. En servicios que manejan
datos externos (API, SQLite), esto puede ocultar crashes en runtime.

**Inventario completo:**

| Archivo | Línea | Contexto | Riesgo |
|---------|-------|----------|--------|
| `screens/VillageScreen.tsx:200` | `navigation.navigate(screen as any)` | Route name dinámico | Medio |
| `screens/CharacterDetailScreen.tsx:147` | `left: \`${tickPct}%\` as any` | CSS percentage en RN | Bajo |
| `components/GlossaryModal.tsx:90` | `raw.ability_bonuses as any[]` | API response DnD 5e | Medio |
| `components/GlossaryModal.tsx:93` | `raw.traits as any[]` | API response DnD 5e | Medio |
| `components/GlossaryModal.tsx:109` | `raw.saving_throws as any[]` | API response DnD 5e | Medio |
| `components/GlossaryModal.tsx:127` | `raw.armor_class as any[]` | API response DnD 5e | Medio |
| `services/geminiImageService.ts:455` | `(formData as any).append(...)` | FormData multipart | Bajo |
| `services/enemySpriteService.ts:223` | `(formData as any).append(...)` | FormData multipart | Bajo |

**Solución por caso:**

**VillageScreen.tsx:200 — navegación dinámica:**
```ts
// ANTES
if (screen) navigation.navigate(screen as any);

// DESPUÉS — tipar el screen como keyof RootStackParamList
import type { RootStackParamList } from '../navigation/types';
import type { NavigationProp } from '@react-navigation/native';

type ValidScreen = keyof RootStackParamList;
// screen debe ser tipado como ValidScreen en su declaración
const screen: ValidScreen = 'Village'; // ejemplo
navigation.navigate(screen); // ✅ type-safe
```

**GlossaryModal.tsx — respuestas de API externa:**
```ts
// Crear tipos para la respuesta de la API DnD 5e
interface DnD5eAbilityBonus {
  ability_score: { index: string; name: string; url: string };
  bonus: number;
}
interface DnD5eRaceResponse {
  ability_bonuses: DnD5eAbilityBonus[];
  traits: Array<{ index: string; name: string; url: string }>;
  saving_throws: Array<{ index: string; name: string; url: string }>;
  armor_class: Array<{ type: string; value: number }>;
}

// Usar los tipos:
const bonuses = (raw as DnD5eRaceResponse).ability_bonuses;
```

**FormData en geminiImageService/enemySpriteService:**
```ts
// React Native's FormData acepta esto con cast más seguro:
formData.append('image', {
  uri: imageUri,
  type: 'image/jpeg',
  name: 'image.jpg',
} as unknown as Blob);
// 'as unknown as Blob' es más seguro que 'as any' — al menos requiere pasar por unknown
```

**Tiempo estimado:** 1-2 horas  
**Prioridad:** P2 — Mejora la seguridad de tipos gradualmente

---

### [TS-002] `as const` en traducciones — buena práctica ya en uso

**Archivo(s):** `src/i18n/translations/es.ts`, `src/i18n/translations/en.ts`  
**Severidad:** ✅ Sin issues  
**Nota:** Ambos archivos de traducción usan `} as const` al final, lo que narrowea los tipos
a literales y permite type-checking de las keys. ✅ Correcto.

---

## Checklist de verificación

- [ ] TS-001: VillageScreen.tsx → screen tipado como keyof RootStackParamList
- [ ] TS-001: GlossaryModal.tsx → tipos para DnD 5e API response creados
- [ ] TS-001: FormData appends → cast `as unknown as Blob` en lugar de `as any`
