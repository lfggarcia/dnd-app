/**
 * AppImage.tsx
 *
 * Drop-in wrappers around @d11/react-native-fast-image for use throughout the app.
 *
 * Why:
 *   - FastImage adds disk + memory caching, progressive loading, and native
 *     GIF/WebP decoding on both platforms — crucial for 1300+ portrait/expression
 *     images bundled in the app.
 *   - Centralising the import means we can swap the underlying lib once without
 *     touching every screen.
 *
 * Exports:
 *   AppImage         — standard replacement for <Image>
 *   AnimatedAppImage — replacement for <Animated.Image> (react-native or reanimated)
 */

import React from 'react';
import FastImage, { type FastImageProps } from '@d11/react-native-fast-image';
import Animated from 'react-native-reanimated';
import { Animated as RNAnimated } from 'react-native';

// ── Re-export priority / resize mode enums so callers don't need the raw import ──
export { FastImage };

// ── Standard replacement ──────────────────────────────────────────────────────

export type AppImageProps = FastImageProps;

/**
 * Standard <Image> replacement.
 * Accepts the same `source` as RN Image: a number (from require()) or { uri }.
 */
export const AppImage = FastImage;

// ── Reanimated-compatible Animated wrapper ────────────────────────────────────

/**
 * Use this in place of <Animated.Image> when you need reanimated animated styles
 * (useAnimatedStyle, withTiming, withSpring …).
 *
 * Usage:
 *   <AnimatedAppImage source={src} style={[staticStyle, animStyle]} resizeMode="cover" />
 */
export const AnimatedAppImage = Animated.createAnimatedComponent(FastImage);

// ── react-native Animated-compatible wrapper ──────────────────────────────────

/**
 * Use this in place of <Animated.Image> when you need the legacy react-native
 * Animated API (Animated.Value, Animated.timing …).
 *
 * Usage:
 *   <RNAnimatedAppImage source={src} style={[staticStyle, animValue.interpolate(...)]} />
 */
export const RNAnimatedAppImage = RNAnimated.createAnimatedComponent(FastImage);
