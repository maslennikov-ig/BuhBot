/**
 * BuhBot Design Tokens
 *
 * TypeScript constants for the premium design system.
 * Use these tokens for programmatic styling and component variants.
 */

// ============================================
// COLOR PALETTE
// ============================================

export const colors = {
  // Primary Colors
  background: {
    light: '#fafbfc',
    dark: '#0c1222',
  },
  backgroundSubtle: {
    light: '#f4f6f8',
    dark: '#111827',
  },
  foreground: {
    light: '#0c1222',
    dark: '#f1f5f9',
  },
  foregroundMuted: {
    light: '#4a5568',
    dark: '#94a3b8',
  },
  foregroundSubtle: {
    light: '#718096',
    dark: '#64748b',
  },

  // Surface Colors
  surface: {
    light: '#ffffff',
    dark: '#1a2744',
  },
  surfaceElevated: {
    light: '#ffffff',
    dark: '#1e3a5f',
  },

  // Brand Colors
  primary: {
    light: '#0066cc',
    dark: '#38bdf8',
  },
  primaryHover: {
    light: '#0052a3',
    dark: '#7dd3fc',
  },

  // Accent Colors (WOW factor)
  accent: '#00d4aa',
  accentHover: '#00b894',
  accentGlow: 'rgba(0, 212, 170, 0.3)',
  accentSecondary: {
    light: '#7c3aed',
    dark: '#a78bfa',
  },
  accentSecondaryGlow: {
    light: 'rgba(124, 58, 237, 0.3)',
    dark: 'rgba(167, 139, 250, 0.4)',
  },

  // Semantic Colors
  success: {
    light: '#10b981',
    dark: '#34d399',
  },
  successMuted: {
    light: 'rgba(16, 185, 129, 0.1)',
    dark: 'rgba(52, 211, 153, 0.15)',
  },
  warning: {
    light: '#f59e0b',
    dark: '#fbbf24',
  },
  warningMuted: {
    light: 'rgba(245, 158, 11, 0.1)',
    dark: 'rgba(251, 191, 36, 0.15)',
  },
  error: {
    light: '#ef4444',
    dark: '#f87171',
  },
  errorMuted: {
    light: 'rgba(239, 68, 68, 0.1)',
    dark: 'rgba(248, 113, 113, 0.15)',
  },
  info: {
    light: '#3b82f6',
    dark: '#60a5fa',
  },
  infoMuted: {
    light: 'rgba(59, 130, 246, 0.1)',
    dark: 'rgba(96, 165, 250, 0.15)',
  },

  // Border Colors
  border: {
    light: '#e2e8f0',
    dark: '#2d3f5f',
  },
  borderSubtle: {
    light: '#edf2f7',
    dark: '#1e3a5f',
  },
} as const;

// ============================================
// TYPOGRAPHY
// ============================================

export const typography = {
  fontFamily: {
    sans: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    serif: '"Spectral", Georgia, serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },

  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem', // 48px
    '6xl': '3.75rem', // 60px
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  lineHeight: {
    tight: '1.1',
    snug: '1.25',
    normal: '1.5',
    relaxed: '1.6',
    loose: '1.75',
  },

  letterSpacing: {
    tight: '-0.02em',
    snug: '-0.01em',
    normal: '0',
    wide: '0.05em',
  },
} as const;

// ============================================
// SPACING (8pt Grid System)
// ============================================

export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

// ============================================
// BORDER RADIUS
// ============================================

export const borderRadius = {
  none: '0',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

// ============================================
// SHADOWS
// ============================================

export const shadows = {
  sm: '0 1px 2px rgba(12, 18, 34, 0.04)',
  md: '0 4px 6px -1px rgba(12, 18, 34, 0.06), 0 2px 4px -1px rgba(12, 18, 34, 0.04)',
  lg: '0 10px 15px -3px rgba(12, 18, 34, 0.08), 0 4px 6px -2px rgba(12, 18, 34, 0.04)',
  xl: '0 20px 25px -5px rgba(12, 18, 34, 0.1), 0 10px 10px -5px rgba(12, 18, 34, 0.04)',
  glow: '0 0 40px rgba(0, 212, 170, 0.15)',
  glowAccent: '0 0 60px rgba(124, 58, 237, 0.1)',

  // Dark mode shadows
  dark: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
    glow: '0 0 60px rgba(0, 212, 170, 0.25)',
    glowAccent: '0 0 80px rgba(167, 139, 250, 0.2)',
  },
} as const;

// ============================================
// GRADIENTS
// ============================================

export const gradients = {
  primary: 'linear-gradient(135deg, #00d4aa 0%, #0066cc 100%)',
  primaryDark: 'linear-gradient(135deg, #00d4aa 0%, #38bdf8 100%)',
  surface: {
    light: 'linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)',
    dark: 'linear-gradient(180deg, #1a2744 0%, #0c1222 100%)',
  },
  aurora: {
    light: `linear-gradient(135deg,
      rgba(0, 212, 170, 0.03) 0%,
      rgba(124, 58, 237, 0.03) 50%,
      rgba(0, 102, 204, 0.03) 100%
    )`,
    dark: `linear-gradient(135deg,
      rgba(0, 212, 170, 0.08) 0%,
      rgba(124, 58, 237, 0.08) 50%,
      rgba(56, 189, 248, 0.08) 100%
    )`,
  },
  mesh: `
    radial-gradient(at 40% 20%, rgba(0, 212, 170, 0.2) 0px, transparent 50%),
    radial-gradient(at 80% 0%, rgba(124, 58, 237, 0.2) 0px, transparent 50%),
    radial-gradient(at 0% 50%, rgba(56, 189, 248, 0.15) 0px, transparent 50%),
    radial-gradient(at 80% 50%, rgba(0, 212, 170, 0.2) 0px, transparent 50%),
    radial-gradient(at 0% 100%, rgba(124, 58, 237, 0.2) 0px, transparent 50%)
  `,
} as const;

// ============================================
// TRANSITIONS & ANIMATIONS
// ============================================

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const animations = {
  fadeInUp: {
    keyframes: {
      from: { opacity: 0, transform: 'translateY(20px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
    duration: '0.6s',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  fadeInScale: {
    keyframes: {
      from: { opacity: 0, transform: 'scale(0.95)' },
      to: { opacity: 1, transform: 'scale(1)' },
    },
    duration: '0.3s',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  slideInLeft: {
    keyframes: {
      from: { opacity: 0, transform: 'translateX(-20px)' },
      to: { opacity: 1, transform: 'translateX(0)' },
    },
    duration: '0.4s',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  pulseGlow: {
    keyframes: {
      '0%, 100%': { boxShadow: shadows.md },
      '50%': { boxShadow: `${shadows.md}, ${shadows.glow}` },
    },
    duration: '2s',
    easing: 'ease-in-out',
    iterationCount: 'infinite',
  },
} as const;

// ============================================
// Z-INDEX SCALE
// ============================================

export const zIndex = {
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
} as const;

// ============================================
// LAYOUT CONSTANTS
// ============================================

export const layout = {
  sidebar: {
    width: '260px',
    collapsedWidth: '72px',
  },
  header: {
    height: '64px',
  },
  maxWidth: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

// ============================================
// COMPONENT VARIANTS
// ============================================

export const buttonVariants = {
  primary: {
    background: gradients.primary,
    color: 'white',
    hoverShadow: `${shadows.md}, ${shadows.glow}`,
  },
  secondary: {
    background: colors.surface.light,
    border: colors.border.light,
    color: colors.foreground.light,
  },
  ghost: {
    background: 'transparent',
    color: colors.foreground.light,
    hoverBackground: 'rgba(0, 102, 204, 0.1)',
  },
  destructive: {
    background: colors.error.light,
    color: 'white',
  },
} as const;

export const badgeVariants = {
  success: {
    background: colors.successMuted.light,
    color: colors.success.light,
  },
  warning: {
    background: colors.warningMuted.light,
    color: colors.warning.light,
  },
  error: {
    background: colors.errorMuted.light,
    color: colors.error.light,
  },
  info: {
    background: colors.infoMuted.light,
    color: colors.info.light,
  },
  accent: {
    background: colors.accentGlow,
    color: colors.accent,
  },
} as const;

// ============================================
// ICON SIZES
// ============================================

export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

// ============================================
// SIDEBAR NAVIGATION CONFIG
// ============================================

export type NavItem = {
  id: string;
  label: string;
  labelRu: string; // Russian translation
  icon: string;
  href: string;
  badge?: string;
  children?: NavItem[];
};

export const sidebarNavigation: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    labelRu: 'Панель управления',
    icon: 'LayoutDashboard',
    href: '/dashboard',
  },
  {
    id: 'requests',
    label: 'Requests',
    labelRu: 'Запросы',
    icon: 'MessageSquare',
    href: '/requests',
    badge: '12',
  },
  {
    id: 'clients',
    label: 'Clients',
    labelRu: 'Клиенты',
    icon: 'Users',
    href: '/clients',
  },
  {
    id: 'sla',
    label: 'SLA Monitor',
    labelRu: 'SLA Мониторинг',
    icon: 'Timer',
    href: '/sla',
  },
  {
    id: 'reports',
    label: 'Reports',
    labelRu: 'Отчеты',
    icon: 'BarChart3',
    href: '/reports',
  },
  {
    id: 'settings',
    label: 'Settings',
    labelRu: 'Настройки',
    icon: 'Settings',
    href: '/settings',
  },
];

// ============================================
// THEME HELPER
// ============================================

export type Theme = 'light' | 'dark';

export function getThemeValue<T extends { light: unknown; dark: unknown }>(
  value: T,
  theme: Theme
): T['light'] | T['dark'] {
  return value[theme];
}
