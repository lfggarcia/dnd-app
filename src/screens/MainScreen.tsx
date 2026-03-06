import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TypewriterText } from '../components/TypewriterText';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { TorreLogo } from '../components/TorreLogo';
import { useI18n } from '../i18n';
import type { ScreenProps } from '../navigation/types';

const BOOT_KEY_ORDER = [
  'bootKernel', 'bootTower', 'bootSeed', 'bootSouls', 'bootCycle', 'bootDnd', 'bootUplink',
] as const;

const MENU_ITEMS = [
  { key: 'continue', labelKey: 'main.continueExpedition', enabled: false, tag: 'noSave' },
  { key: 'new', labelKey: 'main.newSeed', enabled: true, tag: null },
  { key: 'load', labelKey: 'main.loadSeed', enabled: false, tag: 'locked' },
  { key: 'settings', labelKey: 'main.systemConfig', enabled: false, tag: 'locked' },
  { key: 'credits', labelKey: 'main.credits', enabled: false, tag: 'locked' },
] as const;

export const MainScreen = ({ navigation }: ScreenProps<'Main'>) => {
  const { t, lang, setLang } = useI18n();

  const [bootComplete, setBootComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBootComplete(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleMenuPress = (key: string) => {
    if (key === 'new') navigation.navigate('Seed');
  };

  const toggleLang = () => setLang(lang === 'es' ? 'en' : 'es');

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
        {/* Tower Logo */}
        <TorreLogo />

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
    </View>
  );
};
