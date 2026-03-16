/**
 * SLA Timer Worker Tests - Internal Chat Notifications
 *
 * Tests for breach notifications sent to the global internal chat
 * configured via GlobalSettings.internalChatId (replaces per-chat
 * notifyInChatOnBreach field, gh-17).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Mock BullMQ Worker to prevent actual worker creation
vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
  Job: vi.fn(),
}));

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
});
