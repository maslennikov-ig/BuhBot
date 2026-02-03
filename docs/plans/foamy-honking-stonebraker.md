# Plan: Centralize Queue Configuration (buh-xch)

## Summary

Create `backend/src/config/queue.config.ts` to centralize all BullMQ queue configuration with environment variables, replacing 25+ hardcoded values across 5 queue files.

---

## Current State

All queue configuration is hardcoded across these files:

- `backend/src/queues/setup.ts` - Default job options, queues
- `backend/src/queues/alert.worker.ts` - Alert worker settings
- `backend/src/queues/sla-timer.worker.ts` - SLA timer worker settings
- `backend/src/queues/survey.worker.ts` - Survey worker settings
- `backend/src/queues/survey.queue.ts` - Survey queue settings

---

## Implementation

### Step 1: Create Queue Config File

**File**: `backend/src/config/queue.config.ts`

```typescript
import { z } from 'zod';

/**
 * Queue Configuration Schema
 * All values have sensible defaults matching current hardcoded values
 */
const queueConfigSchema = z.object({
  // Global defaults
  defaultAttempts: z.coerce.number().int().min(1).default(3),
  defaultBackoffDelay: z.coerce.number().int().min(100).default(1000),
  defaultRemoveOnComplete: z.coerce.number().int().min(0).default(100),
  defaultRemoveOnFail: z.coerce.number().int().min(0).default(1000),

  // Alert worker
  alertConcurrency: z.coerce.number().int().min(1).default(3),
  alertRateLimitMax: z.coerce.number().int().min(1).default(30),
  alertRateLimitDuration: z.coerce.number().int().min(100).default(1000),

  // SLA timer worker
  slaConcurrency: z.coerce.number().int().min(1).default(5),
  slaRateLimitMax: z.coerce.number().int().min(1).default(10),
  slaRateLimitDuration: z.coerce.number().int().min(100).default(1000),
  slaAttempts: z.coerce.number().int().min(1).default(1),
  slaRemoveOnComplete: z.coerce.number().int().min(0).default(50),

  // Survey worker
  surveyConcurrency: z.coerce.number().int().min(1).default(5),
  surveyRateLimitMax: z.coerce.number().int().min(1).default(30),
  surveyRateLimitDuration: z.coerce.number().int().min(100).default(1000),
  surveyAttempts: z.coerce.number().int().min(1).default(5),
  surveyReminderDelayDays: z.coerce.number().int().min(1).default(2),
  surveyManagerNotifyDelayDays: z.coerce.number().int().min(1).default(5),

  // Data retention
  dataRetentionAttempts: z.coerce.number().int().min(1).default(2),
  dataRetentionBackoffDelay: z.coerce.number().int().min(100).default(5000),
  dataRetentionSchedule: z.string().default('0 0 * * *'),

  // Worker shutdown
  workerShutdownTimeout: z.coerce.number().int().min(1000).default(10000),
});

export type QueueConfig = z.infer<typeof queueConfigSchema>;

export const queueConfig: QueueConfig = queueConfigSchema.parse({
  defaultAttempts: process.env['QUEUE_DEFAULT_ATTEMPTS'],
  defaultBackoffDelay: process.env['QUEUE_DEFAULT_BACKOFF_DELAY'],
  defaultRemoveOnComplete: process.env['QUEUE_DEFAULT_REMOVE_ON_COMPLETE'],
  defaultRemoveOnFail: process.env['QUEUE_DEFAULT_REMOVE_ON_FAIL'],

  alertConcurrency: process.env['QUEUE_ALERT_CONCURRENCY'],
  alertRateLimitMax: process.env['QUEUE_ALERT_RATE_LIMIT_MAX'],
  alertRateLimitDuration: process.env['QUEUE_ALERT_RATE_LIMIT_DURATION'],

  slaConcurrency: process.env['QUEUE_SLA_CONCURRENCY'],
  slaRateLimitMax: process.env['QUEUE_SLA_RATE_LIMIT_MAX'],
  slaRateLimitDuration: process.env['QUEUE_SLA_RATE_LIMIT_DURATION'],
  slaAttempts: process.env['QUEUE_SLA_ATTEMPTS'],
  slaRemoveOnComplete: process.env['QUEUE_SLA_REMOVE_ON_COMPLETE'],

  surveyConcurrency: process.env['QUEUE_SURVEY_CONCURRENCY'],
  surveyRateLimitMax: process.env['QUEUE_SURVEY_RATE_LIMIT_MAX'],
  surveyRateLimitDuration: process.env['QUEUE_SURVEY_RATE_LIMIT_DURATION'],
  surveyAttempts: process.env['QUEUE_SURVEY_ATTEMPTS'],
  surveyReminderDelayDays: process.env['QUEUE_SURVEY_REMINDER_DELAY_DAYS'],
  surveyManagerNotifyDelayDays: process.env['QUEUE_SURVEY_MANAGER_NOTIFY_DELAY_DAYS'],

  dataRetentionAttempts: process.env['QUEUE_DATA_RETENTION_ATTEMPTS'],
  dataRetentionBackoffDelay: process.env['QUEUE_DATA_RETENTION_BACKOFF_DELAY'],
  dataRetentionSchedule: process.env['QUEUE_DATA_RETENTION_SCHEDULE'],

  workerShutdownTimeout: process.env['QUEUE_WORKER_SHUTDOWN_TIMEOUT'],
});

// Helper for survey timing
export const getSurveyReminderDelayMs = () =>
  queueConfig.surveyReminderDelayDays * 24 * 60 * 60 * 1000;

export const getSurveyManagerNotifyDelayMs = () =>
  queueConfig.surveyManagerNotifyDelayDays * 24 * 60 * 60 * 1000;
```

---

### Step 2: Update Queue Files

#### 2.1 `backend/src/queues/setup.ts`

```typescript
// Add import
import { queueConfig } from '../config/queue.config.js';

// Update defaultJobOptions (line ~90)
export const defaultJobOptions = {
  attempts: queueConfig.defaultAttempts,
  backoff: {
    type: 'exponential' as const,
    delay: queueConfig.defaultBackoffDelay,
  },
  removeOnComplete: queueConfig.defaultRemoveOnComplete,
  removeOnFail: queueConfig.defaultRemoveOnFail,
};

// Update slaTimerQueue (line ~136)
defaultJobOptions: {
  ...defaultJobOptions,
  attempts: queueConfig.slaAttempts,
  removeOnComplete: queueConfig.slaRemoveOnComplete,
},

// Update dataRetentionQueue (line ~184)
defaultJobOptions: {
  ...defaultJobOptions,
  attempts: queueConfig.dataRetentionAttempts,
  backoff: {
    type: 'exponential' as const,
    delay: queueConfig.dataRetentionBackoffDelay,
  },
},

// Update closeQueues (line ~376)
export async function closeQueues(timeout: number = queueConfig.workerShutdownTimeout)

// Update scheduleDataRetention (line ~580)
const repeatPattern = queueConfig.dataRetentionSchedule;
```

#### 2.2 `backend/src/queues/alert.worker.ts`

```typescript
// Add import
import { queueConfig } from '../config/queue.config.js';

// Update alertWorker (line ~285)
export const alertWorker = new Worker<AlertWorkerJobData>('alerts', processAlertJob, {
  connection: redis,
  concurrency: queueConfig.alertConcurrency,
  limiter: {
    max: queueConfig.alertRateLimitMax,
    duration: queueConfig.alertRateLimitDuration,
  },
});
```

#### 2.3 `backend/src/queues/sla-timer.worker.ts`

```typescript
// Add import
import { queueConfig } from '../config/queue.config.js';

// Update slaTimerWorker (line ~184)
export const slaTimerWorker = new Worker<SlaTimerJobData>(
  QUEUE_NAMES.SLA_TIMERS,
  processSlaTimer,
  {
    connection: redis,
    concurrency: queueConfig.slaConcurrency,
    limiter: {
      max: queueConfig.slaRateLimitMax,
      duration: queueConfig.slaRateLimitDuration,
    },
  }
);

// Update logger (line ~222)
concurrency: queueConfig.slaConcurrency,
```

#### 2.4 `backend/src/queues/survey.worker.ts`

```typescript
// Add import
import { queueConfig, getSurveyReminderDelayMs, getSurveyManagerNotifyDelayMs } from '../config/queue.config.js';

// Replace constants (line ~42-45)
const REMINDER_DELAY_MS = getSurveyReminderDelayMs();
const MANAGER_NOTIFY_DELAY_MS = getSurveyManagerNotifyDelayMs();

// Update max retry check (line ~186)
if (job.attemptsMade + 1 >= queueConfig.surveyAttempts) {

// Update surveyWorker (line ~433)
export const surveyWorker = new Worker<SurveyJobData>(
  SURVEY_QUEUE_NAME,
  processJob,
  {
    connection: redis,
    concurrency: queueConfig.surveyConcurrency,
    limiter: {
      max: queueConfig.surveyRateLimitMax,
      duration: queueConfig.surveyRateLimitDuration,
    },
  }
);
```

#### 2.5 `backend/src/queues/survey.queue.ts`

```typescript
// Add import
import { queueConfig } from '../config/queue.config.js';

// Update surveyQueue (line ~82)
export const surveyQueue = new Queue<SurveyJobData>(SURVEY_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: queueConfig.surveyAttempts,
    backoff: {
      type: 'exponential',
      delay: queueConfig.defaultBackoffDelay,
    },
    removeOnComplete: queueConfig.defaultRemoveOnComplete,
    removeOnFail: queueConfig.defaultRemoveOnFail,
  },
});
```

---

### Step 3: Add .env.example Documentation

Add to `backend/.env.example`:

```bash
# Queue Configuration (all optional - defaults match current hardcoded values)
# QUEUE_DEFAULT_ATTEMPTS=3
# QUEUE_DEFAULT_BACKOFF_DELAY=1000
# QUEUE_DEFAULT_REMOVE_ON_COMPLETE=100
# QUEUE_DEFAULT_REMOVE_ON_FAIL=1000
# QUEUE_ALERT_CONCURRENCY=3
# QUEUE_ALERT_RATE_LIMIT_MAX=30
# QUEUE_SLA_CONCURRENCY=5
# QUEUE_SURVEY_CONCURRENCY=5
# QUEUE_SURVEY_REMINDER_DELAY_DAYS=2
# QUEUE_DATA_RETENTION_SCHEDULE=0 0 * * *
# QUEUE_WORKER_SHUTDOWN_TIMEOUT=10000
```

---

## Files to Modify

| File                                     | Action |
| ---------------------------------------- | ------ |
| `backend/src/config/queue.config.ts`     | CREATE |
| `backend/src/queues/setup.ts`            | MODIFY |
| `backend/src/queues/alert.worker.ts`     | MODIFY |
| `backend/src/queues/sla-timer.worker.ts` | MODIFY |
| `backend/src/queues/survey.worker.ts`    | MODIFY |
| `backend/src/queues/survey.queue.ts`     | MODIFY |
| `backend/.env.example`                   | MODIFY |

---

## Verification

```bash
# 1. Type check
npm run type-check

# 2. Build
npm run build

# 3. Test with default values (no env vars set)
# All existing behavior should work identically

# 4. Test with custom env var
QUEUE_ALERT_CONCURRENCY=1 npm run dev
# Check logs show concurrency: 1
```

---

## Notes

- All env vars are **optional** - defaults match current hardcoded values
- Zero breaking changes - behavior identical without env vars
- Zod validation ensures type safety and valid ranges
