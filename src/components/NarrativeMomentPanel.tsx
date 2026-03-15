/**
 * NarrativeMomentPanel.tsx — Sprint 4C
 *
 * Compact panel that slides up over the BattleScreen for ~3 seconds
 * when a significant combat event occurs. Shows the character's portrait
 * (with emotional expression), narrator text, character dialogue, and
 * active combat modifiers.
 *
 * Positioned above the action panel — does not block the combat view.
 */

import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';
import { AppImage } from './AppImage';
import type { Source as FastImageSource } from '@d11/react-native-fast-image';
import type { EmotionState } from '../services/emotionalNarrativeService';

// CRT-palette accent colors per emotion family
const FAMILY_ACCENT: Record<string, string> = {
  COLERA:     '#FF3E3E',              // red
  MIEDO:      '#B266FF',              // violet
  DUELO:      '#4DBBFF',              // cold blue
  RESOLUCION: '#00FF41',              // terminal green (game primary)
  CONTROL:    '#FFB000',              // amber
  NEUTRO:     'rgba(255,255,255,0.4)',
};

const DISMISS_DELAY_MS = 3500;

type Props = {
  charName:    string;
  emotion:     EmotionState;
  portraitUri: number | FastImageSource | null;
  onDismiss:   () => void;
};

export const NarrativeMomentPanel = ({ charName, emotion, portraitUri, onDismiss }: Props) => {
  const slideY = useSharedValue(120);
  const color = FAMILY_ACCENT[emotion.family] ?? '#00FF41';

  useEffect(() => {
    slideY.value = withSpring(0, {
      stiffness: 120,
      damping: 15,
      mass: 0.8,
    });
    const timer = setTimeout(onDismiss, DISMISS_DELAY_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimation(slideY); // safe cleanup if panel unmounts before spring ends
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 160,
          left: 16,
          right: 16,
          backgroundColor: '#0A0E0A',
          borderWidth: 1,
          borderColor: color,
          padding: 12,
          zIndex: 100,
        },
        animatedStyle,
      ]}
    >
      {/* Header row: portrait + name + intensity dots */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        {portraitUri != null && (
          <AppImage
            source={portraitUri}
            style={{ width: 48, height: 48, borderWidth: 1, borderColor: color, marginRight: 10 }}
            resizeMode="cover"
          />
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'RobotoMono-Bold', color, fontSize: 11 }}>
            {charName.toUpperCase()}
          </Text>
          <Text style={{ fontFamily: 'RobotoMono-Regular', color: 'rgba(255,255,255,0.5)', fontSize: 9 }}>
            {emotion.expression.toUpperCase()} · {emotion.durationTurns} TURNOS
          </Text>
        </View>
        {/* Intensity indicator 1-3 */}
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {([1, 2, 3] as const).map(i => (
            <View
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i <= emotion.intensity ? color : 'rgba(255,255,255,0.12)',
              }}
            />
          ))}
        </View>
      </View>

      {/* Narrator line */}
      {emotion.narrativeText.narrator !== '' && (
        <Text
          style={{
            fontFamily: 'RobotoMono-Regular',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 10,
            fontStyle: 'italic',
            marginBottom: 4,
          }}
        >
          {emotion.narrativeText.narrator}
        </Text>
      )}

      {/* Character dialogue */}
      {emotion.narrativeText.dialogue !== '' && (
        <Text style={{ fontFamily: 'RobotoMono-Bold', color, fontSize: 10 }}>
          {emotion.narrativeText.dialogue}
        </Text>
      )}

      {/* Active modifier preview */}
      <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {emotion.modifier.damageMult != null && emotion.modifier.damageMult !== 1 && (
          <Text style={{ fontFamily: 'RobotoMono-Regular', color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>
            DMG {emotion.modifier.damageMult > 1 ? '+' : ''}
            {Math.round((emotion.modifier.damageMult - 1) * 100)}%
          </Text>
        )}
        {emotion.modifier.accuracyMult != null && emotion.modifier.accuracyMult !== 1 && (
          <Text style={{ fontFamily: 'RobotoMono-Regular', color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>
            ACC {emotion.modifier.accuracyMult > 1 ? '+' : ''}
            {Math.round((emotion.modifier.accuracyMult - 1) * 100)}%
          </Text>
        )}
        {emotion.modifier.critBonus != null && (
          <Text style={{ fontFamily: 'RobotoMono-Regular', color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>
            CRIT +{Math.round(emotion.modifier.critBonus * 100)}%
          </Text>
        )}
      </View>
    </Animated.View>
  );
};
