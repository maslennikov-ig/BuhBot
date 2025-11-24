# BuhBot - Phase 1.7: Landing Page Implementation Prompt

**Project:** BuhBot - Accounting Firm Client Communication Automation Platform
**Feature:** 004-landing-page
**Priority:** P1 (SHOULD-HAVE)
**Estimated Hours:** 24h
**Created:** 2025-11-24

---

## Context

BuhBot is a Telegram-based automation platform for accounting firms. The system is deployed at https://buhbot.aidevteam.ru but currently shows a default Next.js template page instead of a professional landing page.

### Current State
- **Production URL:** https://buhbot.aidevteam.ru
- **Current Page:** Default Next.js "To get started, edit the page.tsx file" template
- **Frontend Stack:** Next.js 16+, React 19, Tailwind CSS 4.x, shadcn/ui
- **Backend:** Node.js + Express + Telegraf (Telegram bot)
- **Database:** Supabase (PostgreSQL)

### Business Need
A professional landing page is critical for:
1. **First Impression** - Visitors currently see a development placeholder
2. **Lead Generation** - No way to contact or request a demo
3. **Product Communication** - Features and benefits not visible
4. **Trust Building** - Professional appearance for B2B accounting market

---

## Objectives

### Primary Goals
1. Replace default Next.js page with professional landing page
2. Communicate BuhBot value proposition clearly
3. Enable lead capture through contact form
4. Optimize for Russian-speaking accounting firm market

### Success Metrics
- Landing page live at https://buhbot.aidevteam.ru
- Lighthouse Performance score ≥90
- Mobile responsive (320px - 1920px)
- Contact form functional with notifications
- Russian language content

---

## Technical Requirements

### Stack (Already Configured)
- **Framework:** Next.js 16+ (App Router)
- **Styling:** Tailwind CSS 4.x
- **Components:** shadcn/ui (already installed)
- **Animations:** Framer Motion (to add)
- **Forms:** React Hook Form + Zod (already in project)
- **Icons:** Lucide React (already installed)

### Architecture Constraints
- Landing page at `/` route (public, no auth required)
- Admin panel remains at `/login`, `/dashboard`, `/feedback`, `/settings/*`
- Must not break existing authenticated routes
- Server Components where possible, Client Components for interactivity

### Performance Requirements
- LCP (Largest Contentful Paint) < 2.5s
- FID (First Input Delay) < 100ms
- CLS (Cumulative Layout Shift) < 0.1
- Total bundle size increase < 50KB
- Images optimized with next/image

---

## Page Structure

### 1. Navigation Header
**Purpose:** Brand identity and navigation

**Elements:**
- Logo: "BuhBot" text logo or simple icon
- Navigation links (scroll anchors): Возможности | Как это работает | Преимущества | Контакты
- CTA Button: "Войти" (link to /login) or "Запросить демо"
- Mobile: Hamburger menu

**Behavior:**
- Sticky on scroll (with blur background)
- Hide/show on scroll direction (optional)

---

### 2. Hero Section
**Purpose:** Capture attention, communicate core value

**Content (Russian):**
```
Headline: "Автоматизация коммуникаций для бухгалтерских фирм"
Subheadline: "Контролируйте SLA, собирайте обратную связь и повышайте продуктивность бухгалтеров в 4 раза с помощью Telegram-бота"

CTA Primary: "Запросить демо" (scroll to contact form)
CTA Secondary: "Узнать больше" (scroll to features)
```

**Visual:**
- Abstract illustration or 3D render (bot + accounting theme)
- Or: Screenshot/mockup of Telegram bot interface
- Subtle gradient background
- Floating elements animation (optional)

**Technical:**
- Above-the-fold optimization
- Preload hero image
- Animated text entrance (Framer Motion)

---

### 3. Features Section (Возможности)
**Purpose:** Showcase key capabilities

**6 Feature Cards:**

| Icon | Title | Description |
|------|-------|-------------|
| Clock/Timer | SLA Мониторинг | Автоматическое отслеживание времени ответа с учётом рабочих часов и праздников |
| Star/Heart | Сбор обратной связи | Квартальные опросы клиентов с NPS-аналитикой и анонимностью для бухгалтеров |
| Zap/Lightning | Быстрые ответы | Шаблоны, FAQ авто-ответы и inline-кнопки для мгновенной реакции |
| LayoutDashboard | Админ-панель | Дашборды аналитики, управление пользователями и настройки в одном месте |
| MessageCircle | Telegram интеграция | Нативный бот с inline-клавиатурами, обработкой файлов и уведомлениями |
| Shield | Безопасность | HTTPS, Row Level Security, Supabase Auth и защита персональных данных |

**Layout:**
- 3 columns on desktop
- 2 columns on tablet
- 1 column on mobile
- Card hover effect (subtle lift + shadow)

---

### 4. How It Works Section (Как это работает)
**Purpose:** Explain implementation flow

**4 Steps:**
1. **Подключение**
   - Icon: Plug/Link
   - "Подключите Telegram-чаты ваших клиентов к BuhBot"

2. **Настройка**
   - Icon: Settings/Sliders
   - "Настройте SLA-пороги, рабочие часы и шаблоны ответов"

3. **Мониторинг**
   - Icon: Activity/BarChart
   - "Отслеживайте время ответов, получайте алерты о нарушениях"

4. **Аналитика**
   - Icon: TrendingUp/PieChart
   - "Анализируйте метрики, собирайте обратную связь, улучшайте сервис"

**Layout:**
- Horizontal timeline on desktop (numbered circles with connecting line)
- Vertical stack on mobile
- Step numbers: 01, 02, 03, 04

---

### 5. Benefits/Stats Section (Преимущества)
**Purpose:** Build credibility with numbers

**4 Key Stats:**
| Number | Label | Context |
|--------|-------|---------|
| 4x | Быстрее ответы | С шаблонами и кнопками |
| 90%+ | SLA compliance | Среднее по клиентам |
| 55% | Клиентов | Предпочитают авто-ответы |
| 3-4 мес | Окупаемость | ROI инвестиций |

**Layout:**
- 4 columns on desktop
- 2x2 grid on tablet/mobile
- Large numbers with counter animation on scroll (optional)
- Accent background color

---

### 6. Testimonials Section (Optional - Phase 2)
**Purpose:** Social proof

**Note:** Skip for MVP, add when real testimonials available

---

### 7. Contact/CTA Section (Контакты)
**Purpose:** Lead capture

**Form Fields:**
- Имя (Name) - required
- Email - required, validated
- Компания (Company) - optional
- Сообщение (Message) - optional, textarea

**Additional Contact:**
- Telegram: @buhbot_support (or actual support handle)
- Email: contact@aidevteam.ru

**CTA Button:** "Отправить заявку"

**On Submit:**
- Show success toast: "Спасибо! Мы свяжемся с вами в ближайшее время."
- Store in database (contact_requests table) OR send email notification
- Reset form

**Validation:**
- Zod schema for all fields
- Real-time validation feedback
- Honeypot field for spam protection

---

### 8. Footer
**Purpose:** Navigation and legal

**Content:**
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

---

## Design Guidelines

### Color Palette
Use existing Tailwind/shadcn theme or:
- **Primary:** Blue (#3B82F6) - trust, professionalism
- **Secondary:** Slate (#64748B) - neutral, business
- **Accent:** Emerald (#10B981) - success, growth
- **Background:** White/Slate-50
- **Text:** Slate-900 (headings), Slate-600 (body)

### Typography
- **Headings:** Inter or system font, bold
- **Body:** Inter or system font, regular
- **Sizes:**
  - H1: 48px/3rem (mobile: 36px)
  - H2: 36px/2.25rem (mobile: 28px)
  - Body: 16px/1rem
  - Small: 14px/0.875rem

### Spacing
- Section padding: 80px vertical (mobile: 48px)
- Container max-width: 1280px
- Grid gap: 32px (mobile: 24px)

### Animations
- Entrance animations: fade-in + slide-up (staggered)
- Hover effects: scale(1.02), shadow increase
- Scroll animations: elements animate when entering viewport
- Duration: 300-500ms
- Easing: ease-out

---

## File Structure

```
frontend/src/
├── app/
│   ├── page.tsx                    # Landing page (replace existing)
│   ├── layout.tsx                  # Keep existing, add landing layout logic
│   └── (auth)/                     # Existing auth routes (unchanged)
│       ├── login/
│       └── ...
├── components/
│   └── landing/
│       ├── Header.tsx              # Navigation header
│       ├── Hero.tsx                # Hero section
│       ├── Features.tsx            # Features grid
│       ├── HowItWorks.tsx          # Steps timeline
│       ├── Stats.tsx               # Benefits/numbers
│       ├── ContactForm.tsx         # Lead capture form
│       ├── Footer.tsx              # Footer
│       └── index.ts                # Barrel export
└── lib/
    └── schemas/
        └── contact.ts              # Zod schema for contact form
```

---

## API Requirements

### Contact Form Submission

**Option A: Store in Database**
```typescript
// New table: contact_requests
model ContactRequest {
  id        String   @id @default(uuid())
  name      String
  email     String
  company   String?
  message   String?
  createdAt DateTime @default(now())
  status    String   @default("new") // new, contacted, closed
}

// tRPC procedure
contact.submit({ name, email, company, message })
```

**Option B: Email Notification**
- Send email to admin on form submit
- Use existing email service or Telegram notification

**Recommendation:** Option A (database) for tracking + Option B (notification) for immediate alert

---

## SEO Requirements

### Meta Tags
```typescript
export const metadata: Metadata = {
  title: 'BuhBot - Автоматизация коммуникаций для бухгалтерских фирм',
  description: 'Контролируйте SLA, собирайте обратную связь клиентов и повышайте продуктивность бухгалтеров в 4 раза с Telegram-ботом BuhBot.',
  keywords: ['бухгалтерия', 'автоматизация', 'telegram бот', 'SLA', 'CRM'],
  openGraph: {
    title: 'BuhBot - Автоматизация для бухгалтерских фирм',
    description: 'Telegram-бот для контроля качества обслуживания клиентов',
    url: 'https://buhbot.aidevteam.ru',
    siteName: 'BuhBot',
    locale: 'ru_RU',
    type: 'website',
  },
}
```

### Structured Data
- Organization schema
- SoftwareApplication schema (optional)

### Files
- `/robots.txt` - allow all, sitemap reference
- `/sitemap.xml` - landing page + login

---

## Acceptance Criteria

### Functional
- [ ] Landing page renders at https://buhbot.aidevteam.ru
- [ ] All 6 sections display correctly
- [ ] Navigation scrolls to sections smoothly
- [ ] Contact form validates and submits
- [ ] Form submission stores data or sends notification
- [ ] "Войти" button links to /login
- [ ] Mobile menu works on small screens

### Visual
- [ ] Responsive on all breakpoints (320px, 768px, 1024px, 1280px)
- [ ] Consistent with shadcn/ui design system
- [ ] Animations are smooth and not jarring
- [ ] Images optimized and load quickly
- [ ] No layout shift on load

### Performance
- [ ] Lighthouse Performance ≥90
- [ ] LCP < 2.5s
- [ ] No console errors
- [ ] Bundle size increase < 50KB

### SEO
- [ ] Meta tags present and correct
- [ ] Open Graph tags for social sharing
- [ ] robots.txt and sitemap.xml present

---

## Out of Scope (Phase 2+)

- Testimonials section (need real customer quotes)
- Blog/articles section
- Pricing page
- Multi-language support (English)
- Dark mode toggle
- Cookie consent banner
- Analytics integration (Google Analytics, Yandex Metrika)

---

## Dependencies

### To Add
```bash
npm install framer-motion
```

### Already Available
- next/image - image optimization
- react-hook-form - form handling
- zod - validation
- @radix-ui/* - via shadcn
- lucide-react - icons
- tailwindcss - styling

---

## Reference Examples

For design inspiration:
- https://linear.app - Clean SaaS landing
- https://vercel.com - Modern tech landing
- https://stripe.com - Professional B2B
- https://cal.com - Open source SaaS

---

## Notes for Implementation

1. **Start with mobile-first** - Design for 320px, then scale up
2. **Use Server Components** - Header, Footer, Features can be RSC
3. **Client Components only for** - ContactForm, animations, mobile menu toggle
4. **Optimize images** - Use WebP, proper sizing, next/image
5. **Test on real devices** - Not just browser DevTools
6. **Russian text** - Ensure proper typography for Cyrillic
7. **Accessibility** - Proper heading hierarchy, alt texts, focus states

---

**Document Version:** 1.0
**Created:** 2025-11-24
**For:** BuhBot Phase 1.7 - Landing Page
**Next Step:** Run `/speckit.specify` with this prompt
