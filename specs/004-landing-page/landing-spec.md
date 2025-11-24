# BuhBot Landing Page — Technical Specification

**Version**: 1.0
**Date**: 2025-11-24
**Status**: ✅ Approved
**Branch**: `004-landing-page`

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [data-model.md](./data-model.md) | Prisma schema for `ContactRequest` model |
| [contracts/contact.ts](./contracts/contact.ts) | tRPC router contract (input/output types) |
| [quickstart.md](./quickstart.md) | Local development setup guide |
| [tasks.md](./tasks.md) | Granular task breakdown (optional reference) |
| [spec.md](./spec.md) | Original business requirements |
| [research.md](./research.md) | Technical decisions and rationale |

**Primary document for implementation: This file (`landing-spec.md`)**

---

## 1. Purpose & Goals

### Primary Goal
Convert first-time visitors into demo requests (leads) by clearly communicating BuhBot's value proposition within 30 seconds.

### Secondary Goals
- Establish trust and credibility for B2B audience (accounting firms)
- Provide quick access to login for existing users
- Achieve 90+ Lighthouse performance score

### Target Audience
- **Primary**: Decision makers at accounting firms (owners, managing partners, operations directors)
- **Secondary**: IT specialists evaluating solutions for accounting firms
- **Tertiary**: Existing BuhBot users accessing the dashboard

### Key Metrics (Success Criteria)
- Demo request conversion rate: >3%
- Time to understand value proposition: <30 seconds
- Bounce rate: <50%
- Mobile usability: 100% functional

---

## 2. Page Structure

### Section Order (Top to Bottom)

| # | Section | Purpose | Estimated Height |
|---|---------|---------|------------------|
| 1 | Header | Navigation + Login CTA | Fixed, ~64-80px |
| 2 | Hero | Hook + Primary CTA | 100vh (full screen) |
| 3 | Problem/Pain Points | Empathy + Problem awareness | ~50vh |
| 4 | Features | Solution capabilities | ~100vh |
| 5 | How It Works | Process clarity | ~80vh |
| 6 | Benefits/Results | Proof + outcomes | ~60vh |
| 7 | Social Proof | Trust building | ~40vh |
| 8 | Contact/CTA | Lead capture | ~60vh |
| 9 | Footer | Links + legal | ~200px |

---

## 3. Section Specifications

### 3.1 Header

**Goal**: Navigation + quick access to login

**Content**:
- Logo (left): "BuhBot" wordmark
- Navigation links (center): Возможности | Как это работает | Результаты | Контакты
- CTA button (right): "Войти" (Login)

**Behavior**:
- Sticky on scroll (appears after scrolling past hero)
- Mobile: hamburger menu
- Smooth scroll to sections on click

---

### 3.2 Hero Section

**Goal**: Instant value proposition + emotional hook

**Content Structure**:

```
[Badge/Label]
Для бухгалтерских фирм

[Main Headline]
Клиенты ждут ответа.
Вы контролируете время.

[Subheadline]
BuhBot автоматически отслеживает время ответа бухгалтеров
и уведомляет о приближении дедлайна — прежде чем клиент
успеет пожаловаться.

[Primary CTA Button]
Запросить демо →

[Secondary Link]
Узнать как это работает ↓

[Optional: Hero Visual]
Abstract visualization or screenshot showing the concept
```

**Key Messages**:
- Pain point acknowledgment: clients waiting for responses
- Solution: control over response time
- Mechanism: automatic tracking + proactive alerts

---

### 3.3 Problem/Pain Points Section

**Goal**: Create emotional resonance by articulating problems the audience faces

**Section Title**: "Знакомо?" or "Это про вашу фирму?"

**Pain Points (3-4 cards)**:

| Icon | Problem | Description |
|------|---------|-------------|
| ⏰ | Забытые сообщения | Клиент написал в Telegram, бухгалтер увидел, но забыл ответить. Через 3 дня — жалоба руководителю. |
| 😤 | Негативные отзывы | "Долго отвечают" — частая причина ухода клиентов. Узнаёте последними. |
| 📊 | Слепая зона | Сколько обращений в день? Какое среднее время ответа? Кто из бухгалтеров перегружен? Данных нет. |
| 🔥 | Тушение пожаров | Вместо стратегического развития — разбор конфликтов и извинения перед клиентами. |

**Transition**: "BuhBot решает эти проблемы автоматически"

---

### 3.4 Features Section

**Goal**: Show specific capabilities that solve the problems

**Section Title**: "Возможности" or "Что умеет BuhBot"

**Features (6 items)**:

| Icon | Feature | Short Description |
|------|---------|-------------------|
| ⏱️ | SLA-мониторинг | Автоматический учёт времени ответа с учётом рабочих часов, выходных и праздников |
| 🔔 | Умные алерты | Предупреждения о приближении дедлайна бухгалтеру и руководителю — до нарушения SLA |
| 📈 | Аналитика | Дашборд с метриками: среднее время ответа, SLA compliance, нагрузка по бухгалтерам |
| 💬 | Telegram-интеграция | Работает прямо в Telegram — без установки нового софта для бухгалтеров |
| 📝 | Шаблоны ответов | Готовые ответы на частые вопросы — быстрее реакция, меньше рутины |
| 📊 | Обратная связь | Квартальные опросы NPS клиентов с анонимной аналитикой |

**Layout**: 2x3 grid or 3x2 grid depending on viewport

---

### 3.5 How It Works Section

**Goal**: Make the solution feel simple and achievable

**Section Title**: "Как это работает"

**Steps (4)**:

| Step | Icon | Title | Description |
|------|------|-------|-------------|
| 01 | 🔗 | Подключение | Добавьте BuhBot в ваши клиентские Telegram-чаты. Занимает 5 минут. |
| 02 | ⚙️ | Настройка | Укажите SLA-пороги (например, 2 часа), рабочее время и праздники. |
| 03 | 📡 | Мониторинг | BuhBot автоматически отслеживает каждое обращение и время ответа. |
| 04 | ✅ | Результат | Бухгалтеры получают напоминания, вы — аналитику и спокойствие. |

**Visual**: Numbered steps with connecting line/arrows

---

### 3.6 Benefits/Results Section

**Goal**: Quantify the value, show proof of results

**Section Title**: "Результаты наших клиентов" or "Что получают клиенты"

**Stats (4)**:

| Number | Metric | Context |
|--------|--------|---------|
| 4× | Быстрее ответы | С шаблонами и напоминаниями |
| 90%+ | SLA compliance | После 1 месяца использования |
| −60% | Просроченных обращений | Среднее снижение |
| 0 | Забытых сообщений | При включенном мониторинге |

**Note**: These are aspirational/projected metrics. Consider adding disclaimer "по данным пилотных внедрений" or similar.

---

### 3.7 Social Proof Section

**Goal**: Build trust through third-party validation

**Section Title**: "Отзывы клиентов"

**Testimonials (3)**:

**Testimonial 1:**
```
"Раньше я узнавала о просроченных обращениях от самих клиентов —
уже с претензией. Теперь вижу всё в реальном времени и успеваю
вмешаться до конфликта. За 3 месяца ни одной жалобы на скорость."

— Елена Сергеева
Управляющий партнёр, ООО "Финансовый Советник"
г. Екатеринбург
```

**Testimonial 2:**
```
"У нас 4 бухгалтера и 80+ клиентов. Было невозможно отследить,
кто кому ответил. BuhBot показал, что 15% обращений 'терялись'.
Сейчас потерь ноль, а среднее время ответа упало с 6 часов до 1.5."

— Андрей Козлов
Директор, БухгалтерияПро
г. Новосибирск
```

**Testimonial 3:**
```
"Внедрили за день, без обучения сотрудников — всё работает
в привычном Telegram. Бухгалтеры даже не заметили изменений,
а я наконец-то получил нормальную аналитику по нагрузке."

— Дмитрий Волков
IT-директор, Группа компаний "Учёт и Право"
г. Москва
```

**Stats Bar** (below testimonials):
| 50+ | 10,000+ | 12 |
|-----|---------|-----|
| Бухгалтерских фирм | Обработанных обращений | Регионов России |

**Layout**: Testimonial cards in horizontal scroll or 3-column grid

---

### 3.8 Contact/CTA Section

**Goal**: Capture leads

**Section Title**: "Запросите демо"

**Content**:
```
[Headline]
Готовы контролировать время ответа?

[Subheadline]
Оставьте заявку — мы покажем BuhBot в действии
и поможем настроить под вашу фирму.

[Form]
- Имя* (text)
- Email* (email)
- Компания (text, optional)
- Сообщение (textarea, optional)

[Submit Button]
Запросить демо →

[Alternative Contact]
Или напишите нам: @buhbot_support | contact@aidevteam.ru
```

**Form Behavior**:
- Client-side validation (Zod)
- Success state: "Спасибо! Мы свяжемся с вами в течение 24 часов."
- Error state: Clear error messages in Russian
- Honeypot field for spam protection

---

### 3.9 Footer

**Goal**: Navigation, legal, secondary info

**Content**:
```
Left Column:
- BuhBot logo
- Tagline: "Автоматизация коммуникаций для бухгалтерских фирм"

Center Column (Links):
- Возможности
- Как это работает
- Контакты
- Войти

Right Column (Contact):
- Telegram: @buhbot_support
- Email: contact@aidevteam.ru

Bottom:
© 2025 AIDevTeam. Все права защищены.
```

---

## 4. Navigation & User Flows

### Primary Flow (New Visitor → Lead)
```
Hero → Scroll/Explore → Features/HowItWorks → Contact Form → Submit
```

### Secondary Flow (Existing User → Dashboard)
```
Hero → Header "Войти" → /login → Auth → /dashboard
```

### Navigation Links Behavior
| Link | Target |
|------|--------|
| Возможности | Scroll to Features section |
| Как это работает | Scroll to How It Works section |
| Результаты | Scroll to Benefits section |
| Контакты | Scroll to Contact section |
| Войти | Navigate to /login |

---

## 5. Content Guidelines

### Language
- **All content in Russian**
- Formal but approachable tone (вы-form)
- Technical terms explained simply
- Focus on outcomes, not features

### Copywriting Principles
1. **Lead with pain**: Acknowledge problems before presenting solutions
2. **Be specific**: "2 часа" not "быстро", "70%" not "значительно"
3. **Show, don't tell**: Describe scenarios, not abstract benefits
4. **Create urgency without pressure**: "Узнайте, сколько обращений вы теряете"

### Content Gaps to Fill
- [ ] Final headline/subheadline (pending approval)
- [ ] Real testimonials (if available)
- [ ] Exact stats from pilot implementations
- [ ] Legal pages (Privacy Policy, Terms — if required)

---

## 6. Technical Requirements

### SEO
- Unique title and meta description
- Single H1 (Hero headline)
- Proper heading hierarchy (H2 for sections, H3 for subsections)
- Alt text for all images
- robots.txt and sitemap.xml

### Performance
- First Contentful Paint: <1.5s
- Largest Contentful Paint: <2.5s
- Total Blocking Time: <300ms
- Lighthouse Performance: >90

### Accessibility
- Keyboard navigation for all interactive elements
- ARIA labels for icon-only buttons
- Color contrast: WCAG AA minimum
- Focus states visible

### Mobile
- Fully responsive (320px - 1920px)
- Touch-friendly tap targets (min 44x44px)
- Mobile menu for header navigation
- Form usable on mobile keyboards

---

## 7. Legal Requirements (Russian Federation)

### Required Legal Pages

Per Federal Law No. 152-FZ "On Personal Data" and Federal Law No. 149-FZ "On Information":

**7.1 Privacy Policy (Политика конфиденциальности)**

Must include:
- Operator identity (AIDevTeam, legal name, address, contact)
- Categories of personal data collected (name, email, company, message)
- Purposes of data processing (responding to demo requests, marketing with consent)
- Legal basis for processing (consent via form submission)
- Data storage period (specify retention period, e.g., 3 years)
- Third-party disclosure (Supabase as processor, hosting providers)
- Data subject rights (access, correction, deletion, withdrawal of consent)
- Cross-border transfer notice (if Supabase servers outside Russia)
- Contact for data protection inquiries

**7.2 User Agreement / Terms of Service (Пользовательское соглашение)**

Must include:
- Service description
- User obligations
- Intellectual property rights
- Limitation of liability
- Dispute resolution (Russian courts jurisdiction)
- Agreement modification procedure

**7.3 Consent Mechanism**

Contact form must include:
- Checkbox: "Даю согласие на обработку персональных данных в соответствии с Политикой конфиденциальности"
- Link to Privacy Policy
- Form cannot be submitted without consent checkbox checked

**7.4 Footer Legal Links**

Required links in footer:
- Политика конфиденциальности
- Пользовательское соглашение

**7.5 Cookie Notice (if cookies used)**

If analytics/tracking cookies are implemented:
- Cookie consent banner required
- Option to accept/reject non-essential cookies

---

## 8. Delivery Specification for Development Team

### 8.1 Project Structure

Deliver the landing page in the following structure:

```
frontend/src/
├── app/
│   ├── page.tsx                    # Main landing page (replace existing)
│   ├── login/
│   │   └── page.tsx                # Login page with Supabase redirect
│   ├── privacy/
│   │   └── page.tsx                # Privacy Policy page
│   └── terms/
│       └── page.tsx                # Terms of Service page
│
├── components/
│   └── landing/
│       ├── index.ts                # Barrel export
│       ├── Header.tsx              # Sticky header with navigation
│       ├── Hero.tsx                # Hero section (full viewport)
│       ├── PainPoints.tsx          # Problem/Pain points section
│       ├── Features.tsx            # Features grid (6 items)
│       ├── HowItWorks.tsx          # 4-step process
│       ├── Benefits.tsx            # Stats/results section
│       ├── Testimonials.tsx        # Social proof with testimonials
│       ├── ContactForm.tsx         # Lead capture form
│       └── Footer.tsx              # Footer with links
│
├── lib/
│   └── schemas/
│       └── contact.ts              # Zod schema for contact form
│
└── public/
    ├── images/
    │   └── landing/                # Landing page images (if any)
    ├── robots.txt                  # SEO robots file
    └── sitemap.xml                 # SEO sitemap
```

### 8.2 Technology Stack (Must Use)

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js | 16.x (App Router) |
| Language | TypeScript | 5.x (strict mode) |
| Styling | Tailwind CSS | 4.x |
| UI Components | shadcn/ui | Latest |
| Animations | Framer Motion | Latest |
| Form Handling | React Hook Form | 7.x |
| Validation | Zod | 3.x |
| Icons | Lucide React | Latest |

### 8.3 File Requirements

**Each component file must include:**
- TypeScript with proper types (no `any`)
- "use client" directive where needed (interactive components)
- Responsive design (mobile-first, breakpoints: sm/md/lg/xl)
- Russian content as specified in this document
- Accessibility: ARIA labels, keyboard navigation, focus states

**Naming conventions:**
- Components: PascalCase (e.g., `ContactForm.tsx`)
- Functions: camelCase
- CSS classes: Tailwind utilities only (no custom CSS unless absolutely necessary)

### 8.4 Backend Integration Points

The landing connects to existing backend at `backend/`:

**Contact form submission:**
- Endpoint: tRPC mutation `contact.submit`
- Location: `backend/src/api/trpc/routers/contact.ts` (to be created)
- Sends Telegram notification on successful submission

**Authentication:**
- Login page redirects to Supabase Auth
- After auth, redirect to `/dashboard`

### 8.5 Acceptance Criteria

**Functional Requirements:**
- [ ] All 9 sections render correctly
- [ ] Navigation links scroll smoothly to sections
- [ ] Mobile hamburger menu works
- [ ] Contact form validates and submits
- [ ] Login button navigates to /login
- [ ] Privacy/Terms pages accessible and contain required content
- [ ] All content is in Russian

**Technical Requirements:**
- [ ] `pnpm type-check` passes with zero errors
- [ ] `pnpm build` completes successfully
- [ ] Lighthouse Performance score ≥90
- [ ] Lighthouse Accessibility score ≥90
- [ ] No console errors in browser
- [ ] Responsive on 320px, 768px, 1024px, 1440px viewports

**Visual Requirements:**
- [ ] Matches approved design (if design phase completed)
- [ ] Animations are smooth (60fps)
- [ ] No layout shifts on load
- [ ] Images optimized (Next.js Image component)

### 8.6 Handoff Checklist

Before submitting, ensure:

```
[ ] All files placed in correct directories per 8.1
[ ] TypeScript strict mode passes
[ ] Build passes without errors
[ ] All sections implemented per specification
[ ] Russian content matches this document
[ ] Legal pages created (Privacy, Terms)
[ ] Contact form consent checkbox implemented
[ ] Mobile responsive tested
[ ] Accessibility basics verified (keyboard nav, focus states)
[ ] No hardcoded secrets or credentials
[ ] Images in /public/images/landing/ (if any)
[ ] robots.txt and sitemap.xml created
```

### 8.7 Review Process

After delivery:

1. **Automated checks**: CI runs type-check, build, lint
2. **Code review**: Architecture and code quality review
3. **Functional testing**: Manual verification of all acceptance criteria
4. **Performance audit**: Lighthouse audit on deployed preview
5. **Feedback**: Issues logged, iteration if needed
6. **Merge**: Approved code merged to main branch

---

## 9. Approval Status

| Item | Status |
|------|--------|
| Hero headline | ✅ Approved |
| Pain Points section | ✅ Approved (include) |
| Social Proof section | ✅ Approved (with testimonials) |
| Projected metrics | ✅ Approved |
| Alternative contacts | ✅ Approved (Telegram + email) |
| Legal requirements | ✅ Approved (Russian law) |
| Delivery specification | ✅ Added |

---

**Document Status: READY FOR IMPLEMENTATION**

Next steps:
1. Optional: Design specification (visual style, colors, typography, animations)
2. Development team implements per this specification
3. Review and acceptance per Section 8.7
