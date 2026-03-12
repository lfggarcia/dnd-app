import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { ScreenProps } from '../navigation/types';

export const SimulationLoadingScreen = ({ navigation, route }: ScreenProps<'SimulationLoading'>) => {
  const { lang }      = useI18n();
  const { fromCycle } = route.params;

  const advanceToVillage    = useGameStore(s => s.advanceToVillage);
  const lastSimEvents       = useGameStore(s => s.lastSimulationEvents);
  const cycle               = useGameStore(s => s.activeGame?.cycle ?? fromCycle);

  const [phase, setPhase]   = useState<'running' | 'done'>('running');
  const [highlight, setHighlight] = useState<string>('');

  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim    = useRef(new Animated.Value(0.4)).current;

  const TARGET_CYCLE = 60;
  const progress     = Math.round(((cycle - fromCycle) / Math.max(1, TARGET_CYCLE - fromCycle)) * 100);

  useEffect(() => {
    // Pulse animation for loading indicator
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();

    // Run the full season simulation
    advanceToVillage().then(() => {
      setPhase('done');
      loop.stop();
    });

    return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show latest notable event as highlight
  useEffect(() => {
    if (lastSimEvents && lastSimEvents.length > 0) {
      const notable = lastSimEvents.find(e =>
        e.type === 'AI_COMBAT_WIN' || e.type === 'AI_FLOOR_ADVANCE' || e.type === 'ALLIANCE_FORMED',
      );
      if (notable) setHighlight(lang === 'es' ? notable.summary : (notable.summary_en ?? notable.summary));
    }
  }, [lastSimEvents, lang]);

  // Navigate away when done
  useEffect(() => {
    if (phase === 'done') {
      const timer = setTimeout(() => navigation.navigate('Village'), 1200);
      return () => clearTimeout(timer);
    }
  }, [phase, navigation]);

  return (
    <View className="flex-1 bg-background items-center justify-center">
      <CRTOverlay />

      <Animated.View style={{ opacity: pulseAnim, marginBottom: 16 }}>
        <Text className="text-primary font-robotomono text-xl font-bold">
          {phase === 'done'
            ? (lang === 'es' ? '✓ SIMULACIÓN COMPLETA' : '✓ SIMULATION COMPLETE')
            : (lang === 'es' ? '⟳ SIMULANDO EL MUNDO...' : '⟳ SIMULATING THE WORLD...')}
        </Text>
      </Animated.View>

      <Text className="text-primary/60 font-robotomono text-sm mb-6">
        {lang === 'es'
          ? `Ciclo ${fromCycle} → Ciclo ${TARGET_CYCLE}`
          : `Cycle ${fromCycle} → Cycle ${TARGET_CYCLE}`}
      </Text>

      {/* Progress bar */}
      <View className="w-64 h-2 bg-primary/20 rounded-full mb-6 overflow-hidden">
        <Animated.View
          className="h-full bg-primary rounded-full"
          style={{ width: `${Math.min(100, phase === 'done' ? 100 : progress)}%` }}
        />
      </View>

      {highlight.length > 0 && (
        <View className="border border-primary/30 rounded p-3 w-64 mb-4">
          <Text className="text-primary/40 font-robotomono text-xs mb-1">
            {lang === 'es' ? 'DESTACADO:' : 'HIGHLIGHT:'}
          </Text>
          <Text className="text-primary font-robotomono text-xs">
            · {highlight}
          </Text>
        </View>
      )}

      <Text className="text-primary/40 font-robotomono text-xs">
        {lang === 'es' ? 'Procesando en lotes...' : 'Processing in batches...'}
      </Text>
    </View>
  );
};
