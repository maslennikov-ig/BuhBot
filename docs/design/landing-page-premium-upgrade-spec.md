# YOUR TASK: Implement Premium Design Enhancements for BuhBot Landing Page

**You are tasked with implementing a comprehensive design upgrade** for the BuhBot landing page. This is a B2B SaaS platform for accounting firms. Your goal is to transform the current functional landing page into a stunning, modern design with "wow" moments while maintaining professional credibility.

**What you need to do:**

1. Read and analyze all existing landing page components
2. Implement ALL enhancements described in this specification
3. Add dark theme support with smooth theme toggle
4. Enhance animations, micro-interactions, and visual effects
5. Maintain accessibility (WCAG 2.1 AA) and performance (Lighthouse > 90)
6. Test on multiple devices and browsers
7. Ensure all code is production-ready and type-safe

**Expected outcome:** A premium landing page comparable to Linear, Vercel, or Stripe in visual quality, with distinctive design that avoids generic AI aesthetics.

**Implementation timeline:** 7 days (phases outlined below)

---

# TECHNICAL SPECIFICATION: BuhBot Landing Page - Premium Design Transformation

## Context

You are transforming the landing page for BuhBot - a B2B SaaS platform for accounting firms that automates communication monitoring and SLA tracking in Telegram. The current implementation is functional but needs a design upgrade to create "wow" moments while maintaining professional credibility for B2B clients.

**Current Stack:**

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Framer Motion (already integrated)
- Plus Jakarta Sans (primary font)
- Spectral (serif font)
- JetBrains Mono (monospace)

**Current Color Palette:**

- Light Mode: Primary #0066cc, Accent #00d4aa (teal), Secondary Accent #7c3aed (purple)
- Dark Mode: Primary #38bdf8, Accent #00d4aa, Secondary Accent #a78bfa
- Background: Light #fafbfc / Dark #0c1222

**Existing Components:**

- Header (sticky, scroll-aware)
- Hero (aurora background, animated)
- PainPoints (4-card grid)
- Features (6-card grid)
- HowItWorks (4-step process)
- Benefits (statistics cards)
- Testimonials (3 testimonials + stats row)
- ContactForm (tRPC-integrated form)
- Footer (3-column layout)

**Design System Location:** `/frontend/src/styles/design-system.css` (804 lines of CSS custom properties, animations, utilities)

---

## Design Goals

1. Create distinctive, memorable visual moments that avoid generic AI aesthetics
2. Implement smooth, sophisticated dark theme with seamless theme toggle
3. Add premium micro-interactions and orchestrated animations
4. Enhance depth perception through layering, shadows, and parallax effects
5. Maintain WCAG 2.1 AA accessibility standards
6. Keep professional B2B SaaS credibility (not playful, not too experimental)
7. Optimize perceived performance (animations should feel instant, not sluggish)

---

## Phase 1: Dark Theme Implementation

### 1.1 Theme Toggle Component

**Create:** `/frontend/src/components/ThemeToggle.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check system preference and localStorage
    const stored = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = stored || (systemDark ? 'dark' : 'light');
    setTheme(initialTheme as 'light' | 'dark');
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';

    // Add transition class
    document.documentElement.classList.add('theme-transition');

    // Toggle theme
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    localStorage.setItem('theme', newTheme);

    // Remove transition class after animation
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);
  };

  if (!mounted) return <div className="w-10 h-10" />; // Prevent hydration mismatch

  return (
    <button
      onClick={toggleTheme}
      className="relative w-10 h-10 rounded-full bg-[var(--buh-surface-elevated)] border border-[var(--buh-border)] flex items-center justify-center transition-colors duration-200 hover:border-[var(--buh-primary)] group"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <AnimatePresence mode="wait">
        {theme === 'light' ? (
          <motion.div
            key="moon"
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <Moon className="w-5 h-5 text-[var(--buh-foreground-muted)] group-hover:text-[var(--buh-primary)] transition-colors" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <Sun className="w-5 h-5 text-[var(--buh-foreground-muted)] group-hover:text-[var(--buh-primary)] transition-colors" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
```

**Integration:** Add `<ThemeToggle />` to Header component after desktop CTA button and before mobile menu button.

### 1.2 Theme Transition Enhancements

Already exists in `globals.css` (lines 347-364). Ensure these classes are present:

```css
html.theme-transition,
html.theme-transition *,
html.theme-transition *::before,
html.theme-transition *::after {
  transition:
    background-color 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease !important;
}
```

### 1.3 Dark Mode Color Refinements

The dark mode palette is already well-defined in `design-system.css` (lines 133-202). Verify contrast ratios:

- Text on background: #f1f5f9 on #0c1222 = 15.6:1 (AAA)
- Muted text: #94a3b8 on #0c1222 = 8.2:1 (AAA)
- Accent on background: #00d4aa on #0c1222 = 9.8:1 (AAA)
- Primary on surface: #38bdf8 on #1a2744 = 7.1:1 (AAA)

All ratios exceed WCAG AAA standards. No changes needed.

---

## Phase 2: Hero Section - Premium WOW Moments

### 2.1 Enhanced Aurora Background

**Enhance:** `/frontend/src/components/landing/Hero.tsx` (lines 38-42)

Add dynamic particle system to aurora background:

```typescript
// Add after aurora div
<div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
  {/* Floating particles */}
  {[...Array(20)].map((_, i) => (
    <motion.div
      key={i}
      className="absolute w-1 h-1 bg-[var(--buh-accent)] rounded-full opacity-30"
      initial={{
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
      }}
      animate={{
        y: [null, Math.random() * -100 - 50],
        opacity: [0.3, 0, 0.3],
      }}
      transition={{
        duration: Math.random() * 10 + 10,
        repeat: Infinity,
        delay: Math.random() * 5,
        ease: 'linear',
      }}
    />
  ))}
</div>
```

### 2.2 Gradient Text Enhancement

**Enhance:** Hero headline gradient (line 65-67)

Replace static gradient with animated mesh gradient:

```typescript
<span className="relative">
  <span className="absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-[var(--buh-accent)] via-[var(--buh-primary)] to-[var(--buh-accent-secondary)] blur-lg opacity-50 animate-pulse" />
  <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[var(--buh-accent)] via-[var(--buh-primary)] to-[var(--buh-accent-secondary)]">
    Вы контролируете время.
  </span>
</span>
```

### 2.3 CTA Button Enhancement

**Enhance:** Primary CTA button (lines 85-93)

Add magnetic hover effect:

```typescript
'use client';

import { useRef, useState } from 'react';

// Inside Hero component:
const ctaRef = useRef<HTMLButtonElement>(null);
const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
  if (!ctaRef.current) return;
  const rect = ctaRef.current.getBoundingClientRect();
  const x = e.clientX - rect.left - rect.width / 2;
  const y = e.clientY - rect.top - rect.height / 2;
  setMousePosition({ x: x * 0.15, y: y * 0.15 });
};

const handleMouseLeave = () => {
  setMousePosition({ x: 0, y: 0 });
};

// In button JSX:
<motion.button
  ref={ctaRef}
  onMouseMove={handleMouseMove}
  onMouseLeave={handleMouseLeave}
  animate={{ x: mousePosition.x, y: mousePosition.y }}
  transition={{ type: 'spring', stiffness: 150, damping: 15 }}
  onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
  className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white transition-all duration-200 bg-[var(--buh-primary)] rounded-full hover:bg-[var(--buh-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--buh-primary)] shadow-[0_0_20px_-5px_var(--buh-primary-muted)] hover:shadow-[0_0_40px_-5px_var(--buh-primary),0_0_60px_-10px_var(--buh-accent)] overflow-hidden"
>
  {/* Existing shimmer effect */}
  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />

  {/* Add ripple effect on click */}
  <span className="absolute inset-0 rounded-full bg-white/30 scale-0 group-active:scale-100 transition-transform duration-500" />

  <span>Запросить демо</span>
  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
</motion.button>
```

### 2.4 Scroll Indicator Enhancement

**Enhance:** Scroll indicator (lines 106-127)

Add smooth bounce animation with mouse proximity effect:

```typescript
<motion.div
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 1.5, duration: 1, type: 'spring' }}
  className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10"
>
  <motion.button
    onClick={scrollToNext}
    className="flex flex-col items-center gap-2 text-[var(--buh-foreground-subtle)] hover:text-[var(--buh-primary)] transition-colors group"
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
  >
    <motion.span
      className="text-xs font-medium uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
      initial={{ y: 10 }}
      whileHover={{ y: 0 }}
    >
      Листайте вниз
    </motion.span>
    <div className="relative w-6 h-10 border-2 border-[var(--buh-border)] rounded-full flex justify-center pt-2 group-hover:border-[var(--buh-primary)] transition-colors overflow-hidden">
      <motion.div
        animate={{ y: [0, 14, 0] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        className="w-1.5 h-1.5 bg-[var(--buh-foreground-subtle)] rounded-full group-hover:bg-[var(--buh-primary)] group-hover:shadow-[0_0_8px_var(--buh-primary)]"
      />
    </div>
  </motion.button>
</motion.div>
```

---

## Phase 3: Component Enhancements

### 3.1 PainPoints Section

**Add parallax scrolling effect:**

```typescript
'use client';

import { useScroll, useTransform, motion } from 'framer-motion';
import { useRef } from 'react';

export function PainPoints() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <motion.section
      ref={containerRef}
      style={{ opacity }}
      className="py-24 relative bg-[var(--buh-background-subtle)]"
    >
      {/* Add floating background element */}
      <motion.div
        style={{ y }}
        className="absolute top-1/2 left-1/4 w-64 h-64 bg-[var(--buh-accent-glow)] rounded-full blur-[100px] opacity-20 pointer-events-none"
      />

      {/* Rest of component remains the same */}
    </motion.section>
  );
}
```

**Enhance problem cards with hover tilt effect:**

```typescript
<motion.div
  key={index}
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ delay: index * 0.1, duration: 0.5 }}
  whileHover={{
    y: -8,
    rotateX: 5,
    rotateY: 5,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
  }}
  className="bg-[var(--buh-surface)] p-6 rounded-2xl border border-[var(--buh-border)] shadow-[var(--buh-shadow-sm)] hover:shadow-[var(--buh-shadow-lg),0_0_40px_-10px_var(--buh-accent-glow)] transition-all duration-300 perspective-1000"
  style={{ transformStyle: 'preserve-3d' }}
>
  {/* Existing card content */}
</motion.div>
```

Add to globals.css:

```css
.perspective-1000 {
  perspective: 1000px;
}
```

### 3.2 Features Section

**Add staggered reveal on scroll:**

```typescript
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.2, 0.65, 0.3, 0.9],
    },
  },
};

// In JSX:
<motion.div
  variants={containerVariants}
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true, amount: 0.2 }}
  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
>
  {features.map((feature, index) => (
    <motion.div
      key={index}
      variants={itemVariants}
      className="group relative bg-[var(--buh-surface)] p-8 rounded-3xl border border-[var(--buh-border)] hover:border-[var(--buh-primary)] transition-colors duration-300 overflow-hidden"
    >
      {/* Add animated gradient background on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--buh-primary-muted)]/0 via-[var(--buh-accent-glow)] to-[var(--buh-primary-muted)]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />

      {/* Existing content */}
    </motion.div>
  ))}
</motion.div>
```

**Enhance icon animation:**

```typescript
<motion.div
  className="w-14 h-14 rounded-2xl bg-[var(--buh-surface-elevated)] flex items-center justify-center mb-6 text-[var(--buh-primary)] shadow-sm border border-[var(--buh-border)]"
  whileHover={{
    scale: 1.15,
    rotate: [0, -5, 5, 0],
    transition: { duration: 0.5 }
  }}
>
  <feature.icon size={28} strokeWidth={1.5} />
</motion.div>
```

### 3.3 HowItWorks Section

**Add connecting line animation:**

```typescript
// Add animated connecting line
<motion.div
  className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[var(--buh-accent)] to-transparent -translate-y-1/2 z-0"
  initial={{ scaleX: 0, opacity: 0 }}
  whileInView={{ scaleX: 1, opacity: 1 }}
  viewport={{ once: true }}
  transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
/>
```

**Enhance step cards with pulse effect:**

```typescript
<motion.div
  key={index}
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ delay: index * 0.15, duration: 0.6 }}
  whileHover={{ y: -8 }}
  className="bg-[var(--buh-surface)] p-8 rounded-2xl border border-[var(--buh-border)] shadow-sm relative group transition-all duration-300"
>
  {/* Add pulsing ring on hover */}
  <motion.div
    className="absolute -inset-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] rounded-2xl opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500"
    animate={{ scale: [1, 1.02, 1] }}
    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
  />

  {/* Existing content with relative positioning */}
  <div className="relative z-10">
    {/* ... */}
  </div>
</motion.div>
```

### 3.4 Benefits Section (Statistics)

**Add counter animation:**

Create `/frontend/src/components/landing/CounterAnimation.tsx`:

```typescript
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
      setCount(value);
      return;
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
```

**Use in Benefits component:**

```typescript
import { CounterAnimation } from './CounterAnimation';

// In stat card:
<span className="text-5xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-br from-[var(--buh-primary)] to-[var(--buh-accent)] mb-4 inline-block">
  <CounterAnimation value={stat.value} duration={2000} />
</span>
```

### 3.5 Testimonials Section

**Add card flip effect on hover (subtle):**

```typescript
<motion.div
  key={index}
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ delay: index * 0.1, duration: 0.5 }}
  whileHover={{
    scale: 1.02,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 40px -10px var(--buh-accent-glow)',
  }}
  className="bg-[var(--buh-surface)] p-8 rounded-2xl border border-[var(--buh-border)] shadow-sm flex flex-col h-full cursor-pointer"
>
  {/* Add gradient overlay on hover */}
  <div className="absolute inset-0 bg-gradient-to-br from-[var(--buh-accent-glow)] to-transparent opacity-0 hover:opacity-10 transition-opacity duration-500 rounded-2xl pointer-events-none" />

  {/* Existing content */}
</motion.div>
```

### 3.6 ContactForm Section

**Add form field focus animations:**

```typescript
// Add to each input field:
<motion.input
  {...form.register('name')}
  id="name"
  whileFocus={{ scale: 1.02 }}
  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
  className="w-full px-4 py-3 rounded-xl border border-[var(--buh-border)] bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground)] focus:ring-2 focus:ring-[var(--buh-primary)] focus:border-transparent outline-none transition-all"
  placeholder="Иван Петров"
/>
```

**Enhance submit button with loading state:**

```typescript
<motion.button
  type="submit"
  disabled={isLoading}
  whileHover={{ scale: isLoading ? 1 : 1.02 }}
  whileTap={{ scale: isLoading ? 1 : 0.98 }}
  className="w-full py-4 rounded-xl bg-[var(--buh-primary)] text-white font-bold text-lg shadow-[0_4px_14px_0_var(--buh-primary-muted)] hover:shadow-[0_6px_20px_var(--buh-primary-muted),0_0_40px_-10px_var(--buh-accent)] hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 relative overflow-hidden"
>
  {/* Add shimmer effect */}
  {!isLoading && (
    <motion.div
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
      animate={{ x: ['-100%', '100%'] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
    />
  )}

  <span className="relative z-10">
    {isLoading ? (
      <>
        <Loader2 className="animate-spin" /> Отправка...
      </>
    ) : (
      'Запросить демо'
    )}
  </span>
</motion.button>
```

---

## Phase 4: Global Enhancements

### 4.1 Smooth Scroll with Progress Indicator

**Create:** `/frontend/src/components/ScrollProgress.tsx`

```typescript
'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] via-[var(--buh-primary)] to-[var(--buh-accent-secondary)] origin-left z-[1200]"
      style={{ scaleX }}
    />
  );
}
```

**Add to layout.tsx:**

```typescript
import { ScrollProgress } from '@/components/ScrollProgress';

export default function RootLayout({ children }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased">
        <ScrollProgress />
        <TRPCProvider>{children}</TRPCProvider>
        <Toaster richColors />
      </body>
    </html>
  );
}
```

### 4.2 Cursor Glow Effect (Desktop Only)

**Create:** `/frontend/src/components/CursorGlow.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function CursorGlow() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window;
    if (isTouchDevice) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      setIsVisible(true);
    };

    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', handleMouseMove);
    document.body.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <motion.div
      className="pointer-events-none fixed z-[9999] w-64 h-64 rounded-full"
      style={{
        left: mousePosition.x - 128,
        top: mousePosition.y - 128,
        background: 'radial-gradient(circle, var(--buh-accent-glow) 0%, transparent 70%)',
        mixBlendMode: 'screen',
        opacity: 0.15,
      }}
      animate={{ x: 0, y: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 200 }}
    />
  );
}
```

**Add to page.tsx:**

```typescript
import { CursorGlow } from '@/components/CursorGlow';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--buh-background)] flex flex-col overflow-x-hidden selection:bg-[var(--buh-accent)] selection:text-white">
      <CursorGlow />
      {/* Rest of page */}
    </div>
  );
}
```

### 4.3 Add Smooth Section Transitions

**Create:** `/frontend/src/components/SectionDivider.tsx`

```typescript
'use client';

import { motion } from 'framer-motion';

export function SectionDivider() {
  return (
    <motion.div
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1, ease: 'easeInOut' }}
      className="w-full h-px bg-gradient-to-r from-transparent via-[var(--buh-border)] to-transparent my-16"
    />
  );
}
```

**Use between major sections in page.tsx:**

```typescript
<SectionDivider />
```

---

## Phase 5: Advanced Animations

### 5.1 Add Shimmer Animation to Key Text

**Create CSS animation in design-system.css:**

```css
@keyframes shimmer-text {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}

.buh-shimmer-text {
  background: linear-gradient(
    90deg,
    var(--buh-foreground) 25%,
    var(--buh-accent) 50%,
    var(--buh-foreground) 75%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer-text 3s linear infinite;
}
```

**Apply to key headlines:**

```typescript
<h1 className="buh-shimmer-text">Key Headline</h1>
```

---

## Phase 6: Performance Optimizations

### 6.1 Lazy Load Animations

Wrap heavy animations in dynamic imports:

```typescript
import dynamic from 'next/dynamic';

const HeavyAnimation = dynamic(() => import('./HeavyAnimation'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-64" />,
  ssr: false,
});
```

### 6.2 Use will-change Sparingly

Add to elements with frequent animations:

```css
.will-animate {
  will-change: transform, opacity;
}

/* Remove after animation completes */
.animation-complete {
  will-change: auto;
}
```

### 6.3 Optimize Framer Motion

Use `layoutId` for shared element transitions:

```typescript
<motion.div layoutId="unique-id" />
```

Reduce motion for users with preferences:

```typescript
const shouldReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const variants = shouldReduceMotion
  ? {}
  : {
      // Full animation variants
    };
```

---

## Acceptance Criteria

### Visual Quality

- [ ] Dark theme toggle works smoothly with 300ms transition
- [ ] All text meets WCAG AA contrast ratios (4.5:1 minimum)
- [ ] Animations are smooth 60fps on desktop, 30fps acceptable on mobile
- [ ] No layout shift (CLS < 0.1)
- [ ] No flashing/jarring transitions

### Functionality

- [ ] Theme preference persists in localStorage
- [ ] Smooth scroll works across all browsers (Chrome, Firefox, Safari, Edge)
- [ ] All interactive elements have hover, focus, and active states
- [ ] Mobile responsiveness maintained (320px - 1920px)
- [ ] Touch gestures work on mobile (no hover-only interactions)

### Performance

- [ ] Lighthouse Performance score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] Bundle size increase < 50KB (gzipped)

### Accessibility

- [ ] All interactive elements keyboard navigable
- [ ] Focus indicators visible and distinct
- [ ] ARIA labels present where needed
- [ ] Screen reader tested with NVDA/JAWS
- [ ] Color contrast verified with axe DevTools

### Browser Compatibility

- [ ] Chrome 120+
- [ ] Firefox 120+
- [ ] Safari 17+
- [ ] Edge 120+
- [ ] Mobile Safari iOS 16+
- [ ] Chrome Android 120+

---

## Implementation Order

1. **Day 1**: Theme toggle + dark mode refinements
2. **Day 2**: Hero section enhancements (aurora, gradient text, CTA)
3. **Day 3**: Component animations (PainPoints, Features, HowItWorks)
4. **Day 4**: Statistics counter + Testimonials + ContactForm
5. **Day 5**: Global enhancements (scroll progress, cursor glow, dividers)
6. **Day 6**: Performance optimization + accessibility audit
7. **Day 7**: Cross-browser testing + final polish

---

## Code Quality Standards

- Use TypeScript strict mode (already configured)
- All components must be type-safe
- Extract reusable animations into shared utilities
- Use CSS custom properties for all colors/spacing
- Comment complex animation logic
- Test on real devices, not just DevTools emulation
- Follow existing file structure and naming conventions

---

## Testing Checklist

**Manual Testing:**

- [ ] Theme toggle on first load (system preference detection)
- [ ] Theme toggle persistence across page refreshes
- [ ] Smooth scroll on all internal links
- [ ] All animations play correctly on scroll
- [ ] No animation conflicts or jank
- [ ] Hover states work consistently
- [ ] Form validation and submission flow
- [ ] Mobile menu functionality
- [ ] Keyboard navigation through all interactive elements

**Automated Testing:**

- [ ] Run Lighthouse audit (Performance, Accessibility, Best Practices)
- [ ] Run axe DevTools accessibility scan
- [ ] Visual regression tests (Percy/Chromatic if available)
- [ ] Cross-browser screenshot comparison

---

## Notes for Implementation

1. **Maintain Professional Tone**: This is B2B SaaS - avoid overly playful or experimental designs. WOW effect should come from polish and attention to detail, not gimmicks.

2. **Mobile-First**: Test on real mobile devices. Animations that work on desktop may feel sluggish on mobile.

3. **Dark Mode First**: Implement both themes simultaneously. Don't treat dark mode as an afterthought.

4. **Accessibility is Non-Negotiable**: Every visual enhancement must maintain or improve accessibility. If an animation causes motion sickness, add reduced-motion support.

5. **Performance Budget**: Landing page should load in < 3 seconds on 3G. Use code splitting and lazy loading aggressively.

6. **Incremental Enhancement**: Build features progressively. Core content should work without JavaScript.

---

## Expected Outcome

A stunning, professional B2B SaaS landing page that:

- Creates memorable "wow" moments through subtle, sophisticated animations
- Provides a seamless dark mode experience with smooth theme switching
- Maintains exceptional accessibility and performance standards
- Avoids generic AI aesthetics through distinctive design choices
- Converts visitors through premium visual quality and attention to detail

The landing page should feel like a premium product from a world-class tech company - comparable to Linear, Vercel, or Stripe - while remaining authentic to the BuhBot brand and target audience (Russian accounting firms).
