/**
 * E2E SLA Diagnostic Script
 *
 * Connects to real DB, Redis, and Telegram (no mocks) and systematically
 * tests every layer of the SLA notification pipeline to pinpoint failures.
 *
 * Usage:
 *   cd backend && npx tsx src/scripts/e2e-sla-diagnostic.ts [flags]
 *
 * Flags:
 *   --skip-cleanup    Preserve test data created in Phase 6 for debugging
 *   --skip-delivery   Skip Telegram message sending (phases 5 and 6 Telegram parts)
 *   --manager-id=XXXX Override test message recipient Telegram ID
 *
 * IMPORTANT: Do NOT import worker modules here — they auto-start background
 * processes that conflict with the running application.
 *
 * @module scripts/e2e-sla-diagnostic
 */

import { type Queue } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { bot } from '../bot/bot.js';
import {
  slaTimerQueue,
  alertQueue,
  QUEUE_NAMES,
  scheduleSlaCheck,
  cancelSlaCheck,
  cancelEscalation,
} from '../queues/setup.js';
import { recoverPendingSlaTimers } from '../services/sla/timer.service.js';
import {
  isWorkingTime,
  calculateDelayUntilBreach,
  DEFAULT_WORKING_SCHEDULE,
  type WorkingSchedule,
} from '../services/sla/working-hours.service.js';
import { getGlobalSettings } from '../config/config.service.js';

// ============================================================================
// CLI FLAG PARSING
// ============================================================================

const argv = process.argv.slice(2);
const skipCleanup = argv.includes('--skip-cleanup');
const skipDelivery = argv.includes('--skip-delivery');

const managerIdArg = argv.find((a) => a.startsWith('--manager-id='));
const managerIdOverride: string | null = managerIdArg ? (managerIdArg.split('=')[1] ?? null) : null;

// ============================================================================
// RESULT TRACKING
// ============================================================================

type ResultLevel = 'PASS' | 'FAIL' | 'WARN' | 'INFO';

interface DiagResult {
  phase: number;
  level: ResultLevel;
  message: string;
}

const results: DiagResult[] = [];
let hasCriticalFailure = false;

function log(level: ResultLevel, message: string, phase: number = currentPhase): void {
  results.push({ phase, level, message });
  const prefix =
    level === 'PASS'
      ? '  [PASS]'
      : level === 'FAIL'
        ? '  [FAIL]'
        : level === 'WARN'
          ? '  [WARN]'
          : '  [INFO]';
  // eslint-disable-next-line no-console
  console.log(`${prefix} ${message}`);
}

let currentPhase = 0;

function phaseHeader(num: number, title: string): void {
  currentPhase = num;
  // eslint-disable-next-line no-console
  console.log(`\n=== PHASE ${num}: ${title} ===\n`);
}

// ============================================================================
// PHASE 1: CONNECTIVITY
// ============================================================================

async function phase1Connectivity(): Promise<boolean> {
  phaseHeader(1, 'CONNECTIVITY');

  let allPassed = true;

  // 1a. Database
  try {
    const dbStart = Date.now();
    await Promise.race([
      prisma.$queryRaw`SELECT 1 as ok`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout after 5000ms')), 5000)
      ),
    ]);
    log('PASS', `Database connection OK (${Date.now() - dbStart}ms)`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('FAIL', `Database connection FAILED: ${msg}`);
    allPassed = false;
  }

  // 1b. Redis
  try {
    const redisStart = Date.now();
    const pong = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis timeout after 5000ms')), 5000)
      ),
    ]);
    if (pong === 'PONG') {
      log('PASS', `Redis connection OK (${Date.now() - redisStart}ms)`);
    } else {
      log('FAIL', `Redis ping returned unexpected response: ${String(pong)}`);
      allPassed = false;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('FAIL', `Redis connection FAILED: ${msg}`);
    allPassed = false;
  }

  // 1c. Telegram Bot API
  try {
    const tgStart = Date.now();
    const me = await Promise.race([
      bot.telegram.getMe(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Telegram timeout after 10000ms')), 10000)
      ),
    ]);
    log('PASS', `Telegram Bot API OK — @${me.username} (id: ${me.id}) (${Date.now() - tgStart}ms)`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('FAIL', `Telegram Bot API FAILED: ${msg}`);
    allPassed = false;
  }

  return allPassed;
}

// ============================================================================
// PHASE 2: CONFIGURATION VALIDATION
// ============================================================================

interface SlaChat {
  id: bigint;
  title: string | null;
  accountantTelegramIds: bigint[];
  managerTelegramIds: string[];
  is24x7Mode: boolean;
  slaThresholdMinutes: number;
}

async function phase2Config(): Promise<SlaChat[]> {
  phaseHeader(2, 'CONFIGURATION VALIDATION');

  // 2a. GlobalSettings row
  let settings: Awaited<ReturnType<typeof getGlobalSettings>> | null = null;

  try {
    settings = await getGlobalSettings();
    log('PASS', 'GlobalSettings loaded successfully');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('FAIL', `Failed to load GlobalSettings: ${msg}`);
    return [];
  }

  // Confirm the DB row actually exists (getGlobalSettings falls back to defaults)
  try {
    const rawSettings = await prisma.globalSettings.findUnique({ where: { id: 'default' } });
    if (!rawSettings) {
      log('FAIL', 'GlobalSettings row MISSING (id=default) — using hardcoded defaults');
    } else {
      log('PASS', 'GlobalSettings DB row exists (id=default)');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('WARN', `Could not verify GlobalSettings DB row: ${msg}`);
  }

  // 2b. globalManagerIds — most likely root cause of missing notifications
  if (!settings.globalManagerIds || settings.globalManagerIds.length === 0) {
    log(
      'FAIL',
      'globalManagerIds is EMPTY — no one receives breach notifications unless chat has managerTelegramIds!'
    );
  } else {
    log(
      'PASS',
      `globalManagerIds: [${settings.globalManagerIds.join(', ')}] (${settings.globalManagerIds.length} manager(s))`
    );
  }

  // 2c. internalChatId
  if (!settings.internalChatId) {
    log('WARN', 'internalChatId is NULL — breach chat notifications disabled');
  } else {
    log('PASS', `internalChatId: ${settings.internalChatId.toString()}`);
    try {
      const chatInfo = await bot.telegram.getChat(settings.internalChatId.toString());
      const chatName = 'title' in chatInfo ? (chatInfo.title ?? chatInfo.type) : chatInfo.type;
      log('PASS', `Internal chat accessible: "${chatName}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log('FAIL', `Internal chat ${settings.internalChatId.toString()} NOT accessible: ${msg}`);
    }
  }

  // 2d. SLA-enabled chats
  let slaChats: SlaChat[] = [];
  try {
    slaChats = await prisma.chat.findMany({
      where: { slaEnabled: true, deletedAt: null },
      select: {
        id: true,
        title: true,
        accountantTelegramIds: true,
        managerTelegramIds: true,
        is24x7Mode: true,
        slaThresholdMinutes: true,
      },
    });

    if (slaChats.length === 0) {
      log('FAIL', 'No chats with slaEnabled=true — SLA monitoring inactive for ALL chats');
    } else {
      log('PASS', `${slaChats.length} chat(s) with SLA enabled`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('FAIL', `Failed to query SLA-enabled chats: ${msg}`);
    return [];
  }

  // 2e. Chat-level recipient audit
  for (const chat of slaChats) {
    const hasAccountant = chat.accountantTelegramIds && chat.accountantTelegramIds.length > 0;
    const hasManager = chat.managerTelegramIds && chat.managerTelegramIds.length > 0;
    const chatLabel = `Chat ${chat.id.toString()} "${chat.title ?? '(no title)'}"`;

    if (!hasAccountant && !hasManager) {
      log(
        'WARN',
        `${chatLabel} has no accountant/manager IDs — will use globalManagerIds as fallback`
      );
    } else {
      log(
        'INFO',
        `${chatLabel}: ${chat.accountantTelegramIds?.length ?? 0} accountant(s), ` +
          `${chat.managerTelegramIds?.length ?? 0} manager(s), ` +
          `threshold=${chat.slaThresholdMinutes}min, 24x7=${chat.is24x7Mode}`
      );
    }
  }

  // 2f. SLA warning percent
  log(
    'INFO',
    `slaWarningPercent=${settings.slaWarningPercent}% ` +
      `(${settings.slaWarningPercent > 0 ? 'warnings enabled' : 'warnings DISABLED'})`
  );

  return slaChats;
}

// ============================================================================
// PHASE 3: QUEUE HEALTH
// ============================================================================

async function phase3QueueHealth(): Promise<void> {
  phaseHeader(3, 'QUEUE HEALTH');

  // 3a/3b. Job counts for both queues
  // Use Queue<any> to allow heterogeneous queue types in a single array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queuePairs: Array<[string, Queue<any>]> = [
    [QUEUE_NAMES.SLA_TIMERS, slaTimerQueue],
    [QUEUE_NAMES.ALERTS, alertQueue],
  ];

  for (const [name, queue] of queuePairs) {
    try {
      const counts = await queue.getJobCounts(
        'waiting',
        'delayed',
        'active',
        'failed',
        'completed'
      );
      log(
        'INFO',
        `Queue "${name}": waiting=${counts['waiting'] ?? 0}, delayed=${counts['delayed'] ?? 0}, ` +
          `active=${counts['active'] ?? 0}, failed=${counts['failed'] ?? 0}, completed=${counts['completed'] ?? 0}`
      );
      const failedCount = counts['failed'] ?? 0;
      if (failedCount > 0) {
        log('WARN', `Queue "${name}" has ${failedCount} failed job(s) — check worker logs`);
        try {
          const failedJobs = await queue.getFailed(0, 2);
          for (const job of failedJobs) {
            log('INFO', `  Failed job ${job.id ?? '?'}: ${job.failedReason ?? 'unknown reason'}`);
          }
        } catch {
          // Non-critical: can't list failed jobs
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log('FAIL', `Failed to get job counts for queue "${name}": ${msg}`);
    }
  }

  // 3c. Worker detection
  try {
    const slaWorkers = await slaTimerQueue.getWorkers();
    if (slaWorkers.length === 0) {
      log(
        'FAIL',
        `No workers connected to "${QUEUE_NAMES.SLA_TIMERS}" queue — jobs will NOT be processed!`
      );
    } else {
      log('PASS', `${slaWorkers.length} worker(s) connected to "${QUEUE_NAMES.SLA_TIMERS}" queue`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('WARN', `Could not check workers for "${QUEUE_NAMES.SLA_TIMERS}": ${msg}`);
  }

  try {
    const alertWorkers = await alertQueue.getWorkers();
    if (alertWorkers.length === 0) {
      log(
        'FAIL',
        `No workers connected to "${QUEUE_NAMES.ALERTS}" queue — notifications will NOT be delivered!`
      );
    } else {
      log('PASS', `${alertWorkers.length} worker(s) connected to "${QUEUE_NAMES.ALERTS}" queue`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('WARN', `Could not check workers for "${QUEUE_NAMES.ALERTS}": ${msg}`);
  }

  // 3d. Orphaned timers: pending requests with slaTimerStartedAt but no BullMQ job
  try {
    const pendingRequests = await prisma.clientRequest.findMany({
      where: {
        status: { in: ['pending'] },
        slaTimerStartedAt: { not: null },
      },
      select: { id: true, chatId: true, receivedAt: true },
      take: 50,
    });

    if (pendingRequests.length === 0) {
      log('INFO', 'No pending requests with active SLA timers');
    } else {
      let orphanCount = 0;
      for (const req of pendingRequests) {
        try {
          const job = await slaTimerQueue.getJob(`sla-${req.id}`);
          if (!job) {
            orphanCount++;
            log(
              'WARN',
              `Orphaned timer: request ${req.id} (chat ${req.chatId.toString()}) has slaTimerStartedAt but no BullMQ job`
            );
          }
        } catch {
          // Skip individual job check errors
        }
      }

      if (orphanCount === 0) {
        log(
          'PASS',
          `All ${pendingRequests.length} pending request(s) have corresponding BullMQ jobs`
        );
      } else {
        log(
          'WARN',
          `${orphanCount}/${pendingRequests.length} pending requests are orphaned (no BullMQ job) — run recovery`
        );
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('WARN', `Failed to check orphaned timers: ${msg}`);
  }
}

// ============================================================================
// PHASE 4: WORKING HOURS
// ============================================================================

async function phase4WorkingHours(slaChats: SlaChat[]): Promise<void> {
  phaseHeader(4, 'WORKING HOURS');

  let schedule: WorkingSchedule;

  try {
    const settings = await getGlobalSettings();
    schedule = {
      timezone: settings.defaultTimezone || DEFAULT_WORKING_SCHEDULE.timezone,
      workingDays:
        settings.defaultWorkingDays.length > 0
          ? settings.defaultWorkingDays
          : DEFAULT_WORKING_SCHEDULE.workingDays,
      startTime: settings.defaultStartTime || DEFAULT_WORKING_SCHEDULE.startTime,
      endTime: settings.defaultEndTime || DEFAULT_WORKING_SCHEDULE.endTime,
      holidays: [],
      is24x7: false,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('WARN', `Failed to load GlobalSettings for schedule; using defaults: ${msg}`);
    schedule = { ...DEFAULT_WORKING_SCHEDULE };
  }

  const now = new Date();

  try {
    const isWorking = isWorkingTime(now, schedule);
    if (isWorking) {
      log(
        'PASS',
        `Current time is within working hours (${schedule.timezone}, ${schedule.startTime}–${schedule.endTime})`
      );
    } else {
      log(
        'WARN',
        `Currently OUTSIDE working hours (${schedule.timezone}, ${schedule.startTime}–${schedule.endTime}). ` +
          `SLA timers will delay until next working period.`
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('WARN', `isWorkingTime check failed: ${msg}`);
  }

  // Hypothetical 2-minute SLA delay
  try {
    const testDelay = calculateDelayUntilBreach(now, 2, schedule);
    const delayMin = Math.round(testDelay / 60000);
    const delayHours = (testDelay / 3600000).toFixed(1);

    if (testDelay > 3600000) {
      log(
        'WARN',
        `2-min SLA breach would fire in ${delayMin} min (${delayHours}h) — ` +
          `large delay due to working hours schedule`
      );
    } else {
      log(
        'INFO',
        `2-min SLA breach would fire in ${delayMin} min (${(testDelay / 1000).toFixed(0)}s delay)`
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('WARN', `calculateDelayUntilBreach check failed: ${msg}`);
  }

  // 24x7 mode summary
  const twentyFourSevenChats = slaChats.filter((c) => c.is24x7Mode);
  log(
    'INFO',
    `${twentyFourSevenChats.length} of ${slaChats.length} SLA-enabled chat(s) in 24/7 mode (bypasses working hours)`
  );
}

// ============================================================================
// PHASE 5: TELEGRAM DELIVERY TEST
// ============================================================================

async function phase5TelegramDelivery(): Promise<void> {
  phaseHeader(5, 'TELEGRAM DELIVERY TEST');

  if (skipDelivery) {
    log('INFO', 'Phase 5 skipped (--skip-delivery flag)');
    return;
  }

  let recipientId: string | null = null;

  if (managerIdOverride) {
    recipientId = managerIdOverride;
    log('INFO', `Using --manager-id override: ${recipientId}`);
  } else {
    try {
      const settings = await getGlobalSettings();
      recipientId = settings.globalManagerIds?.[0] ?? null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log('FAIL', `Could not load globalManagerIds: ${msg}`);
      return;
    }
  }

  if (!recipientId) {
    log(
      'FAIL',
      'No recipient for Telegram delivery test — globalManagerIds is empty and no --manager-id provided'
    );
    return;
  }

  try {
    const testMsg = await bot.telegram.sendMessage(
      recipientId,
      `[E2E-TEST] SLA diagnostic test message.\nSent at: ${new Date().toISOString()}\nThis message will be auto-deleted.`
    );
    log('PASS', `Telegram message sent to ${recipientId} (message_id: ${testMsg.message_id})`);

    // Attempt cleanup
    try {
      await bot.telegram.deleteMessage(recipientId, testMsg.message_id);
      log('INFO', 'Test message deleted');
    } catch {
      log(
        'WARN',
        'Could not delete test message (may have been deleted by user or bot lacks permission)'
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('403') || msg.includes('Forbidden')) {
      log(
        'FAIL',
        `Manager ${recipientId} has NOT started a conversation with the bot (403 Forbidden). ` +
          `Bot cannot send DMs to users who have not initiated contact.`
      );
    } else if (msg.includes('400') || msg.includes('chat not found')) {
      log('FAIL', `Chat/user ${recipientId} not found (400): ${msg}`);
    } else {
      log('FAIL', `Telegram send failed to ${recipientId}: ${msg}`);
    }
  }
}

// ============================================================================
// PHASE 6: FULL PIPELINE TEST
// ============================================================================

async function phase6PipelineTest(slaChats: SlaChat[]): Promise<void> {
  phaseHeader(6, 'FULL PIPELINE TEST');

  if (skipDelivery) {
    log('INFO', 'Phase 6 skipped (--skip-delivery flag)');
    return;
  }

  let testRequestId: string | null = null;

  try {
    // 6a. Select a test chat
    const testChat = slaChats.find((c) => c.is24x7Mode) ?? slaChats[0];
    if (!testChat) {
      log(
        'FAIL',
        'No SLA-enabled chat available for pipeline test — add at least one chat with slaEnabled=true'
      );
      return;
    }
    log(
      'INFO',
      `Using chat ${testChat.id.toString()} "${testChat.title ?? '(no title)'}" for pipeline test`
    );

    // 6b. Create a test ClientRequest (2 min in the past → guaranteed breach)
    const testMessageId = BigInt(Date.now());
    const request = await prisma.clientRequest.create({
      data: {
        chatId: testChat.id,
        messageId: testMessageId,
        messageText: '[E2E-TEST] SLA diagnostic pipeline test — auto-cleanup',
        clientUsername: 'e2e_diagnostic',
        classification: 'REQUEST',
        classificationScore: 1.0,
        classificationModel: 'e2e-test',
        status: 'pending',
        slaTimerStartedAt: new Date(),
        receivedAt: new Date(Date.now() - 120_000), // 2 minutes ago
      },
    });
    testRequestId = request.id;
    log('PASS', `Test ClientRequest created: ${request.id}`);

    // 6c. Schedule SLA check with 0 delay (fire immediately)
    await scheduleSlaCheck(request.id, testChat.id.toString(), 1, 0);

    const scheduledJob = await slaTimerQueue.getJob(`sla-${request.id}`);
    if (scheduledJob) {
      const jobState = await scheduledJob.getState();
      log('PASS', `SLA check job scheduled: sla-${request.id} (delay=0, state=${jobState})`);
    } else {
      log('FAIL', `SLA check job NOT found in queue immediately after scheduling`);
    }

    // 6d. Poll for SlaAlert creation (up to 30s)
    let alert: {
      id: string;
      alertType: string;
      escalationLevel: number;
      deliveryStatus: string;
      telegramMessageId: bigint | null;
      alertSentAt: Date;
    } | null = null;
    const maxWaitMs = 30_000;
    const pollIntervalMs = 1_000;
    const waitStart = Date.now();

    while (Date.now() - waitStart < maxWaitMs) {
      try {
        alert = await prisma.slaAlert.findFirst({
          where: { requestId: request.id },
          orderBy: { alertSentAt: 'desc' },
          select: {
            id: true,
            alertType: true,
            escalationLevel: true,
            deliveryStatus: true,
            telegramMessageId: true,
            alertSentAt: true,
          },
        });
        if (alert) break;
      } catch {
        // Continue polling
      }

      // Also check if the job has failed
      try {
        const currentJob = await slaTimerQueue.getJob(`sla-${request.id}`);
        if (currentJob) {
          const state = await currentJob.getState();
          if (state === 'failed') {
            log('FAIL', `SLA timer job FAILED: ${currentJob.failedReason ?? 'unknown reason'}`);
            break;
          }
        }
      } catch {
        // Continue
      }

      await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    const elapsedMs = Date.now() - waitStart;

    if (alert) {
      log(
        'PASS',
        `SlaAlert created in ${elapsedMs}ms: id=${alert.id}, type=${alert.alertType}, ` +
          `level=${alert.escalationLevel}`
      );

      // 6e. Check delivery status (wait up to 5s more for alert worker)
      let deliveredAlert = alert;
      if (alert.deliveryStatus === 'pending') {
        await new Promise<void>((resolve) => setTimeout(resolve, 5_000));
        try {
          const refreshed = await prisma.slaAlert.findUnique({
            where: { id: alert.id },
            select: {
              id: true,
              alertType: true,
              escalationLevel: true,
              deliveryStatus: true,
              telegramMessageId: true,
              alertSentAt: true,
            },
          });
          if (refreshed) deliveredAlert = refreshed;
        } catch {
          // Use stale data
        }
      }

      if (deliveredAlert.deliveryStatus === 'delivered') {
        log(
          'PASS',
          `Alert DELIVERED via Telegram (telegramMessageId=${deliveredAlert.telegramMessageId?.toString() ?? 'null'})`
        );
      } else if (deliveredAlert.deliveryStatus === 'failed') {
        log('FAIL', `Alert delivery FAILED — Telegram message not sent. Check alert worker logs.`);
      } else {
        log(
          'WARN',
          `Alert delivery still PENDING after ${elapsedMs + 5_000}ms — ` +
            `alert worker may be slow or not running (status=${deliveredAlert.deliveryStatus})`
        );
      }
    } else {
      log(
        'FAIL',
        `No SlaAlert created after ${maxWaitMs / 1000}s — SLA timer worker is NOT processing jobs`
      );

      // Extra diagnostics: job state
      try {
        const remainingJob = await slaTimerQueue.getJob(`sla-${request.id}`);
        if (remainingJob) {
          const state = await remainingJob.getState();
          log('INFO', `Job sla-${request.id} is in state: ${state}`);
        } else {
          log(
            'INFO',
            `Job sla-${request.id} no longer exists in queue (consumed but no SlaAlert written?)`
          );
        }
      } catch {
        log('INFO', `Could not check job state for sla-${request.id}`);
      }
    }

    // 6f. Check request slaBreached flag
    try {
      const updatedRequest = await prisma.clientRequest.findUnique({
        where: { id: request.id },
        select: { status: true, slaBreached: true },
      });
      if (updatedRequest?.slaBreached) {
        log('PASS', `Request marked as breached (status=${updatedRequest.status})`);
      } else {
        log(
          'WARN',
          `Request NOT marked as breached (status=${updatedRequest?.status ?? 'unknown'}, ` +
            `slaBreached=${String(updatedRequest?.slaBreached ?? 'unknown')})`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log('WARN', `Could not verify request slaBreached flag: ${msg}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('FAIL', `Pipeline test error: ${msg}`);
  } finally {
    // 6g. Cleanup
    if (testRequestId && !skipCleanup) {
      try {
        await cancelSlaCheck(testRequestId).catch(() => {});
        for (let level = 1; level <= 5; level++) {
          await cancelEscalation(testRequestId, level).catch(() => {});
        }
        await prisma.slaAlert.deleteMany({ where: { requestId: testRequestId } }).catch(() => {});
        await prisma.requestHistory
          .deleteMany({ where: { requestId: testRequestId } })
          .catch(() => {});
        await prisma.clientRequest.delete({ where: { id: testRequestId } }).catch(() => {});
        log('INFO', `Test data cleaned up (requestId=${testRequestId})`);
      } catch (cleanupErr: unknown) {
        const msg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
        log('WARN', `Cleanup error: ${msg}`);
      }
    } else if (testRequestId && skipCleanup) {
      log('INFO', `Test data preserved (--skip-cleanup): requestId=${testRequestId}`);
    }
  }
}

// ============================================================================
// PHASE 7: RECOVERY CHECK
// ============================================================================

async function phase7Recovery(): Promise<void> {
  phaseHeader(7, 'RECOVERY CHECK');

  try {
    const recovery = await recoverPendingSlaTimers();
    log(
      'INFO',
      `Recovery results: total=${recovery.totalPending}, rescheduled=${recovery.rescheduled}, ` +
        `breached=${recovery.breached}, active=${recovery.alreadyActive}, failed=${recovery.failed}`
    );

    if (recovery.failed > 0) {
      log('FAIL', `${recovery.failed} timer(s) failed recovery — check logs for details`);
    } else if (recovery.breached > 0) {
      log(
        'WARN',
        `${recovery.breached} timer(s) were already breached during recovery (missed SLA breach while server was down)`
      );
    } else {
      log('PASS', 'Timer recovery completed successfully');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('FAIL', `Recovery failed: ${msg}`);
  }
}

// ============================================================================
// SUMMARY
// ============================================================================

function printSummary(): void {
  // eslint-disable-next-line no-console
  console.log('\n' + '='.repeat(60));
  // eslint-disable-next-line no-console
  console.log('DIAGNOSTIC SUMMARY');
  // eslint-disable-next-line no-console
  console.log('='.repeat(60));

  const TOTAL_PHASES = 7;
  const phaseStatuses: Record<number, 'PASS' | 'FAIL' | 'WARN' | 'SKIP'> = {};

  for (let p = 1; p <= TOTAL_PHASES; p++) {
    const phaseResults = results.filter((r) => r.phase === p);
    if (phaseResults.length === 0) {
      phaseStatuses[p] = 'SKIP';
    } else if (phaseResults.some((r) => r.level === 'FAIL')) {
      phaseStatuses[p] = 'FAIL';
    } else if (phaseResults.some((r) => r.level === 'WARN')) {
      phaseStatuses[p] = 'WARN';
    } else {
      phaseStatuses[p] = 'PASS';
    }
  }

  const phaseLabels: Record<number, string> = {
    1: 'Connectivity',
    2: 'Configuration',
    3: 'Queue Health',
    4: 'Working Hours',
    5: 'Telegram Delivery',
    6: 'Full Pipeline',
    7: 'Recovery Check',
  };

  for (let p = 1; p <= TOTAL_PHASES; p++) {
    const status = phaseStatuses[p] ?? 'SKIP';
    const label = phaseLabels[p] ?? `Phase ${p}`;
    const statusStr =
      status === 'PASS'
        ? '[PASS]'
        : status === 'FAIL'
          ? '[FAIL]'
          : status === 'WARN'
            ? '[WARN]'
            : '[SKIP]';
    // eslint-disable-next-line no-console
    console.log(`  Phase ${p}: ${statusStr.padEnd(8)} ${label}`);
  }

  // Counts
  const passCount = results.filter((r) => r.level === 'PASS').length;
  const failCount = results.filter((r) => r.level === 'FAIL').length;
  const warnCount = results.filter((r) => r.level === 'WARN').length;

  // eslint-disable-next-line no-console
  console.log(`\n  Total: ${passCount} PASS, ${failCount} FAIL, ${warnCount} WARN`);

  // DIAGNOSIS section
  const failures = results.filter((r) => r.level === 'FAIL');
  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.log('\n' + '-'.repeat(60));
    // eslint-disable-next-line no-console
    console.log('DIAGNOSIS — Root cause candidates:');
    // eslint-disable-next-line no-console
    console.log('-'.repeat(60));
    for (const f of failures) {
      // eslint-disable-next-line no-console
      console.log(`  [Phase ${f.phase}] ${f.message}`);
    }

    // Common fix hints
    const msgs = failures.map((f) => f.message.toLowerCase());
    if (msgs.some((m) => m.includes('globalmanagerids is empty'))) {
      // eslint-disable-next-line no-console
      console.log(
        '\n  FIX: Set globalManagerIds in GlobalSettings (admin UI > Settings > Manager IDs)'
      );
    }
    if (msgs.some((m) => m.includes('no workers connected'))) {
      // eslint-disable-next-line no-console
      console.log(
        '\n  FIX: Check that sla-timer.worker and alert.worker are running (index.ts startup)'
      );
    }
    if (msgs.some((m) => m.includes('403 forbidden') || m.includes('not started a conversation'))) {
      // eslint-disable-next-line no-console
      console.log('\n  FIX: Manager must send /start to the bot before it can send DMs');
    }
    if (msgs.some((m) => m.includes('globalSettings row missing'))) {
      // eslint-disable-next-line no-console
      console.log('\n  FIX: Run database seed to create GlobalSettings row');
    }
  } else {
    // eslint-disable-next-line no-console
    console.log('\n  No failures detected — pipeline appears healthy.');
  }

  // eslint-disable-next-line no-console
  console.log('='.repeat(60) + '\n');

  hasCriticalFailure = failCount > 0;
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

async function shutdown(): Promise<void> {
  try {
    await slaTimerQueue.close();
  } catch {
    // Best effort
  }
  try {
    await alertQueue.close();
  } catch {
    // Best effort
  }
  try {
    await prisma.$disconnect();
  } catch {
    // Best effort
  }
  try {
    redis.disconnect();
  } catch {
    // Best effort
  }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('\n' + '='.repeat(60));
  // eslint-disable-next-line no-console
  console.log('BuhBot E2E SLA Diagnostic');
  // eslint-disable-next-line no-console
  console.log(`Started: ${new Date().toISOString()}`);
  // eslint-disable-next-line no-console
  console.log(
    `Flags: skip-cleanup=${skipCleanup}, skip-delivery=${skipDelivery}, manager-id=${managerIdOverride ?? '(none)'}`
  );
  // eslint-disable-next-line no-console
  console.log('='.repeat(60));

  // Phase 1: Connectivity — if this fails, skip everything
  const connectivityOk = await phase1Connectivity();
  if (!connectivityOk) {
    // eslint-disable-next-line no-console
    console.log(
      '\n[CRITICAL] Phase 1 connectivity failed — skipping phases 2-7 (no point testing without DB/Redis/Telegram)\n'
    );
    printSummary();
    await shutdown();
    process.exit(1);
  }

  // Phase 2: Configuration — returns SLA-enabled chats for downstream phases
  const slaChats = await phase2Config();

  // Phase 3: Queue Health
  await phase3QueueHealth();

  // Phase 4: Working Hours
  await phase4WorkingHours(slaChats);

  // Phase 5: Telegram Delivery Test
  await phase5TelegramDelivery();

  // Phase 6: Full Pipeline Test
  await phase6PipelineTest(slaChats);

  // Phase 7: Recovery Check
  await phase7Recovery();

  // Print summary
  printSummary();

  // Graceful shutdown
  await shutdown();

  process.exit(hasCriticalFailure ? 1 : 0);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);

  console.error(`\n[FATAL] Unhandled error in diagnostic script: ${msg}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  shutdown()
    .catch(() => {})
    .finally(() => process.exit(2));
});
