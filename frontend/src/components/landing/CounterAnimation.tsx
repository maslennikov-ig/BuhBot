'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

interface CounterProps {
  value: string;
  duration?: number;
}

export function CounterAnimation({ value, duration = 2000 }: CounterProps) {
  const [count, setCount] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    // Extract numeric value
    const numericMatch = value.match(/[\d.]+/);
    if (!numericMatch) {
      const t = setTimeout(() => setCount(value), 0);
      return () => clearTimeout(t);
    }

    const target = parseFloat(numericMatch[0]);
    const prefix = value.slice(0, numericMatch.index);
    const suffix = value.slice((numericMatch.index || 0) + numericMatch[0].length);
    const isDecimal = value.includes('.');

    let start = 0;
    const increment = target / (duration / 16); // 60fps

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(prefix + (isDecimal ? target.toFixed(1) : Math.round(target)) + suffix);
        clearInterval(timer);
      } else {
        setCount(prefix + (isDecimal ? start.toFixed(1) : Math.round(start)) + suffix);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [isInView, value, duration]);

  return <span ref={ref}>{count}</span>;
}
