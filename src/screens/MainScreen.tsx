import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TypewriterText } from '../components/TypewriterText';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { LogoIA } from '../components/LogoIA';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { ScreenProps } from '../navigation/types';

const BOOT_KEY_ORDER = [
  'bootKernel', 'bootTower', 'bootSeed', 'bootSouls', 'bootCycle', 'bootDnd', 'bootUplink',
] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export const MainScreen = ({ navigation }: ScreenProps<'Main'>) => {
  const { t, lang, setLang } = useI18n();

  const activeGame = useGameStore(s => s.activeGame);
  const savedGames = useGameStore(s => s.savedGames);
  const loadGame = useGameStore(s => s.loadGame);
  const removeGame = useGameStore(s => s.removeGame);
  const hydrate = useGameStore(s => s.hydrate);

  const [bootComplete, setBootComplete] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; seed: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setBootComplete(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Re-hydrate when screen gains focus (e.g. returning from game)
  useFocusEffect(
    useCallback(() => {
      hydrate();
    }, [hydrate]),
  );

  const hasSaves = savedGames.length > 0;
  const hasActive = activeGame !== null && activeGame.status === 'active';

  const MENU_ITEMS = useMemo(() => [
    { key: 'continue', labelKey: 'main.continueExpedition', enabled: hasActive, tag: hasActive ? null : 'noSave' },
    { key: 'new', labelKey: 'main.newSeed', enabled: true, tag: null },
    { key: 'load', labelKey: 'main.loadSeed', enabled: hasSaves, tag: hasSaves ? null : 'locked' },
    { key: 'settings', labelKey: 'main.systemConfig', enabled: false, tag: 'locked' },
    { key: 'credits', labelKey: 'main.credits', enabled: false, tag: 'locked' },
  ] as const, [hasActive, hasSaves]);

  const handleMenuPress = useCallback((key: string) => {
    if (key === 'new') navigation.navigate('Seed');
    if (key === 'continue' && hasActive) {
      if (activeGame?.combatRoomId != null) {
        // Crash recovery: a combat was in progress — go directly to Battle
        navigation.reset({
          index: 0,
          routes: [{
            name: 'Battle',
            params: {
              roomId: activeGame.combatRoomId,
              roomType: activeGame.combatRoomType ?? 'NORMAL',
            },
          }],
        });
      } else if (activeGame?.location === 'map') {
        navigation.reset({ index: 0, routes: [{ name: 'Map' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
      }
    }
    if (key === 'load') setLoadModalVisible(true);
  }, [hasActive, activeGame, navigation]);

  const handleLoadGame = useCallback((id: string) => {
    const game = savedGames.find(g => g.id === id);
    const ok = loadGame(id);
    if (ok) {
      setLoadModalVisible(false);
      if (game?.location === 'map') {
        navigation.reset({ index: 0, routes: [{ name: 'Map' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
      }
    }
  }, [savedGames, loadGame, navigation]);

  const handleDeleteGame = useCallback((id: string, seed: string) => {
    setDeleteTarget({ id, seed });
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      removeGame(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, removeGame]);

  const toggleLang = useCallback(() => setLang(lang === 'es' ? 'en' : 'es'), [lang, setLang]);

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Language Toggle */}
      <TouchableOpacity
        onPress={toggleLang}
        className="absolute top-12 right-4 z-10 border border-primary/40 px-3 py-1"
      >
        <Text className="text-primary font-robotomono text-[10px]">{lang.toUpperCase()}</Text>
      </TouchableOpacity>

      {/* Boot Logs */}
      <View className="absolute top-12 left-6 right-16 opacity-30">
        {BOOT_KEY_ORDER.map((key, i) => (
          <Text key={i} className="text-[9px] text-primary font-robotomono leading-4">
            {t(`main.${key}`)}
          </Text>
        ))}
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {/* IA Logo */}
        <LogoIA />

        <Text className="text-secondary font-robotomono text-[9px] mt-2 mb-1">
          {t('main.subtitle')}
        </Text>
        <View className="w-48 h-[1px] bg-primary/30 mb-10" />

        {/* Menu */}
        <View className="w-full max-w-xs space-y-3">
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => handleMenuPress(item.key)}
              disabled={!item.enabled}
              className={`border border-primary/40 p-3 ${
                item.enabled ? 'bg-primary/5' : 'opacity-30'
              }`}
            >
              <View className="flex-row items-center">
                <Text className="text-primary font-robotomono text-[10px] mr-2 opacity-40">
                  {String(i).padStart(2, '0')}
                </Text>
                {item.key === 'new' && bootComplete ? (
                  <TypewriterText
                    text={t(item.labelKey)}
                    className="text-primary font-bold text-base"
                    delay={40}
                    showCursor={false}
                  />
                ) : (
                  <Text className={`font-robotomono text-base ${
                    item.enabled ? 'text-primary font-bold' : 'text-primary'
                  }`}>
                    {t(item.labelKey)}
                  </Text>
                )}
                {item.tag === 'locked' && (
                  <Text className="text-primary/30 font-robotomono text-[8px] ml-auto">
                    [{t('common.locked').toUpperCase()}]
                  </Text>
                )}
                {item.tag === 'noSave' && (
                  <Text className="text-primary/30 font-robotomono text-[8px] ml-auto">
                    [{t('main.noSave').toUpperCase()}]
                  </Text>
                )}
              </View>
              {/* Show active game info under Continue */}
              {item.key === 'continue' && hasActive && activeGame && (
                <View className="mt-2 flex-row justify-between">
                  <Text className="text-primary/50 font-robotomono text-[8px]">
                    {t('main.seed')}: {activeGame.seed}
                  </Text>
                  <Text className="text-primary/50 font-robotomono text-[8px]">
                    {t('common.floor')}: {activeGame.floor} | {t('common.cycle')}: {activeGame.cycle}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Footer */}
      <View className="px-6 pb-6 flex-row justify-between items-end">
        <Text className="text-[9px] text-primary/30 font-robotomono">
          {t('main.footer')}
        </Text>
        <Text className="text-[9px] text-primary/30 font-robotomono">
          {t('main.protocolActive')}
        </Text>
      </View>

      <GlossaryButton />

      {/* Load Game Modal */}
      <Modal
        visible={loadModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLoadModalVisible(false)}
      >
        <View className="flex-1 bg-background/95 px-6 pt-16 pb-8">
          <CRTOverlay />

          {/* Header */}
          <View className="flex-row justify-between items-center mb-6 border-b border-primary/30 pb-3">
            <Text className="text-primary font-robotomono font-bold text-base">
              {t('main.loadSeed')}
            </Text>
            <TouchableOpacity onPress={() => setLoadModalVisible(false)}>
              <Text className="text-primary font-robotomono text-xs">[{t('common.close').toUpperCase()}]</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" scrollEnabled={deleteTarget === null}>
            {savedGames.length === 0 ? (
              <Text className="text-primary/40 font-robotomono text-xs text-center mt-8">
                {t('main.noSaves')}
              </Text>
            ) : (
              savedGames.map((game) => (
                <View
                  key={game.id}
                  className="border border-primary/30 mb-3 bg-muted/10 rounded-sm"
                >
                  <TouchableOpacity
                    onPress={() => handleLoadGame(game.id)}
                    className="p-4"
                  >
                    {/* Top row: seed + status */}
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-primary font-robotomono font-bold text-sm">
                        {game.seed}
                      </Text>
                      <Text
                        className="font-robotomono text-[8px] px-2 py-[2px] border rounded-sm"
                        style={{
                          color: game.status === 'active' ? '#00FF41' : game.status === 'dead' ? '#FF3E3E' : '#FFB000',
                          borderColor: game.status === 'active' ? 'rgba(0,255,65,0.3)' : game.status === 'dead' ? 'rgba(255,62,62,0.3)' : 'rgba(255,176,0,0.3)',
                        }}
                      >
                        {game.status === 'active' ? t('common.active') : game.status === 'dead' ? t('common.dead') : t('main.completed')}
                      </Text>
                    </View>

                    {/* Party summary */}
                    <View className="flex-row flex-wrap mb-2">
                      {game.partyData.map((c, ci) => (
                        <Text key={ci} className="text-secondary/70 font-robotomono text-[9px] mr-3">
                          {c.name} ({c.charClass})
                        </Text>
                      ))}
                    </View>

                    {/* Progress */}
                    <View className="flex-row justify-between">
                      <Text className="text-primary/40 font-robotomono text-[8px]">
                        {t('common.floor')}: {game.floor} | {t('common.cycle')}: {game.cycle} | {t('common.gold')}: {game.gold}
                      </Text>
                      <Text className="text-primary/30 font-robotomono text-[8px]">
                        {formatDate(game.updatedAt)}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Delete button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteGame(game.id, game.seed)}
                    className="border-t border-primary/20 p-2 items-center"
                  >
                    <Text className="text-destructive/60 font-robotomono text-[9px]">
                      [{t('main.deleteSave').toUpperCase()}]
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          {/* Delete Confirmation — inline overlay (iOS only supports one Modal at a time) */}
          {deleteTarget !== null && (
            <View
              className="absolute top-0 left-0 right-0 bottom-0 justify-center items-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
            >
              <View className="mx-8 w-full max-w-xs border border-primary/40 bg-background p-6">
                <Text className="text-primary font-robotomono font-bold text-sm mb-3">
                  {t('main.deleteSave')}
                </Text>
                <Text className="text-primary/60 font-robotomono text-xs mb-6">
                  {t('main.deleteSaveConfirm')} "{deleteTarget?.seed}"?
                </Text>
                <View className="flex-row justify-end space-x-4">
                  <TouchableOpacity
                    onPress={() => setDeleteTarget(null)}
                    className="border border-primary/30 px-4 py-2"
                  >
                    <Text className="text-primary font-robotomono text-xs">
                      [{t('common.cancel').toUpperCase()}]
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmDelete}
                    className="border border-destructive/40 px-4 py-2 ml-3"
                  >
                    <Text className="text-destructive font-robotomono text-xs">
                      [{t('common.confirm').toUpperCase()}]
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>

    </View>
  );
};

