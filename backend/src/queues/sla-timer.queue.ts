/**
 * SLA Timer Queue
 *
 * Re-exports the SLA timer queue and helper functions from setup.ts.
 * Provides a dedicated module for SLA timer queue operations.
 *
 * This module is the main entry point for SLA timer queue operations
 * in the bot handlers and services.
 *
 * @module queues/sla-timer.queue
 */

export {
  slaTimerQueue,
  slaTimerEvents,
  scheduleSlaCheck,
  cancelSlaCheck,
  QUEUE_NAMES,
} from './setup.js';

export type { SlaTimerJobData } from './setup.js';

// Re-import for default export
import { scheduleSlaCheck, cancelSlaCheck } from './setup.js';

export default {
  scheduleSlaCheck,
  cancelSlaCheck,
};
