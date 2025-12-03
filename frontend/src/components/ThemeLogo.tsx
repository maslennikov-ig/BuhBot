'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface ThemeLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  priority?: boolean;
}

const sizes = {
  sm: { width: 100, height: 30, className: 'h-7' },
  md: { width: 120, height: 36, className: 'h-9' },
  lg: { width: 160, height: 48, className: 'h-12' },
  xl: { width: 140, height: 42, className: 'h-10' },
};

export function ThemeLogo({ size = 'md', className = '', priority = false }: ThemeLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { width, height, className: sizeClass } = sizes[size];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch - show nothing until mounted
  if (!mounted) {
    return <div className={`${sizeClass} ${className}`} style={{ width, height }} />;
  }

  // logo-small.png has gray background - for DARK theme (dark background)
  // logo-small-light.png is transparent - for LIGHT theme (light background)
  const logoSrc = resolvedTheme === 'dark'
    ? '/images/logo/logo-small.png'
    : '/images/logo/logo-small-light.png';

  return (
    <Image
      src={logoSrc}
      alt="BuhBot"
      width={width}
      height={height}
      className={`${sizeClass} w-auto object-contain ${className}`}
      priority={priority}
    />
  );
}
