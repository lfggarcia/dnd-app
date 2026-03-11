import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Alert } from 'react-native';
import type { ScreenProps } from '../navigation/types';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';

// ─── Matrix rain — un solo intervalo en lugar de 12 ──────────────────────────
const CHAR_LIST = '0123456789ABCDEF#!@$%&*';
const NUM_COLUMNS = 12;
const NUM_ROWS = 20;
const MATRIX_INTERVAL_MS = 150;

function buildMatrixCols(): string[] {
  return Array.from({ length: NUM_COLUMNS }, () =>
    Array.from({ length: NUM_ROWS }, () =>
      CHAR_LIST.charAt(Math.floor(Math.random() * CHAR_LIST.length))
    ).join('\n')
  );
}

export const SeedScreen = ({ navigation }: ScreenProps<'Seed'>) => {
  const { t } = useI18n();

  const [seed, setSeed] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const processingAnim = useSharedValue(0);

  // Único intervalo para todas las columnas — antes eran 12 intervalos paralelos
  const [matrixCols, setMatrixCols] = useState<string[]>(buildMatrixCols);
  useEffect(() => {
    const id = setInterval(() => setMatrixCols(buildMatrixCols()), MATRIX_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Reset overlay when returning to this screen
  useFocusEffect(
    useCallback(() => {
      processingAnim.value = 0;
      setIsProcessing(false);
    }, []),
  );

  const onExecute = () => {
    if (!seed || isProcessing) return;
    // RT-08: validate seed to prevent low-entropy hash collisions
    if (seed.length < 4) {
      Alert.alert('Seed inválida', 'La seed debe tener al menos 4 caracteres');
      return;
    }
    if (!/^[\x20-\x7E]+$/.test(seed)) {
      Alert.alert('Seed inválida', 'Solo se permiten caracteres ASCII imprimibles');
      return;
    }
    const uniqueChars = new Set(seed).size;
    if (uniqueChars < 2) {
      Alert.alert('Seed inválida', 'La seed necesita más variedad de caracteres');
      return;
    }
    Keyboard.dismiss();
    setIsProcessing(true);
    const hash = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0).toString(16).toUpperCase();
    const navToParty = () => navigation.navigate('Party', { seed, seedHash: hash });
    processingAnim.value = withTiming(1, { duration: 2000 }, () => {
      runOnJS(navToParty)();
    });
  };

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: processingAnim.value,
    backgroundColor: '#FFB000',
  }));

  const seedHash = seed
    ? seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0).toString(16).toUpperCase()
    : '----';

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View className="flex-1 bg-background">
      <CRTOverlay />


      {/* Matrix background */}
      <View className="absolute inset-0 flex-row justify-center opacity-15" pointerEvents="none">
        {matrixCols.map((chars, i) => (
          <View key={i} className="mx-[2px]">
            <Text className="text-[8px] text-secondary/30 font-robotomono">{chars}</Text>
          </View>
        ))}
      </View>

      {/* Header */}
      <View className="p-4 border-b border-secondary/30">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-secondary font-robotomono text-xs">{'<'} {t('common.back')}</Text>
          </TouchableOpacity>
          <Text className="text-secondary font-robotomono text-xs">{t('seed.title')}</Text>
        </View>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
        {/* Seed Name Input */}
        <View className="mb-8">
          <Text className="text-secondary font-robotomono text-[10px] mb-2">
            {'>'} {t('seed.seedLabel')}
          </Text>
          <View className="border-2 border-secondary p-4 bg-muted/30">
            <TextInput
              style={{ fontSize: 24, color: '#FFB000', fontFamily: 'RobotoMono', height: 40, padding: 0 }}
              value={seed}
              onChangeText={setSeed}
              placeholder={t('seed.enterSeed')}
              placeholderTextColor="rgba(255,176,0,0.2)"
              autoCapitalize="characters"
              maxLength={16}
            />
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-secondary/40 font-robotomono text-[9px]">
              {t('seed.hash')}: 0x{seedHash}
            </Text>
            <Text className="text-secondary/40 font-robotomono text-[9px]">
              {t('common.status')}: {seed ? t('seed.valid') : t('seed.awaiting')}
            </Text>
          </View>
        </View>

        {/* Difficulty */}
        <View className="mb-8 border border-secondary/30 p-4 bg-muted/20">
          <Text className="text-secondary font-robotomono text-[10px] mb-3">{t('seed.difficulty')}:</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-secondary font-robotomono text-lg font-bold">{t('seed.cruel')}</Text>
            <Text className="text-destructive font-robotomono text-[9px]">[{t('seed.cruelDesc').toUpperCase()}]</Text>
          </View>
          <Text className="text-secondary/50 font-robotomono text-[8px] mt-2">
            {t('seed.cruelRules')}
          </Text>
        </View>

        {/* Seed Info */}
        <View className="mb-8 border border-primary/20 p-3 bg-primary/5">
          <Text className="text-primary font-robotomono text-[9px]">
            {t('seed.seedGenerates')}
          </Text>
          <Text className="text-primary/60 font-robotomono text-[8px] mt-1">
            {t('seed.seedInfo')}
          </Text>
        </View>

        {/* Execute Button */}
        <TouchableOpacity
          onPress={onExecute}
          disabled={!seed || isProcessing}
          className={`border-2 border-secondary p-4 items-center ${
            !seed ? 'opacity-20' : 'bg-secondary/10'
          }`}
        >
          <Text className="text-secondary font-bold text-lg font-robotomono">
            [ {t('seed.createParty')} ]
          </Text>
          <Text className="text-secondary/50 font-robotomono text-[8px] mt-1">
            {t('seed.createPartyDesc')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Processing Overlay */}
      <Animated.View
        style={[overlayStyle, { position: 'absolute', inset: 0 }]}
        pointerEvents="none"
      />

      <GlossaryButton />
    </View>
    </TouchableWithoutFeedback>
  );
};
