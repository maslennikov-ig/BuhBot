import { z } from 'zod';

/**
 * Queue Configuration
 *
 * Centralized BullMQ queue settings with environment variable support.
 * All values have sensible defaults matching production requirements.
 *
 * Environment variables are optional - defaults work out of the box.
 *
 * @module config/queue
 */

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

/**
 * Get survey reminder delay in milliseconds
 * Default: 2 days
 */
export const getSurveyReminderDelayMs = (): number =>
  queueConfig.surveyReminderDelayDays * 24 * 60 * 60 * 1000;

/**
 * Get survey manager notify delay in milliseconds
 * Default: 5 days (after reminder = 7 days total from initial delivery)
 */
export const getSurveyManagerNotifyDelayMs = (): number =>
  queueConfig.surveyManagerNotifyDelayDays * 24 * 60 * 60 * 1000;
