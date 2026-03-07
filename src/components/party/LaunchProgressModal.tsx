import React, { memo } from 'react';
import { Modal, View, Text, ActivityIndicator } from 'react-native';
import type { Lang } from '../../i18n';

type Props = {
  visible: boolean;
  lang: Lang;
  step: string | null;
  subStep: string | null;
};

const containerStyle = {
  flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  padding: 32,
} as const;

const boxStyle = {
  width: '100%' as const,
  borderWidth: 1, borderColor: 'rgba(0,255,65,0.3)',
  backgroundColor: '#0A0E0A', padding: 24,
} as const;

export const LaunchProgressModal = memo(({ visible, lang, step, subStep }: Props) => (
  <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
    <View style={containerStyle}>
      <View style={boxStyle}>
        <Text style={{
          fontFamily: 'RobotoMono-Bold', fontSize: 10,
          color: 'rgba(0,255,65,0.4)', letterSpacing: 3, marginBottom: 24,
        }}>
          {lang === 'es' ? 'PREPARANDO EXPEDICIÓN' : 'PREPARING EXPEDITION'}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: subStep ? 10 : 0 }}>
          <ActivityIndicator size="small" color="#00FF41" style={{ marginRight: 10 }} />
          <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 13, color: '#00FF41', flex: 1 }}>
            {'> '}{step}
          </Text>
        </View>

        {subStep ? (
          <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 11, color: 'rgba(0,255,65,0.45)', marginLeft: 8 }}>
            {subStep}
          </Text>
        ) : null}
      </View>
    </View>
  </Modal>
));
