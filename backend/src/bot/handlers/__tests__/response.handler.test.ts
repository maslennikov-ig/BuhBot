/**
 * Unit Tests for isAccountantForChat function
 *
 * Tests all 4 check levels for accountant validation:
 * - Check 0: Username in accountantUsernames array (highest priority)
 * - Check 1: Username matches accountantUsername field (legacy)
 * - Check 2: Username matches assignedAccountant.telegramUsername
 * - Check 3: Telegram ID matches assignedAccountant.telegramId
 *
 * @module bot/handlers/__tests__/response.handler.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mock implementations that are available during hoisting
const { mockPrisma, mockLogger } = vi.hoisted(() => {
  const mockPrismaChat = {
    findUnique: vi.fn(),
  };

  return {
    mockPrisma: {
      chat: mockPrismaChat,
    },
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
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

// Now import the function under test
import { isAccountantForChat } from '../response.handler.js';

describe('isAccountantForChat', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Check 0 - accountantUsernames array match (highest priority)', () => {
    it('should match when username is in accountantUsernames array', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: ['accountant1', 'accountant2', 'accountant3'],
        accountantUsername: null,
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
        accountantUsername: null,
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
        accountantUsername: null,
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
        accountantUsername: null,
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
        accountantUsername: null,
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
        accountantUsername: null,
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
        accountantUsername: null,
        assignedAccountantId: null,
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(BigInt(123), 'some_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
    });
  });

  describe('Check 1 - Legacy accountantUsername field match', () => {
    it('should match when username equals accountantUsername', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        accountantUsername: 'legacy_accountant',
        assignedAccountantId: 'accountant_uuid_5',
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(BigInt(123), 'legacy_accountant', 456);

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_5');
    });

    it('should match case-insensitively', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        accountantUsername: 'LegacyAccountant',
        assignedAccountantId: 'accountant_uuid_6',
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'legacyaccountant', // lowercase
        456
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_6');
    });

    it('should normalize @ prefix in both username and accountantUsername', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        accountantUsername: '@legacy_accountant',
        assignedAccountantId: 'accountant_uuid_7',
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'legacy_accountant', // No @ prefix
        456
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_7');
    });

    it('should not match when username is different', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        accountantUsername: 'legacy_accountant',
        assignedAccountantId: null,
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(BigInt(123), 'different_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
    });

    it('should skip check when accountantUsername is null', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        accountantUsername: null,
        assignedAccountantId: null,
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(BigInt(123), 'some_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
    });
  });

  describe('Check 2 - assignedAccountant.telegramUsername match', () => {
    it('should match when username equals assignedAccountant.telegramUsername', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        accountantUsername: null,
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
        accountantUsername: null,
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
        accountantUsername: null,
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
        accountantUsername: null,
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
        accountantUsername: null,
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
        accountantUsername: null,
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

  describe('Check 3 - assignedAccountant.telegramId match', () => {
    it('should match when telegramUserId equals assignedAccountant.telegramId', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        accountantUsername: null,
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
        accountantUsername: null,
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
        accountantUsername: null,
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
        accountantUsername: null,
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
        accountantUsername: null,
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

    it('should prioritize Check 0 (accountantUsernames array) over Check 1 (legacy)', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: ['accountant1'],
        accountantUsername: 'accountant2', // Different from array
        assignedAccountantId: 'accountant_uuid_priority_1',
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'accountant1', // Matches array
        456
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_priority_1');
      // Should match via Check 0 first
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Accountant matched by accountantUsernames array (Check 0)',
        expect.any(Object)
      );
    });

    it('should fall through to Check 1 when Check 0 does not match', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: ['accountant1'],
        accountantUsername: 'accountant2',
        assignedAccountantId: 'accountant_uuid_priority_2',
        assignedAccountant: null,
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'accountant2', // Does not match array, but matches legacy field
        456
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_priority_2');
      // Should match via Check 1
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Accountant matched by legacy accountantUsername field (Check 1)',
        expect.any(Object)
      );
    });

    it('should fall through to Check 2 when Check 0 and Check 1 do not match', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: ['accountant1'],
        accountantUsername: 'accountant2',
        assignedAccountantId: 'accountant_uuid_priority_3',
        assignedAccountant: {
          id: 'accountant_uuid_priority_3',
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
      expect(result.accountantId).toBe('accountant_uuid_priority_3');
      // Should match via Check 2
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Accountant matched by assignedAccountant.telegramUsername (Check 2)',
        expect.any(Object)
      );
    });

    it('should fall through to Check 3 when all username checks fail', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: ['accountant1'],
        accountantUsername: 'accountant2',
        assignedAccountantId: 'accountant_uuid_priority_4',
        assignedAccountant: {
          id: 'accountant_uuid_priority_4',
          telegramUsername: 'accountant3',
          telegramId: BigInt(456), // Matches telegramUserId
        },
      });

      const result = await isAccountantForChat(
        BigInt(123),
        'different_user', // Does not match any username checks
        456 // But matches Telegram ID
      );

      expect(result.isAccountant).toBe(true);
      expect(result.accountantId).toBe('accountant_uuid_priority_4');
      // Should match via Check 3
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Accountant matched by assignedAccountant.telegramId (Check 3)',
        expect.any(Object)
      );
    });

    it('should return false when no accountant is configured for chat', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        accountantUsername: null,
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

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.chat.findUnique.mockRejectedValue(dbError);

      const result = await isAccountantForChat(BigInt(123), 'some_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error checking if user is accountant',
        expect.objectContaining({
          chatId: '123',
          username: 'some_user',
          telegramUserId: 456,
          error: 'Database connection failed',
          stack: expect.any(String),
        })
      );
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockPrisma.chat.findUnique.mockRejectedValue('Unexpected error string');

      const result = await isAccountantForChat(BigInt(123), 'some_user', 456);

      expect(result.isAccountant).toBe(false);
      expect(result.accountantId).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error checking if user is accountant',
        expect.objectContaining({
          error: 'Unexpected error string',
        })
      );
    });

    it('should log chat configuration for debugging', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: ['accountant1'],
        accountantUsername: 'legacy_accountant',
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
          chatAccountantUsername: 'legacy_accountant',
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
      const largeTelegramId = BigInt('9007199254740991'); // Max safe integer + 1

      mockPrisma.chat.findUnique.mockResolvedValue({
        id: BigInt(123),
        accountantUsernames: null,
        accountantUsername: null,
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
        accountantUsername: null,
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
