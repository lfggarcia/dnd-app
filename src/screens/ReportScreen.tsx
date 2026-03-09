import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { TypewriterText } from '../components/TypewriterText';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';
import type { ScreenProps } from '../navigation/types';

const REPORT_DATA = {
  result: 'VICTORY',
  enemiesDefeated: [
    { name: 'SKELETON_KNIGHT', xp: 200, loot: 'IRON_LONGSWORD' },
    { name: 'WIGHT', xp: 150, loot: 'SHADOW_ESSENCE x2' },
    { name: 'SHADOW', xp: 100, loot: null },
  ],
  partyStatus: [
    { name: 'KAEL', class: 'FIGHTER', hpBefore: 32, hpAfter: 28, status: 'ALIVE' },
    { name: 'LYRA', class: 'WIZARD', hpBefore: 18, hpAfter: 18, status: 'ALIVE' },
    { name: 'THORNE', class: 'CLERIC', hpBefore: 24, hpAfter: 24, status: 'ALIVE' },
    { name: 'RAVEN', class: 'ROGUE', hpBefore: 22, hpAfter: 20, status: 'ALIVE' },
  ],
  totalXp: 450,
  goldEarned: 120,
  roundsElapsed: 4,
};

export const ReportScreen = ({ navigation, route }: ScreenProps<'Report'>) => {
  const { roomId, roomWasCleared } = route.params;
  const { t } = useI18n();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('Map');
      return true;
    });
    return () => sub.remove();
  }, [navigation]);


  const headerText = `─── ${t('report.title')} · ${t('common.floor')} 01 · ${t('common.cycle')} 01 ───`;

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />


      {/* Header */}
      <View className="p-4 border-b border-primary/30">
        <TypewriterText
          text={headerText}
          className="text-primary text-xs text-center"
          delay={20}
          showCursor={false}
        />
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Result */}
        <View className="items-center mb-6">
          <Text className={`font-robotomono text-2xl font-bold ${
            REPORT_DATA.result === 'VICTORY' ? 'text-primary' : 'text-destructive'
          }`}>
            [{REPORT_DATA.result === 'VICTORY' ? t('report.victory') : t('report.defeat')}]
          </Text>
          <Text className="text-primary/40 font-robotomono text-[8px] mt-1">
            {REPORT_DATA.roundsElapsed} {t('report.rounds')} · {t('common.floor')} 01
          </Text>
        </View>

        {/* Enemies Defeated */}
        <View className="mb-4 border border-primary/20 p-3 bg-muted/10">
          <Text className="text-primary font-robotomono text-[9px] mb-2 font-bold">{t('report.enemiesDefeated')}</Text>
          {REPORT_DATA.enemiesDefeated.map((e, i) => (
            <View key={i} className="flex-row justify-between items-center mb-1 py-1 border-b border-primary/10">
              <Text className="text-primary/70 font-robotomono text-[9px]">{e.name}</Text>
              <View className="flex-row">
                <Text className="text-secondary font-robotomono text-[8px] mr-3">+{e.xp}XP</Text>
                {e.loot && (
                  <Text className="text-accent font-robotomono text-[8px]">{e.loot}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Party Status */}
        <View className="mb-4 border border-primary/20 p-3 bg-muted/10">
          <Text className="text-primary font-robotomono text-[9px] mb-2 font-bold">{t('report.partyStatus')}</Text>
          {REPORT_DATA.partyStatus.map((c, i) => {
            const hpLost = c.hpBefore - c.hpAfter;
            return (
              <View key={i} className="flex-row justify-between items-center mb-1 py-1 border-b border-primary/10">
                <View className="flex-row items-center">
                  <Text className="text-primary font-robotomono text-[9px] font-bold mr-2">{c.name}</Text>
                  <Text className="text-secondary/60 font-robotomono text-[7px]">{t(`party.class_${c.class}`)}</Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-primary/60 font-robotomono text-[8px]">
                    {t('common.hp')}: {c.hpAfter}/{c.hpBefore}
                  </Text>
                  {hpLost > 0 && (
                    <Text className="text-destructive font-robotomono text-[8px] ml-2">-{hpLost}</Text>
                  )}
                  <View className={`w-2 h-2 ml-2 ${
                    c.status === 'ALIVE' ? 'bg-primary' : 'bg-destructive'
                  }`} />
                </View>
              </View>
            );
          })}
        </View>

        {/* XP & Gold */}
        <View className="mb-4 flex-row">
          <View className="flex-1 mr-2 border border-secondary/30 p-3 bg-secondary/5 items-center">
            <Text className="text-secondary/50 font-robotomono text-[7px]">{t('report.totalXp')}</Text>
            <Text className="text-secondary font-robotomono text-xl font-bold">+{REPORT_DATA.totalXp}</Text>
          </View>
          <View className="flex-1 ml-2 border border-secondary/30 p-3 bg-secondary/5 items-center">
            <Text className="text-secondary/50 font-robotomono text-[7px]">{t('report.goldEarned')}</Text>
            <Text className="text-secondary font-robotomono text-xl font-bold">{REPORT_DATA.goldEarned}G</Text>
          </View>
        </View>

        {/* Performance Graph */}
        <View className="mb-4 border border-primary/20 p-3 bg-primary/5">
          <Text className="text-primary font-robotomono text-[9px] mb-2 font-bold">{t('report.damageDone')}</Text>
          <View className="flex-row items-end h-16">
            {[
              { name: 'RAVEN', dmg: 15, max: 15 },
              { name: 'LYRA', dmg: 9, max: 15 },
              { name: 'KAEL', dmg: 0, max: 15 },
              { name: 'THORNE', dmg: 0, max: 15 },
            ].map((d, i) => (
              <View key={i} className="flex-1 items-center mx-1">
                <View
                  className="w-full bg-primary/40 border border-primary/20"
                  style={{ height: `${(d.dmg / d.max) * 100}%`, minHeight: 2 }}
                />
                <Text className="text-primary/40 font-robotomono text-[6px] mt-1">{d.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* World Event Alert */}
        <View className="mb-4 border border-destructive/30 p-3 bg-destructive/5">
          <Text className="text-destructive font-robotomono text-xs font-bold">
            ⚠ {t('report.worldEvent')}
          </Text>
          <Text style={{ color: 'rgba(255,62,62,0.7)' }} className="font-robotomono text-[11px] mt-1">
            PARTY "LAST_LIGHT" ELIMINATED · {t('common.floor')} 03 · {t('common.cycle')} 01
          </Text>
        </View>

        <View className="h-8" />
      </ScrollView>

      {/* Continue Button */}
      <View className="p-4 border-t border-primary/30 bg-background">
        <TouchableOpacity
          onPress={() => navigation.navigate('Map')}
          className="bg-primary p-3 items-center"
        >
          <Text className="text-background font-bold font-robotomono">{t('common.continue')}</Text>
        </TouchableOpacity>
      </View>

      <GlossaryButton />
    </View>
  );
};
