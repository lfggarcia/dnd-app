import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { useGameStore } from '../stores/gameStore';
import { makePRNG } from '../utils/prng';
import type { ScreenProps } from '../navigation/types';
import type { CharacterSave } from '../database/gameRepository';

// ── Event Types ────────────────────────────────────────────────────────────────

type EventType = 'AMBUSH' | 'MERCHANT' | 'SHRINE' | 'TRAP' | 'LORE' | 'ALLY';
type EventChoice = 'PRIMARY' | 'SECONDARY';

interface EventConfig {
  icon: string;
  title: string;
  flavor: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryDesc: string;
  secondaryDesc: string;
}

const EVENT_CONFIGS: Record<EventType, EventConfig> = {
  AMBUSH: {
    icon: '⚠',
    title: 'EMBOSCADA',
    flavor: 'Sombras se mueven entre las grietas. Los rastros de sangre son frescos.',
    primaryLabel: 'DEFENDER',
    secondaryLabel: 'HUIR',
    primaryDesc: 'Uno de los aventureros absorbe el golpe inicial',
    secondaryDesc: 'La party retrocede y pierde terreno',
  },
  MERCHANT: {
    icon: '⚖',
    title: 'MERCADER ERRANTE',
    flavor: 'Un hombre encapuchado levanta la vista. "Mercancía fresca. Precio justo."',
    primaryLabel: 'COMPRAR',
    secondaryLabel: 'IGNORAR',
    primaryDesc: 'Gastar 30 gold por provisiones (+10 HP a toda la party)',
    secondaryDesc: 'Continúa sin detenerte',
  },
  SHRINE: {
    icon: '✦',
    title: 'ALTAR ANTIGUO',
    flavor: 'Runas brillan débilmente en la piedra. Algo sagrado descansa aquí.',
    primaryLabel: 'REZAR',
    secondaryLabel: 'IGNORAR',
    primaryDesc: 'Restaura HP completo al adventurer con menos HP',
    secondaryDesc: 'Respetas el lugar y sigues adelante',
  },
  TRAP: {
    icon: '☠',
    title: 'TRAMPA OCULTA',
    flavor: 'Un clic bajo el pie. Demasiado tarde para evitarlo.',
    primaryLabel: 'DESACTIVAR',
    secondaryLabel: 'ABSORBER',
    primaryDesc: 'Intentar desactivar — 50% éxito, si falla -20% HP al líder',
    secondaryDesc: 'Soportar el golpe — -15% HP al personaje con más HP',
  },
  LORE: {
    icon: '📜',
    title: 'INSCRIPCIÓN ANTIGUA',
    flavor: 'Jeroglíficos revelan el plano de esta torre. El conocimiento es poder.',
    primaryLabel: 'ESTUDIAR',
    secondaryLabel: 'CONTINUAR',
    primaryDesc: 'Revela las posiciones de salas no exploradas adyacentes',
    secondaryDesc: 'No tienes tiempo para esto',
  },
  ALLY: {
    icon: '⚔',
    title: 'AVENTURERO HERIDO',
    flavor: 'Un aventurero yace contra la pared, aún consciente pero malherido.',
    primaryLabel: 'AYUDAR',
    secondaryLabel: 'PASAR',
    primaryDesc: '+10 moral a toda la party. El aventurero te da información',
    secondaryDesc: 'No hay lugar para sentimentalismos aquí',
  },
};

// ── PRNG-based event generation ────────────────────────────────────────────────

function resolveEventType(eventSeed: string): EventType {
  const rng = makePRNG(eventSeed);
  const types: EventType[] = ['AMBUSH', 'MERCHANT', 'SHRINE', 'TRAP', 'LORE', 'ALLY'];
  return types[rng.next(0, types.length - 1)];
}

// ── Outcome application ────────────────────────────────────────────────────────

function applyOutcome(
  eventType: EventType,
  choice: EventChoice,
  party: CharacterSave[],
  gold: number,
  rng: ReturnType<typeof makePRNG>,
): { newParty: CharacterSave[]; newGold: number; message: string } {
  let newParty = party.map(c => ({ ...c }));
  let newGold = gold;
  let message = '';

  const alive = newParty.filter(c => c.alive && c.hp > 0);
  if (alive.length === 0) return { newParty, newGold, message: 'Sin efecto.' };

  switch (eventType) {
    case 'AMBUSH': {
      if (choice === 'PRIMARY') {
        // One random alive member takes ~20% max HP damage
        const target = alive[rng.next(0, alive.length - 1)];
        const dmg = Math.max(1, Math.floor(target.maxHp * 0.2));
        const idx = newParty.findIndex(c => c.characterId === target.characterId);
        if (idx !== -1) {
          newParty[idx] = { ...newParty[idx], hp: Math.max(1, target.hp - dmg) };
          message = `${target.name} absorbe el golpe (-${dmg} HP)`;
        }
      } else {
        // Flee: -10 morale to all
        newParty = newParty.map(c => ({ ...c, morale: Math.max(0, c.morale - 10) }));
        message = 'La party huye. Moral -10 a todos.';
      }
      break;
    }
    case 'MERCHANT': {
      if (choice === 'PRIMARY' && gold >= 30) {
        newGold = gold - 30;
        newParty = newParty.map(c => ({
          ...c,
          hp: c.alive ? Math.min(c.maxHp, c.hp + 10) : c.hp,
        }));
        message = '+10 HP a toda la party. -30 gold.';
      } else if (choice === 'PRIMARY') {
        message = 'No tienes suficiente gold (necesitas 30).';
      } else {
        message = 'El mercader se encoge de hombros y sigue su camino.';
      }
      break;
    }
    case 'SHRINE': {
      if (choice === 'PRIMARY') {
        const lowestHp = alive.reduce((min, c) => (c.hp < min.hp ? c : min), alive[0]);
        const idx = newParty.findIndex(c => c.characterId === lowestHp.characterId);
        if (idx !== -1) {
          const restored = lowestHp.maxHp - lowestHp.hp;
          newParty[idx] = { ...newParty[idx], hp: lowestHp.maxHp };
          message = `${lowestHp.name} restaurado a HP máximo (+${restored} HP)`;
        }
      } else {
        message = 'El altar permanece en silencio.';
      }
      break;
    }
    case 'TRAP': {
      if (choice === 'PRIMARY') {
        // 50% chance to disarm
        const success = rng.bool(0.5);
        if (success) {
          message = 'Trampa desactivada. Ningún daño.';
        } else {
          const leader = alive[0];
          const dmg = Math.max(1, Math.floor(leader.maxHp * 0.2));
          const idx = newParty.findIndex(c => c.characterId === leader.characterId);
          if (idx !== -1) {
            newParty[idx] = { ...newParty[idx], hp: Math.max(1, leader.hp - dmg) };
            message = `Fallo. ${leader.name} recibe -${dmg} HP.`;
          }
        }
      } else {
        const highestHp = alive.reduce((max, c) => (c.hp > max.hp ? c : max), alive[0]);
        const dmg = Math.max(1, Math.floor(highestHp.maxHp * 0.15));
        const idx = newParty.findIndex(c => c.characterId === highestHp.characterId);
        if (idx !== -1) {
          newParty[idx] = { ...newParty[idx], hp: Math.max(1, highestHp.hp - dmg) };
          message = `${highestHp.name} absorbe la trampa (-${dmg} HP)`;
        }
      }
      break;
    }
    case 'LORE': {
      // No mechanical HP/gold effect — narrative only
      message = choice === 'PRIMARY'
        ? 'El conocimiento es registrado. Las rutas secretas son tuyas.'
        : 'El tiempo apremia. Sigues adelante.';
      break;
    }
    case 'ALLY': {
      if (choice === 'PRIMARY') {
        newParty = newParty.map(c => ({ ...c, morale: Math.min(100, c.morale + 10) }));
        message = 'Moral +10 a toda la party. El aventurero comparte sus mapas.';
      } else {
        newParty = newParty.map(c => ({ ...c, morale: Math.max(0, c.morale - 5) }));
        message = 'Algo se endurece en la party. Moral -5.';
      }
      break;
    }
  }

  return { newParty, newGold, message };
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export const EventResolutionScreen = ({ navigation, route }: ScreenProps<'EventResolution'>) => {
  const { roomId, eventType: routeEventType, eventSeed } = route.params;

  const partyData    = useGameStore(s => s.activeGame?.partyData ?? []);
  const gold         = useGameStore(s => s.activeGame?.gold ?? 0);
  const updateProgress = useGameStore(s => s.updateProgress);

  // Use eventType from route if provided, else derive from seed for determinism
  const eventType = useMemo<EventType>(() => {
    const valid: EventType[] = ['AMBUSH', 'MERCHANT', 'SHRINE', 'TRAP', 'LORE', 'ALLY'];
    if (valid.includes(routeEventType as EventType)) return routeEventType as EventType;
    return resolveEventType(eventSeed);
  }, [routeEventType, eventSeed]);

  const config = EVENT_CONFIGS[eventType];

  const handleChoice = useCallback((choice: EventChoice) => {
    const rng = makePRNG(`${eventSeed}_outcome`);
    const { newParty, newGold, message: _msg } = applyOutcome(
      eventType, choice, partyData, gold, rng,
    );
    updateProgress({ partyData: newParty, gold: newGold });
    navigation.goBack();
  }, [eventType, eventSeed, partyData, gold, updateProgress, navigation]);

  return (
    <View style={styles.root}>
      <CRTOverlay />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.roomLabel}>SALA {roomId} · EVENTO</Text>
          <Text style={styles.eventIcon}>{config.icon}</Text>
          <Text style={styles.eventTitle}>{config.title}</Text>
        </View>

        {/* Flavor text */}
        <View style={styles.flavorBox}>
          <Text style={styles.flavorText}>{config.flavor}</Text>
        </View>

        {/* Party status strip */}
        <View style={styles.partyStrip}>
          {partyData.filter(c => c.alive).map(c => (
            <View key={c.characterId} style={styles.charChip}>
              <Text style={styles.charName} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.charHp}>{c.hp}/{c.maxHp}</Text>
            </View>
          ))}
        </View>

        {/* Gold */}
        <Text style={styles.goldLabel}>GOLD: {gold}</Text>

        {/* Choices */}
        <View style={styles.choiceArea}>
          <TouchableOpacity
            onPress={() => handleChoice('PRIMARY')}
            style={[styles.choiceBtn, styles.primaryBtn]}
            activeOpacity={0.75}
          >
            <Text style={styles.primaryBtnLabel}>{config.primaryLabel}</Text>
            <Text style={styles.choiceDesc}>{config.primaryDesc}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleChoice('SECONDARY')}
            style={[styles.choiceBtn, styles.secondaryBtn]}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryBtnLabel}>{config.secondaryLabel}</Text>
            <Text style={styles.choiceDesc}>{config.secondaryDesc}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060A06',
  },
  content: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 48,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  roomLabel: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 9,
    color: 'rgba(0,229,255,0.4)',
    letterSpacing: 2,
  },
  eventIcon: {
    fontSize: 40,
    marginVertical: 4,
  },
  eventTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 18,
    color: '#00E5FF',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  flavorBox: {
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.2)',
    backgroundColor: 'rgba(0,229,255,0.04)',
    padding: 14,
    marginTop: 8,
  },
  flavorText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: 'rgba(0,229,255,0.7)',
    lineHeight: 18,
    textAlign: 'center',
  },
  partyStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  charChip: {
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.25)',
    backgroundColor: 'rgba(0,255,65,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    minWidth: 70,
  },
  charName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 8,
    color: '#00FF41',
    letterSpacing: 0.5,
  },
  charHp: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
    color: 'rgba(0,255,65,0.5)',
  },
  goldLabel: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 9,
    color: '#FFB000',
    textAlign: 'center',
    letterSpacing: 1,
  },
  choiceArea: {
    gap: 10,
    marginTop: 12,
  },
  choiceBtn: {
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  primaryBtn: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0,229,255,0.06)',
  },
  secondaryBtn: {
    borderColor: 'rgba(0,255,65,0.25)',
    backgroundColor: 'rgba(0,255,65,0.03)',
  },
  primaryBtnLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 13,
    color: '#00E5FF',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  secondaryBtnLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 13,
    color: 'rgba(0,255,65,0.6)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  choiceDesc: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 9,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 14,
  },
});
