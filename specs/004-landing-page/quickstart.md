# Quickstart: BuhBot Landing Page

**Date**: 2025-11-24
**Feature**: 004-landing-page

## Prerequisites

- Node.js 20.x LTS
- pnpm (package manager)
- PostgreSQL database (Supabase)
- Telegram bot token configured

## Quick Setup

### 1. Database Migration

```bash
cd backend
pnpm prisma migrate dev --name add_contact_requests
pnpm prisma generate
```

### 2. Environment Variables

Ensure these exist in `backend/.env`:

```env
# Already configured (from infrastructure setup)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
TELEGRAM_BOT_TOKEN=...

# Manager notification (add if not present)
TELEGRAM_MANAGER_CHAT_ID=123456789  # Telegram chat ID for notifications
```

### 3. Start Development

```bash
# Terminal 1: Backend
cd backend
pnpm dev

# Terminal 2: Frontend
cd frontend
pnpm dev
```

### 4. Verify Landing Page

Open http://localhost:3000 - should see landing page instead of default Next.js template.

## Key Files to Create

### Frontend

| File                                              | Purpose                        |
| ------------------------------------------------- | ------------------------------ |
| `frontend/src/app/page.tsx`                       | Landing page (replace default) |
| `frontend/src/app/login/page.tsx`                 | Login page (new route)         |
| `frontend/src/components/landing/Header.tsx`      | Navigation header              |
| `frontend/src/components/landing/Hero.tsx`        | Hero section                   |
| `frontend/src/components/landing/Features.tsx`    | Features grid                  |
| `frontend/src/components/landing/HowItWorks.tsx`  | Steps section                  |
| `frontend/src/components/landing/Benefits.tsx`    | Stats section                  |
| `frontend/src/components/landing/ContactForm.tsx` | Contact form                   |
| `frontend/src/components/landing/Footer.tsx`      | Footer                         |

### Backend

| File                                           | Purpose                  |
| ---------------------------------------------- | ------------------------ |
| `backend/prisma/schema.prisma`                 | Add ContactRequest model |
| `backend/src/api/trpc/routers/contact.ts`      | Contact form router      |
| `backend/src/api/trpc/router.ts`               | Register contact router  |
| `backend/src/services/notification/contact.ts` | Telegram notification    |

## Testing Checklist

- [ ] Landing page renders at `/`
- [ ] All sections visible (hero, features, how-it-works, benefits, contact, footer)
- [ ] Navigation links scroll to sections
- [ ] Mobile menu opens/closes
- [ ] Contact form validates inputs
- [ ] Contact form submits successfully
- [ ] Telegram notification received
- [ ] Login link navigates to `/login`
- [ ] Responsive design works (320px-1920px)

## Content Sections (Russian)

### Hero

- Headline: "BuhBot — автоматизация коммуникаций для бухгалтерских фирм"
- Subheadline: Focus on SLA monitoring and response time improvement

### Features (6 items)

1. SLA-мониторинг в реальном времени
2. AI-классификация сообщений
3. Telegram-интеграция
4. Автоматические напоминания
5. Аналитика и отчёты
6. Многопользовательский доступ

### How It Works (4 steps)

1. Подключение Telegram-чатов
2. Настройка SLA-параметров
3. Автоматический мониторинг
4. Получение уведомлений и отчётов

### Benefits (4 stats)

1. В 4 раза быстрее обработка
2. 90%+ соблюдение SLA
3. -60% просроченных обращений
4. 24/7 мониторинг

## Common Issues

### Form not submitting

- Check backend is running on port 4000
- Verify tRPC endpoint at `/api/trpc`
- Check browser console for errors

### Telegram notification not received

- Verify `TELEGRAM_MANAGER_CHAT_ID` is set
- Check bot has permission to send messages
- Review backend logs for Telegraf errors

### Styles not applying

- Run `pnpm dev` (not `npm run dev`)
- Clear `.next` cache: `rm -rf frontend/.next`
- Verify Tailwind config includes landing components path
