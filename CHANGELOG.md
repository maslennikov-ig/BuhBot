# Changelog - BuhBot

All notable changes to BuhBot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
