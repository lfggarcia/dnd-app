import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useI18n } from '../i18n';

// ─── Types ────────────────────────────────────────────────

export type TutorialStep = {
  id: string;
  icon: string;
  titleKey: string;
  descKey: string;
};

type TutorialOverlayProps = {
  visible: boolean;
  steps: TutorialStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onClose: () => void;
};

// ─── Styles ───────────────────────────────────────────────

const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.6)',
    backgroundColor: '#0A0E0A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,65,0.2)',
    backgroundColor: 'rgba(0,255,65,0.05)',
  },
  headerTitle: {
    color: '#00FF41',
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  stepCounter: {
    color: 'rgba(0,255,65,0.5)',
    fontFamily: 'RobotoMono-Regular',
    fontSize: 9,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,62,62,0.5)',
    backgroundColor: 'rgba(255,62,62,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FF3E3E',
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  body: {
    padding: 20,
  },
  icon: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#FFB000',
    fontFamily: 'RobotoMono-Bold',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  desc: {
    color: 'rgba(0,255,65,0.8)',
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
  },
  progressBar: {
    height: 2,
    backgroundColor: 'rgba(0,255,65,0.1)',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00FF41',
    borderRadius: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.2)',
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.4)',
    borderRadius: 2,
    minWidth: 70,
    alignItems: 'center',
  },
  navBtnDisabled: {
    opacity: 0.2,
  },
  navBtnText: {
    color: '#00FF41',
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    fontWeight: 'bold',
  },
  nextBtn: {
    backgroundColor: 'rgba(0,255,65,0.15)',
    borderColor: '#00FF41',
  },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  skipText: {
    color: 'rgba(0,255,65,0.35)',
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
    textDecorationLine: 'underline',
  },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,255,65,0.08)',
  },
});

// ─── Component ────────────────────────────────────────────

export const TutorialOverlay = ({
  visible,
  steps,
  currentStep,
  onNext,
  onPrev,
  onSkip,
  onClose,
}: TutorialOverlayProps) => {
  const { t } = useI18n();
  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Entry animation
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.92);
  const scanY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      cardOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) });
      cardScale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    } else {
      cardOpacity.value = 0;
      cardScale.value = 0.92;
    }
  }, [visible]);

  // Scanline animation on step change
  useEffect(() => {
    scanY.value = 0;
    scanY.value = withDelay(
      100,
      withSequence(
        withTiming(200, { duration: 600, easing: Easing.linear }),
        withTiming(200, { duration: 0 }),
      ),
    );
  }, [currentStep]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const scanStyle = useAnimatedStyle(() => ({
    top: scanY.value,
  }));

  if (!step) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={S.backdrop}>
        <Animated.View style={[S.card, cardStyle]}>
          {/* Scanline effect */}
          <Animated.View style={[S.scanline, scanStyle]} />

          {/* Header */}
          <View style={S.header}>
            <Text style={S.headerTitle}>
              {'>'} {t('tutorial.header')}
            </Text>
            <View style={S.headerRight}>
              <Text style={S.stepCounter}>
                [{currentStep + 1}/{steps.length}]
              </Text>
              <TouchableOpacity onPress={onClose} style={S.closeBtn} hitSlop={8}>
                <Text style={S.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Body */}
          <View style={S.body}>
            <Text style={S.icon}>{step.icon}</Text>
            <Text style={S.title}>{t(step.titleKey)}</Text>
            <Text style={S.desc}>{t(step.descKey)}</Text>
          </View>

          {/* Progress bar */}
          <View style={S.progressBar}>
            <View style={[S.progressFill, { width: `${progress}%` }]} />
          </View>

          {/* Footer */}
          <View style={S.footer}>
            <TouchableOpacity
              onPress={onPrev}
              disabled={isFirst}
              style={[S.navBtn, isFirst && S.navBtnDisabled]}
            >
              <Text style={S.navBtnText}>{'<'} {t('tutorial.prev')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onSkip} style={S.skipBtn}>
              <Text style={S.skipText}>{t('tutorial.skip')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onNext}
              style={[S.navBtn, S.nextBtn]}
            >
              <Text style={S.navBtnText}>
                {isLast ? t('tutorial.finish') : t('tutorial.next')} {'>'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};
