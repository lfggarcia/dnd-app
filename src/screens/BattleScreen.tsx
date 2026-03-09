import React, { useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, BackHandler, Image, StyleSheet } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { ScreenProps } from '../navigation/types';

export const BattleScreen = ({ navigation, route }: ScreenProps<'Battle'>) => {
  const { roomId } = route.params;
  const { t } = useI18n();
  // Selectores granulares — evita re-renders cuando cambian campos ajenos a esta pantalla
  const partyData = useGameStore(s => s.activeGame?.partyData ?? []);
  const portrait = useGameStore(s => s.activeGame?.partyPortrait ?? null);
  /** Retratos indexados por posición en el party. portraitsJson tiene prioridad */
  const portraitsMap = useGameStore(s => s.activeGame?.portraitsJson ?? null);
  const activeFloor = useGameStore(s => s.activeGame?.floor ?? 1);
  const activeCycle = useGameStore(s => s.activeGame?.cycle ?? 1);

  const aliveParty = useMemo(() => partyData.filter(c => c.alive), [partyData]);

  const getCharPortrait = useCallback(
    (char: typeof partyData[0], index: number): string | null =>
      portraitsMap?.[String(index)] ?? char.portrait ?? null,
    [portraitsMap],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('Report', { roomId, roomWasCleared: true });
      return true;
    });
    return () => sub.remove();
  }, [navigation, roomId]);

  // Se recalcula solo cuando cambia t (cambio de idioma), no en cada render
  const LOG_ENTRIES = useMemo(() => [
    `INITIATIVE: PARTY (18) vs ENEMY (12)`,
    `d20(15) + STR(4) VS ${t('battle.ac')}(14) = ✓`,
    `DMG: 8 (PHYSICAL)`,
    `> ${t('battle.turn')}: SQUAD_VULCAN`,
  ], [t]);

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Party Portrait Banner (if available) */}
      {portrait ? (
        <View style={S.portraitBanner}>
          <Image source={{ uri: portrait }} style={S.portraitImg} resizeMode="cover" />
          <View style={S.portraitDimmer} />
          {/* Floor / Cycle HUD overlaid on portrait */}
          <View style={S.portraitHud}>
            <Text style={S.hudText}>
              FLOOR {activeFloor}  ·  CYCLE {activeCycle}
            </Text>
          </View>
        </View>
      ) : (
        <View style={S.noPortraitHud}>
          <Text style={S.hudText}>
            FLOOR {activeFloor}  ·  CYCLE {activeCycle}
          </Text>
        </View>
      )}

      <View style={{ flex: 1, padding: 16 }}>
        {/* Enemies Area */}
        <View className="flex-row items-center justify-around mb-3">
          <View className="items-center">
            <View className="w-16 h-24 border border-secondary items-center justify-center" style={{ backgroundColor: 'rgba(255,176,0,0.08)' }}>
              <Text className="text-secondary font-robotomono text-[10px]">LICH_V1</Text>
            </View>
            <View className="w-16 h-1 mt-1" style={{ backgroundColor: '#FFB000' }} />
          </View>
          <View className="items-center">
            <View className="w-16 h-24 border border-secondary items-center justify-center" style={{ backgroundColor: 'rgba(255,176,0,0.08)' }}>
              <Text className="text-secondary font-robotomono text-[10px]">SKELETON</Text>
            </View>
            <View className="w-16 h-1 mt-1" style={{ backgroundColor: '#FFB000' }} />
          </View>
        </View>

        {/* Battlefield separator */}
        <View className="border-y items-center justify-center py-2" style={{ borderColor: 'rgba(0,255,65,0.15)' }}>
          <Text className="font-robotomono" style={{ color: 'rgba(0,255,65,0.07)', fontSize: 32 }}>
            {t('battle.title')}
          </Text>
        </View>

        {/* Party row */}
        <View className="flex-row items-end justify-around py-3">
          {aliveParty.slice(0, 5).map((char, i) => {
            const hpPct = char.maxHp > 0 ? char.hp / char.maxHp : 0;
            const hpColor = hpPct > 0.5 ? '#00FF41' : hpPct > 0.25 ? '#FFB000' : '#FF3E3E';
            const charPortrait = getCharPortrait(char, i);
            return (
              <View key={`${char.name}-${i}`} className="items-center" style={{ flex: 1 }}>
              <View
                  className="border mx-1"
                  style={{
                    width: 44, height: 56,
                    borderColor: i === 0 ? '#00FF41' : 'rgba(0,255,65,0.3)',
                    backgroundColor: i === 0 ? 'rgba(0,255,65,0.1)' : 'transparent',
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {charPortrait ? (
                    <Image
                      source={{ uri: charPortrait }}
                      style={{ position: 'absolute', width: 44, height: 56 }}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: charPortrait ? 'rgba(10,14,10,0.45)' : 'transparent', width: '100%', height: '100%' }}>
                    <Text className="font-robotomono text-center" style={{ fontSize: 7, color: hpColor }}>
                      {char.name.substring(0, 6).toUpperCase()}
                    </Text>
                    <Text className="font-robotomono" style={{ fontSize: 6, color: 'rgba(0,229,255,0.7)' }}>
                      {char.charClass.substring(0, 4).toUpperCase()}
                    </Text>
                  </View>
                </View>
                {/* HP bar */}
                <View style={{ width: 44, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 2 }}>
                  <View style={{ width: `${Math.round(hpPct * 100)}%`, height: 2, backgroundColor: hpColor }} />
                </View>
                <Text className="font-robotomono" style={{ fontSize: 6, color: 'rgba(0,255,65,0.5)', marginTop: 1 }}>
                  {char.hp}/{char.maxHp}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Combat Log */}
        <View className="border-2 p-2" style={{ borderColor: '#00FF41', backgroundColor: 'rgba(10,14,10,0.9)', height: 100 }}>
          <ScrollView>
            {LOG_ENTRIES.map((entry, idx) => (
              <Text key={idx} className="font-robotomono mb-1" style={{ fontSize: 9, color: '#00FF41' }}>
                {idx === LOG_ENTRIES.length - 1 ? '> ' : ''}{entry}
              </Text>
            ))}
          </ScrollView>
          <View className="absolute bottom-2 right-2 px-2 py-1" style={{ backgroundColor: '#00FF41' }}>
            <Text className="font-bold font-robotomono" style={{ fontSize: 9, color: '#0A0E0A' }}>
              {t('battle.waitingAction')}
            </Text>
          </View>
        </View>
      </View>

      {/* Force end button */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Report', { roomId, roomWasCleared: true })}
        className="absolute top-4 right-4 p-2"
        style={{ backgroundColor: '#FFB000' }}
      >
        <Text className="font-bold font-robotomono" style={{ fontSize: 9, color: '#0A0E0A' }}>
          {t('battle.forceEnd')}
        </Text>
      </TouchableOpacity>

      <GlossaryButton />
    </View>
  );
};

const S = StyleSheet.create({
  portraitBanner: {
    height: 90,
    overflow: 'hidden',
  },
  portraitImg: {
    width: '100%',
    height: 90,
  },
  portraitDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,14,10,0.55)',
  },
  portraitHud: {
    position: 'absolute',
    bottom: 6,
    left: 12,
  },
  noPortraitHud: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  hudText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    color: 'rgba(0,255,65,0.7)',
    letterSpacing: 1,
  },
});

