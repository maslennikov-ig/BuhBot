# BuhBot Admin UI Style Guide

> **Version:** 1.0.0
> **Last Updated:** 2025-11-23
> **Design System:** BuhBot Premium Design System

This comprehensive style guide ensures design consistency across all BuhBot Admin UI development. Follow these guidelines to maintain the distinctive, modern aesthetic that sets BuhBot apart from generic AI-generated interfaces.

---

## Table of Contents

1. [Brand Identity](#1-brand-identity)
2. [Color Palette](#2-color-palette)
3. [Typography](#3-typography)
4. [Spacing & Layout](#4-spacing--layout)
5. [Components](#5-components)
6. [Effects & Animations](#6-effects--animations)
7. [Icons](#7-icons)
8. [Charts & Data Visualization](#8-charts--data-visualization)
9. [Dark Mode](#9-dark-mode)
10. [DO's and DON'Ts](#10-dos-and-donts)
11. [Code Examples](#11-code-examples)
12. [Accessibility](#12-accessibility)

---

## 1. Brand Identity

### Brand Values

| Value            | Description                                             |
| ---------------- | ------------------------------------------------------- |
| **Professional** | Trustworthy, reliable, enterprise-grade                 |
| **Modern**       | Cutting-edge design, not outdated corporate aesthetics  |
| **Distinctive**  | Unique identity, avoiding generic AI-generated patterns |
| **Efficient**    | Clean, functional, no visual clutter                    |

### Target Audience

- **Primary:** Accounting firm managers and administrators (Russia)
- **Secondary:** Accountants and support staff
- **Technical Level:** Non-technical business users
- **Age Range:** 30-55 years old

### Design Principles

1. **Depth Over Flatness** - Use glassmorphism, shadows, and layering
2. **Aurora Atmosphere** - Subtle animated gradients create visual interest
3. **Orchestrated Motion** - Coordinated animations, not random effects
4. **Premium Feel** - Every detail signals quality and attention

### Inspiration Sources

- Linear.app (orchestrated animations, dark mode)
- Vercel Dashboard (clean typography, glassmorphism)
- Stripe Dashboard (information density, visual hierarchy)

---

## 2. Color Palette

### Primary Colors

| Token                     | Light Mode | Dark Mode | Usage                   |
| ------------------------- | ---------- | --------- | ----------------------- |
| `--buh-background`        | `#fafbfc`  | `#0c1222` | Page backgrounds        |
| `--buh-background-subtle` | `#f4f6f8`  | `#111827` | Subtle background areas |
| `--buh-foreground`        | `#0c1222`  | `#f1f5f9` | Primary text            |
| `--buh-foreground-muted`  | `#4a5568`  | `#94a3b8` | Secondary text          |
| `--buh-foreground-subtle` | `#718096`  | `#64748b` | Tertiary text, hints    |

### Surface Colors

| Token                    | Light Mode                 | Dark Mode               | Usage                  |
| ------------------------ | -------------------------- | ----------------------- | ---------------------- |
| `--buh-surface`          | `#ffffff`                  | `#1a2744`               | Cards, panels          |
| `--buh-surface-elevated` | `#ffffff`                  | `#1e3a5f`               | Elevated cards, modals |
| `--buh-surface-overlay`  | `rgba(255, 255, 255, 0.8)` | `rgba(26, 39, 68, 0.9)` | Overlays               |

### Brand Colors

| Token                 | Light Mode               | Dark Mode                  | Usage                       |
| --------------------- | ------------------------ | -------------------------- | --------------------------- |
| `--buh-primary`       | `#0066cc`                | `#38bdf8`                  | Links, interactive elements |
| `--buh-primary-hover` | `#0052a3`                | `#7dd3fc`                  | Hover states                |
| `--buh-primary-muted` | `rgba(0, 102, 204, 0.1)` | `rgba(56, 189, 248, 0.15)` | Subtle backgrounds          |

### Accent Colors (WOW Factor)

| Token                         | Light Mode                | Dark Mode                  | Usage                     |
| ----------------------------- | ------------------------- | -------------------------- | ------------------------- |
| `--buh-accent`                | `#00d4aa`                 | `#00d4aa`                  | Primary accent, CTAs      |
| `--buh-accent-hover`          | `#00b894`                 | `#34eac5`                  | Accent hover              |
| `--buh-accent-glow`           | `rgba(0, 212, 170, 0.3)`  | `rgba(0, 212, 170, 0.4)`   | Glow effects              |
| `--buh-accent-secondary`      | `#7c3aed`                 | `#a78bfa`                  | Secondary accent (purple) |
| `--buh-accent-secondary-glow` | `rgba(124, 58, 237, 0.3)` | `rgba(167, 139, 250, 0.4)` | Secondary glow            |

### Semantic Colors

| Semantic    | Light Mode | Dark Mode | Muted (Light)             | Muted (Dark)                |
| ----------- | ---------- | --------- | ------------------------- | --------------------------- |
| **Success** | `#10b981`  | `#34d399` | `rgba(16, 185, 129, 0.1)` | `rgba(52, 211, 153, 0.15)`  |
| **Warning** | `#f59e0b`  | `#fbbf24` | `rgba(245, 158, 11, 0.1)` | `rgba(251, 191, 36, 0.15)`  |
| **Error**   | `#ef4444`  | `#f87171` | `rgba(239, 68, 68, 0.1)`  | `rgba(248, 113, 113, 0.15)` |
| **Info**    | `#3b82f6`  | `#60a5fa` | `rgba(59, 130, 246, 0.1)` | `rgba(96, 165, 250, 0.15)`  |

### Border Colors

| Token                 | Light Mode          | Dark Mode           | Usage            |
| --------------------- | ------------------- | ------------------- | ---------------- |
| `--buh-border`        | `#e2e8f0`           | `#2d3f5f`           | Standard borders |
| `--buh-border-subtle` | `#edf2f7`           | `#1e3a5f`           | Subtle dividers  |
| `--buh-border-focus`  | `var(--buh-accent)` | `var(--buh-accent)` | Focus rings      |

### Color Usage Guidelines

```
+------------------+----------------------------------------+
| Use Case         | Color Token                            |
+------------------+----------------------------------------+
| Page background  | --buh-background                       |
| Card background  | --buh-surface                          |
| Primary text     | --buh-foreground                       |
| Secondary text   | --buh-foreground-muted                 |
| Placeholder text | --buh-foreground-subtle                |
| Links            | --buh-primary                          |
| CTA buttons      | --buh-gradient-primary (gradient)      |
| Success states   | --buh-success / --buh-success-muted    |
| Error states     | --buh-error / --buh-error-muted        |
| Active nav item  | --buh-primary-muted background         |
+------------------+----------------------------------------+
```

---

## 3. Typography

### Font Families

| Role               | Font              | Fallback                                                  | Usage                                  |
| ------------------ | ----------------- | --------------------------------------------------------- | -------------------------------------- |
| **Sans (Primary)** | Plus Jakarta Sans | -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif | Headings, UI elements, body text       |
| **Serif**          | Spectral          | Georgia, serif                                            | Special emphasis, quotes (rarely used) |
| **Monospace**      | JetBrains Mono    | Fira Code, monospace                                      | Code, technical values, IDs            |

**CSS Variables:**

```css
--buh-font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--buh-font-serif: 'Spectral', Georgia, serif;
--buh-font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Font Import

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Spectral:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
```

### Type Scale

| Token  | Size     | Pixels | Usage                       |
| ------ | -------- | ------ | --------------------------- |
| `xs`   | 0.75rem  | 12px   | Badges, captions, footnotes |
| `sm`   | 0.875rem | 14px   | Secondary text, labels      |
| `base` | 1rem     | 16px   | Body text (default)         |
| `lg`   | 1.125rem | 18px   | Emphasized body             |
| `xl`   | 1.25rem  | 20px   | H6, small headings          |
| `2xl`  | 1.5rem   | 24px   | H5, card titles             |
| `3xl`  | 1.875rem | 30px   | H4, section headers         |
| `4xl`  | 2.25rem  | 36px   | H3, page headers            |
| `5xl`  | 3rem     | 48px   | H2, feature headings        |
| `6xl`  | 3.75rem  | 60px   | H1, hero headings           |

### Font Weights

| Token      | Value | Usage                   |
| ---------- | ----- | ----------------------- |
| `normal`   | 400   | Body text               |
| `medium`   | 500   | Emphasized text, labels |
| `semibold` | 600   | Headings H3-H6, buttons |
| `bold`     | 700   | H1-H2, metric values    |

### Line Heights

| Token     | Value | Usage                   |
| --------- | ----- | ----------------------- |
| `tight`   | 1.1   | Large headings (H1, H2) |
| `snug`    | 1.25  | Medium headings (H3-H6) |
| `normal`  | 1.5   | Body text               |
| `relaxed` | 1.6   | Long-form content       |
| `loose`   | 1.75  | Extra-readable content  |

### Letter Spacing

| Token    | Value   | Usage                    |
| -------- | ------- | ------------------------ |
| `tight`  | -0.02em | H1, display text         |
| `snug`   | -0.01em | H2-H6                    |
| `normal` | 0       | Body text                |
| `wide`   | 0.05em  | Uppercase labels, badges |

### Heading Styles (globals.css)

```css
h1 {
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
h2 {
  font-size: 1.875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
h3 {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
h4 {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
h5 {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
h6 {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
```

### Typography Utility Classes

| Class                | Effect                                              |
| -------------------- | --------------------------------------------------- |
| `.buh-text-gradient` | Gradient text (accent to primary)                   |
| `.buh-text-display`  | Display font styling (700 weight, tight tracking)   |
| `.buh-text-heading`  | Heading font styling (600 weight)                   |
| `.buh-text-body`     | Body font styling (400 weight, relaxed line-height) |
| `.buh-text-mono`     | Monospace font (0.9em size)                         |
| `.gradient-text`     | Shorthand for gradient text                         |

---

## 4. Spacing & Layout

### 8pt Grid System

All spacing uses an 8pt base grid. Values are multiples of 4px.

| Token            | Value | Common Usage                 |
| ---------------- | ----- | ---------------------------- |
| `--buh-space-1`  | 4px   | Minimal gaps, icon padding   |
| `--buh-space-2`  | 8px   | Tight spacing, badge padding |
| `--buh-space-3`  | 12px  | Button padding (vertical)    |
| `--buh-space-4`  | 16px  | Card padding, form gaps      |
| `--buh-space-5`  | 20px  | Button padding (horizontal)  |
| `--buh-space-6`  | 24px  | Section spacing              |
| `--buh-space-8`  | 32px  | Large section gaps           |
| `--buh-space-10` | 40px  | Page section dividers        |
| `--buh-space-12` | 48px  | Major section breaks         |
| `--buh-space-16` | 64px  | Hero spacing                 |
| `--buh-space-20` | 80px  | Large hero spacing           |
| `--buh-space-24` | 96px  | Maximum spacing              |

### Visual Spacing Reference

```
4px   |=|
8px   |==|
12px  |===|
16px  |====|
24px  |======|
32px  |========|
48px  |============|
64px  |================|
96px  |========================|
```

### Border Radius

| Token               | Value  | Usage                   |
| ------------------- | ------ | ----------------------- |
| `--buh-radius-sm`   | 6px    | Badges, small buttons   |
| `--buh-radius-md`   | 8px    | Buttons, inputs         |
| `--buh-radius-lg`   | 12px   | Cards, panels           |
| `--buh-radius-xl`   | 16px   | Large cards, modals     |
| `--buh-radius-2xl`  | 24px   | Hero sections           |
| `--buh-radius-full` | 9999px | Pills, avatars, circles |

### Layout Constants

| Token                           | Value | Usage             |
| ------------------------------- | ----- | ----------------- |
| `--buh-sidebar-width`           | 260px | Sidebar expanded  |
| `--buh-sidebar-collapsed-width` | 72px  | Sidebar collapsed |
| `--buh-header-height`           | 64px  | Top header        |

### Container Widths (Breakpoints)

| Token | Value  | Tailwind Breakpoint |
| ----- | ------ | ------------------- |
| `sm`  | 640px  | `sm:`               |
| `md`  | 768px  | `md:`               |
| `lg`  | 1024px | `lg:`               |
| `xl`  | 1280px | `xl:`               |
| `2xl` | 1536px | `2xl:`              |

### Responsive Patterns

```tsx
// Mobile-first responsive layout
<div className="
  p-4          // Mobile: 16px padding
  md:p-6       // Tablet: 24px padding
  lg:p-8       // Desktop: 32px padding
">

// Grid responsive columns
<div className="
  grid
  grid-cols-1        // Mobile: 1 column
  md:grid-cols-2     // Tablet: 2 columns
  lg:grid-cols-4     // Desktop: 4 columns
  gap-4 md:gap-6
">
```

### Layout Structure (ASCII)

```
+------------------------------------------------------------------+
|                         HEADER (64px)                             |
|  [Logo] [Search...........................] [Theme] [Bell] [User] |
+------------+-----------------------------------------------------+
|            |                                                     |
|  SIDEBAR   |                    MAIN CONTENT                     |
|  (260px)   |                                                     |
|            |  +------------------+  +------------------+          |
|  [Nav 1]   |  |    GlassCard     |  |    GlassCard     |          |
|  [Nav 2]   |  |                  |  |                  |          |
|  [Nav 3]   |  +------------------+  +------------------+          |
|  [Nav 4]   |                                                     |
|  [Nav 5]   |  +------------------------------------------+       |
|  [Nav 6]   |  |              GlassCard (wide)            |       |
|            |  |                                          |       |
|  [Collapse]|  +------------------------------------------+       |
|            |                                                     |
+------------+-----------------------------------------------------+
|                           FOOTER                                  |
|         (c) 2025 BuhBot. All rights reserved.  v0.1.16           |
+------------------------------------------------------------------+
```

---

## 5. Components

### 5.1 Cards

#### GlassCard Component

**Location:** `frontend/src/components/layout/GlassCard.tsx`

```tsx
import { GlassCard } from '@/components/layout/GlassCard';

// Variants
<GlassCard variant="default" padding="md">Content</GlassCard>
<GlassCard variant="elevated" padding="lg">Elevated</GlassCard>
<GlassCard variant="glow" padding="md">With glow effect</GlassCard>
```

**Variants:**

| Variant    | Class                           | Effect                         |
| ---------- | ------------------------------- | ------------------------------ |
| `default`  | `.buh-glass`                    | Standard glassmorphism         |
| `elevated` | `.buh-glass-elevated`           | Stronger blur, inset highlight |
| `glow`     | `.buh-glass` + `.buh-card-glow` | Gradient border on hover       |

**Padding Options:**

| Padding | Class | Value |
| ------- | ----- | ----- |
| `none`  | -     | 0     |
| `sm`    | `p-4` | 16px  |
| `md`    | `p-6` | 24px  |
| `lg`    | `p-8` | 32px  |

#### Standard Card CSS Classes

```css
.buh-card {
  /* Solid surface, light shadow, hover lift */
}

.buh-card-interactive {
  /* Adds cursor pointer, enhanced hover effect */
}

.buh-card-glow {
  /* Gradient border appears on hover */
}
```

**When to Use Glassmorphism:**

- Dashboard widgets over aurora background
- Modal overlays
- Elevated content areas
- Feature highlights

**When NOT to Use:**

- Dense data tables (use solid backgrounds)
- Print layouts
- Low-contrast accessibility requirements

### 5.2 Buttons

#### Button Variants (shadcn/ui + Custom)

**Location:** `frontend/src/components/ui/button.tsx`

```tsx
import { Button } from '@/components/ui/button';

<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button variant="link">Link Style</Button>
```

**Sizes:**

| Size      | Height      | Usage                        |
| --------- | ----------- | ---------------------------- |
| `sm`      | 32px (h-8)  | Inline actions, compact UI   |
| `default` | 36px (h-9)  | Standard buttons             |
| `lg`      | 40px (h-10) | Hero CTAs, prominent actions |
| `icon`    | 36px x 36px | Icon-only buttons            |

#### Gradient Button (Custom CSS)

```css
.buh-btn-primary {
  background: var(--buh-gradient-primary);
  color: white;
  font-weight: 600;
  /* Lifts and glows on hover */
}
```

**Usage:**

```tsx
<button className="buh-btn-primary">Primary CTA</button>
```

#### Ghost Button (Custom CSS)

```css
.buh-btn-ghost {
  background: transparent;
  /* Subtle background on hover */
}
```

### 5.3 Forms

#### Input Styling

```css
input,
textarea,
select {
  font-family: var(--buh-font-sans);
  background: var(--buh-surface);
  border: 1px solid var(--buh-border);
  border-radius: var(--buh-radius-md);
  padding: 0.5rem 0.75rem;
}

input:focus {
  border-color: var(--buh-accent);
  box-shadow: 0 0 0 3px var(--buh-accent-glow);
}
```

#### Labels

- Font size: 14px (`text-sm`)
- Font weight: 500 (`font-medium`)
- Color: `--buh-foreground-muted`
- Margin bottom: 8px

#### Validation States

| State   | Border Color    | Background            | Icon        |
| ------- | --------------- | --------------------- | ----------- |
| Default | `--buh-border`  | `--buh-surface`       | None        |
| Focus   | `--buh-accent`  | `--buh-surface`       | None        |
| Error   | `--buh-error`   | `--buh-error-muted`   | AlertCircle |
| Success | `--buh-success` | `--buh-success-muted` | CheckCircle |

### 5.4 Tables

```css
th {
  font-weight: 600;
  color: var(--buh-foreground-muted);
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--buh-border);
}

tr:hover {
  background: var(--buh-surface-elevated);
}
```

#### Empty State Pattern

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <div className="mb-4 text-[var(--buh-foreground-subtle)]">
    <InboxIcon className="h-12 w-12" />
  </div>
  <h3 className="text-lg font-medium text-[var(--buh-foreground)]">Нет данных</h3>
  <p className="mt-1 text-sm text-[var(--buh-foreground-muted)]">
    Данные появятся после первых запросов
  </p>
</div>
```

### 5.5 Navigation (Sidebar)

#### Active State

```css
.buh-sidebar-item-active {
  background: var(--buh-primary-muted);
  color: var(--buh-primary);
  font-weight: 600;
}

/* Gradient indicator bar */
.buh-sidebar-item-active::before {
  width: 3px;
  height: 24px;
  background: var(--buh-gradient-primary);
  border-radius: 0 6px 6px 0;
}
```

#### Hover State

```css
.buh-sidebar-item:hover {
  background: var(--buh-primary-muted);
  color: var(--buh-foreground);
  transform: translateX(2px);
}
```

### 5.6 StatCard Component

**Location:** `frontend/src/components/layout/StatCard.tsx`

```tsx
import { StatCard } from '@/components/layout/StatCard';
import { Users } from 'lucide-react';

<StatCard
  title="Активные клиенты"
  value="1,234"
  change={{
    value: 12,
    type: 'increase',
    label: 'vs last week',
  }}
  icon={<Users className="h-6 w-6" />}
/>;
```

**Props:**

| Prop      | Type             | Description               |
| --------- | ---------------- | ------------------------- |
| `title`   | string           | Metric label              |
| `value`   | string \| number | Main value                |
| `change`  | object           | Optional change indicator |
| `icon`    | ReactNode        | Optional icon             |
| `loading` | boolean          | Shows shimmer skeleton    |

### 5.7 PageHeader Component

**Location:** `frontend/src/components/layout/PageHeader.tsx`

```tsx
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

<PageHeader
  title="Панель управления"
  description="Обзор ключевых показателей системы"
  breadcrumbs={[{ label: 'Главная', href: '/' }, { label: 'Панель управления' }]}
  actions={<Button>Экспорт</Button>}
/>;
```

### 5.8 Badges

```css
.buh-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

**Variants:**

| Class                | Background            | Text Color      |
| -------------------- | --------------------- | --------------- |
| `.buh-badge-success` | `--buh-success-muted` | `--buh-success` |
| `.buh-badge-warning` | `--buh-warning-muted` | `--buh-warning` |
| `.buh-badge-error`   | `--buh-error-muted`   | `--buh-error`   |
| `.buh-badge-info`    | `--buh-info-muted`    | `--buh-info`    |
| `.buh-badge-accent`  | `--buh-accent-glow`   | `--buh-accent`  |

---

## 6. Effects & Animations

### 6.1 Background Effects

#### Aurora Gradient

The signature BuhBot background effect. Adds depth and visual interest.

```css
.buh-aurora {
  position: relative;
  overflow: hidden;
}

.buh-aurora::before {
  /* Animated radial gradients */
  /* 3 color points: accent, secondary, primary */
  animation: aurora-shift 20s ease-in-out infinite alternate;
}
```

**Usage:**

```tsx
<div className="buh-aurora fixed inset-0 pointer-events-none" aria-hidden="true" />
```

**Light Mode:** Opacity 0.5 (subtle)
**Dark Mode:** Opacity 1.0 (prominent)

#### Mesh Gradient

Static multi-point gradient for special backgrounds.

```css
.buh-mesh-gradient {
  background-image:
    radial-gradient(at 40% 20%, accent-glow 0px, transparent 50%),
    radial-gradient(at 80% 0%, secondary-glow 0px, transparent 50%),
    /* ... more gradient points */
  background-attachment: fixed;
}
```

### 6.2 Glassmorphism

#### Standard Glass

```css
.buh-glass {
  background: var(--buh-glass-background);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--buh-glass-border);
  box-shadow: var(--buh-shadow-lg);
}
```

#### Elevated Glass

```css
.buh-glass-elevated {
  backdrop-filter: blur(20px);
  box-shadow:
    var(--buh-shadow-xl),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}
```

**Glass Values by Mode:**

| Property   | Light Mode                 | Dark Mode               |
| ---------- | -------------------------- | ----------------------- |
| Background | `rgba(255, 255, 255, 0.7)` | `rgba(26, 39, 68, 0.7)` |
| Border     | `rgba(255, 255, 255, 0.3)` | `rgba(45, 63, 95, 0.5)` |
| Blur       | 12px                       | 16px                    |

### 6.3 Animations

#### Entrance Animations

| Animation     | Class                        | Duration | Use Case            |
| ------------- | ---------------------------- | -------- | ------------------- |
| Fade In Up    | `.buh-animate-fade-in-up`    | 600ms    | Page content, cards |
| Fade In Scale | `.buh-animate-fade-in-scale` | 300ms    | Modals, popovers    |
| Slide In Left | `.buh-animate-slide-in-left` | 400ms    | Sidebar, drawers    |

**Staggered Children:**

```tsx
<div className="buh-stagger">
  <div>Item 1 (50ms delay)</div>
  <div>Item 2 (100ms delay)</div>
  <div>Item 3 (150ms delay)</div>
  {/* Up to 10 children with 50ms increments */}
</div>
```

#### Micro-Interactions

| Class               | Effect                    | Timing  |
| ------------------- | ------------------------- | ------- |
| `.buh-hover-lift`   | translateY(-2px) + shadow | 150ms   |
| `.buh-hover-scale`  | scale(1.02)               | 150ms   |
| `.buh-active-press` | scale(0.98)               | instant |
| `.buh-focus-ring`   | 2px accent ring           | 150ms   |

#### Loading States

**Shimmer Effect:**

```css
.buh-shimmer {
  background: linear-gradient(
    90deg,
    var(--buh-surface) 25%,
    var(--buh-surface-elevated) 50%,
    var(--buh-surface) 75%
  );
  background-size: 200% 100%;
  animation: buh-shimmer 1.5s ease-in-out infinite;
}
```

**Pulse Glow (attention):**

```css
.buh-animate-pulse-glow {
  animation: buh-pulse-glow 2s ease-in-out infinite;
  /* Alternates between shadow-md and shadow-md + glow */
}
```

### 6.4 Transition Timing

| Token                     | Duration | Easing                | Usage                 |
| ------------------------- | -------- | --------------------- | --------------------- |
| `--buh-transition-fast`   | 150ms    | ease-out              | Hovers, toggles       |
| `--buh-transition-base`   | 200ms    | ease-out              | Standard interactions |
| `--buh-transition-slow`   | 300ms    | ease-out              | Complex transitions   |
| `--buh-transition-spring` | 500ms    | spring (cubic-bezier) | Playful bounce        |

**Easing Functions:**

- Standard: `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out)
- Entrance: `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out)
- Spring: `cubic-bezier(0.34, 1.56, 0.64, 1)` (bounce)

---

## 7. Icons

### Icon Library

**Lucide React** - Modern, consistent icon set

```tsx
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Timer,
  BarChart3,
  Settings,
  Bell,
  Search,
  Moon,
  Sun,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
```

### Icon Sizes

| Token | Size | Usage                  |
| ----- | ---- | ---------------------- |
| `xs`  | 14px | Inline with small text |
| `sm`  | 16px | Buttons, inputs        |
| `md`  | 20px | Default, nav items     |
| `lg`  | 24px | Cards, prominent UI    |
| `xl`  | 32px | Hero, empty states     |

```tsx
<Search className="h-4 w-4" />  {/* 16px */}
<Search className="h-5 w-5" />  {/* 20px */}
<Search className="h-6 w-6" />  {/* 24px */}
```

### Icon Colors

- **Default:** `--buh-foreground-muted`
- **Active:** `--buh-primary`
- **Hover:** `--buh-foreground`
- **Disabled:** `--buh-foreground-subtle`

### Gradient Icon Headers

For stat cards and feature highlights:

```tsx
<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10 text-[var(--buh-primary)]">
  <Users className="h-6 w-6" />
</div>
```

---

## 8. Charts & Data Visualization

### Tremor Components

BuhBot uses Tremor for charts. All Tremor components are automatically styled via globals.css overrides.

**Available Components:**

- `DonutChart` - SLA compliance, category breakdown
- `AreaChart` - Time series, trends
- `BarChart` - Comparisons, rankings
- `LineChart` - Trends over time

### Chart Colors

Use semantic colors for meaning:

```tsx
// Tremor color names (mapped to BuhBot palette)
colors={['emerald', 'rose']}  // Success/Error
colors={['cyan', 'violet', 'amber']}  // Multi-category
```

### Chart Integration Example

```tsx
import { DonutChart } from '@tremor/react';
import { GlassCard } from '@/components/layout/GlassCard';

<GlassCard variant="elevated" padding="lg">
  <h3 className="text-sm font-medium text-[var(--buh-foreground-muted)]">SLA Compliance</h3>
  <DonutChart
    data={data}
    category="value"
    index="name"
    colors={['emerald', 'rose']}
    showAnimation={true}
    className="h-40 w-40"
  />
</GlassCard>;
```

### Data Visualization Guidelines

1. **Always add context** - Labels, legends, time ranges
2. **Use semantic colors** - Green for good, red for bad
3. **Animate on load** - Enable `showAnimation`
4. **Responsive sizing** - Use relative units
5. **Empty states** - Show meaningful placeholder

---

## 9. Dark Mode

### How It Works

Dark mode uses CSS custom properties that are redefined when `.dark` class is on `<html>`.

```css
/* Light mode (default) */
:root {
  --buh-background: #fafbfc;
  /* ... */
}

/* Dark mode */
.dark,
[data-theme='dark'] {
  --buh-background: #0c1222;
  /* ... */
}
```

### Theme Provider

**Location:** `frontend/src/components/layout/AdminLayout.tsx`

```tsx
const { theme, toggleTheme } = useTheme();

// Toggle button
<button onClick={toggleTheme}>{theme === 'light' ? <Moon /> : <Sun />}</button>;
```

### Theme Transition

Smooth 300ms transition when switching themes:

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

### Dark Mode Testing Checklist

- [ ] Text readable on dark backgrounds (contrast ratio >= 4.5:1)
- [ ] Borders visible but not harsh
- [ ] Shadows deeper (use dark.\* shadow tokens)
- [ ] Aurora effect more prominent
- [ ] Accent colors adjusted for vibrancy
- [ ] No pure white (#ffffff) text
- [ ] Charts and data viz readable

---

## 10. DO's and DON'Ts

### Typography

| DO                                         | DON'T                                 |
| ------------------------------------------ | ------------------------------------- |
| Use Plus Jakarta Sans for all UI           | Use Inter, Roboto, or Arial           |
| Apply negative letter-spacing to headings  | Use default letter-spacing everywhere |
| Use font-weight scale (400, 500, 600, 700) | Use weights outside the scale         |
| Minimum 16px for body text                 | Use 14px or smaller for body          |

### Colors

| DO                                | DON'T                                     |
| --------------------------------- | ----------------------------------------- |
| Use the accent (#00d4aa) for CTAs | Use generic blue for everything           |
| Apply gradients strategically     | Purple gradients on white (AI cliche)     |
| Use muted backgrounds for badges  | Use solid semantic colors for backgrounds |
| Test dark mode contrast           | Assume light mode colors work in dark     |

### Layout

| DO                                     | DON'T                                  |
| -------------------------------------- | -------------------------------------- |
| Use aurora/mesh backgrounds for depth  | Use flat, solid backgrounds everywhere |
| Apply glassmorphism to elevate content | Overuse glassmorphism (performance)    |
| Use the 8pt grid consistently          | Use arbitrary spacing values           |
| Create visual hierarchy with spacing   | Equal spacing everywhere               |

### Animation

| DO                              | DON'T                              |
| ------------------------------- | ---------------------------------- |
| Use staggered reveals for lists | Animate everything at once         |
| Keep durations 150-500ms        | Animations over 500ms (feels slow) |
| Use ease-out/expo-out easing    | Linear easing (feels robotic)      |
| Add micro-interactions on hover | Leave elements static              |

### Anti-Patterns to Avoid

```
AVOID: Generic AI-Generated Look
----------------------------------------

1. Purple gradients on white backgrounds
2. Inter/Roboto/System fonts only
3. Generic blue (#3B82F6) everywhere
4. Cookie-cutter layouts (logo, hero, 3 cols)
5. Flat design without depth
6. Minimal or no animations
7. Stock photos of "diverse teams"
8. Rounded corners on everything without variation
9. Gray-on-gray text without hierarchy
10. Card grids with identical spacing
```

---

## 11. Code Examples

### Using Design Tokens in TypeScript

```typescript
import { colors, typography, spacing, shadows } from '@/components/ui/design-tokens';

// Direct value usage
const cardStyle = {
  background: colors.surface.light,
  padding: spacing[6], // 24px
  boxShadow: shadows.md,
  fontFamily: typography.fontFamily.sans,
};

// Theme-aware value
import { getThemeValue } from '@/components/ui/design-tokens';

const theme = 'dark';
const bgColor = getThemeValue(colors.background, theme); // '#0c1222'
```

### CSS Variable Usage

```tsx
// In className (Tailwind-like)
<div className="bg-[var(--buh-surface)] border-[var(--buh-border)]">

// In inline styles
<div style={{
  background: 'var(--buh-gradient-primary)',
  color: 'var(--buh-foreground)'
}}>
```

### Component Composition

```tsx
// Page layout pattern
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/layout/GlassCard';
import { StatCard } from '@/components/layout/StatCard';

export default function DashboardPage() {
  return (
    <AdminLayout>
      <PageHeader title="Панель управления" description="Обзор ключевых метрик" />

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Клиенты" value="1,234" />
        <StatCard title="Запросы" value="567" />
        {/* ... */}
      </div>

      {/* Content section */}
      <GlassCard variant="elevated" padding="lg">
        <h2 className="text-xl font-semibold mb-4">Детальная статистика</h2>
        {/* Chart or table */}
      </GlassCard>
    </AdminLayout>
  );
}
```

### Animation Patterns

```tsx
// Page load stagger
<div className="buh-stagger">
  {items.map((item, i) => (
    <div
      key={item.id}
      className="buh-animate-fade-in-up"
      style={{ animationDelay: `${i * 0.05}s` }}
    >
      {item.content}
    </div>
  ))}
</div>

// Interactive card
<div className="buh-card buh-card-interactive buh-hover-lift">
  Click me
</div>

// Loading skeleton
<div className="buh-shimmer h-8 w-32 rounded" />
```

### Responsive Patterns

```tsx
// Grid that adapts
<div className="
  grid
  grid-cols-1
  sm:grid-cols-2
  lg:grid-cols-3
  xl:grid-cols-4
  gap-4
  md:gap-6
">

// Text that scales
<h1 className="
  text-2xl
  md:text-3xl
  lg:text-4xl
  font-bold
  tracking-tight
">

// Sidebar that collapses
<aside className={cn(
  'transition-all duration-300',
  collapsed ? 'w-[72px]' : 'w-[260px]',
  'lg:translate-x-0',
  mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
)}>
```

---

## 12. Accessibility

### Focus States

All interactive elements must have visible focus states:

```css
:focus-visible {
  outline: 2px solid var(--buh-accent);
  outline-offset: 2px;
}

/* Custom focus ring utility */
.buh-focus-ring:focus-visible {
  box-shadow:
    0 0 0 2px var(--buh-background),
    0 0 0 4px var(--buh-accent);
}
```

### Color Contrast

**Minimum Requirements (WCAG 2.1 AA):**

- Normal text: 4.5:1 contrast ratio
- Large text (18px+): 3:1 contrast ratio
- UI components: 3:1 contrast ratio

**BuhBot Contrast Ratios:**

| Combination              | Light Mode | Dark Mode |
| ------------------------ | ---------- | --------- |
| Foreground on Background | 15.2:1     | 14.8:1    |
| Muted on Background      | 5.1:1      | 4.8:1     |
| Primary on Background    | 5.4:1      | 5.2:1     |
| Accent on Background     | 4.6:1      | 4.5:1     |

### Keyboard Navigation

- All interactive elements must be focusable
- Tab order should follow visual order
- Escape key closes modals/drawers
- Arrow keys navigate within components

```tsx
// Sidebar keyboard handling
React.useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setMobileSidebarOpen(false);
    }
  };
  window.addEventListener('keydown', handleEscape);
  return () => window.removeEventListener('keydown', handleEscape);
}, []);
```

### Screen Reader Support

```tsx
// Decorative elements
<div className="buh-aurora" aria-hidden="true" />

// Icon buttons
<button aria-label="Open sidebar">
  <Menu className="h-5 w-5" />
</button>

// Live regions
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Appendix A: File Reference

| File                                             | Purpose                                            |
| ------------------------------------------------ | -------------------------------------------------- |
| `frontend/src/styles/design-system.css`          | CSS custom properties, animations, utility classes |
| `frontend/src/components/ui/design-tokens.ts`    | TypeScript constants for programmatic use          |
| `frontend/src/app/globals.css`                   | Base styles, Tailwind config, Tremor overrides     |
| `frontend/src/components/layout/AdminLayout.tsx` | Main layout with sidebar, header, theme            |
| `frontend/src/components/layout/GlassCard.tsx`   | Glassmorphism card component                       |
| `frontend/src/components/layout/StatCard.tsx`    | Metric/stat display card                           |
| `frontend/src/components/layout/PageHeader.tsx`  | Page header with breadcrumbs                       |
| `frontend/src/components/ui/button.tsx`          | shadcn/ui button with variants                     |

---

## Appendix B: Quick Reference Card

```
+-------------------------------------------------------+
|                 BUHBOT DESIGN TOKENS                  |
+-------------------------------------------------------+
| FONTS                                                  |
|   Sans:  Plus Jakarta Sans                            |
|   Mono:  JetBrains Mono                               |
+-------------------------------------------------------+
| COLORS                                                |
|   Background:  #fafbfc (light) / #0c1222 (dark)       |
|   Accent:      #00d4aa                                |
|   Primary:     #0066cc (light) / #38bdf8 (dark)       |
|   Secondary:   #7c3aed (light) / #a78bfa (dark)       |
+-------------------------------------------------------+
| SPACING (8pt grid)                                    |
|   xs: 4px | sm: 8px | md: 16px | lg: 24px | xl: 32px  |
+-------------------------------------------------------+
| RADIUS                                                |
|   sm: 6px | md: 8px | lg: 12px | xl: 16px | full      |
+-------------------------------------------------------+
| TRANSITIONS                                           |
|   fast: 150ms | base: 200ms | slow: 300ms             |
+-------------------------------------------------------+
| BREAKPOINTS                                           |
|   sm: 640px | md: 768px | lg: 1024px | xl: 1280px     |
+-------------------------------------------------------+
```

---

**Document maintained by:** BuhBot Development Team
**Last review:** 2025-11-23
