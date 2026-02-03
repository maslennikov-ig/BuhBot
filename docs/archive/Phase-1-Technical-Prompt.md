# BuhBot - Phase 1 Implementation Prompt

**Project:** BuhBot - Accounting Firm Client Communication Automation Platform
**Phase:** Phase 1 - CORE + QUICK WINS
**Duration:** 6-8 weeks (extended due to scope additions)
**Budget:** ₽1,420,000 (~$15,000 USD)

**Last Updated:** 2025-11-27
**Architecture Version:** Hybrid Deployment (Supabase Cloud + First VDS)
**Current Version:** v0.2.9

---

## Project Status (As of 2025-11-27)

**Overall Progress:** ~90% complete. Core functionality fully deployed. Remaining: Admin Panel CRUD pages (FAQ, Templates, Users), Documentation.

### Completed Modules:

| Module                                        | Status  | Version | Notes                            |
| --------------------------------------------- | ------- | ------- | -------------------------------- |
| **MODULE 1.1: SLA Monitoring System**         | ✅ 100% | v0.1.16 | Fully functional                 |
| **MODULE 1.2: Quarterly Feedback Collection** | ✅ 100% | v0.2.0  | Surveys, NPS, Alerts             |
| **MODULE 1.3: Quick Wins**                    | ✅ 100% | v0.2.0  | Buttons, Templates, FAQ          |
| **MODULE 1.5: Infrastructure & Security**     | ✅ 100% | v0.1.16 | VDS + Supabase deployed          |
| **MODULE 1.7: Landing Page**                  | ✅ 100% | v0.2.0  | Full premium design              |
| **MODULE 1.8: Onboarding & Dashboard**        | ✅ 100% | v0.2.9  | NEW - Wizard + Real-time metrics |

### Partially Completed Modules:

| Module                      | Status  | Remaining                             |
| --------------------------- | ------- | ------------------------------------- |
| **MODULE 1.4: Admin Panel** | 🟡 ~80% | FAQ/Template/User Management UI pages |

### Not Started:

| Module                                   | Status | Hours |
| ---------------------------------------- | ------ | ----- |
| **MODULE 1.6: Documentation & Training** | ❌ 0%  | 40h   |

### Next Steps (Priority Order):

1. **MODULE 1.4** - Complete Admin Panel CRUD pages (FAQ, Templates, Users)
2. **Feature 006** - Telegram Login Integration (spec ready)
3. **MODULE 1.6** - Documentation & Team Training

### Deployment Status:

- **Production URL:** https://buhbot.aidevteam.ru ✅
- **API Health:** https://buhbot.aidevteam.ru/health ✅
- **Grafana:** http://185.200.177.180:3002 ✅
- **SSL:** Let's Encrypt ✅

---

## Recent Releases

### v0.2.9 (2025-11-27) - Onboarding & Dashboard Complete

- ✅ Onboarding Wizard (Bot Token, Working Hours, SLA)
- ✅ Real-Time Dashboard with live tRPC data (30s polling)
- ✅ Settings Management (General, Schedule, Notifications)
- ✅ Premium Auth UI (Aurora background, glassmorphism)
- ✅ Legal Pages (Privacy Policy, Terms of Service)
- ✅ Theme Toggle (Dark/Light mode)
- ✅ Profile Settings page

### v0.2.0 (2025-11-24) - Client Feedback & Quick Wins

- ✅ Quarterly feedback surveys (Telegram bot)
- ✅ Survey management (Admin Panel)
- ✅ Low rating alerts
- ✅ Client inline menu (/menu command)
- ✅ Template library (/template command)
- ✅ FAQ auto-responses
- ✅ File receipt confirmation
- ✅ NPS analytics dashboard

### v0.1.16 (2025-11-22) - Infrastructure Foundation

- ✅ Hybrid VDS + Supabase infrastructure deployed
- ✅ CI/CD pipeline (GitHub Actions)
- ✅ Monitoring (Prometheus + Grafana + Uptime Kuma)
- ✅ Security (HTTPS, RLS, fail2ban)
- ✅ SLA Monitoring system functional

---

## Mission Statement

Build a Telegram-based automation platform for accounting firms to monitor service quality (SLA), collect client feedback, and dramatically improve communication efficiency through intelligent automation and quick-response features.

---

## Core Objectives

### Business Goals

1. **Transparency:** 100% visibility into accountant response times
2. **Client Satisfaction:** Regular feedback collection with early problem detection
3. **Efficiency:** 4x productivity increase for accountants through automation
4. **Retention:** Foundation for 15-20% client retention improvement
5. **ROI:** 3-4 month payback period

### Technical Goals

1. Real-time SLA monitoring with working hours awareness
2. Automated quarterly feedback collection with anonymity
3. Intelligent spam filtering (distinguish real requests from "Thanks!" messages)
4. Quick-response system (buttons, FAQ auto-responses, templates)
5. Unified admin panel for management and analytics
6. Secure data handling with industry-standard encryption and authentication

---

## Architecture

### Stack (Current)

- **Backend:** Node.js 20+ (TypeScript strict mode), Express 5.1, Prisma 7
- **API:** tRPC v11 (type-safe)
- **Database:** Supabase Cloud (PostgreSQL 15+)
- **Cache/Queue:** Redis + BullMQ
- **Bot Framework:** Telegraf 4.16
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **UI Components:** shadcn/ui (Radix primitives)
- **AI/NLP:** OpenRouter API (spam classification)
- **Hosting:** First VDS (Russian VDS, 152-ФЗ compliance)

### Infrastructure (Hybrid Deployment)

**Supabase Cloud (EU region):**

- PostgreSQL 15+ database (managed)
- Supabase Auth (JWT)
- Row Level Security (RLS)
- Automatic backups (PITR)

**First VDS Server:**

- Node.js Telegram Bot application
- BullMQ workers (alerts, surveys, reminders)
- Redis (queue management)
- Nginx reverse proxy (SSL)
- Prometheus + Grafana (monitoring)
- Docker Compose deployment

---

## MODULE 1.1: SLA Monitoring System [COMPLETED ✅]

**Status:** ✅ 100% Complete | **Version:** v0.1.16

### Features Implemented:

- ✅ Webhook integration with Telegram Bot API
- ✅ AI spam filter (OpenRouter + keyword fallback)
- ✅ Working hours calendar with Russian holidays
- ✅ SLA timer with pause outside working hours
- ✅ Manager alerts on SLA breach
- ✅ Escalation reminders
- ✅ Admin Panel SLA configuration

---

## MODULE 1.2: Quarterly Feedback Collection [COMPLETED ✅]

**Status:** ✅ 100% Complete | **Version:** v0.2.0

### Features Implemented:

- ✅ Automated quarterly surveys (cron job)
- ✅ 1-5 star rating with inline buttons
- ✅ Optional comments
- ✅ Anonymity (accountant sees aggregates only)
- ✅ Low rating alerts to manager
- ✅ NPS analytics dashboard
- ✅ Manual survey trigger
- ✅ Survey management UI

---

## MODULE 1.3: Quick Wins [COMPLETED ✅]

**Status:** ✅ 100% Complete | **Version:** v0.2.0

### Features Implemented:

- ✅ Client inline buttons (/menu command)
- ✅ Accountant status buttons
- ✅ FAQ auto-responses (25 FAQs)
- ✅ File receipt confirmation
- ✅ Response templates library (/template command)
- ✅ Variable substitution in templates

---

## MODULE 1.4: Unified Admin Panel [PARTIALLY COMPLETED 🟡]

**Status:** 🟡 ~80% Complete

### Completion Status:

| Subsection                   | Status     | Notes                           |
| ---------------------------- | ---------- | ------------------------------- |
| 1.4.1 Authentication & Roles | ✅ Done    | Supabase Auth + RLS             |
| 1.4.2 Main Dashboard         | ✅ Done    | Real-time widgets (v0.2.9)      |
| 1.4.3 User Management        | 🟡 Partial | Profile page done, CRUD pending |
| 1.4.4 FAQ Management         | 🟡 Partial | API done, UI page pending       |
| 1.4.5 Template Management    | 🟡 Partial | API done, UI page pending       |
| 1.4.6 Audit Logs             | ❌ TODO    | Not started                     |
| 1.4.7 Global Settings        | ✅ Done    | Full settings page (v0.2.9)     |
| Feedback Pages               | ✅ Done    | v0.2.0                          |
| Survey Pages                 | ✅ Done    | v0.2.0                          |
| Onboarding Wizard            | ✅ Done    | v0.2.9                          |
| Profile Settings             | ✅ Done    | v0.2.9                          |

### Remaining Work:

| Task                            | Priority | Notes                                           |
| ------------------------------- | -------- | ----------------------------------------------- |
| FAQ Management UI Page          | P1       | API exists (faq.ts), need /faq page             |
| Template Management UI Page     | P1       | API exists (templates.ts), need /templates page |
| User/Accountant Management Page | P2       | CRUD for accountants                            |
| Audit Logs                      | P3       | Action logging                                  |

---

## MODULE 1.5: Infrastructure & Security [COMPLETED ✅]

**Status:** ✅ 100% Complete | **Version:** v0.1.16

### Features Implemented:

- ✅ VDS server provisioned (First VDS)
- ✅ Docker + Docker Compose deployment
- ✅ Nginx reverse proxy with Let's Encrypt SSL
- ✅ Supabase Cloud database configured
- ✅ RLS policies for role-based access
- ✅ Prometheus + Grafana monitoring
- ✅ Uptime Kuma health checks
- ✅ GitHub Actions CI/CD
- ✅ Backup strategy (Supabase PITR)
- ✅ Security hardening (fail2ban, UFW)

---

## MODULE 1.6: Documentation & Training [NOT STARTED ❌]

**Status:** ❌ 0% | **Hours:** 40h | **Blocked by:** Feature completion

### Documents to Create:

1. **For Accountants:** "How to Use BuhBot"
2. **For Clients:** "Quick Start Guide"
3. **For Manager:** "Admin Panel Guide"
4. **Technical Documentation:** Architecture, API, Deployment

### Training Sessions:

- Session 1: Accountants (2 hours)
- Session 2: Manager (2 hours)
- Session 3: Follow-up Q&A (1 hour)

---

## MODULE 1.7: Landing Page [COMPLETED ✅]

**Status:** ✅ 100% Complete | **Version:** v0.2.0

### Features Implemented:

- ✅ Hero Section with CTA
- ✅ Features Section (6 feature cards)
- ✅ How It Works (step-by-step flow)
- ✅ Benefits/Stats Section with counter animation
- ✅ Pain Points Section
- ✅ Testimonials
- ✅ Contact Form (with email notification)
- ✅ Header with navigation
- ✅ Footer with legal links
- ✅ Mobile responsive design
- ✅ Dark/Light theme support

---

## MODULE 1.8: Onboarding & Dashboard [COMPLETED ✅] (NEW)

**Status:** ✅ 100% Complete | **Version:** v0.2.9
**Spec:** `/specs/005-onboarding-dashboard/`

### Features Implemented:

**Onboarding Wizard:**

- ✅ Step 1: Bot Token validation (Telegram API)
- ✅ Step 2: Working Hours configuration
- ✅ Step 3: SLA Thresholds
- ✅ Redirect for new users (isOnboardingComplete check)
- ✅ Skip option

**Real-Time Dashboard:**

- ✅ SLA Compliance Widget (donut chart)
- ✅ Response Time Widget (area chart)
- ✅ Violations Widget (counter)
- ✅ Active Alerts Widget (list)
- ✅ Recent Requests Table
- ✅ Live data from tRPC (30s polling)

**Settings Management:**

- ✅ General Settings (Bot, AI confidence)
- ✅ Schedule Settings (Working hours, holidays)
- ✅ Notification Settings

**Auth & Legal:**

- ✅ Premium Login UI (Aurora background)
- ✅ Theme Toggle (Dark/Light)
- ✅ Privacy Policy page
- ✅ Terms of Service page
- ✅ Profile Settings page

---

## Upcoming Features

### Feature 006: Telegram Login Integration

**Status:** Spec Ready | **Priority:** P1
**Spec:** `/docs/specs/006-telegram-login-integration.md`

Replace manual Telegram username input with official Telegram Login Widget for secure identity verification. Enables future role-based notifications.

---

## Remaining Work Summary

| Task                   | Hours    | Priority | Status      |
| ---------------------- | -------- | -------- | ----------- |
| FAQ Management UI      | 8h       | P1       | API ready   |
| Template Management UI | 8h       | P1       | API ready   |
| User Management UI     | 12h      | P2       | Partial     |
| Audit Logs             | 12h      | P3       | Not started |
| Telegram Login (006)   | 16h      | P1       | Spec ready  |
| Documentation          | 24h      | P2       | Not started |
| Training               | 16h      | P2       | Not started |
| **TOTAL REMAINING**    | **~96h** | —        | —           |

---

## Success Metrics (Phase 1)

### KPIs to Measure After 3 Months

1. **SLA Compliance:** Target 90%+ requests answered <1 hour
2. **Client Satisfaction:** Target average rating ≥4.0/5
3. **Efficiency Gains:** Target 30% reduction in response time
4. **Adoption:** Target 60%+ accountants use templates regularly
5. **ROI:** Target 3-4 month payback period

---

## Tech Stack Summary

### Backend (Node.js on First VDS)

- **Runtime:** Node.js 20+ (TypeScript strict mode)
- **Framework:** Express 5.1
- **ORM:** Prisma 7 (driver adapter pattern)
- **API:** tRPC v11 (type-safe)
- **Queue:** BullMQ with Redis
- **Validation:** Zod
- **Logging:** Winston

### Frontend (Next.js Admin Panel)

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** Tailwind CSS 4 + shadcn/ui
- **State:** React 19
- **Auth:** Supabase Auth (JWT)
- **API Client:** tRPC React Query

### Bot (Telegram)

- **Library:** Telegraf 4.16
- **State:** Redis
- **Queue:** BullMQ

### Database & Auth (Supabase Cloud)

- **Database:** PostgreSQL 15+
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **RLS:** Row Level Security policies

### DevOps

- **CI/CD:** GitHub Actions
- **Containers:** Docker + Docker Compose
- **Reverse Proxy:** Nginx (Let's Encrypt SSL)
- **Monitoring:** Prometheus + Grafana + Uptime Kuma

---

## Production URLs

- **Website:** https://buhbot.aidevteam.ru
- **API Health:** https://buhbot.aidevteam.ru/health
- **Grafana:** http://185.200.177.180:3002
- **Repository:** https://github.com/maslennikov-ig/BuhBot

---

## Key Artifacts

- **Infrastructure:** `specs/001-infrastructure-setup/`
- **SLA Monitoring:** `specs/002-sla-monitoring/`
- **Feedback & Quick Wins:** `specs/003-client-feedback-quick-wins/`
- **Onboarding & Dashboard:** `specs/005-onboarding-dashboard/`
- **Telegram Login (Next):** `docs/specs/006-telegram-login-integration.md`
- **VDS Credentials:** `.tmp/current/vds-credentials.md`

---

**Document Version:** 2.0
**Last Updated:** 2025-11-27
**Current Version:** v0.2.9
**Author:** Claude Code + Igor Maslennikov
