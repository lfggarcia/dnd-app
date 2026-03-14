import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import { attemptFlee } from '../services/encounterService';
import { makePRNG } from '../utils/prng';
import type { ScreenProps } from '../navigation/types';

type NegotiationAction = 'ATTACK' | 'NEGOTIATE' | 'FLEE';

const FLEE_DC = 15;

export const NegotiationScreen = ({ navigation, route }: ScreenProps<'Negotiation'>) => {
  const { lang } = useI18n();
  const { rivalName, floor } = route.params;

  const gold         = useGameStore(s => s.activeGame?.gold ?? 0);
  const partyData    = useGameStore(s => s.activeGame?.partyData ?? []);
  const seedHash     = useGameStore(s => s.activeGame?.seedHash ?? '0');
  const cycle        = useGameStore(s => s.activeGame?.cycle ?? 1);
  const updateProgress = useGameStore(s => s.updateProgress);

  const [action, setAction] = useState<NegotiationAction | null>(null);
  const [fleeResult, setFleeResult] = useState<'SUCCESS' | 'FAIL' | null>(null);
  const [fleeLog, setFleeLog] = useState<string[]>([]);

  // Costs scale with floor
  const PASS_COST     = Math.max(100, floor * 50);
  const TRIBUTE_COST  = Math.max(300, floor * 100);
  const ALLIANCE_FEE  = Math.max(100, floor * 40);
  const ALLIANCE_CYCLES = 5;

  const handleAttack = useCallback(() => {
    navigation.navigate('Battle', { roomId: `rival_${rivalName}`, roomType: 'ELITE' });
  }, [navigation, rivalName]);

  const handlePayPass = useCallback(() => {
    if (gold < PASS_COST) {
      Alert.alert(
        lang === 'es' ? 'Sin fondos' : 'Insufficient gold',
        lang === 'es'
          ? `Necesitas ${PASS_COST}G para pagar el paso.`
          : `You need ${PASS_COST}G to pay passage.`,
      );
      return;
    }
    updateProgress({ gold: gold - PASS_COST });
    Alert.alert(
      lang === 'es' ? 'Paso libre' : 'Free passage',
      lang === 'es'
        ? `${rivalName} acepta y despeja el camino.`
        : `${rivalName} accepts and clears the way.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }],
    );
  }, [gold, PASS_COST, updateProgress, rivalName, navigation, lang]);

  const handlePayTribute = useCallback(() => {
    if (gold < TRIBUTE_COST) {
      Alert.alert(
        lang === 'es' ? 'Sin fondos' : 'Insufficient gold',
        lang === 'es'
          ? `Necesitas ${TRIBUTE_COST}G para el tributo.`
          : `You need ${TRIBUTE_COST}G for tribute.`,
      );
      return;
    }
    updateProgress({ gold: gold - TRIBUTE_COST });
    Alert.alert(
      lang === 'es' ? 'Tributo ofrecido' : 'Tribute offered',
      lang === 'es'
        ? `${rivalName} toma el oro sin decir nada y se retira.`
        : `${rivalName} takes the gold silently and withdraws.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }],
    );
  }, [gold, TRIBUTE_COST, updateProgress, rivalName, navigation, lang]);

  const handleFlee = useCallback(() => {
    // d20 + DEX mod vs DC 15 — IG-01: use makePRNG for deterministic rolls
    const rng  = makePRNG(`${seedHash}_flee_${cycle}`);
    const lead = partyData.find(c => c.alive);
    const dexMod = lead ? Math.floor(((lead.baseStats?.DEX ?? 10) - 10) / 2) : 0;
    const roll   = Math.floor(rng.float() * 20) + 1 + dexMod;
    if (roll >= FLEE_DC) {
      setFleeResult('SUCCESS');
      setTimeout(() => navigation.goBack(), 1500);
    } else {
      setFleeResult('FAIL');
      // Failed flee: straight to battle (ambush)
      setTimeout(() => {
        navigation.navigate('Battle', { roomId: `rival_flee_${rivalName}`, roomType: 'ELITE' });
      }, 1500);
    }
  }, [partyData, navigation, rivalName, seedHash, cycle]);

  const handleProposeAlliance = useCallback(() => {
    // Navigate to AllianceScreen with context
    navigation.navigate('Alliance');
  }, [navigation]);

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Header */}
      <View className="p-4 border-b border-primary/30 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Text className="text-primary font-robotomono text-xs">
            {'<'} {lang === 'es' ? 'VOLVER' : 'BACK'}
          </Text>
        </TouchableOpacity>
        <Text className="text-primary font-robotomono text-sm font-bold flex-1 text-center mr-8">
          {lang === 'es' ? '⚔ ENCUENTRO CON RIVAL' : '⚔ RIVAL ENCOUNTER'}
        </Text>
      </View>

      <View className="flex-1 p-4">
        {/* Rival info */}
        <View className="border border-destructive/50 rounded p-3 mb-4">
          <Text className="text-destructive font-robotomono text-sm font-bold">
            {rivalName}
          </Text>
          <Text className="text-primary/60 font-robotomono text-xs mt-1">
            {lang === 'es' ? `Piso ${floor}` : `Floor ${floor}`} · {lang === 'es' ? 'PARTIDO RIVAL' : 'RIVAL PARTY'}
          </Text>
        </View>

        {/* Gold display */}
        <Text className="text-accent font-robotomono text-xs mb-4">
          {lang === 'es' ? `ORO DISPONIBLE: ${gold}G` : `AVAILABLE GOLD: ${gold}G`}
        </Text>

        {fleeResult && (
          <View className={`border rounded p-3 mb-4 ${fleeResult === 'SUCCESS' ? 'border-primary' : 'border-destructive'}`}>
            <Text className={`font-robotomono text-sm text-center ${fleeResult === 'SUCCESS' ? 'text-primary' : 'text-destructive'}`}>
              {fleeResult === 'SUCCESS'
                ? (lang === 'es' ? '¡Escapaste!' : 'You escaped!')
                : (lang === 'es' ? '¡Atrapado! ¡Al combate!' : 'Caught! Into combat!')}
            </Text>
          </View>
        )}

        {!fleeResult && (
          <>
            {/* ATTACK */}
            <TouchableOpacity
              onPress={handleAttack}
              className="border border-destructive rounded p-4 mb-3"
            >
              <Text className="text-destructive font-robotomono text-sm font-bold">
                {lang === 'es' ? '[ATACAR]' : '[ATTACK]'}
              </Text>
              <Text className="text-primary/60 font-robotomono text-xs mt-1">
                {lang === 'es' ? 'Iniciar combate PvP' : 'Start PvP combat'}
              </Text>
            </TouchableOpacity>

            {/* NEGOTIATE */}
            <TouchableOpacity
              onPress={() => setAction(action === 'NEGOTIATE' ? null : 'NEGOTIATE')}
              className={`border rounded p-4 mb-3 ${action === 'NEGOTIATE' ? 'border-accent' : 'border-primary/50'}`}
            >
              <Text className="text-accent font-robotomono text-sm font-bold">
                {lang === 'es' ? '[NEGOCIAR]' : '[NEGOTIATE]'}
              </Text>
              <Text className="text-primary/60 font-robotomono text-xs mt-1">
                {lang === 'es' ? 'Ofrecer oro o alianza' : 'Offer gold or alliance'}
              </Text>
            </TouchableOpacity>

            {action === 'NEGOTIATE' && (
              <View className="ml-4 mb-3 space-y-2">
                <TouchableOpacity
                  onPress={handlePayPass}
                  disabled={gold < PASS_COST}
                  className={`border rounded p-3 ${gold >= PASS_COST ? 'border-accent/60' : 'border-primary/20 opacity-40'}`}
                >
                  <Text className="text-primary font-robotomono text-xs">
                    {lang === 'es' ? `Pagar paso libre: ${PASS_COST}G` : `Pay free passage: ${PASS_COST}G`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleProposeAlliance}
                  className="border border-accent/60 rounded p-3"
                >
                  <Text className="text-primary font-robotomono text-xs">
                    {lang === 'es'
                      ? `Proponer alianza (${ALLIANCE_FEE}G/${lang === 'es' ? 'ciclo' : 'cycle'} · ${ALLIANCE_CYCLES} ciclos)`
                      : `Propose alliance (${ALLIANCE_FEE}G/cycle · ${ALLIANCE_CYCLES} cycles)`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePayTribute}
                  disabled={gold < TRIBUTE_COST}
                  className={`border rounded p-3 ${gold >= TRIBUTE_COST ? 'border-accent/60' : 'border-primary/20 opacity-40'}`}
                >
                  <Text className="text-primary font-robotomono text-xs">
                    {lang === 'es' ? `Ofrecer tributo: ${TRIBUTE_COST}G` : `Offer tribute: ${TRIBUTE_COST}G`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* FLEE */}
            <TouchableOpacity
              onPress={handleFlee}
              className="border border-primary/30 rounded p-4"
            >
              <Text className="text-primary/70 font-robotomono text-sm font-bold">
                {lang === 'es' ? '[HUIR]' : '[FLEE]'}
              </Text>
              <Text className="text-primary/40 font-robotomono text-xs mt-1">
                {lang === 'es'
                  ? `Chequeo Atletismo/Sigilo DC ${FLEE_DC} · Un miembro puede quedarse atrás`
                  : `Athletics/Stealth check DC ${FLEE_DC} · A member may get left behind`}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};
