# Changelog - BuhBot

All notable changes to BuhBot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **docs**: DEV MODE documentation — README section and [docs/infrastructure/dev-mode.md](docs/infrastructure/dev-mode.md) for local development without Supabase
- Pre-commit hooks with Husky and lint-staged (ESLint + Prettier on staged files) (3888a6e)
- commitlint and commit-msg hook for conventional commits (9f37772)
- Commit conventions doc and agent wiring for Release Please (5b4a989)

### Changed

- **ci**: add format check job (Prettier) (b9c1cec)

### Other

- ADR-001: pre-commit hooks with Husky; CONTRIBUTING and README updates (87fba45)
- chore: add .pnpm-store to .gitignore (f2bf257)
- style: format codebase with Prettier (9a19b09)

## [0.9.19] - 2026-01-30

### Fixed

- **sla**: fix notifyInChatOnBreach and global threshold update (gh-16, gh-17) (6d4cca9)

### Other

- bd sync: 2026-01-30 16:15:39 (073a3b1)
- bd sync: 2026-01-30 16:15:23 (c7e938e)
- **sla**: add timer service unit tests (0316ae9)

## [0.9.18] - 2026-01-30

### Added

- add 1 skill(s), update docs (40c751a)
- implement 4 GitHub issues (gh-8, gh-12, gh-13, gh-15) (a1caee9)

### Changed

- **queues**: centralize BullMQ configuration in queue.config.ts (buh-xch) (2fc9c86)

### Fixed

- resolve 6 P1-P2 production bugs (02e5827)
- **frontend**: fix response time chart overflow on analytics page (5fa9ff8)
- **frontend**: replace empty string values in Select components (922cf38)
- **docker**: revert COPY paths to match CI build context (ce2c8f9)
- **deps**: add winston-transport as direct dependency (15f713f)
- **lint**: resolve TypeScript and ESLint errors for CI (5e91a99)

### Other

- bd sync: 2026-01-30 13:53:46 (5e51087)
- bd sync: 2026-01-30 13:53:20 (013e833)
- bd sync: 2026-01-30 13:26:29 (62901a5)
- bd sync: 2026-01-30 13:25:36 (58e3b22)
- bd sync: 2026-01-30 13:10:32 (60ced73)
- bd sync: 2026-01-30 13:09:26 (b5c4cb5)

## [0.9.17] - 2026-01-16

### Added

- **navigation**: add System Logs item to AdminLayout (buh-xla) (0e8a4f3)
- **frontend**: add complete logs/errors UI with pages and components (buh-mgs, buh-brr) (3fe4d8e)
- **api**: add tRPC logs router for error logs management (buh-zdc) (5e3be7e)
- **logging**: add ErrorCaptureService with MD5 fingerprinting (buh-65g) (8e68351)

### Fixed

- **imports**: use relative paths instead of aliases for build compatibility (62e4127)
- **docker**: add backend/ prefix to COPY paths for correct build context (9173e0d)

### Other

- update docs (c04a5b6)
- bd sync: 2026-01-16 14:35:04 (0229d86)
- bd sync: 2026-01-16 14:32:15 (7b47149)
- bd sync: 2026-01-16 14:30:58 (1a17557)
- bd sync: 2026-01-16 14:29:59 (9a14d9c)
- bd sync: 2026-01-16 14:20:48 (8dea97a)
- bd sync: 2026-01-16 14:15:40 (49a70e5)
- bd sync: 2026-01-16 14:15:29 (474f35d)

## [0.9.16] - 2026-01-16

### Added

- **database**: add ErrorLog model for centralized error tracking (buh-oyj) (7830439)

### Other

- update docs (64ef484)
- bd sync: 2026-01-16 14:05:08 (9ae6e83)
- bd sync: 2026-01-16 14:05:01 (ee91587)

## [0.9.15] - 2026-01-16

### Added

- **.claude/skills/systematic-debugging/condition-based-waiting-example.ts**: add 17 source file(s), add 4 agent(s), +7 more (7cc7cdc)
- add invite_link to Chat model for universal 'Open chat' button support (buh-8tp) (fbf8510)
- notify all accountants from accountantUsernames array (buh-k5a) (484d21f)
- **ci**: add Telegram notification on CI failure (585f6cd)

### Fixed

- **alerts**: send notification to accountant DM instead of group (3b34954)
- **alerts**: use assignedAccountant relation for notify button (5828296)
- **sla**: complete SLA notification system fixes and testing (9e6532a)
- use const for finalUsernames (lint error) (96f4d92)
- auto-add accountant username when assigned via dropdown (65cd4c9)
- **ci**: use lowercase repository name for Docker image tags (ceb08ef)

### Other

- bd sync: 2026-01-16 12:43:49 (61d2fa2)
- bd sync: 2026-01-14 16:45:52 (f62d7db)
- bd sync: 2026-01-14 16:45:34 (e5317aa)
- bd sync: 2026-01-14 16:42:26 (a2e079d)
- bd sync: 2026-01-14 16:17:58 (3e909a4)
- bd sync: 2026-01-14 16:05:52 (71d52d3)
- bd sync: 2026-01-14 15:59:53 (77f05f1)
- bd sync: 2026-01-14 13:40:41 (ad52b54)

## [0.9.14] - 2025-12-25

## [0.9.13] - 2025-12-25

## [0.9.12] - 2025-12-20

### Added

- **deploy**: add pre-flight checks for dependencies and ports (b78cac2)

## [0.9.11] - 2025-12-20

### Fixed

- **ci**: skip telegram notification when deploy is skipped (72ddd72)

## [0.9.10] - 2025-12-20

## [0.9.9] - 2025-12-20

### Added

- **accountants**: add multiple accountant usernames support (8587966)
- **api**: add accountantUsernames array support to chats router (048bf1c)
- **requests**: show accountant response in requests table (2b1b06d)

### Fixed

- **api**: cascade delete chat_message when deleting client_request (5c0a272)

## [0.9.8] - 2025-12-18

### Fixed

- **api**: remove direction param conflict with tRPC infinite query (1d199fa)
- **ci**: sync backend package-lock.json with npm (not pnpm) (0e831df)
- **ci**: regenerate backend package-lock.json for Docker build (bb9175d)

## [0.9.7] - 2025-12-17

### Added

- **agents**: add supabase-fixer agent (7ab2cfe)

### Fixed

- **sla**: use IN operator for enum comparison in Prisma 7 (f923928)

## [0.9.6] - 2025-12-17

### Added

- **sla**: add SLA timer recovery on server restart (e01bacf)

### Fixed

- **webhook**: use explicit POST route for Telegraf middleware (f2081af)
- **webhook**: skip express.json() for Telegram webhook path (1cb266b)
- **deploy**: use pre-built Docker images instead of building on deploy (06718c3)

## [0.9.5] - 2025-12-16

### Added

- **classifier**: improve Russian classification prompt with few-shot examples (dd57b75)

## [0.9.4] - 2025-12-16

### Added

- add chat delete functionality (aa16d15)
- **frontend**: add action buttons for requests management (8fcb1c2)
- **frontend**: add request details page /requests/[id] (6f18dff)

### Fixed

- SLA timer now stops on accountant response + dropdown menu visibility (657da82)
- **bot**: improve accountant detection using User table (7ef66e1)
- **ci**: exclude Docker-created dirs from rsync sync (f130a3d)
- **docker**: switch frontend from Alpine to Debian slim for SWC compatibility (07a9f60)
- **ci**: remove frontend pnpm-lock.yaml for npm-based Docker build (81dc4ec)
- **ci**: sync backend package-lock.json for Docker build (0230312)
- **ci**: resolve ESLint error and sync frontend lock file (7f46e78)

## [0.9.3] - 2025-12-16

### Added

- **classifier**: add metrics, circuit breaker, and message filtering (e152d29)

### Fixed

- **types**: add explicit ClientRequest type to response handler (5fbdabb)
- **docker**: use npm install --legacy-peer-deps instead of npm ci (888aaab)
- **backend**: resolve all audit issues (P0-P3) (7364984)
- **sla**: initialize BullMQ workers for SLA monitoring (70f1698)
- **security**: update Next.js to 16.0.10 - CVE-2025-55182/CVE-2025-66478 (e3e69ca)
- **analytics**: use z.coerce.date() for all date inputs in tRPC (18cb31e)
- resolve TypeScript errors blocking CI (3739160)

## [0.9.2] - 2025-12-14

### Security

- harden frontend container limits and fs permissions (1d8dad9)

### Fixed

- change User.role from enum to String for DB compatibility (5ce7ff0)
- add IPv4-first DNS resolution and diagnostic logging (342e1c3)
- **users**: allow selecting admins as accountants (3c0e188)
- **chats**: enforce strict BOT_USERNAME check for invitations (d60cb8f)

## [0.9.1] - 2025-12-14

### Fixed

- **bot**: enable polling fallback in prod, fix accountant select, add /info command (fc3a244)

## [0.9.0] - 2025-12-14

### Added

- **bot**: add /help command handler (36485d3)

### Changed

- **deploy**: use workflow_run trigger instead of wait-on-check (0dbaf9f)

### Fixed

- **config**: require BOT_USERNAME env var for deep links (7f03672)
- **bot**: reorder handler registration for /menu and /template commands (983c2c8)
- **bot**: correct webhook middleware integration with Express (a031268)
- **bot**: use createWebhook instead of webhookCallback (5436f83)
- **bot**: register webhook route before 404 handler (e5ff392)
- **deploy**: add SSH keepalive to prevent connection timeout (fb1c0eb)
- **deploy**: use root context for frontend Docker build (6c6842e)
- **deploy**: increase wait-on-check timeout to 15 minutes (ca4b9f9)
- **ci**: use default import for logger (b7ee219)
- **ci**: fix eslint errors in notification, user routers and invitation handler (8c4d983)
- **ci**: update pnpm-lock.yaml to include tsx dependency (3f43c80)
- **deploy**: fix secrets context not allowed in step if condition (4f9ef28)
- **ci**: remove CRLF line endings from workflow files (890d2d8)
- **deploy**: update production URL to buhbot.aidevteam.ru (dab885c)

## [0.8.3] - 2025-12-10

### Fixed

- **bot**: integrate Telegram bot initialization into backend entry point (c5b93a9)

## [0.8.2] - 2025-12-04

## [0.8.1] - 2025-12-04

## [0.8.0] - 2025-12-04

### Added

- **hero**: Add light theme and 8 chat scenarios to HeroChatMockup (429a3a6)
- **branding**: Add light theme logo + increase Hero text size (470e29b)
- **landing**: Add animated chat mockup to Hero section (cf6a3ec)
- **branding**: Add logo image to Header, Footer, Auth pages (63e51f0)

### Fixed

- Multiple UI and backend fixes (f368c45)
- **auth**: Fix deleteUser enum type mismatch with Prisma pg-adapter (0dc137f)
- **logo**: Add unoptimized to preserve PNG quality (prevent WebP conversion) (761551e)
- **logo**: Regenerate logos from source with max quality (400px, Lanczos) (98d956d)
- **logo**: Remove query params breaking Next.js Image (ed5cdd2)
- **logo**: Add cache-busting version param (61b15dc)
- **logo**: Swap logo files so emails use light version (0fea50b)
- **logo**: Increase xl size to h-14 (56px) for Header logo (5c79b0b)
- **logo**: Fix theme-aware logo switching and increase Header size (dc1c3d7)

## [0.7.2] - 2025-12-03

## [0.7.1] - 2025-12-03

## [0.7.0] - 2025-12-03

### Added

- **auth**: Add user invitation flow with Supabase Auth (66b8a4b)
- **users**: Add full user management for admins (c43cc82)

### Fixed

- **auth**: Wrap SetPasswordForm in Suspense boundary (d938b2b)
- **dashboard**: Add violations chart data to dashboard widget (2043ad6)

## [0.6.3] - 2025-12-02

## [0.6.2] - 2025-12-02

### Added

- **reports**: Implement reports section with export functionality (fefa74a)
- add Violations and Help menu items, create Help page (162f266)

### Fixed

- **ui**: Fix tabs styling and translate to Russian (ba70489)
- **reports**: Add white text to modal generate button (36cedcd)
- **api**: Use z.coerce.date() for exportReport input (0be12b6)
- **reports**: Fix button text color and React hook error (935f281)
- **ui**: Add popover/dropdown background colors to theme (8e36629)
- HelpButton TypeScript error (6df3cdb)
- sync package-lock.json with new dependencies (19a799d)

## [0.6.1] - 2025-12-02

## [0.6.0] - 2025-11-30

### Added

- **analytics**: Add response time analytics page and table sorting (1f5698a)
- **notifications**: Link SLA alerts to in-app notifications (8532bb2)

### Fixed

- **sidebar**: Simplify active nav item logic (4db5631)
- **sidebar**: Don't highlight parent nav when child is active (344ec77)
- **alerts**: Use actual data for quick stats counters (14cb6d6)
- **ui**: Rewrite AlertsPage to match Chats page structure (5076b30)
- **ui**: Restyle AlertsPage to match project design system (96957df)

## [0.5.0] - 2025-11-30

## [0.4.0] - 2025-11-29

### Added

- **007**: Implement Admin CRUD Pages (1cd27c7)

### Fixed

- **007**: Implement shadcn Select component (f797340)
- **007**: Code review improvements (dd27da5)

## [0.3.0] - 2025-11-27

### Added

- **telegram**: implement Telegram Login integration (006) (d3f3fdc)

### Fixed

- **frontend**: prevent TelegramLoginButton widget re-initialization (98c34bf)
- **docker**: add NEXT_PUBLIC_BOT_NAME build arg for Telegram Login (2987869)

## [0.2.9] - 2025-11-27

## [0.2.9] - 2025-11-27

### Added

- **frontend**: add separate Profile settings page (`/settings/profile`) with personal data editing
- **frontend**: add "Connect Telegram" UI in profile settings
- **backend**: add `telegram_id` and `telegram_username` fields to User model (T002)
- **backend**: implement `auth.updateProfile` tRPC procedure

## [0.2.8] - 2025-11-27

### Changed

- **frontend**: unify ProfileMenu component for landing and dashboard

### Added

- implement robust theme management with next-themes (281c102)
- add password visibility toggle and fix light mode visibility in login (9a6cf15)

### Changed

- replace custom ThemeContext with next-themes in AdminLayout (0e6f139)

### Fixed

- improve login page light theme support and add theme toggle (ffaca0d)

## [0.2.6] - 2025-11-25

### Fixed

- **frontend**: add layoutRoot for Yandex Browser compatibility (df92fcf)
- **frontend**: add explicit left/top positioning for cursor glow (24effc1)

## [0.2.5] - 2025-11-25

### Fixed

- **frontend**: correct cursor glow positioning using useMotionValue (962e65c)

## [0.2.4] - 2025-11-25

### Fixed

- **frontend**: correct tRPC API path from /trpc to /api/trpc (b819856)
- **backend**: use raw SQL for contact insert as workaround for Prisma 7 UUID bug (1797ec7)
- **backend**: remove @default from GlobalSettings.id to fix UUID parsing (c4afc01)

## [0.2.3] - 2025-11-25

### Added

- **backend**: integrate tRPC Express adapter (a6c0d39)

### Fixed

- **backend**: add .js extensions to tRPC imports for ESM compatibility (5f13d91)
- **backend**: convert undefined to null for contact notification payload (47ba96d)
- **backend**: use bracket notation for env var access to satisfy TypeScript strict mode (22671f4)

## [0.2.2] - 2025-11-25

### Added

- **landing**: add section IDs for smooth scroll navigation (bc3b02a)

## [0.2.1] - 2025-11-24

### Fixed

- **prisma**: switch to prisma-client-js for runtime compatibility (dbf7001)
- **build**: include Prisma generated files in TypeScript compilation (2e3ecc3)
- **docker**: regenerate Prisma client in runtime stage (24e607b)
- **docker**: add --legacy-peer-deps for React 19 compatibility (efacfe7)
- **docker**: change frontend build context to repo root (270d792)
- **docker**: switch from pnpm to npm in Dockerfiles (819d938)

## [0.2.0] - 2025-11-24

## [0.1.22] - 2025-11-24

## [0.1.21] - 2025-11-24

## [0.1.20] - 2025-11-24

## [0.1.19] - 2025-11-24

## [0.1.18] - 2025-11-24

## [0.1.17] - 2025-11-24

### Added

- SLA Monitoring System (MODULE 1.1) (#2) (f1f5a7a)
- **deps**: migrate Prisma 5.22 to 7.0 (785e16e)

## [0.1.16] - 2025-11-22

## [0.1.15] - 2025-11-22

## [0.1.14] - 2025-11-22

## [0.1.13] - 2025-11-22

## [0.1.12] - 2025-11-22

## [0.1.11] - 2025-11-22

### Fixed

- **docker**: switch to node:18-slim for Prisma OpenSSL compatibility (fbcb551)
- **docker**: use Node 18 Alpine for Prisma OpenSSL compatibility (f2365cd)
- **infra**: remove security restrictions causing container crashes (639514d)
- **types**: convert Prisma bigint to number in tRPC routers (a87406a)
- **docker**: add package-lock.json for npm ci builds (347430f)

## [0.1.10] - 2025-11-20

## [0.1.9] - 2025-11-20

## [0.1.8] - 2025-11-20

## [0.1.7] - 2025-11-20

### Added

- **agents**: add nextjs-ui-designer agent (04fd327)

## [0.1.6] - 2025-11-17

### Added

- **backend**: complete Phase 3 - Supabase database setup (142ca9f)

## [0.1.5] - 2025-11-17

## [0.1.4] - 2025-11-17

## [0.1.3] - 2025-11-17

### Added

- **infrastructure**: complete Phase 1 Setup - project initialization (7988d84)

## [0.1.2] - 2025-11-17

### Added

- **agents**: create 8 infrastructure worker agents for BuhBot deployment (5b01434)

## [0.1.1] - 2025-11-17

## [0.1.0] - 2025-11-17

### Added

- Initial repository setup
- Project naming: **BuhBot** (платформа автоматизации коммуникаций для бухгалтерских фирм)
- README.md with project overview and roadmap
- Complete project documentation (Technical Specification, Modular Offer)
- Claude Code orchestration rules (CLAUDE.md)
- Git repository initialization with GitHub remote
- 152-ФЗ compliance architecture planning
- 3-phase development roadmap

### Documentation

- Technical Specification v1.2
- Final Modular Offer with Hours breakdown
- DeepResearch Analysis for TG Bot Features
- Agent Ecosystem documentation
- Executive Summary
