/**
 * survey.worker — gh-292 cooldown gate tests.
 *
 * Covers the three contracts for `processSurveyDelivery`:
 *   1. Cooldown BLOCKED → no `bot.telegram.sendMessage`, delivery row gets
 *      status='failed' + skipReason starting with 'cooldown:', and the handler
 *      RETURNS (no throw) so BullMQ does not retry.
 *   2. Cooldown MISS → sendMessage called once, delivery row and
 *      Chat.lastSurveySentAt updated atomically inside prisma.$transaction.
 *   3. Cooldown block NEVER throws → BullMQ retry path not triggered.
 *
 * Test style mirrors sla-timer.worker.test.ts (vi.hoisted mocks, BullMQ stub).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  surveyDelivery: {
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  chat: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  feedbackSurvey: {
    update: vi.fn(),
  },
  globalSettings: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const mockBot = vi.hoisted(() => ({
  telegram: {
    sendMessage: vi.fn(),
  },
}));

const mockQueueSurveyReminder = vi.hoisted(() => vi.fn());

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../bot/bot.js', () => ({ bot: mockBot }));
vi.mock('../../lib/redis.js', () => ({ redis: {} }));

vi.mock('../survey.queue.js', () => ({
  SURVEY_QUEUE_NAME: 'surveys',
  queueSurveyReminder: mockQueueSurveyReminder,
  queueManagerNotification: vi.fn(),
}));

vi.mock('../setup.js', () => ({
  registerWorker: vi.fn(),
}));

vi.mock('../../config/queue.config.js', () => ({
  queueConfig: {
    surveyConcurrency: 5,
    surveyRateLimitMax: 30,
    surveyRateLimitDuration: 1000,
    surveyAttempts: 5,
  },
  getSurveyReminderDelayMs: () => 2 * 86_400_000,
  getSurveyManagerNotifyDelayMs: () => 5 * 86_400_000,
}));

vi.mock('../../bot/keyboards/survey.keyboard.js', () => ({
  createSurveyRatingKeyboard: () => ({ reply_markup: { inline_keyboard: [] } }),
  SURVEY_MESSAGE_TEXT: 'Survey prompt text',
  SURVEY_REMINDER_TEXT: 'Survey reminder text',
}));

vi.mock('../../utils/logger.js', () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock BullMQ Worker — survey.worker.ts constructs `new Worker(...)` at module load.
vi.mock('bullmq', () => ({
  Worker: class {
    on() {
      return this;
    }
  },
  Job: class {},
}));

// Import AFTER mocks. processSurveyDelivery is exported for this test (gh-292).
import { processSurveyDelivery } from '../survey.worker.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function buildJob(): Job<{
  surveyId: string;
  chatId: string;
  deliveryId: string;
  quarter: string;
}> {
  return {
    id: 'job-test',
    attemptsMade: 0,
    data: {
      surveyId: 'survey-uuid',
      chatId: '-100123',
      deliveryId: 'delivery-uuid',
      quarter: '2026-Q2',
    },
  } as unknown as Job<{
    surveyId: string;
    chatId: string;
    deliveryId: string;
    quarter: string;
  }>;
}

/**
 * Default: cooldown settings row with 24h cooldown; chat has no prior delivery
 * (eligible); sendMessage succeeds; $transaction executes its callback with a
 * tx proxy that forwards to the same mockPrisma methods.
 */
function primeAllowedPath(): void {
  mockPrisma.globalSettings.findUnique.mockResolvedValue({ surveyCooldownHours: 24 });
  mockPrisma.chat.findUnique.mockResolvedValue({ lastSurveySentAt: null });
  mockBot.telegram.sendMessage.mockResolvedValue({ message_id: 42 });
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      surveyDelivery: mockPrisma.surveyDelivery,
      chat: mockPrisma.chat,
      feedbackSurvey: mockPrisma.feedbackSurvey,
    })
  );
  mockPrisma.surveyDelivery.update.mockResolvedValue({});
  mockPrisma.chat.update.mockResolvedValue({});
  mockPrisma.feedbackSurvey.update.mockResolvedValue({});
  mockQueueSurveyReminder.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('survey.worker — gh-292 cooldown gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('BLOCKS delivery when chat is within cooldown window and does NOT throw', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00.000Z'));

    mockPrisma.globalSettings.findUnique.mockResolvedValue({ surveyCooldownHours: 24 });
    // Last delivered 6h ago → still in cooldown.
    mockPrisma.chat.findUnique.mockResolvedValue({
      lastSurveySentAt: new Date('2026-04-18T06:00:00.000Z'),
    });
    mockPrisma.surveyDelivery.update.mockResolvedValue({});

    // Job must complete without throwing — otherwise BullMQ would retry.
    await expect(processSurveyDelivery(buildJob())).resolves.toBeUndefined();

    // sendMessage must NEVER be called when blocked.
    expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();

    // Delivery row must be marked failed with a cooldown skipReason.
    expect(mockPrisma.surveyDelivery.update).toHaveBeenCalledTimes(1);
    const updateArgs = mockPrisma.surveyDelivery.update.mock.calls[0]![0]!;
    expect(updateArgs.where.id).toBe('delivery-uuid');
    expect(updateArgs.data.status).toBe('failed');
    expect(updateArgs.data.skipReason).toMatch(/^cooldown: next eligible /);
    // ISO timestamp must be included.
    expect(updateArgs.data.skipReason).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // Transactional success path must NOT be taken.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.chat.update).not.toHaveBeenCalled();
    expect(mockQueueSurveyReminder).not.toHaveBeenCalled();
  });

  it('SENDS and atomically updates delivery + Chat.lastSurveySentAt on cooldown miss', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00.000Z'));

    primeAllowedPath();

    await processSurveyDelivery(buildJob());

    // Telegram call happened exactly once.
    expect(mockBot.telegram.sendMessage).toHaveBeenCalledTimes(1);
    const sendArgs = mockBot.telegram.sendMessage.mock.calls[0]!;
    expect(sendArgs[0]).toBe('-100123');
    expect(sendArgs[1]).toBe('Survey prompt text');

    // The atomic block ran as a $transaction(callback).
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // Inside the transaction we expect exactly three writes in this order:
    //   delivery.update(delivered) → chat.update(lastSurveySentAt) → survey.update(deliveredCount)
    expect(mockPrisma.surveyDelivery.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.surveyDelivery.update.mock.calls[0]![0]!.data.status).toBe('delivered');
    expect(mockPrisma.surveyDelivery.update.mock.calls[0]![0]!.data.deliveredAt).toEqual(
      new Date('2026-04-18T12:00:00.000Z')
    );
    expect(mockPrisma.surveyDelivery.update.mock.calls[0]![0]!.data.messageId).toEqual(BigInt(42));

    expect(mockPrisma.chat.update).toHaveBeenCalledTimes(1);
    const chatUpdateArgs = mockPrisma.chat.update.mock.calls[0]![0]!;
    expect(chatUpdateArgs.where.id).toEqual(BigInt('-100123'));
    expect(chatUpdateArgs.data.lastSurveySentAt).toEqual(new Date('2026-04-18T12:00:00.000Z'));

    expect(mockPrisma.feedbackSurvey.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.feedbackSurvey.update.mock.calls[0]![0]!.data.deliveredCount).toEqual({
      increment: 1,
    });

    // Reminder scheduled after the atomic write.
    expect(mockQueueSurveyReminder).toHaveBeenCalledTimes(1);
  });

  it('cooldown block NEVER throws so BullMQ retries are not triggered', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00.000Z'));

    mockPrisma.globalSettings.findUnique.mockResolvedValue({ surveyCooldownHours: 24 });
    mockPrisma.chat.findUnique.mockResolvedValue({
      lastSurveySentAt: new Date('2026-04-18T10:00:00.000Z'),
    });
    mockPrisma.surveyDelivery.update.mockResolvedValue({});

    // Even across multiple "retry attempts" BullMQ would issue, the handler
    // returns cleanly, so no retry ever happens.
    let thrown: unknown = null;
    try {
      await processSurveyDelivery(buildJob());
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeNull();
    expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
  });
});
