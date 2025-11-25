# Fixup Prompt - Landing Page Missing Components

---

## Task

Complete the remaining tasks for BuhBot landing page implementation.

## Repository

```
Repository: https://github.com/maslennikov-ig/BuhBot
Branch: 004-landing-page
```

Pull latest changes:
```bash
git pull origin 004-landing-page
```

---

## Critical Issues to Fix

### 1. Create Login Page (CRITICAL)

**File**: `frontend/src/app/login/page.tsx`

**Requirements**:
- Simple page with Supabase Auth redirect
- After authentication, redirect to `/dashboard`
- Use existing Supabase client configuration
- Match existing app styling (use design tokens from other pages)

**Example structure**:
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check if already authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      } else {
        // Redirect to Supabase Auth
        supabase.auth.signInWithOAuth({
          provider: 'github', // or your configured provider
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        });
      }
    });
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">Вход в систему</h1>
        <p>Перенаправление на страницу авторизации...</p>
      </div>
    </div>
  );
}
```

---

### 2. Run Prisma Migration (CRITICAL)

**Commands** (from backend directory):
```bash
cd backend
pnpm prisma migrate dev --name add_contact_requests
pnpm prisma generate
```

This creates the `contact_requests` table in the database.

---

### 3. Verify Login Button in Header

**File**: `frontend/src/components/landing/Header.tsx`

**Check**:
- Does Header have a "Войти" button?
- Does it link to `/login`?
- Is it visible on mobile menu?

**If missing**, add:
```typescript
<Link href="/login" className="...">
  Войти
</Link>
```

---

### 4. Verify Navigation Features

**Files to check**:
- `frontend/src/components/landing/Header.tsx`
- `frontend/src/app/page.tsx`

**Required features**:
1. **Section IDs**: Each section should have `id` attribute (e.g., `id="features"`, `id="how-it-works"`)
2. **Smooth scroll**: Navigation links should scroll to sections smoothly
3. **Sticky header**: Header should stick to top on scroll
4. **Mobile menu**: Hamburger menu with section links

**Example section IDs in page.tsx**:
```typescript
<section id="hero">
  <Hero />
</section>
<section id="pain-points">
  <PainPoints />
</section>
<section id="features">
  <Features />
</section>
// etc.
```

**Example smooth scroll in Header.tsx**:
```typescript
<a href="#features" className="..." onClick={(e) => {
  e.preventDefault();
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
}}>
  Возможности
</a>
```

---

### 5. Verify Contact Form Integration

**Check** (`frontend/src/components/landing/ContactForm.tsx`):
- [ ] Uses tRPC mutation `contact.submit`
- [ ] Has consent checkbox with text: "Даю согласие на обработку персональных данных"
- [ ] Links to `/privacy` in checkbox label
- [ ] Shows success message in Russian after submission
- [ ] Shows error message in Russian on failure

---

## Testing Checklist

After completing fixes, test:

```bash
# 1. Build passes
cd frontend
pnpm build

# 2. Backend builds
cd ../backend
pnpm build

# 3. Start dev servers
pnpm dev  # backend (terminal 1)
cd frontend && pnpm dev  # frontend (terminal 2)

# 4. Manual tests
- Visit http://localhost:3000
- Click "Войти" → should redirect to /login → auth flow
- Fill contact form → submit → check Telegram notification
- Test mobile view (resize browser to 375px width)
- Test all navigation links scroll to sections
```

---

## Acceptance Criteria

Before marking complete:

- [X] Login page created and working
- [X] Prisma migration run successfully
- [X] Login button in Header
- [X] Navigation smooth scrolls to sections
- [X] Mobile menu works
- [X] Contact form submits successfully
- [X] Telegram notification received on form submit
- [X] All content in Russian
- [X] Build passes without errors
- [X] Mobile responsive (320px-1440px)

---

## Reference Documents

- Specification: `specs/004-landing-page/landing-spec.md`
- Status Report: `specs/004-landing-page/STATUS-REPORT.md`
- Original Tasks: `specs/004-landing-page/tasks.md`

---

**Priority Order**: Login page → Prisma migration → Navigation verification → Testing
