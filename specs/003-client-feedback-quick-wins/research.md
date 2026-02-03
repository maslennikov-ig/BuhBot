# Research: Client Feedback & Quick Wins

**Date**: 2025-11-24
**Feature**: 003-client-feedback-quick-wins

## Research Summary

No critical unknowns identified. Tech stack is well-defined in constitution and existing codebase provides clear patterns.

## Decisions

### 1. Survey Queue Architecture

**Decision**: Use existing BullMQ infrastructure with new `survey` queue
**Rationale**:

- BullMQ already configured in `backend/src/queues/setup.ts`
- Proven patterns for delayed jobs (sla-timers), alerts, and data-retention
- Supports cron scheduling for quarterly surveys
- Built-in retry with exponential backoff

**Alternatives Considered**:

- node-cron standalone: Rejected - no persistence, no retry, no monitoring
- Separate Redis instance: Rejected - over-engineering, existing Redis sufficient

### 2. NPS Calculation Formula

**Decision**: Standard NPS = % Promoters (4-5 stars) - % Detractors (1-3 stars)
**Rationale**:

- Industry-standard calculation
- 1-5 scale maps to: Detractors (1-3), Passives (none on 5-point), Promoters (4-5)
- Simple percentage calculation, no external dependencies

**Alternatives Considered**:

- 10-point NPS scale: Rejected - spec requires 1-5 stars, keep simple
- Weighted scoring: Rejected - over-engineering for MVP

### 3. Role-Based Data Access Pattern

**Decision**: tRPC middleware with role check + separate query procedures
**Rationale**:

- Existing `authRouter` provides user context with role
- Create two procedures: `feedback.getAll` (manager only), `feedback.getAggregates` (all roles)
- RLS at database level for additional security

**Alternatives Considered**:

- Single procedure with filtered output: Rejected - information leakage risk
- Supabase RLS only: Rejected - need TypeScript-level enforcement for clarity

### 4. Telegram Inline Keyboard for Surveys

**Decision**: Use Telegraf's `Markup.inlineKeyboard` with callback_data pattern
**Rationale**:

- Existing pattern in `bot/keyboards/alert.keyboard.ts`
- callback_data format: `survey:rating:{surveyId}:{rating}`
- Allows tracking which survey the response belongs to

**Alternatives Considered**:

- Reply keyboard: Rejected - not persistent, clutters chat
- Custom webapp: Rejected - over-engineering for 5 buttons

### 5. Template Variable Substitution

**Decision**: Simple regex replacement with `{{variable}}` syntax
**Rationale**:

- Template model already has `content` field
- Pattern: `/\{\{(\w+)\}\}/g` replace with context values
- Variables: client_name, accountant_name, chat_title, date

**Alternatives Considered**:

- Handlebars/Mustache: Rejected - dependency overhead for simple use case
- Template literals: Rejected - security risk with user content

### 6. FAQ Keyword Matching

**Decision**: Case-insensitive substring match on keywords array, return highest usage_count
**Rationale**:

- FaqItem model already has `keywords: String[]` field
- Simple `ILIKE ANY` query in PostgreSQL
- Tie-breaker: highest `usage_count` (most popular answer)

**Alternatives Considered**:

- Full-text search (tsvector): Deferred - good for v2 if simple matching insufficient
- AI classification: Deferred - over-engineering, spec says "keyword-based"

### 7. Survey Delivery Rate Limiting

**Decision**: Batch processing with 100ms delay between messages
**Rationale**:

- Telegram rate limits: ~30 messages/second per bot
- 10,000 clients / 30 msg/s = ~5.5 minutes (well under 4 hour requirement)
- 100ms delay = 10 msg/s, safe margin for retries

**Alternatives Considered**:

- No rate limiting: Rejected - risk of Telegram 429 errors
- Per-chat rate limiting: Rejected - unnecessary complexity

## Patterns from Existing Codebase

### Queue Pattern (from setup.ts)

```typescript
export const surveyQueue = new Queue<SurveyJobData>(QUEUE_NAMES.SURVEYS, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
});
```

### tRPC Router Pattern (from analytics.ts)

```typescript
export const feedbackRouter = router({
  getAggregates: protectedProcedure.query(async ({ ctx }) => {
    // Available to all authenticated users
  }),
  getAll: protectedProcedure.use(requireRole('manager')).query(async ({ ctx }) => {
    // Managers only
  }),
});
```

### Bot Handler Pattern (from message.handler.ts)

```typescript
bot.on(message('document'), async (ctx) => {
  // Auto-file confirmation
});
bot.action(/^survey:rating:(.+):(\d)$/, async (ctx) => {
  // Survey callback
});
```

## Open Questions (None Critical)

All questions resolved during clarification phase. No blocking research needed.

## Dependencies to Verify

| Dependency                | Status   | Notes                           |
| ------------------------- | -------- | ------------------------------- |
| BullMQ cron               | VERIFIED | Used by data-retention job      |
| Telegraf inline keyboards | VERIFIED | Used in alert.keyboard.ts       |
| Prisma aggregations       | VERIFIED | Used in analytics router        |
| tRPC middleware           | VERIFIED | Role checks in existing routers |
