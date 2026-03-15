import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

interface Props {
  text: string;
  delay?: number;
  className?: string;
  onComplete?: () => void;
  showCursor?: boolean;
}

export const TypewriterText = ({
  text,
  delay = 50,
  className = "",
  onComplete,
  showCursor = true
}: Props) => {
  const [displayedText, setDisplayedText] = useState("");
  const cursorOpacity = useSharedValue(showCursor ? 1 : 0);

  // Typewriter effect — one setState per letter
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        cancelAnimation(cursorOpacity); // stop blinking on completion
        cursorOpacity.value = 0;
        if (onComplete) onComplete();
      }
    }, delay);

    return () => clearInterval(timer);
  // onComplete entra en deps para evitar closure obsoleto si el callback cambia
  }, [text, delay, onComplete]);

  // Cursor blink — runs on UI thread via Reanimated, zero JS setState calls
  useEffect(() => {
    if (!showCursor) return;
    cursorOpacity.value = withRepeat(
      withTiming(0, { duration: 500 }),
      -1,
      true,
    );
    return () => cancelAnimation(cursorOpacity);
  }, [showCursor]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return (
    <Text className={`font-robotomono ${className}`}>
      {displayedText}
      {showCursor && (
        <Animated.Text style={cursorStyle} className="text-primary">
          _
        </Animated.Text>
      )}
    </Text>
  );
};
