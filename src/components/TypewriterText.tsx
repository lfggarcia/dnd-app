import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';

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
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(timer);
        if (onComplete) onComplete();
      }
    }, delay);

    return () => clearInterval(timer);
  }, [text, delay]);

  useEffect(() => {
    if (!showCursor) return;
    const cursorTimer = setInterval(() => {
      setCursorVisible(v => !v);
    }, 500);
    return () => clearInterval(cursorTimer);
  }, [showCursor]);

  return (
    <Text className={`font-robotomono ${className}`}>
      {displayedText}
      {showCursor && (
        <Text style={{ opacity: cursorVisible ? 1 : 0 }} className="text-primary">
          _
        </Text>
      )}
    </Text>
  );
};
