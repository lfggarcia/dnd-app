import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Text as SvgText, Defs, Filter, FeGaussianBlur, FeFlood, FeComposite, FeMerge, FeMergeNode } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  useAnimatedProps,
} from 'react-native-reanimated';

const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);
const AnimatedView = Animated.View;

/**
 * "TORRE" logo rendered as SVG with a broken-neon flickering effect.
 * Two layers: a blurred glow behind + crisp text on top, both flicker independently.
 */
export const TorreLogo = () => {
  // Main text flicker
  const mainOpacity = useSharedValue(1);
  // Glow layer flicker (slightly different rhythm for "broken" feel)
  const glowOpacity = useSharedValue(0.6);
  // Horizontal jitter to simulate electrical instability
  const jitterX = useSharedValue(0);

  useEffect(() => {
    // Main flicker — irregular pattern simulating a broken neon tube
    mainOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.linear }),
        withTiming(0.15, { duration: 60, easing: Easing.steps(1) }),
        withTiming(1, { duration: 60, easing: Easing.steps(1) }),
        withTiming(1, { duration: 800, easing: Easing.linear }),
        withTiming(0.1, { duration: 40, easing: Easing.steps(1) }),
        withTiming(0.8, { duration: 40, easing: Easing.steps(1) }),
        withTiming(0.05, { duration: 50, easing: Easing.steps(1) }),
        withTiming(1, { duration: 50, easing: Easing.steps(1) }),
        withTiming(1, { duration: 3000, easing: Easing.linear }),
        withTiming(0.2, { duration: 30, easing: Easing.steps(1) }),
        withTiming(1, { duration: 70, easing: Easing.steps(1) }),
        withTiming(0.6, { duration: 40, easing: Easing.steps(1) }),
        withTiming(1, { duration: 40, easing: Easing.steps(1) }),
        withTiming(1, { duration: 1500, easing: Easing.linear }),
      ),
      -1,
      false,
    );

    // Glow flicker — slower, offset from main
    glowOpacity.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1800, easing: Easing.linear }),
          withTiming(0.1, { duration: 50, easing: Easing.steps(1) }),
          withTiming(0.5, { duration: 50, easing: Easing.steps(1) }),
          withTiming(0.8, { duration: 2500, easing: Easing.linear }),
          withTiming(0.05, { duration: 40, easing: Easing.steps(1) }),
          withTiming(0.6, { duration: 60, easing: Easing.steps(1) }),
          withTiming(0.0, { duration: 30, easing: Easing.steps(1) }),
          withTiming(0.7, { duration: 80, easing: Easing.steps(1) }),
          withTiming(0.7, { duration: 2000, easing: Easing.linear }),
        ),
        -1,
        false,
      ),
    );

    // Horizontal jitter — tiny random-feeling shifts
    jitterX.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2500, easing: Easing.linear }),
        withTiming(2, { duration: 30, easing: Easing.steps(1) }),
        withTiming(-1, { duration: 30, easing: Easing.steps(1) }),
        withTiming(0, { duration: 30, easing: Easing.steps(1) }),
        withTiming(0, { duration: 3500, easing: Easing.linear }),
        withTiming(-2, { duration: 25, easing: Easing.steps(1) }),
        withTiming(1, { duration: 25, easing: Easing.steps(1) }),
        withTiming(0, { duration: 25, easing: Easing.steps(1) }),
        withTiming(0, { duration: 1800, easing: Easing.linear }),
      ),
      -1,
      false,
    );
  }, []);

  const mainStyle = useAnimatedStyle(() => ({
    opacity: mainOpacity.value,
    transform: [{ translateX: jitterX.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ translateX: jitterX.value }],
  }));

  const SVG_WIDTH = 280;
  const SVG_HEIGHT = 60;

  return (
    <View style={{ width: SVG_WIDTH, height: SVG_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
      {/* Glow layer — blurred green behind */}
      <AnimatedView
        style={[
          {
            position: 'absolute',
            width: SVG_WIDTH,
            height: SVG_HEIGHT,
          },
          glowStyle,
        ]}
        pointerEvents="none"
      >
        <Svg width={SVG_WIDTH} height={SVG_HEIGHT} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
          <SvgText
            x={SVG_WIDTH / 2}
            y={42}
            textAnchor="middle"
            fontFamily="RobotoMono-Bold"
            fontSize={48}
            fontWeight="bold"
            fill="#00FF41"
            opacity={0.4}
          />
          {/* Extra blurred copies for glow spread */}
          <SvgText
            x={SVG_WIDTH / 2}
            y={42}
            textAnchor="middle"
            fontFamily="RobotoMono-Bold"
            fontSize={48}
            fontWeight="bold"
            fill="rgba(0,255,65,0.15)"
            stroke="rgba(0,255,65,0.25)"
            strokeWidth={6}
          >
            TORRE
          </SvgText>
        </Svg>
      </AnimatedView>

      {/* Main crisp text layer */}
      <AnimatedView
        style={[
          {
            position: 'absolute',
            width: SVG_WIDTH,
            height: SVG_HEIGHT,
          },
          mainStyle,
        ]}
        pointerEvents="none"
      >
        <Svg width={SVG_WIDTH} height={SVG_HEIGHT} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
          <SvgText
            x={SVG_WIDTH / 2}
            y={42}
            textAnchor="middle"
            fontFamily="RobotoMono-Bold"
            fontSize={48}
            fontWeight="bold"
            fill="#00FF41"
            stroke="rgba(0,255,65,0.6)"
            strokeWidth={1}
          >
            TORRE
          </SvgText>
        </Svg>
      </AnimatedView>
    </View>
  );
};
