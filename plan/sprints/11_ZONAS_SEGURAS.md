# 11 · ZONAS SEGURAS Y CAMPAMENTO
> **Estado actual:** 0% — mecánica no documentada ni implementada
> **Sprint objetivo:** 6
> **Archivos a crear/modificar:** nuevo `src/services/safeZoneService.ts`, nuevo `src/screens/CampScreen.tsx`, nuevo `src/screens/LevelUpScreen.tsx`, `dungeonGraphService.ts`, `migrations.ts` (v11), `navigation/types.ts`

---

## Concepto

Las zonas seguras son nodos especiales del grafo del dungeon donde la party puede detenerse sin riesgo de combate. Son el único lugar dentro de la Torre donde se pueden gestionar personajes: subir de nivel, equipar items, cambiar líder, consumir consumibles y reorganizar la party. Es el equivalente al campamento de *Baldur's Gate 3* — un respiro táctico dentro de la presión constante del dungeon.

El nivel se gana en combate pero **las habilidades nuevas no se activan hasta llegar a una zona segura**. Esto hace que cada zona segura sea un momento de decisión y transformación, no solo un punto de recuperación.

---

## Estado Actual vs Objetivo

| Aspecto | Hoy | Objetivo |
|---------|-----|----------|
| Zona segura | No existe como concepto | Nodo especial en el grafo del dungeon con UI de campamento |
| Subir de nivel | `applyXP` calcula el nivel nuevo pero no hay pantalla de gestión | `LevelUpScreen` por cada personaje con nivel disponible |
| Habilidades nuevas | Sin sistema | Se desbloquean al confirmar el nivel en zona segura |
| Gestión de inventario | No existe en dungeon | `CampScreen` con tabs: Party / Inventario / Descanso |
| Cambio de líder | No existe | Acción disponible en CampScreen |
| Consumir consumibles | No existe en dungeon | Acción en CampScreen, aplica efecto inmediato |

---

## Paso 1 — Definir zonas seguras en el grafo del dungeon

Las zonas seguras son nodos de tipo `SAFE_ZONE` en el grafo del dungeon. Su frecuencia y posición son determinísticas por seed.

```typescript
// src/services/dungeonGraphService.ts — añadir tipo de sala

export type RoomType =
  | 'NORMAL'
  | 'ELITE'
  | 'BOSS'
  | 'TREASURE'
  | 'SECRET'
  | 'SAFE_ZONE';   // ← nuevo
```

### Reglas de distribución de zonas seguras

```typescript
// src/services/safeZoneService.ts

/**
 * Determina si un nodo del dungeon es una zona segura.
 * REGLAS:
 *   - Siempre hay una zona segura antes de cada sala de boss
 *   - Aparecen cada 8–12 salas normales (determinístico por seed)
 *   - Nunca adyacentes entre sí (no dos zonas seguras conectadas)
 *   - No pueden ser la sala inicial ni la sala de extracción
 */
export function isSafeZoneNode(
  nodeId: string,
  floor: number,
  seedHash: string,
  totalNodesInFloor: number,
): boolean {
  const rng = makePRNG(`${seedHash}_safezone_${floor}_${nodeId}`);

  // Garantizar zona segura pre-boss (nodo con id que termina en '_preboss')
  if (nodeId.includes('_preboss')) return true;

  // Distribución probabilística cada ~10 salas
  const baseInterval = 10;
  const variance = rng.next(-2, 2);
  const interval = baseInterval + variance;

  // Derivar posición del nodo en el piso para evaluar intervalo
  const nodeIndex = hashNodeIndex(nodeId, totalNodesInFloor);
  return nodeIndex % interval === 0;
}

/**
 * Devuelve un índice numérico consistente para un nodeId dado.
 */
function hashNodeIndex(nodeId: string, max: number): number {
  let h = 0;
  for (let i = 0; i < nodeId.length; i++) {
    h = (Math.imul(h, 31) + nodeId.charCodeAt(i)) >>> 0;
  }
  return h % max;
}
```

---

## Paso 2 — Navigation hacia CampScreen

```typescript
// src/navigation/types.ts — añadir

CampScreen: {
  roomId: string;
  floor: number;
};

LevelUpScreen: {
  characterIndex: number;
  previousLevel: number;
  newLevel: number;
  unlockedAbilities: string[];
};
```

```typescript
// src/screens/MapScreen.tsx — en handleNodePress

if (room.type === 'SAFE_ZONE') {
  navigation.navigate('CampScreen', {
    roomId: String(room.id),
    floor: activeGame.floor,
  });
  return;
}
```

---

## Paso 3 — CampScreen: el campamento

La `CampScreen` es el hub de gestión de party dentro del dungeon. Tiene 3 tabs principales.

```typescript
// src/screens/CampScreen.tsx

import { useGameStore } from '../stores/gameStore';
import { getInventory } from '../database/itemRepository';
import { getLevelFromXP } from '../services/progressionService';

type CampTab = 'PARTY' | 'INVENTORY' | 'REST';

export const CampScreen = ({ navigation, route }: ScreenProps<'CampScreen'>) => {
  const activeGame = useGameStore(s => s.activeGame);
  const [activeTab, setActiveTab] = useState<CampTab>('PARTY');

  // Detectar personajes con nivel disponible para subir
  const pendingLevelUps = useMemo(() =>
    activeGame?.partyData
      .map((char, index) => ({
        char,
        index,
        currentLevel: char.level ?? 1,
        earnedLevel: getLevelFromXP(char.xp ?? 0),
      }))
      .filter(c => c.earnedLevel > c.currentLevel) ?? [],
    [activeGame],
  );

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Header */}
      <View className="px-4 pt-4 pb-2 border-b border-primary/20">
        <Text className="text-primary font-robotomono-bold text-lg">⛺ ZONA SEGURA</Text>
        <Text className="text-muted font-robotomono text-xs">
          PISO {route.params.floor} · {pendingLevelUps.length > 0
            ? `${pendingLevelUps.length} SUBIDA/S DE NIVEL DISPONIBLE/S`
            : 'PARTY EN ORDEN'}
        </Text>
      </View>

      {/* Notificación de level-ups pendientes */}
      {pendingLevelUps.length > 0 && (
        <View className="mx-4 mt-3 p-3 border border-secondary bg-secondary/10">
          <Text className="text-secondary font-robotomono-bold text-xs">
            ⭐ NIVEL DISPONIBLE — Ir a PARTY para confirmar subidas
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View className="flex-row border-b border-primary/30 mt-3">
        {(['PARTY', 'INVENTORY', 'REST'] as CampTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 py-2 items-center ${activeTab === tab ? 'border-b-2 border-primary' : ''}`}
          >
            <Text className={`font-robotomono text-[10px] ${activeTab === tab ? 'text-primary' : 'text-muted'}`}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenido */}
      {activeTab === 'PARTY'     && <PartyTab pendingLevelUps={pendingLevelUps} navigation={navigation} />}
      {activeTab === 'INVENTORY' && <InventoryTab />}
      {activeTab === 'REST'      && <RestTab navigation={navigation} />}

      {/* Botón salir del campamento */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        className="mx-4 mb-6 mt-2 border border-primary/60 py-3 items-center"
      >
        <Text className="text-primary font-robotomono-bold text-xs">CONTINUAR EXPLORANDO</Text>
      </TouchableOpacity>
    </View>
  );
};
```

---

## Paso 4 — Tab PARTY: gestión de personajes y level-ups

```typescript
// Dentro de CampScreen.tsx — PartyTab

const PartyTab = ({
  pendingLevelUps,
  navigation,
}: {
  pendingLevelUps: PendingLevelUp[];
  navigation: any;
}) => {
  const activeGame   = useGameStore(s => s.activeGame);
  const updateProgress = useGameStore(s => s.updateProgress);

  const handleChangeLeader = useCallback((newLeaderIndex: number) => {
    if (!activeGame) return;
    const updatedParty = activeGame.partyData.map((char, i) => ({
      ...char,
      isLeader: i === newLeaderIndex,
    }));
    updateProgress({ partyData: updatedParty });
  }, [activeGame, updateProgress]);

  return (
    <ScrollView className="flex-1 px-4 pt-3">
      {activeGame?.partyData.map((char, index) => {
        const pending = pendingLevelUps.find(p => p.index === index);
        const level = char.level ?? 1;

        return (
          <View
            key={char.name}
            className={`border p-3 mb-3 ${pending ? 'border-secondary' : 'border-primary/30'}`}
          >
            {/* Header del personaje */}
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-primary font-robotomono-bold text-sm">
                  {char.isLeader ? '★ ' : ''}{char.name.toUpperCase()}
                </Text>
                <Text className="text-muted font-robotomono text-[10px]">
                  {char.charClass.toUpperCase()} · Nv {level} · {char.hp}/{char.maxHp} HP
                </Text>
              </View>
              {char.alive && !char.isLeader && (
                <TouchableOpacity
                  onPress={() => handleChangeLeader(index)}
                  className="border border-muted/40 px-2 py-1"
                >
                  <Text className="text-muted font-robotomono text-[9px]">HACER LÍDER</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Barra de moral */}
            <View className="mt-2">
              <Text className="text-muted font-robotomono text-[9px] mb-1">
                MORAL: {char.morale ?? 80}/100
              </Text>
              <View className="h-1 bg-primary/10">
                <View
                  style={{ width: `${char.morale ?? 80}%` }}
                  className={`h-1 ${(char.morale ?? 80) > 50 ? 'bg-secondary' : 'bg-destructive'}`}
                />
              </View>
            </View>

            {/* Botón de subida de nivel */}
            {pending && (
              <TouchableOpacity
                onPress={() => navigation.navigate('LevelUpScreen', {
                  characterIndex: index,
                  previousLevel: pending.currentLevel,
                  newLevel: pending.earnedLevel,
                  unlockedAbilities: getUnlockedAbilities(char.charClass, pending.earnedLevel),
                })}
                className="mt-3 bg-secondary/20 border border-secondary py-2 items-center"
              >
                <Text className="text-secondary font-robotomono-bold text-xs">
                  ⭐ SUBIR A NIVEL {pending.earnedLevel} — CONFIRMAR
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};
```

---

## Paso 5 — LevelUpScreen: confirmar subida de nivel

Esta pantalla se navega desde el tab PARTY de CampScreen. Es **por personaje** — si hay 2 personajes con nivel disponible se navega 2 veces (una tras otra o el jugador elige el orden).

```typescript
// src/screens/LevelUpScreen.tsx

import { applyXP, getUnlockedAbilities } from '../services/progressionService';

export const LevelUpScreen = ({ navigation, route }: ScreenProps<'LevelUpScreen'>) => {
  const { characterIndex, previousLevel, newLevel, unlockedAbilities } = route.params;
  const activeGame     = useGameStore(s => s.activeGame);
  const updateProgress = useGameStore(s => s.updateProgress);

  const char = activeGame?.partyData[characterIndex];
  if (!char || !activeGame) return null;

  // Calcular preview de los cambios que trae el nuevo nivel
  const hpGained = calculateHPGain(char.charClass, char.baseStats.CON, newLevel);
  const newStats  = calculateStatGains(char.charClass, newLevel);

  // SUBCLASE: si el nuevo nivel es 3, 6 o 9 → hay elección de subclase
  const isSubclassLevel = [3, 6, 9].includes(newLevel);

  const handleConfirmLevelUp = useCallback(() => {
    const updatedParty = activeGame.partyData.map((c, i) => {
      if (i !== characterIndex) return c;

      return {
        ...c,
        level: newLevel,
        maxHp: c.maxHp + hpGained,
        hp: c.hp + hpGained,            // HP ganada se suma al HP actual también
        unlockedAbilities: [            // habilidades ACTIVAS desde este momento
          ...(c.unlockedAbilities ?? []),
          ...unlockedAbilities,
        ],
        pendingAbilities: [],           // limpiar las pendientes
      };
    });

    updateProgress({ partyData: updatedParty });
    navigation.goBack(); // Volver a CampScreen
  }, [activeGame, characterIndex, newLevel, hpGained, unlockedAbilities, updateProgress, navigation]);

  return (
    <View className="flex-1 bg-background justify-center px-6">
      <CRTOverlay />

      {/* Portrait + nombre */}
      <View className="items-center mb-6">
        <CharacterPortrait charClass={char.charClass} emotion="confident" size="large" />
        <Text className="text-secondary font-robotomono-bold text-xl mt-3">
          ⭐ NIVEL {newLevel}
        </Text>
        <Text className="text-primary font-robotomono text-sm">
          {char.name.toUpperCase()} — {char.charClass.toUpperCase()}
        </Text>
      </View>

      {/* Cambios del nivel */}
      <View className="border border-primary/40 p-4 mb-4">
        <Text className="text-muted font-robotomono-bold text-xs mb-3">MEJORAS OBTENIDAS</Text>

        <View className="flex-row justify-between mb-2">
          <Text className="text-primary font-robotomono text-xs">HP Máxima</Text>
          <Text className="text-secondary font-robotomono-bold text-xs">+{hpGained}</Text>
        </View>

        {Object.entries(newStats).map(([stat, gain]) => gain > 0 && (
          <View key={stat} className="flex-row justify-between mb-2">
            <Text className="text-primary font-robotomono text-xs">{stat}</Text>
            <Text className="text-secondary font-robotomono-bold text-xs">+{gain}</Text>
          </View>
        ))}
      </View>

      {/* Habilidades desbloqueadas */}
      {unlockedAbilities.length > 0 && (
        <View className="border border-secondary/40 p-4 mb-4">
          <Text className="text-secondary font-robotomono-bold text-xs mb-2">
            HABILIDADES DESBLOQUEADAS
          </Text>
          <Text className="text-muted font-robotomono text-[10px] mb-3">
            Disponibles en el siguiente combate
          </Text>
          {unlockedAbilities.map(ability => (
            <View key={ability} className="flex-row items-center mb-2">
              <Text className="text-secondary font-robotomono text-[10px]">▶ </Text>
              <Text className="text-primary font-robotomono text-xs">{ability}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Elección de subclase (niveles 3, 6, 9) */}
      {isSubclassLevel && (
        <SubclassSelectionPanel
          charClass={char.charClass}
          currentLevel={newLevel}
          onSelect={(subclass) => { /* ver Paso 6 */ }}
        />
      )}

      {/* Confirmar */}
      <TouchableOpacity
        onPress={handleConfirmLevelUp}
        className="border border-secondary bg-secondary/20 py-4 items-center mt-2"
      >
        <Text className="text-secondary font-robotomono-bold text-sm">
          CONFIRMAR SUBIDA DE NIVEL
        </Text>
      </TouchableOpacity>
    </View>
  );
};
```

---

## Paso 6 — Subclases en niveles 3, 6, 9

Los niveles 3, 6 y 9 presentan una **elección de especialización** que no puede deshacerse. Cada clase tiene exactamente 2 opciones: una orientada a daño/ofensiva, otra a utilidad/soporte.

```typescript
// src/services/progressionService.ts — añadir

export type SubclassOption = {
  id: string;
  name: string;
  description: string;
  orientation: 'offensive' | 'utility';
  passiveBonus: Record<string, number>;  // ej: { critChance: 0.05, damage: 0.10 }
  unlockedAbility: string;
};

export const SUBCLASS_OPTIONS: Record<string, SubclassOption[]> = {
  warrior: [
    {
      id: 'berserker',
      name: 'BERSERKER',
      description: 'La ira es su escudo. Cuanto más daño recibe, más daño hace.',
      orientation: 'offensive',
      passiveBonus: { critChance: 0.08, damagePerMissingHP: 0.02 },
      unlockedAbility: 'berserk_rage',
    },
    {
      id: 'sentinel',
      name: 'CENTINELA',
      description: 'El último en caer. Puede interceptar ataques dirigidos a aliados.',
      orientation: 'utility',
      passiveBonus: { defense: 0.15, tauntChance: 0.30 },
      unlockedAbility: 'guardian_stance',
    },
  ],
  rogue: [
    {
      id: 'assassin',
      name: 'ASESINO',
      description: 'Un golpe. Un objetivo. El trabajo está hecho.',
      orientation: 'offensive',
      passiveBonus: { critDamage: 0.25, critChanceFromStealth: 0.40 },
      unlockedAbility: 'execute',
    },
    {
      id: 'scout',
      name: 'EXPLORADOR',
      description: 'Ve lo que otros no pueden. Sus ojos son los ojos del grupo.',
      orientation: 'utility',
      passiveBonus: { perception: 5, detectionBonus: 0.20 },
      unlockedAbility: 'advance_scout',
    },
  ],
  // ... resto de clases
};

/**
 * Retorna las habilidades desbloqueadas al llegar a un nivel.
 * Las habilidades de subclase solo aparecen si la subclase ya fue elegida.
 */
export function getUnlockedAbilities(
  charClass: string,
  level: number,
  subclassId?: string,
): string[] {
  const baseAbilities = BASE_CLASS_ABILITIES[charClass]?.[level] ?? [];
  const subclassAbilities = subclassId
    ? (SUBCLASS_LEVEL_ABILITIES[subclassId]?.[level] ?? [])
    : [];
  return [...baseAbilities, ...subclassAbilities];
}
```

```typescript
// Componente de selección en LevelUpScreen

const SubclassSelectionPanel = ({
  charClass,
  currentLevel,
  onSelect,
}: {
  charClass: string;
  currentLevel: number;
  onSelect: (subclassId: string) => void;
}) => {
  const options = SUBCLASS_OPTIONS[charClass.toLowerCase()] ?? [];
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <View className="border border-accent/60 p-4 mb-4">
      <Text className="text-accent font-robotomono-bold text-xs mb-1">
        ESPECIALIZACIÓN — NIVEL {currentLevel}
      </Text>
      <Text className="text-muted font-robotomono text-[10px] mb-3">
        Esta elección es permanente. No puede cambiarse.
      </Text>
      {options.map(option => (
        <TouchableOpacity
          key={option.id}
          onPress={() => { setSelected(option.id); onSelect(option.id); }}
          className={`border p-3 mb-2 ${selected === option.id ? 'border-accent bg-accent/10' : 'border-muted/30'}`}
        >
          <Text className="text-primary font-robotomono-bold text-xs">{option.name}</Text>
          <Text className="text-muted font-robotomono text-[10px] mt-1">{option.description}</Text>
          <Text className="text-accent font-robotomono text-[9px] mt-1">
            Habilidad: {option.unlockedAbility.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

---

## Paso 7 — Tab INVENTORY: gestión de equipo en dungeon

```typescript
// Dentro de CampScreen.tsx — InventoryTab

const InventoryTab = () => {
  const activeGame     = useGameStore(s => s.activeGame);
  const updateProgress = useGameStore(s => s.updateProgress);
  const [inventory, setInventory] = useState<ItemRow[]>([]);

  useEffect(() => {
    if (activeGame) setInventory(getInventory(activeGame.id));
  }, [activeGame]);

  const handleEquip = useCallback((item: ItemRow, charName: string) => {
    equipItem(item.id, charName);
    setInventory(getInventory(activeGame!.id));
  }, [activeGame]);

  const handleConsume = useCallback((item: ItemRow) => {
    if (item.type !== 'consumable') return;
    applyConsumableEffect(item, activeGame!, updateProgress);
    // Eliminar del inventario tras consumir
    sellItem(item.id, activeGame!.id); // reutilizamos la función de eliminar (sell a 0G)
    setInventory(getInventory(activeGame!.id));
  }, [activeGame, updateProgress]);

  const consumables = inventory.filter(i => i.type === 'consumable');
  const equipment   = inventory.filter(i => i.type !== 'consumable' && i.type !== 'boss_loot');
  const special     = inventory.filter(i => i.type === 'boss_loot');

  return (
    <ScrollView className="flex-1 px-4 pt-3">

      {/* Consumibles */}
      {consumables.length > 0 && (
        <>
          <Text className="text-muted font-robotomono-bold text-xs mb-2">
            CONSUMIBLES ({consumables.length})
          </Text>
          {consumables.map(item => (
            <View key={item.id} className="flex-row justify-between items-center border border-muted/20 p-3 mb-2">
              <View>
                <Text className="text-primary font-robotomono text-xs">{item.name}</Text>
                <Text className="text-muted font-robotomono text-[9px]">{item.rarity.toUpperCase()}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleConsume(item)}
                className="border border-secondary/60 px-3 py-1"
              >
                <Text className="text-secondary font-robotomono text-[10px]">USAR</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Equipo */}
      {equipment.length > 0 && (
        <>
          <Text className="text-muted font-robotomono-bold text-xs mb-2 mt-3">
            EQUIPO ({equipment.length})
          </Text>
          {equipment.map(item => (
            <View key={item.id} className="border border-muted/20 p-3 mb-2">
              <View className="flex-row justify-between">
                <Text className="text-primary font-robotomono text-xs">{item.name}</Text>
                <Text className={`font-robotomono text-[9px] ${rarityColor(item.rarity)}`}>
                  {item.rarity.toUpperCase()}
                </Text>
              </View>
              <Text className="text-muted font-robotomono text-[9px] mb-2">
                {item.type.toUpperCase()} · {item.isEquipped ? `EQUIPADO: ${item.ownerCharName}` : 'SIN EQUIPAR'}
              </Text>
              {/* Selector de personaje para equipar */}
              {!item.isEquipped && (
                <View className="flex-row flex-wrap gap-2">
                  {activeGame?.partyData.filter(c => c.alive).map(char => (
                    <TouchableOpacity
                      key={char.name}
                      onPress={() => handleEquip(item, char.name)}
                      className="border border-primary/40 px-2 py-1"
                    >
                      <Text className="text-primary font-robotomono text-[9px]">
                        → {char.name.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </>
      )}

      {inventory.length === 0 && (
        <Text className="text-muted font-robotomono text-xs mt-4">Sin items en el inventario</Text>
      )}
    </ScrollView>
  );
};
```

---

## Paso 8 — Tab REST: descanso corto en zona segura

En una zona segura, el descanso corto es **más efectivo** que en cualquier otra sala: recupera más HP y puede simular los ciclos faltantes.

```typescript
// Dentro de CampScreen.tsx — RestTab

const RestTab = ({ navigation }: { navigation: any }) => {
  const activeGame     = useGameStore(s => s.activeGame);
  const advanceCycle   = useGameStore(s => s.advanceCycle);
  const [resting, setResting] = useState(false);

  const cyclesLeft = 60 - (activeGame?.cycle ?? 0);

  const handleShortRest = useCallback(async () => {
    setResting(true);
    // En zona segura: REST_SHORT recupera 30% HP máximo por personaje
    const updatedParty = activeGame!.partyData.map(char => ({
      ...char,
      hp: Math.min(char.maxHp, char.hp + Math.floor(char.maxHp * 0.30)),
    }));
    useGameStore.getState().updateProgress({ partyData: updatedParty });
    await advanceCycle('REST_SHORT');
    setResting(false);
  }, [activeGame, advanceCycle]);

  /**
   * Simular ciclos restantes en lotes de 6 para mostrar loading dinámico.
   * El jugador ve pasar los días/noches con los eventos más destacados de cada lote.
   * Esto termina la temporada y lleva al jugador al pueblo.
   */
  const handleSimulateRemaining = useCallback(async () => {
    if (!activeGame) return;
    setResting(true);

    const batchSize = 6;
    let currentCycle = activeGame.cycle;

    while (currentCycle < 60) {
      const nextBatch = Math.min(currentCycle + batchSize, 60);

      // Simular lote
      await advanceCycle('SAFE_ZONE_WAIT'); // nueva TimeAction que avanza N ciclos

      currentCycle = nextBatch;

      // La animación de loading la gestiona el CycleTransitionScreen
      // que muestra los eventos destacados del lote
    }

    // Al llegar al ciclo 60 → cerrar Torre y navegar al pueblo
    navigation.navigate('CycleTransition');
  }, [activeGame, advanceCycle, navigation]);

  return (
    <View className="flex-1 px-4 pt-4">

      {/* Info de ciclos */}
      <View className="border border-primary/20 p-4 mb-4">
        <Text className="text-primary font-robotomono-bold text-xs mb-1">ESTADO TEMPORAL</Text>
        <Text className="text-muted font-robotomono text-xs">
          Ciclo actual: {activeGame?.cycle ?? 1} / 60
        </Text>
        <Text className="text-muted font-robotomono text-xs">
          Ciclos restantes: {cyclesLeft}
        </Text>
      </View>

      {/* Descanso corto */}
      <TouchableOpacity
        onPress={handleShortRest}
        disabled={resting}
        className="border border-primary/60 py-4 items-center mb-3"
      >
        <Text className="text-primary font-robotomono-bold text-xs">DESCANSAR AQUÍ</Text>
        <Text className="text-muted font-robotomono text-[10px] mt-1">
          Recupera 30% HP · Consume 0.5 ciclos
        </Text>
      </TouchableOpacity>

      {/* Simular ciclos restantes */}
      <TouchableOpacity
        onPress={handleSimulateRemaining}
        disabled={resting}
        className="border border-destructive/60 py-4 items-center"
      >
        <Text className="text-destructive font-robotomono-bold text-xs">
          ESPERAR FIN DE TEMPORADA
        </Text>
        <Text className="text-muted font-robotomono text-[10px] mt-1">
          Simular {cyclesLeft} ciclos restantes · Regresa al pueblo
        </Text>
        <Text className="text-muted font-robotomono text-[9px] mt-1">
          Los personajes muertos no podrán ser revividos hasta el pueblo
        </Text>
      </TouchableOpacity>

      {/* Aviso de muertos */}
      {activeGame?.partyData.some(c => !c.alive) && (
        <View className="border border-destructive/30 p-3 mt-4">
          <Text className="text-destructive font-robotomono text-[10px]">
            ⚠ Tienes personajes muertos. Solo podrás revivirlos al llegar al pueblo
            (fin de temporada). Si eliges esperar aquí, el costo de revivir escalará
            con los ciclos que pasen.
          </Text>
        </View>
      )}
    </View>
  );
};
```

---

## Paso 9 — Aplicar efectos de consumibles

```typescript
// src/services/safeZoneService.ts — efectos de consumibles

export type ConsumableEffect = {
  type: 'heal_hp' | 'boost_stat' | 'restore_morale' | 'remove_debuff';
  value: number;
  targetStat?: string;
  duration?: number; // ciclos de duración (0 = permanente)
};

export const CONSUMABLE_EFFECTS: Record<string, ConsumableEffect> = {
  HEALTH_POTION: { type: 'heal_hp', value: 50 },
  ELIXIR_OF_STRENGTH: { type: 'boost_stat', value: 3, targetStat: 'STR', duration: 2 },
  MORALE_TONIC: { type: 'restore_morale', value: 30 },
  ANTIDOTE: { type: 'remove_debuff', value: 0 },
};

export function applyConsumableEffect(
  item: ItemRow,
  activeGame: SavedGame,
  updateProgress: (data: Partial<SavedGame>) => void,
): void {
  const effect = CONSUMABLE_EFFECTS[item.name];
  if (!effect) return;

  const updatedParty = activeGame.partyData.map(char => {
    if (!char.alive) return char;
    // Por ahora aplica al primer personaje vivo que lo necesite
    // TODO Sprint 7: selector de objetivo al consumir
    switch (effect.type) {
      case 'heal_hp':
        return { ...char, hp: Math.min(char.maxHp, char.hp + effect.value) };
      case 'restore_morale':
        return { ...char, morale: Math.min(100, (char.morale ?? 80) + effect.value) };
      default:
        return char;
    }
  });

  updateProgress({ partyData: updatedParty });
}
```

---

## Paso 10 — Migration v11: guardar estado de zona segura

```typescript
// src/database/migrations.ts — migration v11

11: [
  // Guardar si la party está actualmente en una zona segura
  // (para restaurar al reabrir la app)
  `ALTER TABLE saved_games ADD COLUMN in_safe_zone INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE saved_games ADD COLUMN safe_zone_room_id TEXT`,

  // Habilidades desbloqueadas por personaje (JSON array en party_data)
  // Se añaden al campo JSON existente de party_data — no requiere columna nueva
  -- Ya gestionado por partyData JSON en saved_games
],
```

---

## Flujo completo de una visita a zona segura

```
Jugador toca nodo SAFE_ZONE en MapScreen
    ↓
navigation.navigate('CampScreen', { roomId, floor })
    ↓
CampScreen abre con 3 tabs
    ↓
[Tab PARTY]
  Si hay level-ups pendientes → botón por cada personaje
    ↓
  navigation.navigate('LevelUpScreen', { characterIndex, previousLevel, newLevel, ... })
    ↓
  LevelUpScreen: preview de mejoras + habilidades desbloqueadas
  Si nivel 3/6/9 → SubclassSelectionPanel (elección permanente)
    ↓
  Confirmar → updateProgress({ partyData con level, maxHp, unlockedAbilities })
    ↓
  Volver a CampScreen
    ↓
[Tab INVENTORY]
  Equipar/consumir items del inventario
    ↓
[Tab REST]
  Descanso corto: +30% HP · 0.5 ciclos
  O simular ciclos restantes en lotes de 6 → fin de temporada
    ↓
[CONTINUAR EXPLORANDO]
  navigation.goBack() → MapScreen
```

---

## Checklist de implementación

- [ ] `isSafeZoneNode()` en `dungeonGraphService.ts` o nuevo `safeZoneService.ts` (Paso 1)
- [ ] `RoomType.SAFE_ZONE` añadido al enum y al generador del dungeon (Paso 1)
- [ ] Rutas `CampScreen` y `LevelUpScreen` al navigator (Paso 2)
- [ ] MapScreen: navegar a `CampScreen` al tocar nodo seguro (Paso 2)
- [ ] `CampScreen` con 3 tabs funcionales (Paso 3)
- [ ] Tab PARTY: lista de personajes + botón de level-up si hay pendientes (Paso 4)
- [ ] `LevelUpScreen`: preview de mejoras + confirmar (Paso 5)
- [ ] `SUBCLASS_OPTIONS` por clase + `SubclassSelectionPanel` en niveles 3/6/9 (Paso 6)
- [ ] Tab INVENTORY: equipar y consumir items (Paso 7)
- [ ] Tab REST: descanso corto + simulación de ciclos restantes en lotes (Paso 8)
- [ ] `applyConsumableEffect()` en `safeZoneService.ts` (Paso 9)
- [ ] Migration v11 (Paso 10)
- [ ] `SAFE_ZONE_WAIT` como nueva `TimeAction` en `timeService.ts` — avanza N ciclos
- [ ] Añadir i18n keys: `camp.party`, `camp.inventory`, `camp.rest`, `camp.levelUp`, `camp.subclass`, `camp.simulateRemaining`
- [ ] Restricción: acciones de la zona segura NO consumen ciclo extra — solo el descanso lo hace

---

## ACTUALIZACIÓN v2 — Tab ESSENCES en CampScreen (Doc 13)

El `CampScreen` tiene **4 tabs** (no 3). El tab `ESSENCES` se añadió en doc 13.

```typescript
// ANTES (3 tabs):
type CampTab = 'PARTY' | 'INVENTORY' | 'REST';

// AHORA (4 tabs):
type CampTab = 'PARTY' | 'INVENTORY' | 'ESSENCES' | 'REST';

// En el render del selector de tabs:
{(['PARTY', 'INVENTORY', 'ESSENCES', 'REST'] as CampTab[]).map(tab => (
  <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)}>
    <Text>{tab}</Text>
    {tab === 'ESSENCES' && unequippedCount > 0 && (
      <View style={{ width: 8, height: 8, backgroundColor: '#FFB000', borderRadius: 4 }} />
    )}
  </TouchableOpacity>
))}

// En el render del contenido:
{activeTab === 'PARTY'      && <PartyTab />}
{activeTab === 'INVENTORY'  && <InventoryTab />}
{activeTab === 'ESSENCES'   && <EssencesTab />}  // ← nuevo
{activeTab === 'REST'       && <RestTab />}
```

### Indicador de esencias disponibles en header

```typescript
const unequippedEssences = useMemo(() =>
  activeGame ? getUnequippedEssences(activeGame.id) : [],
  [activeGame],
);

// En el header de CampScreen, junto a pendingLevelUps:
{unequippedEssences.length > 0 && (
  <Text className="text-accent font-robotomono text-[9px]">
    🔮 {unequippedEssences.length} esencia/s sin equipar
  </Text>
)}
```

### Botón de Ascensión en PartyTab

```typescript
// En PartyTab, después del botón de level-up de cada personaje:
import { canAscend } from '../services/essenceService';

{!char.isAscended && canAscend(char, activeGame.id, bossesKilled).eligible && (
  <TouchableOpacity
    onPress={() => navigation.navigate('AscensionScreen', { characterIndex: index })}
    className="mt-2 border border-accent bg-accent/10 py-2 items-center"
  >
    <Text className="text-accent font-robotomono-bold text-xs">✦ ASCENSIÓN DISPONIBLE</Text>
  </TouchableOpacity>
)}
```

Ver doc 13 Pasos 9–11 para la implementación completa de `EssencesTab` y `AscensionScreen`.

### Checklist adicional (v2)
- [ ] Actualizar `CampTab` type a 4 tabs
- [ ] Render condicional de `EssencesTab`
- [ ] Indicador de badge en tab ESSENCES si hay esencias sin equipar
- [ ] Botón de ascensión en `PartyTab` cuando `canAscend().eligible`
- [ ] Añadir ruta `AscensionScreen: { characterIndex: number }` al navigator
