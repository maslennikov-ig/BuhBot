# Quickstart: Client Feedback & Quick Wins

**Date**: 2025-11-24
**Feature**: 003-client-feedback-quick-wins

## Prerequisites

- Node.js 20.x LTS
- pnpm 9.x
- PostgreSQL 15+ (Supabase Cloud)
- Redis 7.x (local or cloud)
- Telegram Bot Token

## Local Development Setup

### 1. Environment Variables

Add to `backend/.env`:

```bash
# Existing vars should already be set
# No new environment variables required for this feature
```

### 2. Database Migration

```bash
cd backend
pnpm prisma migrate dev --name add_feedback_surveys
```

### 3. Seed Default Settings (if needed)

```bash
pnpm prisma db seed
```

### 4. Start Development

```bash
# Terminal 1: Backend
cd backend && pnpm dev

# Terminal 2: Frontend
cd frontend && pnpm dev

# Terminal 3: Bot (if not in backend)
# Bot runs as part of backend
```

## Testing the Feature

### Module 1.2: Feedback Surveys

#### Create a Survey Campaign (Admin Panel)

1. Navigate to `/settings/surveys`
2. Click "Create Survey"
3. Select quarter (e.g., "2025-Q1")
4. Set scheduled date or click "Send Now"

#### Simulate Client Response (Telegram)

1. Find a test chat with the bot
2. Bot sends survey message with 5 star buttons
3. Click a rating button
4. Optionally reply with a comment

#### View Feedback (Admin Panel)

**Manager View** (`/feedback`):
- See all responses with client names
- Filter by date, rating, survey
- Export to CSV

**Accountant View** (`/feedback`):
- See aggregate stats only
- NPS score, average rating
- Anonymous comments

### Module 1.3: Quick Wins

#### Client Inline Menu

1. Open chat with bot as a client
2. See persistent menu buttons:
   - "Document Status"
   - "Contact Accountant"
   - "Request Service"
3. Tap each to test response

#### Template Library

As accountant in a client chat:

```
/template                  # List available templates
/template invoice          # Send invoice template
/template greeting         # Send greeting template
```

#### Auto-File Confirmation

As client:
1. Send a document to bot
2. Bot replies: "File received: document.pdf (1.2 MB)"

#### FAQ Auto-Responses

As client, send messages containing keywords:

```
"Сколько стоит услуга?"     → Pricing FAQ response
"Какой срок сдачи?"         → Deadline FAQ response
```

## API Testing (tRPC)

### Feedback Endpoints

```typescript
// Get aggregates (all users)
trpc.feedback.getAggregates.query({
  dateFrom: new Date('2025-01-01'),
  dateTo: new Date('2025-03-31'),
});

// Get all (manager only)
trpc.feedback.getAll.query({
  page: 1,
  pageSize: 20,
  minRating: 1,
  maxRating: 3, // Low ratings only
});
```

### Survey Endpoints

```typescript
// List surveys
trpc.survey.list.query({ status: 'active' });

// Create survey
trpc.survey.create.mutate({
  quarter: '2025-Q2',
  scheduledAt: new Date('2025-04-01T09:00:00Z'),
});

// Close survey
trpc.survey.close.mutate({ id: 'survey-uuid' });
```

## Queue Monitoring

### Check BullMQ Dashboard

If Bull Board is configured:

```
http://localhost:3001/admin/queues
```

### Queue Names

- `surveys` - Survey delivery jobs
- `survey-reminders` - Day 2 reminders
- `feedback-alerts` - Low rating notifications

## Troubleshooting

### Survey Not Sending

1. Check BullMQ connection: `redis-cli ping`
2. Verify survey status is 'scheduled' or 'sending'
3. Check worker logs for errors

### Low Rating Alert Not Received

1. Verify manager Telegram ID in GlobalSettings
2. Check alertQueue job status
3. Verify bot has permission to message manager

### FAQ Not Matching

1. Check FaqItem keywords array contains search terms
2. Keywords are case-insensitive
3. Verify FAQ item exists with `trpc.faq.list`

### Template Variables Not Replacing

1. Check template content uses `{{variable}}` syntax
2. Verify chat has clientUsername populated
3. Check variable.service.ts for supported variables

## Performance Validation

### Survey Delivery Speed

For 10,000 clients:
- Expected: < 4 hours
- Rate: ~10 messages/second with 100ms delay
- Monitor: `surveys` queue job count

### Alert Latency

- Expected: < 60 seconds from rating to notification
- Monitor: Time between FeedbackResponse.submittedAt and alert delivery

## Feature Flags (Future)

No feature flags in MVP. All features enabled by default.

## Rollback Plan

If issues arise:

1. **Disable survey sending**: Set all surveys to 'closed' status
2. **Disable FAQ auto-response**: Remove FAQ handler from bot middleware
3. **Disable file confirmation**: Comment out file handler registration
4. **Database rollback**: `pnpm prisma migrate rollback`
