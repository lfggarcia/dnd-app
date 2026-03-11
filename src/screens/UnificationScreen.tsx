import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { ScreenProps } from '../navigation/types';

export const UnificationScreen = ({ navigation, route }: ScreenProps<'Unification'>) => {
  const { lang } = useI18n();
  const { previousPartyNames, inheritedLevel } = route.params;

  const startNewGame  = useGameStore(s => s.startNewGame);
  const activeGame    = useGameStore(s => s.activeGame);
  const updateProgress = useGameStore(s => s.updateProgress);
  const endGame       = useGameStore(s => s.endGame);

  const handleContinue = useCallback(() => {
    Alert.alert(
      lang === 'es' ? '⚠ Acción irreversible' : '⚠ Irreversible action',
      lang === 'es'
        ? 'Tu party anterior pasará a ser controlada por la IA. Esta acción no se puede deshacer.'
        : 'Your previous party will be controlled by AI. This cannot be undone.',
      [
        { text: lang === 'es' ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'es' ? 'CONTINUAR' : 'CONTINUE',
          style: 'destructive',
          onPress: () => {
            // Mark the current game as IA-inherited so worldSimulator picks it up
            if (activeGame) {
              updateProgress({ status: 'active' });
            }
            // Navigate to Party creation for new party
            const seed     = activeGame?.seed ?? '';
            const seedHash = activeGame?.seedHash ?? '';
            navigation.navigate('Party', { seed, seedHash });
          },
        },
      ],
    );
  }, [lang, activeGame, updateProgress, navigation]);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Header */}
      <View className="p-4 border-b border-primary/30">
        <Text className="text-primary font-robotomono text-sm font-bold text-center">
          {lang === 'es' ? '⚠ SEED EXISTENTE DETECTADA' : '⚠ EXISTING SEED DETECTED'}
        </Text>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Warning */}
        <View className="border border-destructive/50 rounded p-4 mb-4">
          <Text className="text-primary/80 font-robotomono text-xs">
            {lang === 'es'
              ? 'Tu party anterior en esta seed pasará a ser controlada por IA.'
              : 'Your previous party in this seed will be controlled by AI.'}
          </Text>
        </View>

        {/* Previous party */}
        <Text className="text-primary font-robotomono text-xs font-bold mb-2">
          {lang === 'es' ? 'PARTY ANTERIOR:' : 'PREVIOUS PARTY:'}
        </Text>
        <View className="border border-primary/20 rounded p-3 mb-4">
          {previousPartyNames.map(name => (
            <Text key={name} className="text-primary/60 font-robotomono text-xs py-0.5">
              · {name}
            </Text>
          ))}
        </View>

        {/* New party info */}
        <Text className="text-primary font-robotomono text-xs font-bold mb-2">
          {lang === 'es' ? 'NUEVA PARTY:' : 'NEW PARTY:'}
        </Text>
        <View className="border border-primary/20 rounded p-3 mb-6">
          <Text className="text-accent font-robotomono text-xs">
            {lang === 'es'
              ? `Nivel inicial heredado: Lv ${inheritedLevel}`
              : `Inherited starting level: Lv ${inheritedLevel}`}
          </Text>
          <Text className="text-primary/40 font-robotomono text-xs mt-1">
            {lang === 'es'
              ? '(Promedio de la party anterior)'
              : '(Average of the previous party)'}
          </Text>
        </View>

        {/* Warning footer */}
        <View className="border border-destructive/30 rounded p-3 mb-6">
          <Text className="text-destructive font-robotomono text-xs text-center">
            {lang === 'es'
              ? '⚠ Esta acción es IRREVERSIBLE'
              : '⚠ This action is IRREVERSIBLE'}
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          onPress={handleContinue}
          className="border border-destructive rounded p-4 mb-3 items-center"
        >
          <Text className="text-destructive font-robotomono text-sm font-bold">
            {lang === 'es' ? '[CONTINUAR CON NUEVA PARTY]' : '[CONTINUE WITH NEW PARTY]'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCancel}
          className="border border-primary/40 rounded p-4 items-center"
        >
          <Text className="text-primary font-robotomono text-sm">
            {lang === 'es' ? '[CANCELAR]' : '[CANCEL]'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
