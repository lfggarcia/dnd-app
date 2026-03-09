import React, { useState, useEffect, useRef } from 'react';
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
  // Marca si la animación de escritura ha terminado
  const animDoneRef = useRef(false);

  useEffect(() => {
    animDoneRef.current = false;
    let i = 0;
    const timer = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(timer);
        animDoneRef.current = true;
        if (onComplete) onComplete();
      }
    }, delay);

    return () => clearInterval(timer);
  // onComplete entra en deps para evitar closure obsoleto si el callback cambia
  }, [text, delay, onComplete]);

  useEffect(() => {
    if (!showCursor) return;
    const cursorTimer = setInterval(() => {
      // Detenemos el parpadeo cuando el texto ya se escribió por completo
      if (animDoneRef.current) {
        clearInterval(cursorTimer);
        return;
      }
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
