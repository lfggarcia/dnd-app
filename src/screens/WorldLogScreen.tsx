import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { SimulationEvent } from '../services/worldSimulator';
import type { ScreenProps } from '../navigation/types';

type LogFilter = 'ALL' | 'COMBAT' | 'LORE' | 'SYSTEM';

interface LogEntry {
  cycle: number;
  type: LogFilter;
  message_en: string;
  message_es: string;
}

/** Map SimulationEventType → LogFilter category */
function simEventToLogType(type: SimulationEvent['type']): LogFilter {
  switch (type) {
    case 'AI_COMBAT_WIN':
    case 'AI_COMBAT_LOSS':
    case 'BOSS_KILLED':
      return 'COMBAT';
    case 'ALLIANCE_FORMED':
    case 'BOUNTY_ISSUED':
      return 'SYSTEM';
    case 'AI_FLOOR_ADVANCE':
    case 'AI_REST':
    case 'AI_ELIMINATED':
    case 'AI_PARTY_SPAWNED':
    default:
      return 'SYSTEM';
  }
}

/** Convert SimulationEvent[] → LogEntry[] */
function simEventsToLogEntries(events: SimulationEvent[]): LogEntry[] {
  return events.map(e => ({
    cycle: e.cycle,
    type: simEventToLogType(e.type),
    message_en: e.summary_en,
    message_es: e.summary,
  }));
}

const FILTERS: LogFilter[] = ['ALL', 'COMBAT', 'LORE', 'SYSTEM'];

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
  const rawEvents = useGameStore(s => s.lastSimulationEvents);

  const [filter, setFilter] = useState<LogFilter>('ALL');

  const logEntries = useMemo(
    () => rawEvents ? simEventsToLogEntries(rawEvents) : [],
    [rawEvents],
  );

  const filtered = useMemo(
    () => filter === 'ALL' ? logEntries : logEntries.filter(e => e.type === filter),
    [filter, logEntries],
  );

  const groupedByCycle = useMemo(
    () => filtered.reduce<Record<number, LogEntry[]>>((acc, entry) => {
      if (!acc[entry.cycle]) acc[entry.cycle] = [];
      acc[entry.cycle].push(entry);
      return acc;
    }, {}),
    [filtered],
  );

  const cycles = useMemo(
    () => Object.keys(groupedByCycle).map(Number).sort((a, b) => b - a),
    [groupedByCycle],
  );

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
        {FILTERS.map(f => {
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
          <Text className="text-primary font-robotomono text-sm font-bold">{logEntries.length}</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-primary/40 font-robotomono text-[8px]">{t('worldLog.cycles')}</Text>
          <Text className="text-primary font-robotomono text-sm font-bold">
            {logEntries.length > 0 ? Math.max(...logEntries.map(e => e.cycle)) : 0}
          </Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-destructive/40 font-robotomono text-[8px]">{t('worldLog.combats')}</Text>
          <Text className="text-destructive font-robotomono text-sm font-bold">
            {logEntries.filter(e => e.type === 'COMBAT').length}
          </Text>
        </View>
      </View>

      <GlossaryButton />
    </View>
  );
};
