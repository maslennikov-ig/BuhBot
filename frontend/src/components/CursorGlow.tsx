'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

const spring = {
  stiffness: 200,
  damping: 30,
  restDelta: 0.001,
  restSpeed: 0.001,
};

export function CursorGlow() {
  const [isVisible, setIsVisible] = useState(false);

  // Use motion values for smooth spring animation
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);

  // Apply spring physics to motion values
  const springX = useSpring(cursorX, spring);
  const springY = useSpring(cursorY, spring);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const isTouchDevice = 'ontouchstart' in window;
    if (isTouchDevice) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Center the glow on cursor (256px / 2 = 128px offset)
      cursorX.set(e.clientX - 128);
      cursorY.set(e.clientY - 128);
      setIsVisible(true);
    };

    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', handleMouseMove);
    document.body.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [cursorX, cursorY]);

  if (!isVisible) return null;

  return (
    <motion.div
      className="pointer-events-none fixed z-[9999] w-64 h-64 rounded-full"
      style={{
        x: springX,
        y: springY,
        background: 'radial-gradient(circle, var(--buh-accent-glow) 0%, transparent 70%)',
        mixBlendMode: 'screen',
        opacity: 0.15,
      }}
    />
  );
}
