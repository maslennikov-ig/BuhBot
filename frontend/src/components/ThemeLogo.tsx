'use client';

import Image from 'next/image';

interface ThemeLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  priority?: boolean;
}

const sizes = {
  sm: { width: 100, height: 30, className: 'h-7' },
  md: { width: 120, height: 36, className: 'h-9' },
  lg: { width: 160, height: 48, className: 'h-12' },
};

export function ThemeLogo({ size = 'md', className = '', priority = false }: ThemeLogoProps) {
  const { width, height, className: sizeClass } = sizes[size];

  return (
    <div className={`relative ${sizeClass} ${className}`}>
      {/* Dark theme logo (shown in dark mode) */}
      <Image
        src="/images/logo/logo-small.png"
        alt="BuhBot"
        width={width}
        height={height}
        className={`${sizeClass} w-auto object-contain hidden dark:block`}
        priority={priority}
      />
      {/* Light theme logo (shown in light mode) */}
      <Image
        src="/images/logo/logo-small-light.png"
        alt="BuhBot"
        width={width}
        height={height}
        className={`${sizeClass} w-auto object-contain block dark:hidden`}
        priority={priority}
      />
    </div>
  );
}
