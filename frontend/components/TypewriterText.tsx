'use client';
import { useState, useEffect } from 'react';

interface Props {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export default function TypewriterText({ text, speed = 50, onComplete }: Props) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText(''); // Сбрасываем при новом тексте
    let i = 0;
    
    const typingInterval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(typingInterval);
        if (onComplete) onComplete();
      }
    }, speed);

    return () => clearInterval(typingInterval);
  }, [text, speed, onComplete]);

  return <span>{displayedText}</span>;
}