# Knip Cleanup Report

## Backend

### Unused Files
- [x] src/api/trpc/types.ts
- [x] src/bot/handlers/index.ts
- [x] src/bot/middleware/error.ts
- [x] src/bot/middleware/index.ts
- [x] src/bot/middleware/rate-limit.ts
- [x] src/db/client.ts
- [x] src/jobs/data-retention.job.ts
- [x] src/middleware/rate-limit.ts
- [x] src/middleware/telegram-signature.ts
- [x] src/queues/alert.worker.ts
- [x] src/queues/sla-timer.queue.ts
- [x] src/queues/sla-timer.worker.ts
- [x] src/queues/survey.worker.ts
- [x] src/services/feedback/alert.service.ts
- [x] src/services/telegram-alerts.ts

## Frontend

### Unused Files
- [x] src/app/settings/settings-page-content.tsx
- [x] src/components/chats/index.ts
- [x] src/components/common/ComingSoon.tsx
- [x] src/components/layout/index.ts
- [x] src/components/settings/HolidayCalendar.tsx (Integrated into page.tsx)
- [x] src/components/ui/design-tokens.ts
- [x] src/components/ui/tooltip.tsx
- [x] src/lib/supabase-server.ts
- [x] src/types/dashboard.ts
- [x] src/types/onboarding.ts

### Unused Dependencies
- [x] @radix-ui/react-tooltip
- [x] @tremor/react

### Unlisted Dependencies
- [x] date-fns

## Final Verification (Round 2 & 3)

### Backend Fixes
- [x] Removed unused `export default` from handlers, `prisma.ts`, `bot.ts`, `keyword-classifier.ts`, `openrouter-client.ts`, `metrics.ts`.
- [x] Removed unused exports from `request.service.ts` (`getRequestById`, `updateRequestStatus`, `markRequestAsAnswered`, etc).
- [x] Removed unused exports from `survey.service.ts` (`getActiveClients` (made internal), `markSurveyActive`, `updateDeliveryStatus`, etc).
- [x] Removed unused exports from `analytics.service.ts` (`calculateNPS`, `calculateDistribution` made internal).
- [x] Fixed `metrics.ts` type issue by removing unused `getMetricsJson`.
- [x] Cleaned up `redis.ts` unused imports and default export.
- [x] Cleaned up `queues/setup.ts` unused imports and variables.

### Frontend Fixes
- [x] Removed unused exports from `chart.tsx`, `form.tsx`, `select.tsx`.
- [x] Removed unused type exports from multiple component files (`AccountantSelect`, `FeedbackTable`, `NPSWidget`, `ReportCard`, `ReportGeneratorModal`, `SearchInput`, `documentation.ts`, `useTableSort.ts`).
- [x] Fixed `ChartStyle` export in `chart.tsx`.

## Final Verification (Round 4 - Dec 11, 2025)

### Configuration & Tooling
- [x] **Backend Config**: Fixed `knip.json` to use `entry` for public API files (`src/api/trpc/index.ts`, `src/services/*`) instead of incorrect `ignoreExports`. Removed obsolete `ignoreDependencies`.
- [x] **Frontend Config**: Cleaned up `knip.json` `ignoreDependencies`.
- [x] **Backend Dependencies**: Removed unused `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` (replaced by `typescript-eslint`).
- [x] **Frontend Dependencies**: Removed unused `vitest` and `@vitest/coverage-v8`. Added missing `postcss` dependency.

### Code Fixes
- [x] **Backend**: Removed unused `ActiveClient` export from `src/services/feedback/survey.service.ts`.
- [x] **Verification**: Achieved "Excellent, Knip found no issues" status for both Backend and Frontend.

## Emergency Restoration (Dec 11, 2025)

### Problem
Critical files (workers, services, middleware) were deleted because `knip` flagged them as unused. These files are used dynamically or implicitly (e.g. by BullMQ or Express).

### Actions Taken
- [x] **Restored Files**: 
    - Workers: `alert.worker.ts`, `survey.worker.ts`, `sla-timer.worker.ts`
    - Services: `feedback/alert.service.ts`, `telegram-alerts.ts`
    - Middleware: `rate-limit.ts`, `telegram-signature.ts`, `error.ts`
    - Jobs: `data-retention.job.ts`
    - Setup: `queues/setup.ts` reverted to include worker registration.
- [x] **Knip Config Update**: Added restored files to `backend/knip.json` `entry` list to prevent future deletion.
- [x] **Verification**: Run `npm run type-check` (Exit Code 0).