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
  sm: { width: 100, height: 30, className: 'h-7' }, // 28px
  md: { width: 120, height: 36, className: 'h-9' }, // 36px
  lg: { width: 160, height: 48, className: 'h-12' }, // 48px
  xl: { width: 180, height: 54, className: 'h-14' }, // 56px - for Header
};

export function ThemeLogo({ size = 'md', className = '', priority = false }: ThemeLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { width, height, className: sizeClass } = sizes[size];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Prevent hydration mismatch - show nothing until mounted
  if (!mounted) {
    return <div className={`${sizeClass} ${className}`} style={{ width, height }} />;
  }

  // logo-small-dark.png has gray background - for DARK theme
  // logo-small.png is transparent - for LIGHT theme (and emails)
  const logoSrc =
    resolvedTheme === 'dark' ? '/images/logo/logo-small-dark.png' : '/images/logo/logo-small.png';

  return (
    <Image
      src={logoSrc}
      alt="BuhBot"
      width={width}
      height={height}
      className={`${sizeClass} w-auto object-contain ${className}`}
      priority={priority}
      unoptimized
    />
  );
}
