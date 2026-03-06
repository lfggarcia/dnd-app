import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import type { ScreenProps } from '../navigation/types';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryModal, GlossaryButton } from '../components/GlossaryModal';
import { useGlossary } from '../hooks/useGlossary';
import { useI18n } from '../i18n';

const DataColumn = ({ index }: { index: number }) => {
  const [chars, setChars] = useState('');

  useEffect(() => {
    const charsList = '0123456789ABCDEF#!@$%&*';
    const interval = setInterval(() => {
      let result = '';
      for (let i = 0; i < 20; i++) {
        result += charsList.charAt(Math.floor(Math.random() * charsList.length)) + '\n';
      }
      setChars(result);
    }, 100 + index * 30);
    return () => clearInterval(interval);
  }, [index]);

  return (
    <View className="mx-[2px]">
      <Text className="text-[8px] text-secondary/30 font-robotomono">{chars}</Text>
    </View>
  );
};

export const SeedScreen = ({ navigation }: ScreenProps<'Seed'>) => {
  const { t } = useI18n();
  const glossary = useGlossary();
  const [seed, setSeed] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const processingAnim = useSharedValue(0);

  const onExecute = () => {
    if (!seed || isProcessing) return;
    setIsProcessing(true);
    processingAnim.value = withTiming(1, { duration: 1500 }, () => {
      runOnJS(navigation.navigate)('Party' as any);
    });
  };

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: processingAnim.value * 0.8,
    backgroundColor: '#FFB000',
  }));

  const seedHash = seed
    ? seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0).toString(16).toUpperCase()
    : '----';

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />
      <GlossaryModal visible={glossary.visible} onClose={glossary.close} />

      {/* Matrix background */}
      <View className="absolute inset-0 flex-row justify-center opacity-15" pointerEvents="none">
        {Array.from({ length: 12 }).map((_, i) => (
          <DataColumn key={i} index={i} />
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

      <View className="flex-1 justify-center px-6">
        {/* Seed Name Input */}
        <View className="mb-8">
          <Text className="text-secondary font-robotomono text-[10px] mb-2">
            {'>'} {t('seed.seedLabel')}
          </Text>
          <View className="border-2 border-secondary p-4 bg-muted/30">
            <TextInput
              className="text-2xl text-secondary font-robotomono h-10"
              value={seed}
              onChangeText={setSeed}
              placeholder={t('seed.enterSeed')}
              placeholderTextColor="#FFB00030"
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
      </View>

      {/* Processing Overlay */}
      <Animated.View
        style={[overlayStyle, { position: 'absolute', inset: 0 }]}
        pointerEvents="none"
      />

      <GlossaryButton onPress={glossary.open} />
    </View>
  );
};
