import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import { confirmLevelUps } from '../services/progressionService';
import type { ScreenProps } from '../navigation/types';

export const LevelUpScreen = ({ navigation, route }: ScreenProps<'LevelUp'>) => {
  const { lang } = useI18n();
  const { charIndex } = route.params;

  const activeGame     = useGameStore(s => s.activeGame);
  const updateProgress = useGameStore(s => s.updateProgress);

  const partyData = activeGame?.partyData ?? [];
  const char      = partyData[charIndex];

  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = useCallback(() => {
    if (!char || confirmed) return;
    const result = confirmLevelUps(char);
    const updated = partyData.map((c, i) => i === charIndex ? result.char : c);
    updateProgress({ partyData: updated });
    setConfirmed(true);
    setTimeout(() => navigation.goBack(), 1200);
  }, [char, confirmed, partyData, charIndex, updateProgress, navigation]);

  if (!char) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <CRTOverlay />
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary font-robotomono text-xs">
            {'<'} {lang === 'es' ? 'VOLVER' : 'BACK'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pending  = char.pendingLevelUps ?? 0;
  const newLevel = char.level + pending;

  // Estimate HP gain
  const conMod     = Math.floor(((char.baseStats?.CON ?? 10) - 10) / 2);
  const hpPerLevel = Math.max(4, 5 + conMod);
  const hpGained   = pending * hpPerLevel;

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
          {lang === 'es' ? '⬆ SUBIDA DE NIVEL' : '⬆ LEVEL UP'}
        </Text>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Character info */}
        <View className="border border-primary/30 rounded p-4 mb-4">
          <Text className="text-primary font-robotomono text-lg font-bold">
            {char.name}
          </Text>
          <Text className="text-primary/60 font-robotomono text-xs mt-1">
            {char.charClass.toUpperCase()} · {char.subclass?.toUpperCase() ?? ''}
          </Text>
          <Text className="text-accent font-robotomono text-sm font-bold mt-2">
            {lang === 'es'
              ? `Nivel ${char.level} → ${newLevel}`
              : `Level ${char.level} → ${newLevel}`}
          </Text>
        </View>

        {/* Improvements */}
        <View className="mb-6">
          <Text className="text-primary font-robotomono text-xs font-bold mb-3">
            {lang === 'es' ? 'MEJORAS:' : 'IMPROVEMENTS:'}
          </Text>

          <View className="border-l-2 border-accent pl-3 space-y-2">
            <Text className="text-primary font-robotomono text-sm">
              + {hpGained} {lang === 'es' ? 'HP máximos' : 'max HP'}
            </Text>
            {newLevel % 4 === 0 && (
              <Text className="text-accent font-robotomono text-sm">
                + {lang === 'es' ? 'Mejora de Habilidad' : 'Ability Score Improvement'}
              </Text>
            )}
            {newLevel === 5 && (
              <Text className="text-accent font-robotomono text-sm">
                + {lang === 'es' ? 'Bonus de Competencia +3' : 'Proficiency Bonus +3'}
              </Text>
            )}
            {newLevel === 9 && (
              <Text className="text-accent font-robotomono text-sm">
                + {lang === 'es' ? 'Bonus de Competencia +4' : 'Proficiency Bonus +4'}
              </Text>
            )}
          </View>
        </View>

        {/* Confirm button */}
        {!confirmed && pending > 0 && (
          <TouchableOpacity
            onPress={handleConfirm}
            className="border border-accent py-4 rounded items-center"
          >
            <Text className="text-accent font-robotomono text-sm font-bold">
              {lang === 'es' ? 'CONFIRMAR NIVEL' : 'CONFIRM LEVEL UP'}
            </Text>
          </TouchableOpacity>
        )}

        {confirmed && (
          <View className="border border-primary py-4 rounded items-center">
            <Text className="text-primary font-robotomono text-sm font-bold">
              {lang === 'es' ? '✓ ¡NIVEL CONFIRMADO!' : '✓ LEVEL CONFIRMED!'}
            </Text>
          </View>
        )}

        {pending === 0 && !confirmed && (
          <View className="border border-primary/30 py-4 rounded items-center">
            <Text className="text-primary/50 font-robotomono text-sm">
              {lang === 'es' ? 'Sin niveles pendientes' : 'No pending level ups'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
