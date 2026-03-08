---
name: torre-economy
description: TORRE economy system — gold, loot, item drops, boss unique drops, revive costs, and economic balance rules. Use when implementing loot drops, gold transactions, revive logic, item management, or economy-related features. Keywords: economy, gold, loot, items, revive, boss drop, oro, equipo.
argument-hint: [feature: "loot drop" | "revive cost" | "boss loot" | "gold transaction" | "item system"]
---

# TORRE — Economía y Sistema de Loot

---

## Reglas de Oro

- Cada party posee una **cuenta dimensional privada** (no física en el mapa).
- El oro **NO puede ser robado** directamente.
- Solo usan el oro los **miembros de esa party**.
- PvP **NO genera oro**.

### Usos del Oro
- Revivir miembros.
- Comprar equipo.
- Pagar protección/alianzas.
- Mejoras en el pueblo.

---

## Generación de Oro

El oro se obtiene de:
- Derrotar monstruos nativos.
- Completar eventos.
- Derrotar jefes.
- Completar objetivos de piso.

---

## Sistema de Loot

### Al derrotar criaturas
Se obtiene:
- Equipo no equipado.
- Consumibles.
- Materiales.
- Objetos comunes.

### Al derrotar otra party (PvP)
Solo se puede tomar:
- Parte del botín recolectado **en el ciclo actual**.
- Objetos **NO equipados**.

**NO** se puede obtener:
- Oro.
- Equipo equipado.
- Objetos únicos de jefe.

---

## Botín Único de Jefes

- Cada jefe tiene **un botín único por seed**.
- Solo se obtiene la **primera vez** que es derrotado.
- En temporadas futuras puede volver a obtenerse.
- Si ya fue reclamado → solo deja loot estándar.

---

## Fórmulas de Economía

### Costo de Revivir
```typescript
const REVIVE_BASE_COST = 100;

function reviveCost(characterLevel: number, deathCount: number): number {
  const base = REVIVE_BASE_COST * characterLevel;
  return deathCount > 0 ? base * (1 + deathCount * 0.15) : base;
}
```

### Control de Inflación
- Precios de revivir **escalan con nivel**.
- Equipos poderosos requieren **materiales raros** (de pisos altos).
- La economía está ligada al **progreso vertical** — no al tiempo.

---

## Modelo de Datos

### Items
```typescript
Item {
  id: string;
  seedId: string;
  ownerPartyId: string | null;
  equippedBy: string | null;        // characterId nullable
  name: string;
  type: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  isUnique: boolean;                // true para loot de jefe
  obtainedCycle: number;
  isEquipped: boolean;
}
```

---

## Archivos Relacionados

| Archivo | Propósito |
|---|---|
| `src/services/lootService.ts` | Generación de loot al vencer enemigos |
| `src/services/economyService.ts` | Transacciones de oro, revivir |
| `src/database/gameRepository.ts` | Persistencia de items y oro |
| `src/stores/gameStore.ts` | Estado global de inventario/gold |
| `src/screens/BattleScreen.tsx` | Trigger de loot post-combate |

---

## Anti-Patrones a Evitar

- ❌ No permitir oro negativo.
- ❌ No generar loot de jefe si ya fue reclamado en esta seed.
- ❌ No transferir equipo equipado en loot PvP.
- ❌ No dar XP por matar parties (solo oro/loot están en play).
