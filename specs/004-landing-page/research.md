# Research: BuhBot Landing Page

**Date**: 2025-11-24
**Feature**: 004-landing-page
**Status**: Complete

## Overview

No critical unknowns identified. All technical decisions align with existing codebase patterns.

## Research Findings

### 1. Frontend Architecture

**Decision**: Use existing Next.js 16.x App Router with React 19.x

**Rationale**:

- Frontend already configured with Next.js 16.0.3 and React 19.2.0
- App Router pattern established (`frontend/src/app/`)
- Existing UI components in `frontend/src/components/ui/` (shadcn/ui)
- Tailwind CSS 4.x already configured

**Alternatives Considered**:

- None - must use existing stack per constitution

### 2. Form Handling Pattern

**Decision**: Use React Hook Form + Zod + tRPC mutation

**Rationale**:

- `react-hook-form` (7.66.0) and `@hookform/resolvers` (5.2.2) already installed
- `zod` (4.1.12 frontend, 3.23.8 backend) available for validation
- tRPC 11.x pattern established for API calls (see `backend/src/api/trpc/`)

**Alternatives Considered**:

- Next.js Server Actions: Less type-safe, doesn't leverage existing tRPC setup
- Direct fetch: Loses type safety benefits

### 3. Database Model for Contact Requests

**Decision**: Add new Prisma model `ContactRequest` following existing schema patterns

**Rationale**:

- Prisma 7.x already configured (`backend/prisma/schema.prisma`)
- Similar patterns exist for `ClientRequest`, `FeedbackResponse`
- Use existing enum pattern for status

**Alternatives Considered**:

- Supabase direct: Bypasses Prisma, loses type generation
- External service (Formspree): Adds external dependency, data leaves system

### 4. Telegram Notification

**Decision**: Use existing Telegraf bot infrastructure to send notifications

**Rationale**:

- Telegraf 4.16.3 already integrated (`backend/src/bot/`)
- Bot already handles notifications for SLA alerts
- Reuse existing notification patterns

**Alternatives Considered**:

- Email: Requires SMTP setup, less immediate
- External webhook: Adds dependency

### 5. Component Architecture

**Decision**: Create dedicated `/landing/` component folder with 7 section components

**Rationale**:

- Separation from admin dashboard components
- Each section independently testable
- Follows existing component organization pattern

**Components**:

1. `Header.tsx` - Sticky navigation with logo and links
2. `Hero.tsx` - Main headline, CTA buttons
3. `Features.tsx` - 6-feature grid with icons
4. `HowItWorks.tsx` - 4-step numbered process
5. `Benefits.tsx` - 4 key metrics/stats
6. `ContactForm.tsx` - Lead capture form
7. `Footer.tsx` - Navigation and copyright

### 6. Styling Approach

**Decision**: Use Tailwind CSS with design tokens from existing STYLE-GUIDE.md

**Rationale**:

- Comprehensive style guide exists (`frontend/STYLE-GUIDE.md`)
- Design tokens defined in `frontend/src/components/ui/design-tokens.ts`
- Consistent with existing admin UI

**Key Considerations**:

- Use semantic color variables
- Mobile-first responsive approach
- Smooth scroll for navigation

### 7. Route Structure

**Decision**: Landing at `/`, Login moved to `/login`

**Current State**:

- `/` - Default Next.js template (to be replaced)
- `/dashboard` - Admin dashboard (auth required)
- `/login` - Does not exist yet (needs creation)

**New Structure**:

- `/` - Landing page (public)
- `/login` - Authentication page (public)
- `/dashboard` - Admin dashboard (auth required, unchanged)

## Best Practices Applied

### Performance

- Use Next.js Image component for optimized images
- Lazy load below-fold sections
- Minimal client-side JavaScript
- Static content where possible

### SEO

- Proper heading hierarchy (single H1)
- Meta tags for Russian search engines
- Semantic HTML structure
- JSON-LD schema (optional enhancement)

### Accessibility

- Keyboard navigation for all interactive elements
- Proper ARIA labels
- Focus management for mobile menu
- Color contrast compliance

### Spam Prevention

- Honeypot field (invisible to users)
- Client-side + server-side validation
- Rate limiting consideration (can add later)

## Content Specification (from TZ)

### Hero Section Content

```
Headline: "Автоматизация коммуникаций для бухгалтерских фирм"
Subheadline: "Контролируйте SLA, собирайте обратную связь и повышайте продуктивность бухгалтеров в 4 раза с помощью Telegram-бота"

CTA Primary: "Запросить демо" (scroll to contact form)
CTA Secondary: "Узнать больше" (scroll to features)
```

### 6 Feature Cards (Возможности)

| Icon            | Title               | Description                                                                    |
| --------------- | ------------------- | ------------------------------------------------------------------------------ |
| Clock/Timer     | SLA Мониторинг      | Автоматическое отслеживание времени ответа с учётом рабочих часов и праздников |
| Star/Heart      | Сбор обратной связи | Квартальные опросы клиентов с NPS-аналитикой и анонимностью для бухгалтеров    |
| Zap/Lightning   | Быстрые ответы      | Шаблоны, FAQ авто-ответы и inline-кнопки для мгновенной реакции                |
| LayoutDashboard | Админ-панель        | Дашборды аналитики, управление пользователями и настройки в одном месте        |
| MessageCircle   | Telegram интеграция | Нативный бот с inline-клавиатурами, обработкой файлов и уведомлениями          |
| Shield          | Безопасность        | HTTPS, Row Level Security, Supabase Auth и защита персональных данных          |

### 4 Steps (Как это работает)

| Step | Icon                | Title       | Description                                                      |
| ---- | ------------------- | ----------- | ---------------------------------------------------------------- |
| 01   | Plug/Link           | Подключение | Подключите Telegram-чаты ваших клиентов к BuhBot                 |
| 02   | Settings/Sliders    | Настройка   | Настройте SLA-пороги, рабочие часы и шаблоны ответов             |
| 03   | Activity/BarChart   | Мониторинг  | Отслеживайте время ответов, получайте алерты о нарушениях        |
| 04   | TrendingUp/PieChart | Аналитика   | Анализируйте метрики, собирайте обратную связь, улучшайте сервис |

### 4 Stats (Преимущества)

| Number  | Label          | Context                  |
| ------- | -------------- | ------------------------ |
| 4x      | Быстрее ответы | С шаблонами и кнопками   |
| 90%+    | SLA compliance | Среднее по клиентам      |
| 55%     | Клиентов       | Предпочитают авто-ответы |
| 3-4 мес | Окупаемость    | ROI инвестиций           |

### Navigation Links

```
Возможности | Как это работает | Преимущества | Контакты
```

### Contact Section Additional Info

- Telegram: @buhbot_support
- Email: contact@aidevteam.ru

### Footer Content

```
Left: BuhBot logo + "Автоматизация для бухгалтерских фирм"

Center:
- Возможности
- Как это работает
- Контакты
- Войти

Right:
- Telegram icon + link
- GitHub icon + link (optional)

Bottom: © 2025 AIDevTeam. Все права защищены.
```

## No Outstanding Research Items

All technical decisions resolved. Proceed to Phase 1 design.
