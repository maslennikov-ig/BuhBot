# Implementation Plan: SLA Monitoring System

**Branch**: `002-sla-monitoring` | **Date**: 2025-11-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature spec from `/specs/002-sla-monitoring/spec.md`

**Note**: Template filled by `/speckit.plan` command.

## Summary

Реализация системы мониторинга SLA для отслеживания времени ответа бухгалтеров на запросы клиентов. Включает AI-классификацию сообщений (спам/запрос), расчёт SLA с учётом рабочего времени, алерты менеджерам и админ-панель аналитики.

**Технический подход**: BullMQ для очередей обработки сообщений, Prisma + PostgreSQL для хранения, Telegraf для бота, OpenRouter API для AI-классификации, tRPC для API админ-панели.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 20.19.0+
**Primary Dependencies**: Express 5.1, Prisma 7.0, Telegraf 4.16, BullMQ 5.34, tRPC 11.7, Zod 3.x, Supabase Realtime (dashboard updates)
**Storage**: PostgreSQL 15+ (Supabase Cloud), Redis (BullMQ queues)
**Testing**: Vitest (to be configured)
**Target Platform**: Linux VDS (Docker), Telegram Bot API
**Project Type**: web (monorepo: backend + frontend)
**Performance Goals**: 5s для старта SLA таймера, 2s для AI-классификации, 1000 req/day
**Constraints**: 152-ФЗ compliance, Europe/Moscow timezone, <60s для алертов
**Scale/Scope**: 100+ мониторируемых чатов, 1000+ запросов/день

## Constitution Check

_GATE: Must pass before Phase 0. Re-check after Phase 1._

| Principle                      | Status   | Notes                                                   |
| ------------------------------ | -------- | ------------------------------------------------------- |
| I. Context-First Development   | ✅ PASS  | Контекст собран из spec.md, schema.prisma, package.json |
| II. Agent-Based Orchestration  | ✅ PASS  | Задачи будут делегированы специализированным агентам    |
| III. TDD (Conditional)         | ⏸️ DEFER | Тесты не указаны явно в spec, опционально               |
| IV. Atomic Task Execution      | ✅ PASS  | Задачи будут атомарными с коммитами                     |
| V. User Story Independence     | ✅ PASS  | 6 независимых user stories в spec (P1/P2)               |
| VI. Quality Gates              | ✅ PASS  | type-check + build обязательны                          |
| VII. Progressive Specification | ✅ PASS  | Phase 0 → Phase 1 → tasks.md                            |

**Security Check**:

- ✅ Credentials через env variables
- ✅ RLS policies для Supabase
- ✅ 152-ФЗ compliance (данные в РФ)

## Project Structure

### Documentation (this feature)

```text
specs/002-sla-monitoring/
├── spec.md          # Feature specification
├── plan.md          # This file
├── research.md      # Phase 0 output
├── data-model.md    # Phase 1 output
├── quickstart.md    # Phase 1 output
├── contracts/       # Phase 1 output (tRPC routers)
│   ├── sla.router.ts
│   ├── chat.router.ts
│   └── analytics.router.ts
└── tasks.md         # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── bot/              # Telegraf bot handlers
│   │   ├── handlers/     # Message handlers
│   │   └── middleware/   # Bot middleware
│   ├── services/         # Business logic
│   │   ├── sla/          # SLA calculation service
│   │   ├── classifier/   # AI spam classifier
│   │   └── alerts/       # Manager alerts service
│   ├── queues/           # BullMQ workers
│   │   ├── sla-timer.queue.ts
│   │   └── alert.queue.ts
│   ├── api/              # tRPC routers
│   │   └── routers/
│   └── lib/              # Shared utilities
├── prisma/
│   └── schema.prisma     # Already exists, needs extension
└── tests/

frontend/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── dashboard/    # SLA dashboard
│   │   ├── chats/        # Chat management
│   │   └── settings/     # Working hours config
│   ├── components/       # UI components
│   └── lib/              # tRPC client, utils
└── tests/
```

**Structure Decision**: Монорепо с backend/ и frontend/ уже существует. Добавляем новые модули в существующую структуру.

## Complexity Tracking

> Нарушений Constitution не обнаружено. Таблица пуста.

| Violation | Why Needed | Simpler Alternative Rejected |
| --------- | ---------- | ---------------------------- |
| —         | —          | —                            |

## Phase 0: Research Tasks

| #   | Research Question                                       | Classification | Status  |
| --- | ------------------------------------------------------- | -------------- | ------- |
| R1  | BullMQ patterns для отложенных задач с рабочим временем | Simple         | ✅ Done |
| R2  | OpenRouter API: rate limits, pricing, fallback strategy | Simple         | ✅ Done |
| R3  | Telegram inline buttons для алертов менеджеру           | Simple         | ✅ Done |
| R4  | Working hours calculation с учётом праздников           | Simple         | ✅ Done |

**Output**: [research.md](./research.md)

## Phase 1: Design Artifacts

| #   | Artifact                      | Description                      | Status  |
| --- | ----------------------------- | -------------------------------- | ------- |
| D1  | data-model.md                 | Расширение schema.prisma для SLA | ✅ Done |
| D2  | contracts/sla.router.ts       | tRPC API для SLA операций        | ✅ Done |
| D3  | contracts/chat.router.ts      | tRPC API для управления чатами   | ✅ Done |
| D4  | contracts/alert.router.ts     | tRPC API для алертов             | ✅ Done |
| D5  | contracts/analytics.router.ts | tRPC API для dashboard           | ✅ Done |
| D6  | contracts/settings.router.ts  | tRPC API для настроек            | ✅ Done |
| D7  | quickstart.md                 | Инструкции по запуску            | ✅ Done |

**Output**: design artifacts в [specs/002-sla-monitoring/](.)

## Phase-1-Technical-Prompt.md Compliance

✅ **Все требования MODULE 1.1 покрыты**:

- 1.1.1 Request Tracking (FR-001 — FR-005)
- 1.1.2 AI Spam Filter (FR-006 — FR-010)
- 1.1.3 Working Hours Calendar (FR-011 — FR-015)
- 1.1.4 Manager Alerts (FR-016 — FR-020)
- 1.1.5 Admin Panel (FR-021 — FR-026)

## Next Steps

1. Запустить `/speckit.tasks` для генерации tasks.md
2. Начать реализацию User Stories по приоритету (P1 → P2)
