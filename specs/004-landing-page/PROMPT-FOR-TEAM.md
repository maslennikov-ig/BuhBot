# Landing Page Implementation Prompt

Copy and send this entire prompt to the development team.

---

## Task

Implement a production-ready landing page for BuhBot — a communication automation platform for accounting firms.

## Repository

```
Repository: https://github.com/maslennikov-ig/BuhBot
Branch: 004-landing-page
```

Clone and checkout:
```bash
git clone https://github.com/maslennikov-ig/BuhBot.git
cd BuhBot
git checkout 004-landing-page
```

## Primary Specification

**Read this file first — it contains everything you need:**

```
specs/004-landing-page/landing-spec.md
```

This document includes:
- Page structure (9 sections)
- Content for each section (Russian language)
- Technical requirements (SEO, performance, accessibility)
- Legal requirements (Russian 152-FZ compliance)
- Delivery specification (folder structure, tech stack, acceptance criteria)
- Handoff checklist

## Supporting Documents

| File | Purpose |
|------|---------|
| `specs/004-landing-page/data-model.md` | Prisma schema for ContactRequest model |
| `specs/004-landing-page/contracts/contact.ts` | tRPC router contract (types) |
| `specs/004-landing-page/quickstart.md` | Local development setup |

## Tech Stack (Required)

- Next.js 16.x (App Router)
- TypeScript 5.x (strict mode)
- Tailwind CSS 4.x
- shadcn/ui
- Framer Motion (animations)
- React Hook Form + Zod (form handling)
- Lucide React (icons)
- tRPC 11.x (backend API)
- Prisma 7.x (database)

## Deliverables

Create these files per the specification:

```
frontend/src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── login/page.tsx              # Login page
│   ├── privacy/page.tsx            # Privacy Policy
│   └── terms/page.tsx              # Terms of Service
├── components/landing/
│   ├── index.ts                    # Barrel export
│   ├── Header.tsx
│   ├── Hero.tsx
│   ├── PainPoints.tsx
│   ├── Features.tsx
│   ├── HowItWorks.tsx
│   ├── Benefits.tsx
│   ├── Testimonials.tsx
│   ├── ContactForm.tsx
│   └── Footer.tsx
└── lib/schemas/contact.ts          # Zod schema

backend/src/
├── api/trpc/routers/contact.ts     # tRPC router
└── services/notification/contact.ts # Telegram notification

backend/prisma/schema.prisma        # Add ContactRequest model

public/
├── robots.txt
└── sitemap.xml
```

## Acceptance Criteria

Before submitting, verify:

- [ ] `pnpm type-check` passes
- [ ] `pnpm build` passes
- [ ] All 9 sections render correctly
- [ ] Contact form validates and submits
- [ ] Telegram notification works
- [ ] Mobile responsive (320px-1440px)
- [ ] All content in Russian
- [ ] Legal pages created (Privacy, Terms)
- [ ] Lighthouse Performance ≥90
- [ ] Lighthouse Accessibility ≥90

## Design Guidelines

Create a modern, distinctive design that:
- Avoids generic "AI-generated" aesthetics (no purple gradients on white, no Inter/Roboto)
- Uses professional but approachable style suitable for B2B accounting audience
- Implements smooth animations with Framer Motion
- Has clear visual hierarchy and CTAs
- Works perfectly on mobile

## Important Notes

1. **All content is in Russian** — copy text exactly from the specification
2. **Legal compliance** — contact form must have consent checkbox per 152-FZ
3. **Backend integration** — form submits via tRPC to `contact.submit` mutation
4. **Existing auth** — login redirects to Supabase Auth, then to /dashboard
5. **No breaking changes** — existing routes (/dashboard, /feedback, /settings/*) must continue working

## Questions?

If anything is unclear, check `landing-spec.md` first. It contains detailed specifications for every section.

---

**Start by reading:** `specs/004-landing-page/landing-spec.md`
