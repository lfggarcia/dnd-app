import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';
import type { ScreenProps } from '../navigation/types';

type LogFilter = 'ALL' | 'COMBAT' | 'LORE' | 'SYSTEM';

interface LogEntry {
  cycle: number;
  type: LogFilter;
  message_en: string;
  message_es: string;
}

const LOG_ENTRIES: LogEntry[] = [
  { cycle: 3, type: 'COMBAT', message_en: 'Floor 5: SKELETON_KNIGHT defeated → 35 XP', message_es: 'Piso 5: SKELETON_KNIGHT derrotado → 35 XP' },
  { cycle: 3, type: 'LORE', message_en: 'Discovered ancient inscription in the crypt', message_es: 'Inscripción antigua descubierta en la cripta' },
  { cycle: 3, type: 'SYSTEM', message_en: 'Rivalry: CRIMSON_FANG advanced to Floor 7', message_es: 'Rivalidad: CRIMSON_FANG avanzó al Piso 7' },
  { cycle: 2, type: 'COMBAT', message_en: 'Floor 3: WIGHT defeated → 20 XP', message_es: 'Piso 3: WIGHT derrotado → 20 XP' },
  { cycle: 2, type: 'LORE', message_en: 'Found runic tablet fragment (2/4)', message_es: 'Fragmento de tablilla rúnica encontrado (2/4)' },
  { cycle: 2, type: 'SYSTEM', message_en: 'Village: Forge upgraded to Lv.2', message_es: 'Aldea: Forja mejorada a Nv.2' },
  { cycle: 1, type: 'COMBAT', message_en: 'Floor 1: RAT_SWARM defeated → 5 XP', message_es: 'Piso 1: RAT_SWARM derrotado → 5 XP' },
  { cycle: 1, type: 'SYSTEM', message_en: 'Party created. Seed: DARK_KEEP_7741', message_es: 'Grupo creado. Semilla: DARK_KEEP_7741' },
];

const FILTER_COLORS: Record<LogFilter, string> = {
  ALL: 'border-primary text-primary',
  COMBAT: 'border-destructive text-destructive',
  LORE: 'border-accent text-accent',
  SYSTEM: 'border-secondary text-secondary',
};

const TYPE_ICONS: Record<string, string> = {
  COMBAT: '⚔',
  LORE: '📜',
  SYSTEM: '⚙',
};

export const WorldLogScreen = ({ navigation }: ScreenProps<'WorldLog'>) => {
  const { t, lang } = useI18n();

  const [filter, setFilter] = useState<LogFilter>('ALL');

  const filters: LogFilter[] = ['ALL', 'COMBAT', 'LORE', 'SYSTEM'];
  const filtered = filter === 'ALL' ? LOG_ENTRIES : LOG_ENTRIES.filter(e => e.type === filter);

  const groupedByCycle = filtered.reduce<Record<number, LogEntry[]>>((acc, entry) => {
    if (!acc[entry.cycle]) acc[entry.cycle] = [];
    acc[entry.cycle].push(entry);
    return acc;
  }, {});

  const cycles = Object.keys(groupedByCycle).map(Number).sort((a, b) => b - a);

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />


      {/* Header */}
      <View className="p-4 border-b border-primary/30 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Text className="text-primary font-robotomono text-xs">{'<'} {t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-primary font-robotomono text-sm font-bold flex-1 text-center mr-8">
          {t('worldLog.title')}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View className="flex-row p-3 border-b border-primary/20">
        {filters.map(f => {
          const isActive = filter === f;
          const colorClass = FILTER_COLORS[f];
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              className={`flex-1 mx-1 py-2 items-center border ${isActive ? colorClass : 'border-primary/20'}`}
            >
              <Text className={`font-robotomono text-[10px] ${isActive ? colorClass.split(' ')[1] : 'text-primary/40'}`}>
                {t(`worldLog.filter_${f}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Log Entries */}
      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {cycles.map(cycle => (
          <View key={cycle} className="mb-6">
            <View className="flex-row items-center mb-2">
              <View className="h-px bg-primary/20 flex-1" />
              <Text className="text-primary/40 font-robotomono text-[9px] mx-3">
                {t('worldLog.cycle')} {cycle}
              </Text>
              <View className="h-px bg-primary/20 flex-1" />
            </View>

            {groupedByCycle[cycle].map((entry, i) => {
              const typeColor = entry.type === 'COMBAT' ? 'text-destructive' :
                entry.type === 'LORE' ? 'text-accent' : 'text-secondary';
              return (
                <View key={i} className="flex-row py-2 border-b border-primary/5">
                  <Text className="font-robotomono text-xs mr-2">{TYPE_ICONS[entry.type]}</Text>
                  <View className="flex-1">
                    <Text className={`font-robotomono text-[10px] ${typeColor}`}>
                      {lang === 'es' ? entry.message_es : entry.message_en}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {filtered.length === 0 && (
          <View className="items-center py-12">
            <Text className="text-primary/30 font-robotomono text-xs">{t('worldLog.noEntries')}</Text>
          </View>
        )}
      </ScrollView>

      {/* Stats Footer */}
      <View className="flex-row p-3 border-t border-primary/20 bg-muted/10">
        <View className="flex-1 items-center">
          <Text className="text-primary/40 font-robotomono text-[8px]">{t('worldLog.totalEntries')}</Text>
          <Text className="text-primary font-robotomono text-sm font-bold">{LOG_ENTRIES.length}</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-primary/40 font-robotomono text-[8px]">{t('worldLog.cycles')}</Text>
          <Text className="text-primary font-robotomono text-sm font-bold">3</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-destructive/40 font-robotomono text-[8px]">{t('worldLog.combats')}</Text>
          <Text className="text-destructive font-robotomono text-sm font-bold">
            {LOG_ENTRIES.filter(e => e.type === 'COMBAT').length}
          </Text>
        </View>
      </View>

      <GlossaryButton />
    </View>
  );
};
