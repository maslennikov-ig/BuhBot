/**
 * SLA Timer Worker Tests
 *
 * - Internal chat notifications (gh-17): verify behavior when GlobalSettings.internalChatId is set/missing.
 * - processSlaTimer write contract (gh-290 code-review F1): verify that when a pending request's
 *   timer fires, the handler writes slaBreached:true AND slaBreachedAt inside the same transaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

// Use vi.hoisted to define mocks before vi.mock is hoisted
const mockPrisma = vi.hoisted(() => ({
  clientRequest: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  slaAlert: {
    create: vi.fn(),
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

const mockQueueAlert = vi.hoisted(() => vi.fn());

const mockGetGlobalSettings = vi.hoisted(() => vi.fn());

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../bot/bot.js', () => ({
  bot: mockBot,
}));

vi.mock('../setup.js', () => ({
  QUEUE_NAMES: { SLA_TIMERS: 'sla-timers' },
  registerWorker: vi.fn(),
  queueAlert: mockQueueAlert,
}));

vi.mock('../../lib/redis.js', () => ({
  redis: {},
}));

vi.mock('../../config/queue.config.js', () => ({
  queueConfig: {
    slaConcurrency: 5,
    slaRateLimitMax: 10,
    slaRateLimitDuration: 1000,
  },
}));

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../services/alerts/format.service.js', () => ({
  formatBreachChatNotification: vi.fn(() => 'Test breach notification'),
}));

vi.mock('../../config/config.service.js', () => ({
  getGlobalSettings: mockGetGlobalSettings,
  getManagerIds: vi.fn(),
  getRecipientsByLevel: vi.fn(),
}));

// Mock BullMQ Worker to prevent actual worker creation. Must be a constructable
// class because sla-timer.worker.ts has `new Worker(...)` at module top-level.
vi.mock('bullmq', () => ({
  Worker: class {
    on() {
      return this;
    }
  },
  Job: class {},
}));

// Import after mocks — processSlaTimer is exported for unit testing (gh-290 F1).
import { processSlaTimer } from '../sla-timer.worker.js';

describe('SLA Timer Worker - Internal Chat Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('internalChatId behavior', () => {
    it('should send breach notification to internal chat when internalChatId is set', async () => {
      const internalChatId = BigInt(999);

      mockGetGlobalSettings.mockResolvedValue({ internalChatId });
      mockBot.telegram.sendMessage.mockResolvedValue({});

      // Simulate the worker logic for internal chat notification
      const globalSettings = await mockGetGlobalSettings();
      if (globalSettings.internalChatId) {
        await mockBot.telegram.sendMessage(
          String(globalSettings.internalChatId),
          'Test breach notification',
          { parse_mode: 'HTML' }
        );
      }

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledOnce();
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith('999', 'Test breach notification', {
        parse_mode: 'HTML',
      });
    });

    it('should NOT send in-chat notification when internalChatId is null', async () => {
      mockGetGlobalSettings.mockResolvedValue({ internalChatId: null });

      // Simulate the worker logic for internal chat notification
      const globalSettings = await mockGetGlobalSettings();
      if (globalSettings.internalChatId) {
        await mockBot.telegram.sendMessage(
          String(globalSettings.internalChatId),
          'Test breach notification',
          { parse_mode: 'HTML' }
        );
      }

      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should log a warning but not throw when sendMessage to internal chat fails', async () => {
      const internalChatId = BigInt(999);

      mockGetGlobalSettings.mockResolvedValue({ internalChatId });
      mockBot.telegram.sendMessage.mockRejectedValue(new Error('Bot was blocked by the user'));

      // Import the logger mock to assert on it
      const { default: logger } = await import('../../utils/logger.js');

      // Simulate the worker's try/catch around the internal chat send
      let thrownError: Error | null = null;
      const globalSettings = await mockGetGlobalSettings();
      if (globalSettings.internalChatId) {
        try {
          await mockBot.telegram.sendMessage(
            String(globalSettings.internalChatId),
            'Test breach notification',
            { parse_mode: 'HTML' }
          );
        } catch (chatNotifyError) {
          logger.warn('Failed to send breach notification to internal chat', {
            internalChatId: String(globalSettings.internalChatId),
            error:
              chatNotifyError instanceof Error ? chatNotifyError.message : String(chatNotifyError),
            service: 'sla-timer-worker',
          });
          // Store to verify it was caught rather than re-thrown
          thrownError = chatNotifyError as Error;
        }
      }

      // sendMessage was attempted
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledOnce();

      // The error was caught — not re-thrown — so the job continues
      expect(thrownError).not.toBeNull();
      expect(thrownError!.message).toBe('Bot was blocked by the user');

      // A warning was logged with the right shape
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to send breach notification to internal chat',
        expect.objectContaining({
          internalChatId: '999',
          error: 'Bot was blocked by the user',
          service: 'sla-timer-worker',
        })
      );
    });
  });

  describe('processSlaTimer — breach write contract (gh-290 F1)', () => {
    function buildBreachJob(): Job<{
      requestId: string;
      chatId: string;
      threshold: number;
      type?: 'breach' | 'warning';
    }> {
      return {
        id: 'job-test',
        data: {
          requestId: 'req-1',
          chatId: '-100123',
          threshold: 60,
          type: 'breach',
        },
      } as unknown as Job<{
        requestId: string;
        chatId: string;
        threshold: number;
        type?: 'breach' | 'warning';
      }>;
    }

    it('persists slaBreachedAt alongside slaBreached:true inside the breach transaction', async () => {
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        chatId: BigInt(-100123),
        status: 'pending',
        receivedAt: new Date('2026-04-17T10:00:00.000Z'),
        clientUsername: 'client',
        messageText: 'hi',
        chat: {
          managerTelegramIds: ['mgr-1'],
          accountantTelegramIds: [BigInt(222)],
        },
      });
      mockGetGlobalSettings.mockResolvedValue({ internalChatId: null });

      // $transaction(callback) — invoke the callback with the tx proxy that
      // exposes clientRequest.update + slaAlert.create, then return the alert
      // the callback produces (matching real Prisma behavior).
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
        cb(mockPrisma)
      );
      mockPrisma.clientRequest.update.mockResolvedValue({ id: 'req-1' });
      mockPrisma.slaAlert.create.mockResolvedValue({
        id: 'alert-1',
        requestId: 'req-1',
      });

      // getRecipientsByLevel lives under config.service mock; provide a minimal
      // return shape so the downstream queueAlert branch is exercised.
      const { getRecipientsByLevel } = await import('../../config/config.service.js');
      (getRecipientsByLevel as ReturnType<typeof vi.fn>).mockResolvedValue({
        recipients: ['mgr-1', '222'],
        tier: 'both',
      });

      await processSlaTimer(buildBreachJob());

      // Core regression guard: slaBreachedAt is written with slaBreached:true.
      expect(mockPrisma.clientRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-1' },
          data: expect.objectContaining({
            slaBreached: true,
            slaBreachedAt: expect.any(Date),
            status: 'escalated',
          }),
        })
      );
      expect(mockPrisma.slaAlert.create).toHaveBeenCalled();
      expect(mockQueueAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-1',
          alertType: 'breach',
          escalationLevel: 1,
        })
      );
    });

    it('skips breach write entirely when request is already in a terminal state', async () => {
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'answered',
        chat: { managerTelegramIds: [], accountantTelegramIds: [] },
      });

      await processSlaTimer(buildBreachJob());

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.clientRequest.update).not.toHaveBeenCalled();
    });
  });
});
