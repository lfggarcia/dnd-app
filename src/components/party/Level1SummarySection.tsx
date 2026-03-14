import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SectionCard, SectionHeader } from './atoms';
import { StatsIcon, SwordIcon, DnaIcon, ChevronRightIcon } from '../Icons';
import {
  CLASS_LVL1_FEATURES,
  RACE_TRAITS,
  CLASS_HIT_DICE,
  calcLvl1HP,
  LVL1_RULES,
} from '../../constants/dnd5eLevel1';
import type { Lang } from '../../i18n';
import type { Stats } from '../../database/gameRepository';

const S = StyleSheet.create({
  summaryLabel: { color: 'rgba(0,229,255,0.5)' },
  featureName: { color: 'rgba(255,176,0,0.8)' },
  raceTraitText: { color: 'rgba(0,255,65,0.7)' },
});

type Level1SummarySectionProps = {
  charClass: string;
  race: string;
  finalStats: Stats;
  lang: Lang;
};

export const Level1SummarySection = memo(({ charClass, race, finalStats, lang }: Level1SummarySectionProps) => (
  <SectionCard borderColor="border-accent/40">
    <SectionHeader
      icon={<StatsIcon size={14} color="rgba(0,229,255,0.9)" />}
      label={lang === 'es' ? 'RESUMEN NIVEL 1' : 'LEVEL 1 SUMMARY'}
      color="text-accent"
    />
    <View className="flex-row flex-wrap mt-2 mb-3">
      <View className="mr-4 mb-2 border border-accent/30 rounded px-3 py-2 bg-accent/5 items-center">
        <Text style={S.summaryLabel} className="font-robotomono text-[7px] uppercase">
          {lang === 'es' ? 'NIVEL' : 'LEVEL'}
        </Text>
        <Text className="text-accent font-robotomono text-lg font-bold">1</Text>
      </View>
      <View className="mr-4 mb-2 border border-accent/30 rounded px-3 py-2 bg-accent/5 items-center">
        <Text style={S.summaryLabel} className="font-robotomono text-[7px] uppercase">HP</Text>
        <Text className="text-accent font-robotomono text-lg font-bold">
          {calcLvl1HP(charClass, finalStats.CON)}
        </Text>
      </View>
      <View className="mr-4 mb-2 border border-accent/30 rounded px-3 py-2 bg-accent/5 items-center">
        <Text style={S.summaryLabel} className="font-robotomono text-[7px] uppercase">
          {lang === 'es' ? 'COMPETENCIA' : 'PROFICIENCY'}
        </Text>
        <Text className="text-accent font-robotomono text-lg font-bold">+{LVL1_RULES.PROFICIENCY_BONUS}</Text>
      </View>
      <View className="mb-2 border border-accent/30 rounded px-3 py-2 bg-accent/5 items-center">
        <Text style={S.summaryLabel} className="font-robotomono text-[7px] uppercase">
          {lang === 'es' ? 'DADO GOLPE' : 'HIT DIE'}
        </Text>
        <Text className="text-accent font-robotomono text-lg font-bold">
          d{CLASS_HIT_DICE[charClass] || 8}
        </Text>
      </View>
    </View>

    {CLASS_LVL1_FEATURES[charClass] && (
      <View className="mb-3">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SwordIcon size={9} color="rgba(255,176,0,0.9)" />
          <Text className="text-secondary font-robotomono text-[9px] font-bold mb-1" style={{ marginLeft: 4 }}>
            {lang === 'es' ? 'HABILIDADES DE CLASE (Nv.1):' : 'CLASS FEATURES (Lv.1):'}
          </Text>
        </View>
        {CLASS_LVL1_FEATURES[charClass].map((f, i) => (
          <View key={i} className="flex-row items-center mb-1 ml-2">
            <View style={{ marginRight: 4 }}><ChevronRightIcon size={8} color="rgba(255,176,0,0.6)" /></View>
            <Text style={S.featureName} className="font-robotomono text-[9px]">
              {lang === 'es' ? f.es : f.en}
            </Text>
          </View>
        ))}
      </View>
    )}

    {RACE_TRAITS[race] && (
      <View className="mb-1">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <DnaIcon size={9} color="rgba(0,255,65,0.9)" />
          <Text className="text-primary font-robotomono text-[9px] font-bold mb-1" style={{ marginLeft: 4 }}>
            {lang === 'es' ? 'RASGOS RACIALES:' : 'RACE TRAITS:'}
          </Text>
        </View>
        {RACE_TRAITS[race].map((t, i) => (
          <View key={i} className="flex-row items-center mb-1 ml-2">
            <View style={{ marginRight: 4 }}><ChevronRightIcon size={8} color="rgba(0,255,65,0.6)" /></View>
            <Text style={S.raceTraitText} className="font-robotomono text-[9px]">
              {lang === 'es' ? t.es : t.en}
            </Text>
          </View>
        ))}
      </View>
    )}
  </SectionCard>
));
