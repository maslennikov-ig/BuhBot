# Landing Page Fixup Prompt

**Date**: 2025-11-25
**Status**: 2 blocking issues, 3 warnings
**Priority**: HIGH - Required before production deployment

---

## Executive Summary

Landing page implementation is **95% complete** with excellent code quality. Two blocking issues and three warnings need resolution before production deployment. Estimated fix time: **30 minutes**.

---

## BLOCKING ISSUES (Must Fix)

### 1. Missing Database Migration for ContactRequest

**Priority**: CRITICAL - BLOCKING PRODUCTION
**Impact**: Contact form submissions will fail (500 error)
**Root Cause**: Migration file not created/committed

**Fix**:

```bash
cd /home/me/code/bobabuh/backend
pnpm prisma migrate dev --name add_contact_requests
pnpm prisma generate
```

**Verify**:

```bash
# Check migration was created
ls -la backend/prisma/migrations/ | grep contact

# Test database connection
pnpm prisma migrate status
```

---

### 2. Missing SEO Metadata

**Priority**: HIGH - Required for search visibility
**Impact**: Poor search engine indexing, no social media previews
**File**: `/home/me/code/bobabuh/frontend/src/app/page.tsx`

**Current State**: No metadata export

**Required Fix**: Add metadata export at top of file (after imports, before component):

```typescript
import type { Metadata } from "next";
import {
  Header,
  Hero,
  PainPoints,
  Features,
  HowItWorks,
  Benefits,
  Testimonials,
  ContactForm,
  Footer,
} from '@/components/landing';

export const metadata: Metadata = {
  title: "BuhBot - Автоматизация коммуникаций для бухгалтерских фирм",
  description: "SLA-мониторинг ответов бухгалтеров в Telegram. Автоматические напоминания о приближении дедлайна. Контролируйте время реакции на обращения клиентов.",
  keywords: [
    "бухгалтерия",
    "telegram бот",
    "sla мониторинг",
    "автоматизация бухгалтерии",
    "контроль времени ответа",
  ],
  openGraph: {
    title: "BuhBot - Контроль времени ответа бухгалтеров",
    description: "Автоматическое отслеживание SLA в Telegram-чатах с умными алертами",
    url: "https://buhbot.aidevteam.ru",
    siteName: "BuhBot",
    locale: "ru_RU",
    type: "website",
  },
};

export default function LandingPage() { ... }
```

---

## WARNINGS (Should Fix)

### 3. Add Type-Check Script to package.json

**Priority**: MEDIUM - CI/CD improvement
**File**: `/home/me/code/bobabuh/frontend/package.json`

Add to scripts section:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "type-check": "tsc --noEmit"
}
```

**Verify**:

```bash
cd frontend
pnpm type-check
```

---

### 4. Improve Accessibility (ARIA Labels)

**Priority**: MEDIUM - Accessibility compliance

**A. Hero.tsx** - Add labels to CTA buttons (lines 85-99):

```typescript
<button
  onClick={...}
  aria-label="Запросить демонстрацию BuhBot"
  className="group relative inline-flex..."
>
  <span>Запросить демо</span>
</button>
```

**B. Header.tsx** - Add labels to navigation links:

```typescript
<a
  href={link.href}
  onClick={(e) => scrollToSection(e, link.href)}
  aria-label={`Перейти к разделу: ${link.name}`}
  className="text-sm font-medium..."
>
  {link.name}
</a>
```

---

## Validation Checklist

After applying fixes:

### 1. Database Migration

```bash
cd backend
pnpm prisma migrate status
# Should show: Database schema is up to date!
```

### 2. Type Check

```bash
cd frontend
pnpm type-check
# Should complete with no errors
```

### 3. Build Test

```bash
cd frontend
pnpm build
# Should build successfully
```

### 4. Manual Testing

```bash
# Terminal 1: Backend
cd backend && pnpm dev

# Terminal 2: Frontend
cd frontend && pnpm dev

# Open http://localhost:3000
```

**Test Cases**:

- [ ] Landing page loads without errors
- [ ] Contact form submits successfully
- [ ] Telegram notification received
- [ ] Login link navigates to /login
- [ ] SEO metadata visible in page source

---

## Timeline Estimate

| Task                   | Time           |
| ---------------------- | -------------- |
| Run database migration | 2 min          |
| Add SEO metadata       | 10 min         |
| Add type-check script  | 1 min          |
| Add aria-labels        | 15 min         |
| Testing                | 10 min         |
| **Total**              | **~30-40 min** |

---

**Ready for Production After**: All blocking issues resolved
