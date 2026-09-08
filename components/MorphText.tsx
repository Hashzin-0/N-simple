'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';

interface MorphTextProps {
  text: string;
  className?: string;
  accentColor?: string;
  darkAccentColor?: string;
}

export default function MorphText({
  text,
  className = '',
}: MorphTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevTextRef = useRef(text);

  const startMorphAnimation = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);

    let frame = 0;
    const maxFrames = 4;

    const animate = () => {
      frame++;
      if (frame <= maxFrames) {
        if (frame === Math.floor(maxFrames / 2)) {
          setDisplayText(text);
        }
        requestAnimationFrame(animate);
      } else {
        setDisplayText(text);
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, [isAnimating, text]);

  useEffect(() => {
    if (prevTextRef.current !== text) {
      prevTextRef.current = text;
      startMorphAnimation();
    }
  }, [text, startMorphAnimation]);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <span
        className={`inline-block transition-opacity duration-200 ${
          isAnimating ? 'opacity-50' : 'opacity-100'
        }`}
      >
        {displayText}
      </span>
    </span>
  );
}
