# 06 · CREACIÓN DE PARTIES, HERENCIA Y PROGRESIÓN
> **Estado actual:** ~40% — creación de personaje real y completa, sin herencia de nivel, sin múltiples parties, sin pool de aventureros, sin XP/nivel real
> **Sprint objetivo:** 6
> **Archivos a crear/modificar:** `gameRepository.ts`, `SeedScreen.tsx`, `PartyScreen.tsx`, nuevo `src/services/progressionService.ts`

---

## Concepto

Un jugador puede tener máximo 2 parties activas por seed. Si crea una tercera, elimina la IA más débil. Cuando crea una party nueva (nueva temporada), el nivel máximo inicial es el promedio de la party anterior. Los personajes acumulan XP real y suben de nivel. La muerte permanente ocurre si no hay gold para revivir.

---

## Estado Actual vs Objetivo

| Aspecto | Hoy | Objetivo |
|---------|-----|----------|
| Nivel de personaje | No existe (siempre nivel 1) | `level` + `xp` en `CharacterSave`, sube con XP |
| Máx parties por seed | Sin límite | 2 activas; la 3ra elimina la IA más débil |
| Herencia de nivel | No existe | Nueva party: nivel inicial = avg nivel party anterior |
| Muerte permanente | `alive: false` guardado, pero revivir es gratis | Si `gold < reviveCost` → muerte permanente real |
| XP por combate | `totalXp` calculado en combatEngine pero no persiste en char | Se acumula en `CharacterSave.xp` → sube nivel |
| Pool de aventureros | No existe | Lista de personajes disponibles post-abandono |

---

## Paso 1 — Sistema de progresión (XP y niveles)

Crear `src/services/progressionService.ts`:

```typescript
/**
 * progressionService.ts
 * Maneja la progresión de personajes: XP, niveles, stats al subir nivel.
 */

import type { CharacterSave } from '../database/gameRepository';

// ─── Tabla de XP por nivel (simplificada DnD 5e) ──────────

const XP_THRESHOLDS: Record<number, number> = {
  1:  0,
  2:  300,
  3:  900,
  4:  2700,
  5:  6500,
  6:  14000,
  7:  23000,
  8:  34000,
  9:  48000,
  10: 64000,
};

const MAX_LEVEL = 10;  // MVP: cap en nivel 10 para la Torre

/**
 * Determina el nivel basado en XP acumulada.
 */
export function getLevelFromXP(xp: number): number {
  let level = 1;
  for (const [lvl, threshold] of Object.entries(XP_THRESHOLDS)) {
    if (xp >= threshold) level = Number(lvl);
    else break;
  }
  return Math.min(level, MAX_LEVEL);
}

/**
 * XP necesaria para el próximo nivel.
 */
export function xpToNextLevel(currentXP: number): number {
  const currentLevel = getLevelFromXP(currentXP);
  if (currentLevel >= MAX_LEVEL) return 0;
  return (XP_THRESHOLDS[currentLevel + 1] ?? Infinity) - currentXP;
}

// ─── Bonificaciones al subir de nivel ─────────────────────

export type LevelUpResult = {
  leveledUp: boolean;
  newLevel: number;
  hpGained: number;
  log: string[];
};

/**
 * Aplica XP a un personaje y resuelve subidas de nivel.
 * Retorna el personaje actualizado.
 */
export function applyXP(char: CharacterSave, xpEarned: number): { char: CharacterSave; result: LevelUpResult } {
  const prevLevel = getLevelFromXP(char.xp ?? 0);
  const newXP = (char.xp ?? 0) + xpEarned;
  const newLevel = getLevelFromXP(newXP);
  const log: string[] = [];

  let hpGained = 0;
  let updatedChar = { ...char, xp: newXP, level: newLevel };

  if (newLevel > prevLevel) {
    // HP al subir nivel: dado de vida de la clase + CON mod
    const hitDie: Record<string, number> = {
      barbarian: 12, fighter: 10, paladin: 10, ranger: 10,
      cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
      bard: 8, wizard: 6, sorcerer: 6,
    };
    const die = hitDie[char.charClass.toLowerCase()] ?? 8;
    const conMod = Math.floor((char.baseStats.CON - 10) / 2);
    hpGained = Math.floor(die / 2) + 1 + Math.max(0, conMod);  // promedio del dado + CON

    updatedChar = {
      ...updatedChar,
      maxHp: char.maxHp + hpGained,
      hp: char.hp + hpGained,  // full heal del HP ganado
    };

    log.push(`⭐ ${char.name.toUpperCase()} SUBE A NIVEL ${newLevel} (+${hpGained} HP máx)`);
  }

  return {
    char: updatedChar,
    result: { leveledUp: newLevel > prevLevel, newLevel, hpGained, log },
  };
}

// ─── Herencia entre temporadas ─────────────────────────────

/**
 * SYSTEMS.MD: "Nivel máximo inicial = promedio de nivel de su party anterior."
 * Se llama al crear una nueva party después de que la Torre se cierra.
 */
export function calculateInheritedLevel(previousParty: CharacterSave[]): number {
  if (previousParty.length === 0) return 1;
  const avgLevel = previousParty.reduce((sum, c) => sum + (c.level ?? 1), 0) / previousParty.length;
  return Math.max(1, Math.floor(avgLevel));
}

/**
 * Genera el XP inicial para una nueva party con nivel heredado.
 * La party empieza exactamente en el umbral del nivel heredado.
 */
export function xpForInheritedLevel(inheritedLevel: number): number {
  return XP_THRESHOLDS[inheritedLevel] ?? 0;
}
```

---

## Paso 2 — Distribuir XP después del combate

```typescript
// src/screens/BattleScreen.tsx — en handleContinue

import { applyXP } from '../services/progressionService';

const handleContinue = useCallback(() => {
  if (!result || !activeGame) return;

  // Distribuir XP entre miembros vivos
  const aliveMembers = result.partyAfter.filter(m => m.alive).length;
  const xpPerMember = aliveMembers > 0 ? Math.floor(result.totalXp / aliveMembers) : 0;

  const levelUpLog: string[] = [];

  const updatedPartyData = activeGame.partyData.map((char, i) => {
    const combatMember = result.partyAfter[i];
    if (!combatMember?.alive) return char;

    const { char: updatedChar, result: lvlResult } = applyXP(char, xpPerMember);
    if (lvlResult.leveledUp) levelUpLog.push(...lvlResult.log);

    return { ...updatedChar, hp: combatMember.hpAfter };
  });

  updateProgress({
    partyData: updatedPartyData,
    gold: (activeGame.gold ?? 0) + result.goldEarned,
  });

  // Mostrar level-ups en el ReportScreen
  if (levelUpLog.length > 0) {
    setCombatResult({ ...result, log: [...result.log, ...levelUpLog] });
  }

  setCombatResult(result);
  navigation.navigate('Report', { roomId: route.params.roomId, roomWasCleared: true });
}, [result, activeGame, updateProgress, navigation]);
```

---

## Paso 3 — Límite de 2 parties activas por seed

```typescript
// src/stores/gameStore.ts — modificar startNewGame

startNewGame: (seed, seedHash, party) => {
  // Contar parties activas en esta seed
  const activeSeedGames = get().savedGames.filter(
    g => g.seedHash === seedHash && g.status === 'active'
  );

  if (activeSeedGames.length >= 2) {
    // SYSTEMS.MD: "Si crea una tercera → elimina la party IA derivada más débil"
    // En nuestro caso: eliminar la partida activa más antigua en esta seed
    const oldest = activeSeedGames.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];

    if (oldest) {
      deleteSavedGame(oldest.id);
      set(state => ({
        savedGames: state.savedGames.filter(g => g.id !== oldest.id),
      }));
    }
  }

  // Verificar herencia de nivel de la última party completada/muerta en esta seed
  const completedSeedGames = get().savedGames.filter(
    g => g.seedHash === seedHash && (g.status === 'completed' || g.status === 'dead')
  );

  let inheritedLevel = 1;
  if (completedSeedGames.length > 0) {
    const lastCompleted = completedSeedGames.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
    inheritedLevel = calculateInheritedLevel(lastCompleted.partyData);
  }

  // Ajustar XP inicial de los personajes si hay herencia
  const partyWithInheritance = inheritedLevel > 1
    ? party.map(char => ({
        ...char,
        level: inheritedLevel,
        xp: xpForInheritedLevel(inheritedLevel),
        maxHp: char.maxHp + (inheritedLevel - 1) * 5,  // +5 HP por nivel heredado
        hp: char.maxHp + (inheritedLevel - 1) * 5,
      }))
    : party;

  const game = createSavedGame(seed, seedHash, partyWithInheritance);

  set(state => ({
    activeGame: game,
    savedGames: [game, ...state.savedGames],
  }));

  return game;
},
```

---

## Paso 4 — Muerte permanente real

```typescript
// src/screens/VillageScreen.tsx — verificar muerte permanente

import { calculateReviveCost } from '../services/economyService';

// En el render: separar muertos "permanentes" de los que pueden revivir
const deadMembers = partyData.filter(c => !c.alive);
const permanentlyDead = deadMembers.filter(c => {
  const { cost } = calculateReviveCost({
    level: c.level ?? 1,
    deathCount: c.deathCount ?? 0,
    alive: false,
  });
  return gold < cost;  // Si no puede pagar → muerte permanente
});

// Si TODOS están muertos permanentemente → Game Over
useEffect(() => {
  const aliveOrRevivable = partyData.filter(c =>
    c.alive ||
    (() => {
      const { cost } = calculateReviveCost({ level: c.level ?? 1, deathCount: c.deathCount ?? 0, alive: false });
      return gold >= cost;
    })()
  );

  if (aliveOrRevivable.length === 0 && partyData.length > 0) {
    // Sin posibilidad de continuar → Game Over
    setShowGameOverModal(true);
  }
}, [partyData, gold]);
```

---

## Paso 5 — Mostrar nivel y XP en CharacterDetailScreen

```typescript
// src/screens/CharacterDetailScreen.tsx — (pantalla actualmente sin conectar)
// Este es el momento ideal para conectarla y mostrar progresión

import { getLevelFromXP, xpToNextLevel } from '../services/progressionService';

export const CharacterDetailScreen = ({ route }: ScreenProps<'CharacterDetail'>) => {
  const { characterIndex } = route.params;
  const activeGame = useGameStore(s => s.activeGame);
  const char = activeGame?.partyData[characterIndex];

  if (!char) return null;

  const level = getLevelFromXP(char.xp ?? 0);
  const xpNeeded = xpToNextLevel(char.xp ?? 0);
  const progress = xpNeeded > 0 ? (char.xp ?? 0) / (XP_THRESHOLDS[level + 1] ?? 1) : 1;

  return (
    <View>
      <Text>Nivel {level}</Text>
      <Text>XP: {char.xp ?? 0} / +{xpNeeded} para nivel {level + 1}</Text>
      {/* Barra de progreso XP */}
      <View style={{ height: 4, backgroundColor: 'rgba(0,255,65,0.2)' }}>
        <View style={{ height: 4, width: `${progress * 100}%`, backgroundColor: '#00FF41' }} />
      </View>
      <Text>Moral: {char.morale ?? 80}/100</Text>
      <Text>Muertes: {char.deathCount ?? 0}</Text>
    </View>
  );
};
```

---

## Paso 6 — Conectar CharacterDetailScreen al navigator

```typescript
// src/navigation/types.ts — añadir
CharacterDetail: { characterIndex: number };

// src/navigation/AppNavigator.tsx — registrar pantalla
<Stack.Screen name="CharacterDetail" component={CharacterDetailScreen} />

// src/screens/GuildScreen.tsx — navegar al tocar un personaje
onPress={() => navigation.navigate('CharacterDetail', { characterIndex: idx })}
```

---

## Checklist de implementación

- [ ] Crear `src/services/progressionService.ts` (Paso 1)
- [ ] BattleScreen: distribuir XP entre vivos después del combate (Paso 2)
- [ ] gameStore: límite 2 parties + herencia de nivel en `startNewGame` (Paso 3)
- [ ] VillageScreen: muerte permanente si no hay gold para revivir (Paso 4)
- [ ] Conectar `CharacterDetailScreen` al navigator (Paso 6)
- [ ] Añadir `level`, `xp`, `deathCount`, `morale`, `killCount` a `CharacterSave` (ver doc 05)
- [ ] GuildScreen: mostrar nivel y barra XP por personaje
- [ ] SeedScreen: mostrar "Nueva temporada — Nivel heredado: X" si hay herencia activa
- [ ] ReportScreen: mostrar level-ups en el log de combate

---

## ACTUALIZACIÓN v2 — Level cap: MVP vs sistema completo

```typescript
// src/services/progressionService.ts

// MVP (Sprint 6): cap en nivel 10 para la Torre básica
export const MAX_LEVEL_MVP  = 10;

// Sistema completo (Sprint 7+, con esencias activas):
export const MAX_LEVEL_FULL = 20;

// Usar la constante correcta según el sprint activo:
export const MAX_LEVEL = MAX_LEVEL_MVP; // cambiar a FULL en Sprint 7

// Los slots de esencia para niveles 11-20 (doc 13) están definidos
// pero permanecen inactivos hasta que MAX_LEVEL se suba a 20.
```

### CharacterSave — campos añadidos por doc 13

```typescript
// src/database/gameRepository.ts — añadir a CharacterSave (ver tipo canónico en doc 08)
isAscended:     boolean;        // false por defecto
ascensionPath?: AscensionPath;  // 'TITAN' | 'ARCHMAGE' | 'AVATAR_OF_WAR'
unlockedAbilities: string[];    // habilidades de clase + esencia + subclase
pendingLevelUps: number;        // niveles ganados en combate pendientes de confirmar en CampScreen
```

### Slot de esencia al subir nivel

```typescript
// En applyLevelUp() — añadir notificación de slot desbloqueado:
import { getEssenceSlots } from './essenceService';

const prevSlots = getEssenceSlots(prevLevel, false);
const newSlots  = getEssenceSlots(newLevel, false);
if (newSlots > prevSlots) {
  levelUpLog.push(`🔮 NUEVO SLOT DE ESENCIA (total: ${newSlots})`);
}
```
