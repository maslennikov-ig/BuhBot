/**
 * Contact Accountant Service Tests
 *
 * Tests for handleContactAccountant in contact-accountant.service.ts
 *
 * Scenarios:
 * 1. Group chat — accountant found and notified
 * 2. Private chat — user found in group via ChatMessage
 * 3. Private chat — user in no groups, global managers exist
 * 4. Escalation: accountant blocked → manager notified
 * 5. Escalation: all unreachable → ALL_BLOCKED
 * 6. No recipients configured → NO_RECIPIENTS
 * 7. Partial delivery — some sent, some failed
 * 8. Chat keyboard — invite link used when available
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mocks before vi.mock calls are hoisted
const mockPrisma = vi.hoisted(() => ({
  chat: { findFirst: vi.fn() },
  chatMessage: { findFirst: vi.fn() },
}));

const mockBot = vi.hoisted(() => ({
  telegram: { sendMessage: vi.fn() },
}));

const mockGetGlobalSettings = vi.hoisted(() => vi.fn());

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../bot/bot.js', () => ({ bot: mockBot }));
vi.mock('../../../config/config.service.js', () => ({ getGlobalSettings: mockGetGlobalSettings }));
vi.mock('../../../utils/logger.js', () => ({ default: mockLogger }));

import { handleContactAccountant } from '../contact-accountant.service.js';
import type { ContactRequest } from '../contact-accountant.service.js';

// Unique userId counter to avoid the module-level rate limiter (60s cooldown per userId).
// Each test gets a fresh userId so it never hits the "already contacted" guard.
let nextUserId = 1000;

describe('handleContactAccountant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no global managers
    mockGetGlobalSettings.mockResolvedValue({ globalManagerIds: [] });
  });

  // Helper to build a chat object
  function makeChat(overrides: Record<string, unknown> = {}) {
    return {
      id: BigInt(-1001234567890),
      title: 'Test Chat',
      chatType: 'supergroup',
      accountantTelegramIds: [] as bigint[],
      managerTelegramIds: [] as string[],
      inviteLink: null as string | null,
      ...overrides,
    };
  }

  // Helper to build a request with a unique userId
  function makeRequest(overrides: Partial<ContactRequest> = {}): ContactRequest {
    return {
      userId: nextUserId++,
      chatId: -1001234567890,
      chatType: 'supergroup',
      username: 'testuser',
      ...overrides,
    };
  }

  // ─── Scenario 1: Group chat — accountant found and notified ─────────

  it('should notify accountant in group chat and return success', async () => {
    const chat = makeChat({ accountantTelegramIds: [BigInt(123)] });
    mockPrisma.chat.findFirst.mockResolvedValue(chat);
    mockBot.telegram.sendMessage.mockResolvedValue({});

    const result = await handleContactAccountant(makeRequest());

    expect(result.success).toBe(true);
    expect(result.notifiedRole).toBe('accountant');
    expect(result.notifiedIds).toEqual(['123']);
    expect(result.failedIds).toEqual([]);
    expect(result.userMessage).toContain('бухгалтеру');
    expect(mockBot.telegram.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
      '123',
      expect.stringContaining('testuser'),
      expect.anything()
    );
  });

  // ─── Scenario 2: Private chat — user found in group via ChatMessage ─

  it('should resolve group chat from ChatMessage for private chat requests', async () => {
    const chat = makeChat({ accountantTelegramIds: [BigInt(123)] });
    mockPrisma.chatMessage.findFirst.mockResolvedValue({ chatId: BigInt(-1001234567890) });
    mockPrisma.chat.findFirst.mockResolvedValue(chat);
    mockBot.telegram.sendMessage.mockResolvedValue({});

    const userId = nextUserId++;
    const privateRequest = makeRequest({
      userId,
      chatId: userId,
      chatType: 'private',
    });

    const result = await handleContactAccountant(privateRequest);

    expect(result.success).toBe(true);
    expect(result.notifiedRole).toBe('accountant');
    // Verify ChatMessage was queried with userId
    expect(mockPrisma.chatMessage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          telegramUserId: BigInt(userId),
        }),
      })
    );
  });

  // ─── Scenario 3: Private chat — no groups, global managers exist ────

  it('should fall back to global managers when private chat user has no group history', async () => {
    mockPrisma.chatMessage.findFirst.mockResolvedValue(null);
    mockGetGlobalSettings.mockResolvedValue({ globalManagerIds: ['456'] });
    mockBot.telegram.sendMessage.mockResolvedValue({});

    const userId = nextUserId++;
    const privateRequest = makeRequest({
      userId,
      chatId: userId,
      chatType: 'private',
      username: undefined,
    });

    const result = await handleContactAccountant(privateRequest);

    expect(result.success).toBe(true);
    expect(result.notifiedRole).toBe('global_manager');
    expect(result.notifiedIds).toEqual(['456']);
    expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
      '456',
      expect.stringContaining(`ID: ${userId}`),
      expect.anything()
    );
  });

  // ─── Scenario 4: Escalation: accountant blocked → manager notified ──

  it('should escalate to manager when accountant is unreachable', async () => {
    const chat = makeChat({
      accountantTelegramIds: [BigInt(123)],
      managerTelegramIds: ['456'],
    });
    mockPrisma.chat.findFirst.mockResolvedValue(chat);

    // Accountant blocked, manager OK
    mockBot.telegram.sendMessage
      .mockRejectedValueOnce(new Error('bot was blocked by the user'))
      .mockResolvedValueOnce({});

    const result = await handleContactAccountant(makeRequest());

    expect(result.success).toBe(true);
    expect(result.notifiedRole).toBe('manager');
    expect(result.notifiedIds).toEqual(['456']);
    expect(mockBot.telegram.sendMessage).toHaveBeenCalledTimes(2);
  });

  // ─── Scenario 5: All unreachable → ALL_BLOCKED ─────────────────────

  it('should return ALL_BLOCKED when all recipients are unreachable', async () => {
    const chat = makeChat({
      accountantTelegramIds: [BigInt(123)],
      managerTelegramIds: ['456'],
    });
    mockPrisma.chat.findFirst.mockResolvedValue(chat);
    mockGetGlobalSettings.mockResolvedValue({ globalManagerIds: ['789'] });

    // All send calls fail
    mockBot.telegram.sendMessage.mockRejectedValue(new Error('bot was blocked by the user'));

    const result = await handleContactAccountant(makeRequest());

    expect(result.success).toBe(false);
    expect(result.notifiedRole).toBe('none');
    expect(result.notifiedIds).toEqual([]);
    expect(result.failedIds).toEqual(['789']);
    expect(result.userMessage).toContain('недоступны');
  });

  // ─── Scenario 6: No recipients configured → NO_RECIPIENTS ──────────

  it('should return NO_RECIPIENTS when no one is configured', async () => {
    const chat = makeChat({
      accountantTelegramIds: [],
      managerTelegramIds: [],
    });
    mockPrisma.chat.findFirst.mockResolvedValue(chat);
    mockGetGlobalSettings.mockResolvedValue({ globalManagerIds: [] });

    const result = await handleContactAccountant(makeRequest());

    expect(result.success).toBe(false);
    expect(result.notifiedRole).toBe('none');
    expect(result.notifiedIds).toEqual([]);
    expect(result.failedIds).toEqual([]);
    expect(result.userMessage).toContain('не назначены');
  });

  // ─── Scenario 7: Partial delivery — some sent, some failed ──────────

  it('should report partial delivery with notifiedIds and failedIds', async () => {
    const chat = makeChat({
      accountantTelegramIds: [BigInt(111), BigInt(222)],
    });
    mockPrisma.chat.findFirst.mockResolvedValue(chat);

    // First accountant succeeds, second fails
    mockBot.telegram.sendMessage
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('bot was blocked by the user'));

    const result = await handleContactAccountant(makeRequest());

    expect(result.success).toBe(true);
    expect(result.notifiedRole).toBe('accountant');
    expect(result.notifiedIds).toEqual(['111']);
    expect(result.failedIds).toEqual(['222']);
  });

  // ─── Scenario 8: Chat keyboard — invite link used ───────────────────

  it('should include invite link in keyboard when available', async () => {
    const chat = makeChat({
      accountantTelegramIds: [BigInt(123)],
      inviteLink: 'https://t.me/+abc',
    });
    mockPrisma.chat.findFirst.mockResolvedValue(chat);
    mockBot.telegram.sendMessage.mockResolvedValue({});

    await handleContactAccountant(makeRequest());

    expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
      '123',
      expect.any(String),
      expect.objectContaining({
        reply_markup: {
          inline_keyboard: [[expect.objectContaining({ url: 'https://t.me/+abc' })]],
        },
      })
    );
  });
});
