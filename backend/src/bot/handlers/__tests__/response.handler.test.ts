/**
 * Unit Tests for isAccountantForChat function
 *
 * Tests all check levels for accountant validation:
 * - Check 0: Telegram ID in accountantTelegramIds array (secure, immutable)
 * - Check 1: Telegram ID matches assignedAccountant.telegramId
 * - Check 2: Username in accountantUsernames array (fallback)
 * - Check 3: Username matches assignedAccountant.telegramUsername (fallback)
 *
 * @module bot/handlers/__tests__/response.handler.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mock implementations that are available during hoisting
const { mockPrisma, mockLogger, mockBot } = vi.hoisted(() => {
  const mockPrismaChat = {
    findUnique: vi.fn(),
  };

  return {
    mockPrisma: {
      chat: mockPrismaChat,
      chatMessage: {
        updateMany: vi.fn(),
      },
      clientRequest: {
        updateMany: vi.fn(),
      },
    },
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    mockBot: {
      on: vi.fn(),
      use: vi.fn(),
      command: vi.fn(),
      hears: vi.fn(),
    },
  };
});

// Mock modules before importing (uses hoisted variables)
vi.mock('../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../utils/logger.js', () => ({
  default: mockLogger,
}));

// Mock bot module to prevent env.ts validation side-effect (bot.ts → env.ts)
vi.mock('../../bot.js', () => ({
  bot: mockBot,
  BotContext: {},
}));

// Mock SLA services to prevent transitive env imports
vi.mock('../../../services/sla/timer.service.js', () => ({
  stopSlaTimer: vi.fn(),
}));

vi.mock('../../../services/sla/request.service.js', () => ({
  getRequestByMessage: vi.fn(),
  findLatestPendingRequest: vi.fn(),
}));

// Mock alert services added for buh-q605 (alert resolution on accountant response)
vi.mock('../../../services/alerts/alert.service.js', () => ({
  resolveAlertsForRequest: vi.fn(),
}));

vi.mock('../../../queues/alert.queue.js', () => ({
  cancelAllEscalations: vi.fn(),
}));

// Now import the function under test and the registration function
import { isAccountantForChat, registerResponseHandler } from '../response.handler.js';

describe('isAccountantForChat', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Check 2 - accountantUsernames array match (username fallback)', () => {
    it('should match when username is in accountantUsernames array', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: ['accountant1', 'accountant2', 'accountant3'],
        assignedAccountantId: 'accountant_uuid_1',
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(BigInt(123), 'accountant2', 456);

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_1');
      expect(mockPrisma.chat.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(123) },
        include: { assignedAccountant: true },
      });
    });

    it('should match when username has @ prefix (normalized)', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: ['accountant1', '@accountant2'],
        assignedAccountantId: 'accountant_uuid_2',
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'accountant2', // No @ prefix in input
        456
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_2');
    });

    it('should match case-insensitively', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: ['AccountantOne', 'ACCOUNTANTTWO'],
        assignedAccountantId: 'accountant_uuid_3',
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'accountanttwo', // lowercase
        456
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_3');
    });

    it('should handle both @ prefix and case normalization', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: ['@AccountantOne'],
        assignedAccountantId: 'accountant_uuid_4',
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'accountantone', // lowercase, no @
        456
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_4');
    });

    it('should not match when username is not in array', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: ['accountant1', 'accountant2'],
        assignedAccountantId: null,
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(BigInt(123), 'different_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
    });

    it('should handle empty accountantUsernames array', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: [],
        assignedAccountantId: null,
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(BigInt(123), 'some_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
    });

    it('should skip check when accountantUsernames is null', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: null,
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(BigInt(123), 'some_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
    });
  });

  describe('Check 3 - assignedAccountant.telegramUsername match', () => {
    it('should match when username equals assignedAccountant.telegramUsername', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: 'accountant_uuid_8',
        assignedAccountant: {
          id: 'accountant_uuid_8',
          telegramUsername: 'assigned_accountant',
          telegramId: BigInt(789),
        },
      });

      const result = await isAccountantForChat(BigInt(123), 'assigned_accountant', 456);

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_8');
    });

    it('should match case-insensitively', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: 'accountant_uuid_9',
        assignedAccountant: {
          id: 'accountant_uuid_9',
          telegramUsername: 'AssignedAccountant',
          telegramId: BigInt(789),
        },
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'assignedaccountant', // lowercase
        456
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_9');
    });

    it('should normalize @ prefix', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: 'accountant_uuid_10',
        assignedAccountant: {
          id: 'accountant_uuid_10',
          telegramUsername: '@assigned_accountant',
          telegramId: BigInt(789),
        },
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'assigned_accountant', // No @ prefix
        456
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_10');
    });

    it('should not match when username is different', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: 'accountant_uuid_11',
        assignedAccountant: {
          id: 'accountant_uuid_11',
          telegramUsername: 'assigned_accountant',
          telegramId: BigInt(789),
        },
      });

      const result = await isAccountantForChat(BigInt(123), 'different_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
    });

    it('should skip check when assignedAccountant is null', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: null,
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(BigInt(123), 'some_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
    });

    it('should skip check when assignedAccountant.telegramUsername is null', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: 'accountant_uuid_12',
        assignedAccountant: {
          id: 'accountant_uuid_12',
          telegramUsername: null,
          telegramId: BigInt(789),
        },
      });

      const result = await isAccountantForChat(BigInt(123), 'some_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
    });
  });

  describe('Check 1 - assignedAccountant.telegramId match', () => {
    it('should match when telegramUserId equals assignedAccountant.telegramId', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: 'accountant_uuid_13',
        assignedAccountant: {
          id: 'accountant_uuid_13',
          telegramUsername: null,
          telegramId: BigInt(456),
        },
      });

      const result = await isAccountantForChat(
        BigInt(123),
        undefined, // No username provided
        456
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_13');
    });

    it('should match even when username is different (Telegram ID takes precedence)', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: 'accountant_uuid_14',
        assignedAccountant: {
          id: 'accountant_uuid_14',
          telegramUsername: 'accountant_username',
          telegramId: BigInt(456),
        },
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'different_username', // Different username
        456 // But matching Telegram ID
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_14');
    });

    it('should not match when telegramUserId is different', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: 'accountant_uuid_15',
        assignedAccountant: {
          id: 'accountant_uuid_15',
          telegramUsername: null,
          telegramId: BigInt(789),
        },
      });

      const result = await isAccountantForChat(
        BigInt(123),
        undefined,
        456 // Different ID
      );

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
    });

    it('should skip check when assignedAccountant.telegramId is null', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: 'accountant_uuid_16',
        assignedAccountant: {
          id: 'accountant_uuid_16',
          telegramUsername: 'accountant',
          telegramId: null,
        },
      });

      const result = await isAccountantForChat(BigInt(123), undefined, 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
    });
  });

  describe('Edge cases and priority', () => {
    it('should return false when chat is not found in database', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue(null);

      const result = await isAccountantForChat(BigInt(999), 'some_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Chat not found in database',
        expect.objectContaining({
          chatId: '999',
          service: 'response-handler',
        })
      );
    });

    it('should return false when username is undefined and no other checks pass', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: null,
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(
        BigInt(123),
        undefined, // No username
        456
      );

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
    });

    it('should prioritize Check 0 (accountantTelegramIds) over username checks', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantTelegramIds: [BigInt(456)],
        accountantUsernames: ['accountant1'],
        assignedAccountantId: 'accountant_uuid_priority_1',
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'accountant1',
        456 // Matches accountantTelegramIds
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_priority_1');
      // Should match via Check 0 (ID-based) first
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Accountant matched by accountantTelegramIds array (Check 0)',
        expect.any(Object)
      );
    });

    it('should fall through to Check 1 (assignedAccountant.telegramId) when Check 0 does not match', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantTelegramIds: [BigInt(999)], // Different ID
        accountantUsernames: ['accountant1'],
        assignedAccountantId: 'accountant_uuid_priority_2',
        assignedAccountant: {
          id: 'accountant_uuid_priority_2',
          telegramUsername: 'accountant3',
          telegramId: BigInt(456), // Matches sender
        },
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'different_user',
        456 // Matches assignedAccountant.telegramId
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_priority_2');
      // Should match via Check 1
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Accountant matched by assignedAccountant.telegramId (Check 1)',
        expect.any(Object)
      );
    });

    it('should fall through to Check 2 (accountantUsernames) when ID checks fail', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantTelegramIds: [BigInt(999)],
        accountantUsernames: ['accountant1'],
        assignedAccountantId: 'accountant_uuid_priority_3',
        assignedAccountant: {
          id: 'accountant_uuid_priority_3',
          telegramUsername: 'accountant3',
          telegramId: BigInt(789), // Different from sender
        },
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'accountant1', // Matches accountantUsernames array
        456
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_priority_3');
      // Should match via Check 2 (username fallback)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Accountant matched by accountantUsernames array (Check 2, fallback)',
        expect.any(Object)
      );
    });

    it('should fall through to Check 3 (assignedAccountant.telegramUsername) when all prior checks fail', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantTelegramIds: [],
        accountantUsernames: ['accountant1'],
        assignedAccountantId: 'accountant_uuid_priority_4',
        assignedAccountant: {
          id: 'accountant_uuid_priority_4',
          telegramUsername: 'accountant3',
          telegramId: BigInt(789),
        },
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'accountant3', // Matches assignedAccountant.telegramUsername
        456
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_priority_4');
      // Should match via Check 3 (assignedAccountant.telegramUsername fallback)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Accountant matched by assignedAccountant.telegramUsername (Check 3, fallback)',
        expect.any(Object)
      );
    });

    it('should return false when no accountant is configured for chat', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: null,
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(BigInt(123), 'some_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No accountant match found',
        expect.objectContaining({
          chatId: '123',
          username: 'some_user',
          telegramUserId: 456,
        })
      );
    });

    it('should re-throw database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.chat.findUnique.mockRejectedValue(dbError);

      await expect(isAccountantForChat(BigInt(123), 'some_user', 456)).rejects.toThrow(
        'Database connection failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error checking if user is accountant, re-throwing',
        expect.objectContaining({
          chatId: '123',
          username: 'some_user',
          telegramUserId: 456,
          error: 'Database connection failed',
          stack: expect.any(String),
        })
      );
    });

    it('should re-throw non-Error exceptions', async () => {
      mockPrisma.chat.findUnique.mockRejectedValue('Unexpected error string');

      await expect(isAccountantForChat(BigInt(123), 'some_user', 456)).rejects.toBe(
        'Unexpected error string'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error checking if user is accountant, re-throwing',
        expect.objectContaining({
          error: 'Unexpected error string',
        })
      );
    });

    it('should log chat configuration for debugging', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: ['accountant1'],
        assignedAccountantId: 'accountant_uuid_debug',
        assignedAccountant: {
          id: 'accountant_uuid_debug',
          telegramUsername: 'assigned_accountant',
          telegramId: BigInt(789),
        },
      });

      await isAccountantForChat(BigInt(123), 'test_user', 456);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Chat configuration for accountant check',
        expect.objectContaining({
          chatId: '123',
          accountantUsernames: ['accountant1'],
          assignedAccountantId: 'accountant_uuid_debug',
          assignedAccountantTelegramUsername: 'assigned_accountant',
          assignedAccountantTelegramId: '789',
          senderUsername: 'test_user',
          senderTelegramId: 456,
          service: 'response-handler',
        })
      );
    });
  });

  describe('BigInt handling', () => {
    it('should correctly compare BigInt telegramUserId values', async () => {
      const largeTelegramId = BigInt('9007199254740992'); // First value above MAX_SAFE_INTEGER

      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        assignedAccountantId: 'accountant_uuid_bigint',
        assignedAccountant: {
          id: 'accountant_uuid_bigint',
          telegramUsername: null,
          telegramId: largeTelegramId,
        },
      });

      const result = await isAccountantForChat(BigInt(123), undefined, Number(largeTelegramId));

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_bigint');
    });

    it('should correctly handle chatId as BigInt', async () => {
      const largeChatId = BigInt('-1001234567890'); // Typical Telegram supergroup ID

      mockPrisma.chat.findUnique.mockResolvedValue({
        id: largeChatId,
        accountantUsernames: ['accountant1'],
        assignedAccountantId: 'accountant_uuid_bigchat',
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(largeChatId, 'accountant1', 456);

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_bigchat');
      expect(mockPrisma.chat.findUnique).toHaveBeenCalledWith({
        where: { id: largeChatId },
        include: { assignedAccountant: true },
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Step 7: resolveAlertsForRequest + cancelAllEscalations on accountant response
// ---------------------------------------------------------------------------

import { resolveAlertsForRequest } from '../../../services/alerts/alert.service.js';
import { cancelAllEscalations } from '../../../queues/alert.queue.js';
import {
  getRequestByMessage,
  findLatestPendingRequest,
} from '../../../services/sla/request.service.js';
import { stopSlaTimer } from '../../../services/sla/timer.service.js';

describe('Response handler - alert resolution (step 7)', () => {
  // Capture the handler registered via bot.on(message('text'), handler)
  let responseHandler: (ctx: unknown) => Promise<void>;

  /**
   * Build a minimal Telegraf-like context for a text message from an accountant.
   * isAccountantForChat runs against prisma.chat.findUnique, so we control its
   * outcome by configuring mockPrisma.chat.findUnique in each test's beforeEach.
   */
  function buildResponseCtx(
    overrides: {
      chatId?: number;
      messageId?: number;
      telegramUserId?: number;
      username?: string;
      text?: string;
      chatType?: string;
    } = {}
  ) {
    const {
      chatId = -1009999999999,
      messageId = 1001,
      telegramUserId = 44444,
      username = 'accountant_user',
      text = 'Ответил клиенту',
      chatType = 'supergroup',
    } = overrides;

    return {
      chat: { id: chatId, type: chatType },
      message: {
        message_id: messageId,
        text,
        reply_to_message: undefined,
      },
      from: { id: telegramUserId, username, first_name: 'Test', last_name: 'User' },
    };
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    // Capture the handler from bot.on() — second argument is the handler function
    mockBot.on.mockImplementation((_filter: unknown, handler: (ctx: unknown) => Promise<void>) => {
      responseHandler = handler;
    });

    // Make isAccountantForChat return true by default:
    // accountantTelegramIds contains the sender's Telegram ID (44444 → BigInt(44444))
    mockPrisma.chat.findUnique.mockResolvedValue({
      id: BigInt(-1009999999999),
      accountantTelegramIds: [BigInt(44444)],
      accountantUsernames: [],
      assignedAccountantId: 'acc-uuid-123',
      assignedAccountant: null,
    });

    // No direct reply to a tracked message
    vi.mocked(getRequestByMessage).mockResolvedValue(null);

    // LIFO: one pending request
    vi.mocked(findLatestPendingRequest).mockResolvedValue({
      id: 'req-uuid-step7',
      status: 'pending',
      chatId: String(-1009999999999),
    } as unknown as Awaited<ReturnType<typeof findLatestPendingRequest>>);

    // chatMessage link write (step 4) — non-critical
    mockPrisma.chatMessage.updateMany.mockResolvedValue({ count: 1 });

    // Successful atomic claim (step 5)
    mockPrisma.clientRequest.updateMany.mockResolvedValue({ count: 1 });

    // SLA timer stop (step 6)
    vi.mocked(stopSlaTimer).mockResolvedValue({
      workingMinutes: 15,
      breached: false,
      requestId: 'req-uuid-step7',
    } as unknown as Awaited<ReturnType<typeof stopSlaTimer>>);

    // Step 7 defaults
    vi.mocked(resolveAlertsForRequest).mockResolvedValue(1);
    vi.mocked(cancelAllEscalations).mockResolvedValue(undefined);

    registerResponseHandler();
  });

  it('resolveAlertsForRequest is called with (requestId, "accountant_responded", telegramUserId as string)', async () => {
    const ctx = buildResponseCtx({ telegramUserId: 44444 });

    await responseHandler(ctx);

    expect(resolveAlertsForRequest).toHaveBeenCalledWith(
      'req-uuid-step7',
      'accountant_responded',
      '44444'
    );
  });

  it('cancelAllEscalations is called unconditionally after resolveAlertsForRequest (even when resolvedCount is 0)', async () => {
    vi.mocked(resolveAlertsForRequest).mockResolvedValue(0);

    const ctx = buildResponseCtx();

    await responseHandler(ctx);

    expect(cancelAllEscalations).toHaveBeenCalledWith('req-uuid-step7');
    expect(cancelAllEscalations).toHaveBeenCalledTimes(1);
  });

  it('step 7 failure does not propagate — handler completes without throwing', async () => {
    vi.mocked(resolveAlertsForRequest).mockRejectedValue(new Error('Alert DB error'));

    const ctx = buildResponseCtx();

    // Must not throw or reject
    await expect(responseHandler(ctx)).resolves.toBeUndefined();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to resolve SLA alerts (non-critical)',
      expect.objectContaining({ error: 'Alert DB error' })
    );
  });

  it('step 7 is NOT called when claim fails (count=0 means request already resolved by another handler)', async () => {
    mockPrisma.clientRequest.updateMany.mockResolvedValue({ count: 0 });

    const ctx = buildResponseCtx();

    await responseHandler(ctx);

    expect(resolveAlertsForRequest).not.toHaveBeenCalled();
    expect(cancelAllEscalations).not.toHaveBeenCalled();
  });
});
