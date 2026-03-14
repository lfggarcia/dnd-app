import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import {
  getActiveAlliances,
  formAlliance,
  terminateAlliance,
} from '../services/allianceService';
import { generateRivals } from '../services/rivalGenerator';
import type { Alliance } from '../services/allianceService';
import type { ScreenProps } from '../navigation/types';

export const AllianceScreen = ({ navigation }: ScreenProps<'Alliance'>) => {
  const { lang } = useI18n();

  const gameId       = useGameStore(s => s.activeGame?.id ?? '');
  const seedHash     = useGameStore(s => s.activeGame?.seedHash ?? '');
  const cycle        = useGameStore(s => s.activeGame?.cycle ?? 1);
  const floor        = useGameStore(s => s.activeGame?.floor ?? 1);
  const gold         = useGameStore(s => s.activeGame?.gold ?? 0);
  const updateProgress = useGameStore(s => s.updateProgress);

  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [showProposal, setShowProposal] = useState(false);
  const [selectedRival, setSelectedRival] = useState<string | null>(null);

  const PROPOSAL_FEE     = Math.max(100, floor * 40);
  const PROPOSAL_CYCLES  = 5;

  // Load active alliances from DB
  const refresh = useCallback(() => {
    if (!gameId || !seedHash) return;
    const active = getActiveAlliances(gameId, seedHash);
    setAlliances(active);
  }, [gameId, seedHash]);

  useEffect(() => { refresh(); }, [refresh]);

  // CR-034: memoize — generateRivals is expensive and only changes when seed/floor/cycle change
  const rivals = useMemo(
    () => generateRivals(seedHash, floor, cycle).filter(r => r.status !== 'defeated'),
    [seedHash, floor, cycle],
  );

  const handleFormAlliance = useCallback((rivalName: string) => {
    if (gold < PROPOSAL_FEE) {
      Alert.alert(
        lang === 'es' ? 'Sin fondos' : 'Insufficient funds',
        lang === 'es'
          ? `Necesitas ${PROPOSAL_FEE}G para proponer esta alianza.`
          : `You need ${PROPOSAL_FEE}G to propose this alliance.`,
      );
      return;
    }
    formAlliance(gameId, seedHash, rivalName, PROPOSAL_FEE, PROPOSAL_CYCLES, cycle);
    updateProgress({ gold: gold - PROPOSAL_FEE });
    refresh();
    setShowProposal(false);
    setSelectedRival(null);
    Alert.alert(
      lang === 'es' ? 'Alianza formada' : 'Alliance formed',
      lang === 'es'
        ? `${rivalName} acepta tu propuesta por ${PROPOSAL_CYCLES} ciclos.`
        : `${rivalName} accepts your proposal for ${PROPOSAL_CYCLES} cycles.`,
    );
  }, [gold, PROPOSAL_FEE, gameId, seedHash, cycle, PROPOSAL_CYCLES, updateProgress, refresh, lang]);

  const handleTerminate = useCallback((alliance: Alliance) => {
    Alert.alert(
      lang === 'es' ? 'Romper alianza' : 'Break alliance',
      lang === 'es'
        ? `¿Romper la alianza con ${alliance.partyB}? Esto reduce la moral.`
        : `Break alliance with ${alliance.partyB}? This reduces morale.`,
      [
        { text: lang === 'es' ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'es' ? 'Romper' : 'Break',
          style: 'destructive',
          onPress: () => {
            terminateAlliance(alliance.id);
            refresh();
          },
        },
      ],
    );
  }, [lang, refresh]);

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
          {lang === 'es' ? '🤝 ALIANZAS' : '🤝 ALLIANCES'}
        </Text>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Active alliances */}
        <Text className="text-primary font-robotomono text-xs font-bold mb-3">
          {lang === 'es' ? 'ALIANZAS ACTIVAS' : 'ACTIVE ALLIANCES'}
        </Text>

        {alliances.length === 0 && (
          <View className="border border-primary/20 rounded p-3 mb-4">
            <Text className="text-primary/40 font-robotomono text-xs text-center">
              {lang === 'es' ? 'Sin alianzas activas' : 'No active alliances'}
            </Text>
          </View>
        )}

        {alliances.map(a => {
          const cyclesLeft = a.expiresAtCycle - cycle;
          return (
            <View key={a.id} className="border border-primary/30 rounded p-3 mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-primary font-robotomono text-sm font-bold">
                    {a.partyB}
                  </Text>
                  <Text className="text-primary/60 font-robotomono text-xs mt-1">
                    {lang === 'es'
                      ? `Expira ciclo ${a.expiresAtCycle} · ${cyclesLeft > 0 ? cyclesLeft : 0} restantes`
                      : `Expires cycle ${a.expiresAtCycle} · ${cyclesLeft > 0 ? cyclesLeft : 0} remaining`}
                  </Text>
                  <Text className="text-accent font-robotomono text-xs">
                    {a.protectionFee}G / {lang === 'es' ? 'ciclo' : 'cycle'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleTerminate(a)}
                  className="border border-destructive/50 rounded px-2 py-1 ml-2"
                >
                  <Text className="text-destructive font-robotomono text-xs">
                    {lang === 'es' ? 'ROMPER' : 'BREAK'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Propose new alliance */}
        <TouchableOpacity
          onPress={() => setShowProposal(!showProposal)}
          className="border border-accent/50 rounded p-3 mb-4"
        >
          <Text className="text-accent font-robotomono text-xs font-bold text-center">
            {lang === 'es' ? '+ PROPONER NUEVA ALIANZA' : '+ PROPOSE NEW ALLIANCE'}
          </Text>
          <Text className="text-primary/40 font-robotomono text-xs text-center mt-1">
            {lang === 'es'
              ? `Costo: ${PROPOSAL_FEE}G · Duración: ${PROPOSAL_CYCLES} ciclos`
              : `Cost: ${PROPOSAL_FEE}G · Duration: ${PROPOSAL_CYCLES} cycles`}
          </Text>
        </TouchableOpacity>

        {showProposal && (
          <View className="mb-4">
            <Text className="text-primary font-robotomono text-xs mb-2">
              {lang === 'es' ? 'SELECCIONAR PARTY:' : 'SELECT PARTY:'}
            </Text>
            {rivals.map(r => {
              const alreadyAllied = alliances.some(a => a.partyB === r.name);
              return (
                <TouchableOpacity
                  key={r.name}
                  onPress={() => !alreadyAllied && setSelectedRival(r.name)}
                  disabled={alreadyAllied}
                  className={`border rounded p-3 mb-2 ${selectedRival === r.name ? 'border-accent' : 'border-primary/30'} ${alreadyAllied ? 'opacity-30' : ''}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-primary font-robotomono text-xs">
                      {r.name}
                    </Text>
                    {alreadyAllied && (
                      <Text className="text-accent font-robotomono text-xs">
                        {lang === 'es' ? 'ALIADO' : 'ALLIED'}
                      </Text>
                    )}
                  </View>
                  <Text className="text-primary/40 font-robotomono text-xs">
                    {lang === 'es' ? `Piso ${r.floor}` : `Floor ${r.floor}`}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {selectedRival && (
              <TouchableOpacity
                onPress={() => handleFormAlliance(selectedRival)}
                className="border border-accent rounded p-3 items-center mt-2"
              >
                <Text className="text-accent font-robotomono text-xs font-bold">
                  {lang === 'es'
                    ? `ENVIAR PROPUESTA A ${selectedRival} (${PROPOSAL_FEE}G)`
                    : `SEND PROPOSAL TO ${selectedRival} (${PROPOSAL_FEE}G)`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Gold display */}
        <View className="border border-primary/20 rounded p-3">
          <Text className="text-accent font-robotomono text-xs text-center">
            {lang === 'es' ? `ORO DISPONIBLE: ${gold}G` : `AVAILABLE GOLD: ${gold}G`}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};
