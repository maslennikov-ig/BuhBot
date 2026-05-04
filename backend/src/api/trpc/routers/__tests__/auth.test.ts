/**
 * Auth Router — verification link regeneration tests.
 *
 * Covers:
 *   - regenerateVerificationLink: token reuse, creation, validation guards
 *   - createUser (accountant): VerificationToken creation
 *
 * We mock Prisma and env at the module boundary so the router can be invoked
 * via `createCaller`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before vi.mock calls
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  verificationToken: {
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
  },
  userManager: {
    createMany: vi.fn(),
  },
}));

// $transaction passthrough: executes callback with mockPrisma as tx client
mockPrisma.$transaction = vi.fn(async (cb) => cb(mockPrisma));

vi.mock('../../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockEnv = vi.hoisted(() => ({
  default: {
    BOT_USERNAME: 'test_bot',
    FRONTEND_URL: 'http://localhost:3000',
  },
  isDevMode: false,
}));

vi.mock('../../../../config/env.js', () => mockEnv);

// Supabase mock (needed for createUser)
const mockSupabase = vi.hoisted(() => ({
  supabase: {
    auth: {
      admin: {
        createUser: vi.fn(),
        inviteUserByEmail: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
  },
}));

vi.mock('../../../../lib/supabase.js', () => mockSupabase);

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { authRouter } from '../auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Role = 'admin' | 'manager' | 'observer' | 'accountant';

function makeCaller(user: { id: string; role: Role }) {
  return authRouter.createCaller({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocked
    prisma: mockPrisma as any,
    user: {
      id: user.id,
      email: `${user.id}@test.local`,
      fullName: 'Test User',
      role: user.role,
      isActive: true,
    },
    session: { accessToken: 'test', expiresAt: Math.floor(Date.now() / 1000) + 3600 },
  });
}

const ADMIN_CTX = { id: '00000000-0000-0000-0000-000000000001', role: 'admin' as Role };
const ACCOUNTANT = {
  id: '00000000-0000-0000-0000-000000000002',
  email: 'accountant@example.com',
  fullName: 'Test Accountant',
  role: 'accountant',
  telegramId: null,
};
const ACCT_ID = '00000000-0000-0000-0000-000000000002';
const VALID_UUID = '00000000-0000-0000-0000-000000000099';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// regenerateVerificationLink — validation guards
// ---------------------------------------------------------------------------

describe('regenerateVerificationLink — validation guards', () => {
  it('rejects non-admin callers', async () => {
    const caller = makeCaller({ id: '00000000-0000-0000-0000-000000000010', role: 'manager' });
    await expect(caller.regenerateVerificationLink({ userId: ACCT_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('returns NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const caller = makeCaller(ADMIN_CTX);
    await expect(caller.regenerateVerificationLink({ userId: VALID_UUID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns BAD_REQUEST when user is not an accountant', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000010',
      role: 'manager',
      telegramId: null,
    });
    const caller = makeCaller(ADMIN_CTX);
    await expect(
      caller.regenerateVerificationLink({ userId: '00000000-0000-0000-0000-000000000010' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('returns BAD_REQUEST when user already has telegramId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...ACCOUNTANT,
      telegramId: BigInt(123456),
    });
    const caller = makeCaller(ADMIN_CTX);
    await expect(caller.regenerateVerificationLink({ userId: ACCT_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});

// ---------------------------------------------------------------------------
// regenerateVerificationLink — token reuse
// ---------------------------------------------------------------------------

describe('regenerateVerificationLink — token reuse', () => {
  const FUTURE = new Date();
  FUTURE.setDate(FUTURE.getDate() + 5);

  it('returns existing valid token link without creating a new one', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(ACCOUNTANT);
    mockPrisma.verificationToken.findFirst.mockResolvedValue({
      token: 'existing-token-value',
      expiresAt: FUTURE,
    });

    const caller = makeCaller(ADMIN_CTX);
    const result = await caller.regenerateVerificationLink({ userId: ACCT_ID });

    expect(result.verificationLink).toContain('existing-token-value');
    expect(mockPrisma.verificationToken.create).not.toHaveBeenCalled();
    expect(mockPrisma.verificationToken.updateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// regenerateVerificationLink — new token creation
// ---------------------------------------------------------------------------

describe('regenerateVerificationLink — new token creation', () => {
  it('creates new token when no existing token found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(ACCOUNTANT);
    mockPrisma.verificationToken.findFirst.mockResolvedValue(null);
    mockPrisma.verificationToken.create.mockResolvedValue({
      token: 'new-token',
      expiresAt: new Date(),
    });

    const caller = makeCaller(ADMIN_CTX);
    const result = await caller.regenerateVerificationLink({ userId: ACCT_ID });

    expect(result.verificationLink).toContain('test_bot');
    expect(result.verificationLink).toContain('verify_');
    expect(mockPrisma.verificationToken.create).toHaveBeenCalled();
  });

  it('creates new token when existing token is expired', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(ACCOUNTANT);
    // The query filters expiresAt > now, so expired tokens are never returned
    mockPrisma.verificationToken.findFirst.mockResolvedValue(null);
    mockPrisma.verificationToken.create.mockResolvedValue({
      token: 'new-token',
      expiresAt: new Date(),
    });

    const caller = makeCaller(ADMIN_CTX);
    const result = await caller.regenerateVerificationLink({ userId: ACCT_ID });

    expect(result.verificationLink).toContain('verify_');
    expect(mockPrisma.verificationToken.create).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createUser — accountant path
// ---------------------------------------------------------------------------

describe('createUser — accountant role', () => {
  const SUPABASE_USER_ID = '00000000-0000-0000-0000-000000000003';

  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue(null); // No existing user
    mockSupabase.supabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: SUPABASE_USER_ID } },
      error: null,
    });
    mockPrisma.user.create.mockResolvedValue({
      id: SUPABASE_USER_ID,
      email: 'newacct@example.com',
      fullName: 'New Accountant',
      role: 'accountant',
      isOnboardingComplete: false,
    });
    mockPrisma.verificationToken.create.mockResolvedValue({
      id: 'token-id',
      token: 'new-verification-token',
    });
  });

  it('creates accountant with Supabase auth, User record, and VerificationToken', async () => {
    const caller = makeCaller(ADMIN_CTX);

    const result = await caller.createUser({
      email: 'newacct@example.com',
      fullName: 'New Accountant',
      role: 'accountant',
    });

    // Supabase auth user created (email_confirm: true for accountant)
    expect(mockSupabase.supabase.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newacct@example.com',
        email_confirm: true,
        user_metadata: expect.objectContaining({
          full_name: 'New Accountant',
          role: 'accountant',
        }),
      })
    );

    // User record created in our DB
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'newacct@example.com',
          fullName: 'New Accountant',
          role: 'accountant',
          isOnboardingComplete: false,
        }),
      })
    );

    // VerificationToken created for Telegram onboarding
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: SUPABASE_USER_ID,
        }),
      })
    );

    // Returns verification link
    expect(result.verificationLink).toContain('test_bot');
    expect(result.verificationLink).toContain('verify_');
    expect(result.inviteSent).toBe(false);
  });

  it('creates accountant with manager relationships when managerIds provided', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: '00000000-0000-0000-0000-000000000011' },
      { id: '00000000-0000-0000-0000-000000000012' },
    ]);

    const caller = makeCaller(ADMIN_CTX);

    await caller.createUser({
      email: 'newacct@example.com',
      fullName: 'New Accountant',
      role: 'accountant',
      managerIds: ['00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012'],
    });

    // UserManager records created
    expect(mockPrisma.userManager.createMany).toHaveBeenCalledWith({
      data: [
        { managerId: '00000000-0000-0000-0000-000000000011', accountantId: SUPABASE_USER_ID },
        { managerId: '00000000-0000-0000-0000-000000000012', accountantId: SUPABASE_USER_ID },
      ],
    });
  });

  it('returns error when user with email already exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-user-id',
      email: 'existing@example.com',
    });

    const caller = makeCaller(ADMIN_CTX);

    await expect(
      caller.createUser({
        email: 'existing@example.com',
        fullName: 'Existing User',
        role: 'accountant',
      })
    ).rejects.toThrow('Пользователь с таким email уже существует');
  });

  it('rolls back Supabase user if DB transaction fails', async () => {
    mockPrisma.user.create.mockRejectedValue(new Error('DB error'));

    const caller = makeCaller(ADMIN_CTX);

    await expect(
      caller.createUser({
        email: 'newacct@example.com',
        fullName: 'New Accountant',
        role: 'accountant',
      })
    ).rejects.toThrow('DB error');

    // Supabase user should be cleaned up
    expect(mockSupabase.supabase.auth.admin.deleteUser).toHaveBeenCalledWith(SUPABASE_USER_ID);
  });
});
