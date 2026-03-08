---
name: torre-politics
description: TORRE politics, alliances, guild, and reputation system. Covers alliance formation, protection contracts, bounty & guild interaction, extortion mechanics, and negotiation. Use when implementing guild features, alliance UI, political interactions between parties, or bounty-related diplomacy. Keywords: gremio, guild, alianza, alliance, política, bounty, extorsión, negociación, reputación.
argument-hint: [feature: "alliance UI" | "guild log" | "bounty display" | "negotiation" | "protection contract"]
---

# TORRE — Política, Alianzas y Gremio

---

## El Gremio

El gremio es la entidad central de la torre:
- Registra eventos visibles de la torre.
- Gestiona bounties y recompensas.
- Facilita alianzas entre parties.
- Publica el **World Log**.

### Limitación Importante
El gremio **NO** tiene conocimiento absoluto. Solo conoce lo que ha sido:
- Reportado explícitamente.
- Testigüado.
- Evidenciado.

La información opaca es intencional — crea incertidumbre estratégica.

---

## Sistema Político entre Parties

Las parties interactúan políticamente mediante:
- Alianzas.
- Protección por pago.
- Acuerdos de no agresión.
- Intercambio de recursos.
- Traición indirecta (terminar contrato voluntariamente).

---

## Alianzas — Reglas

### Formación
Una alianza requiere:
1. Una party paga protección a otra.
2. Ambas aceptan los términos.
3. Duración: mientras el pago continúe, o hasta renegociación.

### Ruptura (Traición Controlada)
- No existe traición arbitraria dentro de una alianza activa.
- La alianza termina automáticamente cuando **se detiene el pago**.
- Esto evita caos impredecible.

```typescript
interface Alliance {
  id: string;
  seedId: string;
  partyA: string;         // protegido
  partyB: string;         // protector
  protectionFee: number;  // oro por ciclo
  expiresAtCycle: number;
  status: 'active' | 'expired' | 'broken';
}
```

---

## Extorsión Estratégica

Una party poderosa puede:
- Exigir pago a cambio de protección.
- Ofrecer seguridad contra otras parties.

El jugador decide:
- **Pagar** → preserva recursos, evita conflicto.
- **Rechazar** → asume riesgo de ataque.

---

## Bounty y Diplomacia

Si una party tiene alto bounty:
- Es objetivo prioritario de IA.
- Es difícil conseguir aliados.
- Las IA evalúan riesgo antes de protegerla.
- El historial de violencia **es permanente**.

Ver `torre-ai-system` para el cálculo de BountyMultiplier.

---

## Negociación

La negociación ocurre **en el pueblo** (zona segura).

Se pueden intercambiar:
- Oro.
- Materiales.
- Protección.
- Información/rumores.

La IA puede simular acuerdos automáticamente entre parties IA.

---

## Zonas Seguras

En el **pueblo**:
- ❌ No se permiten combates.
- ❌ No se permiten emboscadas.
- ✅ Solo interacción diplomática o comercial.

En **salas de jefe**:
- Acceso bloqueado mientras otra party esté dentro.

---

## World Log

Estructura de evento del gremio:
```typescript
interface GuildEvent {
  id: string;
  seedId: string;
  message: string;   // "Party X derrotó a Party Y en piso 15"
  cycle: number;
  type: 'Combat' | 'BossKilled' | 'AllianceFormed' | 'BountyIssued' | 'PartyEliminated';
}
```

---

## Archivos Relacionados

| Archivo | Propósito |
|---|---|
| `src/screens/GuildScreen.tsx` | UI del gremio y world log |
| `src/services/allianceService.ts` | Lógica de alianzas y protección |
| `src/services/bountyService.ts` | Gestión de bounties |
| `src/database/gameRepository.ts` | Persistencia de alianzas/bounties |
| `src/stores/gameStore.ts` | Estado global con alianzas activas |

---

## Anti-Patrones a Evitar

- ❌ No permitir combate en el pueblo.
- ❌ No borrar historial de bounty/violencia automáticamente.
- ❌ No dar información al gremio que no haya sido reportada/evidenciada.
- ❌ No permitir ruptura de alianza durante ciclo activo sin terminar el contrato.
