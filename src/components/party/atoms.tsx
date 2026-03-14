import React, { memo, type ReactNode } from 'react';
import { View, Text } from 'react-native';

// ─── Atoms ────────────────────────────────────────────────
// Pure presentational building-blocks with no business logic.

export const SectionCard = memo(({
  children,
  borderColor = 'border-primary/30',
}: {
  children: ReactNode;
  borderColor?: string;
}) => (
  <View className={`mb-5 border ${borderColor} rounded-md bg-muted/10 p-4`}>
    {children}
  </View>
));

export const SectionHeader = memo(({
  icon,
  label,
  color = 'text-primary',
}: {
  icon: ReactNode;
  label: string;
  color?: string;
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
    {icon}
    <Text className={`${color} font-robotomono text-sm font-bold`} style={{ marginLeft: 6 }}>
      {label}
    </Text>
  </View>
));

export const SectionHint = memo(({
  text,
  color = 'text-primary/50',
}: {
  text: string;
  color?: string;
}) => (
  <Text className={`${color} font-robotomono text-xs mb-3`}>{text}</Text>
));

export const DescriptionBox = memo(({
  text,
  borderColor = 'border-primary/40',
  textColor = 'text-primary/70',
}: {
  text: string;
  borderColor?: string;
  textColor?: string;
}) => (
  <View className={`mt-3 border-l-2 ${borderColor} pl-3 py-2 bg-background/60 rounded-r-sm`}>
    <Text className={`${textColor} font-robotomono text-[11px] leading-4`}>{text}</Text>
  </View>
));
