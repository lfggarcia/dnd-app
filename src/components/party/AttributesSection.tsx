import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SectionCard, SectionHeader, SectionHint } from './atoms';
import { AnimatedStatBar } from './AnimatedStatBar';
import { DiceIcon } from '../Icons';
import { STAT_KEYS } from '../../services/characterStats';
import type { Lang } from '../../i18n';
import type { Stats } from '../../database/gameRepository';

const S = StyleSheet.create({
  statTotal: { color: 'rgba(0,255,65,0.5)' },
  statTotalRacial: { color: 'rgba(0,229,255,0.7)' },
});

type AttributesSectionProps = {
  baseStats: Stats;
  racialBonuses: Record<string, number>;
  statMethod: 'standard' | 'rolled';
  totalBase: number;
  totalFinal: number;
  lang: Lang;
  abilityScoresLabel: string;
  onReroll: () => void;
  onStdArray: () => void;
};

export const AttributesSection = memo(({
  baseStats, racialBonuses, statMethod, totalBase, totalFinal,
  lang, abilityScoresLabel, onReroll, onStdArray,
}: AttributesSectionProps) => (
  <SectionCard borderColor="border-primary/40">
    <View className="flex-row justify-between items-center mb-1">
      <SectionHeader icon={<DiceIcon size={14} color="rgba(0,255,65,0.9)" />} label={abilityScoresLabel} />
      <View className="flex-row">
        <TouchableOpacity
          onPress={onStdArray}
          className={`mr-2 border rounded-sm px-2 py-1 ${
            statMethod === 'standard' ? 'bg-primary border-primary' : 'border-primary bg-muted'
          }`}
        >
          <Text className={`font-robotomono text-[8px] ${statMethod === 'standard' ? 'text-background font-bold' : 'text-primary'}`}>
            {lang === 'es' ? 'ESTÁNDAR' : 'STANDARD'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onReroll}
          className={`border rounded-sm px-2 py-1 ${
            statMethod === 'rolled' ? 'bg-primary border-primary' : 'border-primary bg-muted'
          }`}
        >
          <Text className={`font-robotomono text-[8px] ${statMethod === 'rolled' ? 'text-background font-bold' : 'text-primary'}`}>
            4d6
          </Text>
        </TouchableOpacity>
      </View>
    </View>
    <SectionHint
      text={
        statMethod === 'standard'
          ? (lang === 'es'
            ? 'Array estándar [15,14,13,12,10,8] asignado por clase'
            : 'Standard array [15,14,13,12,10,8] assigned by class')
          : (lang === 'es'
            ? '4d6 descarta menor — rango balanceado (total 70-80)'
            : '4d6 drop lowest — balanced range (total 70-80)')
      }
    />
    {STAT_KEYS.map((key, i) => (
      <AnimatedStatBar
        key={key}
        statKey={key as keyof Stats}
        base={baseStats[key as keyof Stats]}
        bonus={racialBonuses[key] || 0}
        index={i}
        lang={lang}
      />
    ))}
    <View className="flex-row justify-between mt-2 border-t border-primary/20 pt-2">
      <Text style={S.statTotal} className="font-robotomono text-[9px]">BASE: {totalBase}</Text>
      <Text style={S.statTotalRacial} className="font-robotomono text-[9px]">
        TOTAL + RACIAL: {totalFinal}
      </Text>
    </View>
  </SectionCard>
));
