import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { useI18n } from '../i18n';
import type { ScreenProps } from '../navigation/types';

export const SettingsScreen = ({ navigation }: ScreenProps<'Settings'>) => {
  const { lang, setLang } = useI18n();

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View className="pt-16 px-6 pb-4 border-b border-primary/20">
          <Text className="text-primary font-robotomono text-2xl font-bold tracking-widest">
            {lang === 'es' ? 'AJUSTES' : 'SETTINGS'}
          </Text>
        </View>

        {/* Language */}
        <View className="px-6 mt-6">
          <Text className="text-primary font-robotomono text-xs uppercase tracking-widest mb-3 opacity-60">
            {lang === 'es' ? 'Idioma' : 'Language'}
          </Text>
          <View className="border border-primary/30 rounded p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-primary font-robotomono">
                {lang === 'es' ? 'Español' : 'English'}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-primary/60 font-robotomono text-sm">EN</Text>
                <Switch
                  value={lang === 'es'}
                  onValueChange={(v) => setLang(v ? 'es' : 'en')}
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#fff"
                />
                <Text className="text-primary/60 font-robotomono text-sm">ES</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Back */}
        <View className="px-6 mt-8">
          <TouchableOpacity
            className="border border-primary/40 rounded p-4 items-center"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-primary font-robotomono">
              {lang === 'es' ? '← Volver' : '← Back'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
};
