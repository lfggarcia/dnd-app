# Code Review: Database Layer

**Revisado:** 2026-03-14

---

## `src/database/connection.ts` — ✅ Sin issues

**Líneas:** 19 | Severidad: 🟢

Singleton pattern correcto para la conexión SQLite:
```ts
let db: DB | null = null;
export function getDB(): DB {
  if (!db) db = open({ name: DB_NAME });
  return db;
}
```
- ✅ Lazy initialization — no conecta a DB hasta el primer uso
- ✅ `closeDB()` disponible para cleanup
- ✅ Sin estado global mutable excepto el singleton de DB (aceptable para SQLite)

---

## `src/database/gameRepository.ts`

**Líneas:** ~420 | Severidad: 🟡

### [CR-062] `null as unknown as string` — patrón repetido para nullable params 🟡

> **Líneas:** múltiples (updateSavedGame función ~300 líneas)  
> **Tipo:** TypeScript / Mantenibilidad

```ts
values.push(updates.mapState ?? null as unknown as string);
values.push(updates.partyPortrait ?? null as unknown as string);
values.push(updates.portraitsJson ? JSON.stringify(...) : null as unknown as string);
```

El array `values` está tipado como `(string | number)[]` pero op-sqlite acepta `null`
para valores SQL NULL. El cast `null as unknown as string` es un workaround para satisfacer
el tipo del array mientras se pasan valores nulos a la BD.

**Propuesta:** Cambiar el tipo del array para admitir `null`:
```ts
const values: (string | number | null)[] = [];
// Elimina todos los `null as unknown as string`
```

Esto requiere actualizar el tipo en el `executeSync` call también, pero eliminaría 8+ casts
y haría el código más honesto.

**Prioridad:** P3 — No es un bug, pero genera ruido en el código.

---

### [CR-063] `updateSavedGame` — 110 líneas de if-chains repetitivas 🟡

> **Líneas:** 288–400  
> **Tipo:** Mantenibilidad / DRY

```ts
if (updates.partyData !== undefined) {
  sets.push('party_data = ?');
  values.push(JSON.stringify(leanParty(updates.partyData)));
}
if (updates.floor !== undefined) {
  sets.push('floor = ?');
  values.push(updates.floor);
}
// ... 20+ más
```

La función tiene 110 líneas de if-chains para construir la query dinámica. Cada nuevo campo
requiere añadir un nuevo bloque.

**Propuesta alternativa más DRY** (si se acepta como refactor futuro):
```ts
const FIELD_MAP: Record<string, (v: unknown) => string | number | null> = {
  'party_data': (v) => JSON.stringify(leanParty(v as CharacterSave[])),
  'floor': (v) => v as number,
  // ...
};
// Reducir a un loop
```

**Prioridad:** P4 — Funciona correctamente. Refactorizar solo si se añaden muchos campos nuevos.

---

### [CR-064] `rowToSavedGame` — retrocompat `characterId` correcta ✅

> **Línea:** 183  
> **Tipo:** Positivo

```ts
return parsed.map(c => c.characterId ? c : { ...c, characterId: generateId() });
```

La retrocompatibilidad para caracteres sin `characterId` (NI-09) está implementada correctamente
en la capa de lectura — no en las migraciones. Esto garantiza que saves viejos sean válidos
sin necesitar una migración destructiva.

---

## Otros archivos de DB — ✅ Sin issues críticos

| Archivo | Notas |
|---------|-------|
| `itemRepository.ts` | CRUD estándar, queries parametrizadas, sin SQL injection (✅) |
| `rivalRepository.ts` | CRUD simple, queries parametrizadas |
| `essenceRepository.ts` | Mismo patrón, correcto |
| `eventRepository.ts` | Registro de eventos, sin issues |
| `index.ts` | Re-exports + `getResource` helper para datos estáticos |

### [CR-065] Todas las queries usan parámetros `?` — sin SQL injection ✅

> **Tipo:** Positivo — Seguridad

```ts
db.executeSync('SELECT * FROM saved_games WHERE id = ?', [id]);
db.executeSync(`UPDATE saved_games SET ${sets.join(', ')} WHERE id = ?`, values);
```

Ningún archivo de la capa DB construye queries con interpolación de strings de inputs externos.
Todas usan parámetros posicionales `?` — inmune a SQL injection. ✅
