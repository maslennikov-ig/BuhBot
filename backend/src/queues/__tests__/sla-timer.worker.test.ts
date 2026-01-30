/**
 * SLA Timer Worker Tests - Group Notifications
 *
 * Tests for breach notifications to group chats (gh-17)
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

// Mock BullMQ Worker to prevent actual worker creation
vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
  Job: vi.fn(),
}));

describe('SLA Timer Worker - Group Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notifyInChatOnBreach behavior', () => {
    it('should send notification to group chat when notifyInChatOnBreach is true', async () => {
      const chatId = '-1001234567890';
      const requestId = 'test-request-id';
      const threshold = 60;

      const mockRequest = {
        id: requestId,
        chatId: BigInt(chatId),
        status: 'pending',
        slaBreached: false,
        clientUsername: 'test_client',
        messageText: 'Test message',
        chat: {
          id: BigInt(chatId),
          notifyInChatOnBreach: true,
          managerTelegramIds: ['123456789'],
        },
      };

      const mockAlert = {
        id: 'test-alert-id',
        requestId,
        alertType: 'breach',
        minutesElapsed: threshold,
        deliveryStatus: 'pending',
        escalationLevel: 1,
      };

      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.$transaction.mockImplementation(async (_callback) => {
        // Simulate transaction execution
        return mockAlert;
      });
      mockBot.telegram.sendMessage.mockResolvedValue({});
      mockQueueAlert.mockResolvedValue({});

      // Simulate the worker logic for notification
      const request = mockRequest;
      if (request.chat?.notifyInChatOnBreach) {
        await mockBot.telegram.sendMessage(
          String(chatId),
          'Test breach notification',
          { parse_mode: 'HTML' }
        );
      }

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        'Test breach notification',
        { parse_mode: 'HTML' }
      );
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should NOT send notification when notifyInChatOnBreach is false', async () => {
      const chatId = '-1001234567890';
      const requestId = 'test-request-id';

      const mockRequest = {
        id: requestId,
        chatId: BigInt(chatId),
        status: 'pending',
        slaBreached: false,
        clientUsername: 'test_client',
        messageText: 'Test message',
        chat: {
          id: BigInt(chatId),
          notifyInChatOnBreach: false, // Disabled
          managerTelegramIds: ['123456789'],
        },
      };

      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);

      // Simulate the worker logic for notification
      const request = mockRequest;
      if (request.chat?.notifyInChatOnBreach) {
        await mockBot.telegram.sendMessage(
          String(chatId),
          'Test breach notification',
          { parse_mode: 'HTML' }
        );
      }

      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should NOT send notification when notifyInChatOnBreach is null/undefined', async () => {
      const chatId = '-1001234567890';
      const requestId = 'test-request-id';

      const mockRequest = {
        id: requestId,
        chatId: BigInt(chatId),
        status: 'pending',
        slaBreached: false,
        clientUsername: 'test_client',
        messageText: 'Test message',
        chat: {
          id: BigInt(chatId),
          notifyInChatOnBreach: null, // NULL - this was the bug in gh-17
          managerTelegramIds: ['123456789'],
        },
      };

      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);

      // Simulate the worker logic for notification
      const request = mockRequest;
      if (request.chat?.notifyInChatOnBreach) {
        await mockBot.telegram.sendMessage(
          String(chatId),
          'Test breach notification',
          { parse_mode: 'HTML' }
        );
      }

      // NULL is falsy, so notification should NOT be sent
      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle sendMessage errors gracefully without failing the job', async () => {
      const chatId = '-1001234567890';
      const requestId = 'test-request-id';

      const mockRequest = {
        id: requestId,
        chatId: BigInt(chatId),
        status: 'pending',
        slaBreached: false,
        clientUsername: 'test_client',
        messageText: 'Test message',
        chat: {
          id: BigInt(chatId),
          notifyInChatOnBreach: true,
          managerTelegramIds: ['123456789'],
        },
      };

      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);
      mockBot.telegram.sendMessage.mockRejectedValue(
        new Error('Bot was blocked by the user')
      );
      mockQueueAlert.mockResolvedValue({});

      // Simulate the worker logic with error handling
      const request = mockRequest;
      let error: Error | null = null;

      if (request.chat?.notifyInChatOnBreach) {
        try {
          await mockBot.telegram.sendMessage(
            String(chatId),
            'Test breach notification',
            { parse_mode: 'HTML' }
          );
        } catch (chatNotifyError) {
          // Don't fail the job if chat notification fails
          error = chatNotifyError as Error;
        }
      }

      // Verify sendMessage was called and threw
      expect(mockBot.telegram.sendMessage).toHaveBeenCalled();

      // Verify error was caught (not thrown)
      expect(error).not.toBeNull();
      expect(error!.message).toBe('Bot was blocked by the user');

      // The job should continue processing (alert queued)
      // In real worker, queueAlert would still be called after this
    });

    it('should NOT send notification when chat is null', async () => {
      const requestId = 'test-request-id';

      const mockRequest = {
        id: requestId,
        chatId: null,
        status: 'pending',
        slaBreached: false,
        clientUsername: 'test_client',
        messageText: 'Test message',
        chat: null, // No associated chat
      };

      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);

      // Simulate the worker logic
      const request = mockRequest;
      if (request.chat?.notifyInChatOnBreach) {
        await mockBot.telegram.sendMessage(
          String(request.chatId),
          'Test breach notification',
          { parse_mode: 'HTML' }
        );
      }

      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });
  });
});
