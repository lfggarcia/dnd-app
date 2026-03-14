import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getTranslatedField } from '../../services/translationBridge';
import { getDescFromRaw, getSubclassFeatures } from '../../services/characterStats';
import { LightningIcon } from '../Icons';
import type { Lang } from '../../i18n';

const S = StyleSheet.create({
  subFlavor: { color: 'rgba(255,176,0,0.5)' },
  subDesc: { color: 'rgba(255,176,0,0.7)' },
  featureName: { color: 'rgba(255,176,0,0.8)' },
});

type SubclassAbilitiesPanelProps = {
  subclassIndex: string;
  raw: Record<string, unknown>;
  lang: Lang;
};

export const SubclassAbilitiesPanel = memo(({ subclassIndex, raw, lang }: SubclassAbilitiesPanelProps) => {
  const features = useMemo(() => getSubclassFeatures(subclassIndex), [subclassIndex]);
  const desc = getTranslatedField('subclasses', subclassIndex, 'desc', lang) || getDescFromRaw(raw);
  const flavor = raw.subclass_flavor as string || '';

  return (
    <View className="mt-3 border border-secondary/20 rounded-sm bg-muted/5 p-3">
      {flavor ? (
        <Text style={S.subFlavor} className="font-robotomono text-[9px] mb-1 uppercase">
          {flavor}
        </Text>
      ) : null}
      <Text style={S.subDesc} className="font-robotomono text-[10px] leading-4 mb-2">
        {desc}
      </Text>
      {features.length > 0 ? (
        <View className="border-t border-secondary/20 pt-2 mt-1">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <LightningIcon size={9} color="rgba(255,176,0,0.9)" />
            <Text className="text-secondary font-robotomono text-[9px] font-bold" style={{ marginLeft: 4 }}>
              {lang === 'es' ? 'HABILIDADES DESBLOQUEADAS:' : 'UNLOCKED FEATURES:'}
            </Text>
          </View>
          {features.map(f => (
            <View key={`${f.en}-${f.level}`} className="flex-row items-center mb-1">
              <Text className="text-accent font-robotomono text-[8px] w-10">Lv.{f.level}</Text>
              <Text style={S.featureName} className="font-robotomono text-[9px] flex-1">
                {f[lang]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});
