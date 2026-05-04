/**
 * Invitation Handler — processVerification tests.
 *
 * Covers the accountant Telegram verification flow:
 *   - Happy path: links Telegram account to user
 *   - Invalid token
 *   - Already used token
 *   - Expired token
 *   - Telegram ID already linked to another user
 *   - Token with user having a Telegram username
 *   - Token with user without a Telegram username (null)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before vi.mock calls
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  verificationToken: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  telegramAccount: {
    upsert: vi.fn(),
  },
  $transaction: vi.fn(async (cb) => cb(mockPrisma)),
}));

vi.mock('../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../config/env.js', () => ({
  default: {
    BOT_USERNAME: 'test_bot',
    FRONTEND_URL: 'http://localhost:3000',
  },
}));

vi.mock('../../bot.js', () => ({
  bot: { start: vi.fn(), command: vi.fn(), help: vi.fn() },
  BotContext: {},
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { processVerification } from '../invitation.handler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockCtx = {
  from: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  } | null;
  chat: { id: number; type: string };
  reply: ReturnType<typeof vi.fn>;
};

function makeCtx(overrides: Partial<MockCtx> = {}): MockCtx {
  return {
    from: { id: 1169871988, username: 'testuser', first_name: 'Test', last_name: 'User' },
    chat: { id: 12345, type: 'private' },
    reply: vi.fn(),
    ...overrides,
  };
}

const VALID_TOKEN = 'verification-token-abc';
const USER_ID = '00000000-0000-0000-0000-000000000001';
const FUTURE = new Date();
FUTURE.setDate(FUTURE.getDate() + 7);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('processVerification — happy path', () => {
  it('links Telegram account when token is valid', async () => {
    const tokenData = {
      id: 'token-id',
      token: VALID_TOKEN,
      isUsed: false,
      expiresAt: FUTURE,
      userId: USER_ID,
      user: { id: USER_ID, email: 'acct@example.com' },
    };

    mockPrisma.verificationToken.findUnique.mockResolvedValue(tokenData);
    mockPrisma.user.findFirst.mockResolvedValue(null); // No existing link
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.telegramAccount.upsert.mockResolvedValue({});
    mockPrisma.verificationToken.update.mockResolvedValue({});

    const ctx = makeCtx();
    await processVerification(
      ctx as unknown as Parameters<typeof processVerification>[0],
      VALID_TOKEN
    );

    // User updated with Telegram info
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({
          telegramId: BigInt(1169871988),
          telegramUsername: 'testuser',
          isOnboardingComplete: true,
        }),
      })
    );

    // TelegramAccount upserted
    expect(mockPrisma.telegramAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { telegramId: BigInt(1169871988) },
        create: expect.objectContaining({
          userId: USER_ID,
          telegramId: BigInt(1169871988),
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
        }),
      })
    );

    // Token marked as used
    expect(mockPrisma.verificationToken.update).toHaveBeenCalled();

    // Success message sent
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Верификация успешна'),
      expect.any(Object)
    );
  });

  it('stores null username when user has no public @username', async () => {
    const tokenData = {
      id: 'token-id',
      token: VALID_TOKEN,
      isUsed: false,
      expiresAt: FUTURE,
      userId: USER_ID,
      user: { id: USER_ID },
    };

    mockPrisma.verificationToken.findUnique.mockResolvedValue(tokenData);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.telegramAccount.upsert.mockResolvedValue({});
    mockPrisma.verificationToken.update.mockResolvedValue({});

    const ctx = makeCtx({ from: { id: 999999, first_name: 'NoUsername' } });
    await processVerification(
      ctx as unknown as Parameters<typeof processVerification>[0],
      VALID_TOKEN
    );

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          telegramUsername: null,
        }),
      })
    );

    expect(mockPrisma.telegramAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          username: null,
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

describe('processVerification — error paths', () => {
  it('rejects with INVALID_TOKEN when token does not exist', async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue(null);

    const ctx = makeCtx();
    await processVerification(
      ctx as unknown as Parameters<typeof processVerification>[0],
      'bad-token'
    );

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Неверный или несуществующий токен')
    );
  });

  it('rejects with ALREADY_USED when token was already consumed', async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue({
      id: 'token-id',
      token: VALID_TOKEN,
      isUsed: true,
      expiresAt: FUTURE,
      userId: USER_ID,
      user: { id: USER_ID },
    });

    const ctx = makeCtx();
    await processVerification(
      ctx as unknown as Parameters<typeof processVerification>[0],
      VALID_TOKEN
    );

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('уже был использован'));
  });

  it('rejects with EXPIRED when token has expired', async () => {
    const PAST = new Date();
    PAST.setDate(PAST.getDate() - 1);

    mockPrisma.verificationToken.findUnique.mockResolvedValue({
      id: 'token-id',
      token: VALID_TOKEN,
      isUsed: false,
      expiresAt: PAST,
      userId: USER_ID,
      user: { id: USER_ID },
    });

    const ctx = makeCtx();
    await processVerification(
      ctx as unknown as Parameters<typeof processVerification>[0],
      VALID_TOKEN
    );

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Срок действия токена верификации истёк')
    );
  });

  it('rejects when Telegram ID is already linked to another user', async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue({
      id: 'token-id',
      token: VALID_TOKEN,
      isUsed: false,
      expiresAt: FUTURE,
      userId: USER_ID,
      user: { id: USER_ID },
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'other-user-id',
      email: 'other@example.com',
    });

    const ctx = makeCtx();
    await processVerification(
      ctx as unknown as Parameters<typeof processVerification>[0],
      VALID_TOKEN
    );

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('уже привязан к другому пользователю')
    );

    // Should not update user or create TelegramAccount
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.telegramAccount.upsert).not.toHaveBeenCalled();
  });
});
