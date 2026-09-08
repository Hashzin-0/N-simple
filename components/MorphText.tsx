'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface MorphTextProps {
  text: string;
  className?: string;
  accentColor?: string;
  darkAccentColor?: string;
}

const SYMBOLS = ['×', '÷', '±', '∞', '≈', '≠', '≤', '≥', '∆', '∇', '∑', '∏', '∫', '√'];

function getRandomSymbol(): string {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export default function MorphText({
  text,
  className = '',
  accentColor = '#5A5A40',
  darkAccentColor = '#9CB386',
}: MorphTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const [morphPhase, setMorphPhase] = useState<'idle' | 'dissolve' | 'symbol' | 'reform'>('idle');
  const prevTextRef = useRef(text);
  const animFrameRef = useRef<number | null>(null);

  const startMorphAnimation = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setMorphPhase('dissolve');

    let frame = 0;
    const maxFrames = 6;

    const animate = () => {
      frame++;
      if (frame <= maxFrames) {
        setDisplayText(getRandomSymbol());
        if (frame === Math.floor(maxFrames / 2)) {
          setMorphPhase('symbol');
        }
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setMorphPhase('reform');
        setDisplayText(text);

        setTimeout(() => {
          setMorphPhase('idle');
          setIsAnimating(false);
        }, 150);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [isAnimating, text]);

  useEffect(() => {
    if (prevTextRef.current !== text) {
      prevTextRef.current = text;
      startMorphAnimation();
    }
  }, [text, startMorphAnimation]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <AnimatePresence mode="wait">
        <motion.span
          key={displayText}
          initial={
            morphPhase === 'dissolve'
              ? { rotateX: -90, opacity: 0, scale: 0.8 }
              : morphPhase === 'symbol'
              ? { scale: 1.2, opacity: 0.5 }
              : { rotateX: 90, opacity: 0 }
          }
          animate={{
            rotateX: 0,
            opacity: 1,
            scale: 1,
          }}
          exit={
            morphPhase === 'dissolve'
              ? { rotateX: 90, opacity: 0, scale: 0.8 }
              : { rotateX: -90, opacity: 0 }
          }
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 20,
            mass: 0.5,
          }}
          style={{
            transformOrigin: 'center',
            display: 'inline-block',
            color: morphPhase === 'symbol' ? accentColor : undefined,
          }}
          className={morphPhase === 'symbol' ? 'font-mono' : ''}
        >
          {displayText}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
