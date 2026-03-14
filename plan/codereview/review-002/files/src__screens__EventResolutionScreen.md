# Code Review: `src/screens/EventResolutionScreen.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** 402  
**Severidad general:** 🟡 Observaciones moderadas  
**Comentarios:** 3 observaciones (2🟡, 1✅)

---

## Resumen

Pantalla de resolución de eventos de sala (`EVENT` rooms) — 6 tipos de evento (AMBUSH, MERCHANT,
SHRINE, TRAP, LORE, ALLY) con resolución PRNG determinista. Lógica de mecánicas bien implementada
y aislada. Los strings de UI están completamente en español sin i18n.

---

## [CR-055] `EVENT_CONFIGS` completamente en español — sin soporte i18n 🟡

> **Líneas:** 28–79  
> **Tipo:** i18n  
> **Referencia audit:** I18N-001

```ts
const EVENT_CONFIGS: Record<EventType, EventConfig> = {
  AMBUSH: {
    title: 'EMBOSCADA',
    flavor: 'Sombras se mueven entre las grietas. Los rastros de sangre son frescos.',
    primaryLabel: 'DEFENDER',
    secondaryLabel: 'HUIR',
    // ...
  },
  MERCHANT: {
    title: 'MERCADER ERRANTE',
    // ...
  },
  // ...
};
```

Los 6 eventos tienen título, flavor, labels, y descripciones solo en español. Esto es un
bloque grande de contenido resistente a la internacionalización porque está en un objeto
de constante exportado.

**Propuesta:** Mover a traducciones o usar función que acepte `lang`:
```ts
function getEventConfig(type: EventType, lang: Lang): EventConfig { ... }
// O:
const EVENT_CONFIGS_ES: Record<EventType, EventConfig> = { ... };
const EVENT_CONFIGS_EN: Record<EventType, EventConfig> = { ... };
const EVENT_CONFIGS = { es: EVENT_CONFIGS_ES, en: EVENT_CONFIGS_EN };
```

**Prioridad:** P2 — Esta pantalla es parte del game loop principal.

---

## [CR-056] Outcome `message` strings de `applyOutcome` en español — sin exportar 🟡

> **Líneas:** 90–190  
> **Tipo:** i18n

```ts
message = `${target.name} absorbe el golpe (-${dmg} HP)`;
message = 'La party huye. Moral -10 a todos.';
message = 'No tienes suficiente gold (necesitas 30).';
message = 'Trampa desactivada. Ningún daño.';
```

Los mensajes de outcome de `applyOutcome` son strings hardcodeados en español. Estos se
muestran al usuario como feedback de la acción. Requieren la misma solución que CR-055:
pasar `lang` a `applyOutcome` o usar claves de traducción.

---

## [CR-057] Lógica de mecánicas correcta e inmutable ✅

> **Tipo:** Positivo

```ts
function applyOutcome(...): { newParty: CharacterSave[]; newGold: number; message: string } {
  let newParty = party.map(c => ({ ...c }));  // deep copy
  // ... switch por eventType
  return { newParty, newGold, message };
}
```

`applyOutcome` es una función pura que retorna nuevos objetos sin mutar los parámetros.
Las mecánicas son correctas per SYSTEMS.MD:
- AMBUSH: absorb (-20% maxHP) vs flee (-10 moral)
- MERCHANT: 30g por +10 HP (con gold check)
- SHRINE: full heal al miembro con menos HP
- TRAP: 50% disarm vs absorb (-15% maxHP al de más HP)
- ALLY: +10 moral vs -5 moral (moral consequence)

---

## Patrones positivos adicionales

- ✅ `resolveEventType` determinista vía `makePRNG` — mismo `eventSeed` siempre da el mismo evento
- ✅ `eventType` de route.params tiene prioridad — permite forzar tipo específico desde MapScreen
- ✅ Selectores granulares (`partyData`, `gold` sin `activeGame` completo)
- ✅ Sin eslint-disable
