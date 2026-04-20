/**
 * Feedback Router Tests (gh-324 / ADR-007)
 *
 * Regression coverage for the unified read model. The router is invoked via
 * `createCaller` against a mocked Prisma client; the same in-memory store
 * powers both router endpoints and the analytics helpers they call.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared store (hoisted so vi.mock factories can read it).
// ---------------------------------------------------------------------------
const store = vi.hoisted(() => {
  type LegacyRow = {
    id: string;
    chatId: bigint;
    rating: number;
    comment: string | null;
    submittedAt: Date;
    clientUsername: string | null;
    surveyId: string | null;
    requestId: string | null;
    deliveryId: string | null;
    chat: {
      title: string | null;
      assignedAccountant: {
        id: string;
        fullName: string;
        email: string;
      } | null;
    } | null;
    survey: { id: string; quarter: string | null; status: string } | null;
  };

  type VoteRow = {
    id: string;
    deliveryId: string;
    telegramUserId: bigint;
    username: string | null;
    rating: number;
    comment: string | null;
    state: 'active' | 'removed';
    createdAt: Date;
    updatedAt: Date;
    delivery: {
      chatId: bigint;
      surveyId: string;
      chat: {
        title: string | null;
        assignedAccountant: {
          id: string;
          fullName: string;
          email: string;
        } | null;
      } | null;
      survey: { id: string; quarter: string | null; status: string } | null;
    };
  };

  const state = {
    legacy: [] as LegacyRow[],
    votes: [] as VoteRow[],
    // Scoping helpers query these tables:
    userManagers: [] as { managerId: string; accountantId: string }[],
    chats: [] as { id: bigint; assignedAccountantId: string | null; deletedAt: Date | null }[],
    reset(): void {
      state.legacy = [];
      state.votes = [];
      state.userManagers = [];
      state.chats = [];
    },
  };

  return { state };
});

type DateFilter = { gte?: Date; lte?: Date } | undefined;

function matchesDate(value: Date, filter: DateFilter): boolean {
  if (!filter) return true;
  if (filter.gte && value < filter.gte) return false;
  if (filter.lte && value > filter.lte) return false;
  return true;
}

function matchesCommentNotNull(filter: { not: null } | undefined, value: string | null): boolean {
  if (!filter) return true;
  return value !== null;
}

function matchesInBigInt(filter: { in: bigint[] } | undefined, value: bigint): boolean {
  if (!filter) return true;
  return filter.in.includes(value);
}

function matchesRatingFilter(
  filter: { gte?: number; lte?: number } | undefined,
  rating: number
): boolean {
  if (!filter) return true;
  if (filter.gte !== undefined && rating < filter.gte) return false;
  if (filter.lte !== undefined && rating > filter.lte) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------
const mockPrisma = vi.hoisted(() => {
  function legacyFindMany(args: {
    where?: Record<string, unknown>;
    orderBy?: { submittedAt?: 'asc' | 'desc' };
    take?: number;
  }): unknown[] {
    const where = args.where ?? {};
    let rows = store.state.legacy.filter((r) => {
      if (!matchesDate(r.submittedAt, (where as { submittedAt?: DateFilter }).submittedAt))
        return false;
      const cw = where as { comment?: { not: null } };
      if (!matchesCommentNotNull(cw.comment, r.comment)) return false;
      const sid = (where as { surveyId?: string }).surveyId;
      if (sid !== undefined && r.surveyId !== sid) return false;
      const cidFilter = (where as { chatId?: bigint | { in: bigint[] } }).chatId;
      if (typeof cidFilter === 'bigint') {
        if (r.chatId !== cidFilter) return false;
      } else if (!matchesInBigInt(cidFilter, r.chatId)) return false;
      const rf = (where as { rating?: { gte?: number; lte?: number } }).rating;
      if (!matchesRatingFilter(rf, r.rating)) return false;
      return true;
    });
    if (args.orderBy?.submittedAt === 'desc') {
      rows = [...rows].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
    }
    if (args.take !== undefined) rows = rows.slice(0, args.take);
    return rows;
  }

  function voteFindMany(args: {
    where?: Record<string, unknown>;
    orderBy?: { updatedAt?: 'asc' | 'desc' };
    take?: number;
  }): unknown[] {
    const where = args.where ?? {};
    let rows = store.state.votes.filter((v) => {
      const stateFilter = (where as { state?: 'active' | 'removed' }).state;
      if (stateFilter !== undefined && v.state !== stateFilter) return false;
      if (!matchesDate(v.updatedAt, (where as { updatedAt?: DateFilter }).updatedAt)) return false;
      const cw = where as { comment?: { not: null } };
      if (!matchesCommentNotNull(cw.comment, v.comment)) return false;
      const delivery = (
        where as {
          delivery?: {
            surveyId?: string;
            chatId?: bigint | { in: bigint[] };
          };
        }
      ).delivery;
      if (delivery) {
        if (delivery.surveyId !== undefined && v.delivery.surveyId !== delivery.surveyId)
          return false;
        const cidFilter = delivery.chatId;
        if (typeof cidFilter === 'bigint') {
          if (v.delivery.chatId !== cidFilter) return false;
        } else if (!matchesInBigInt(cidFilter, v.delivery.chatId)) return false;
      }
      const rf = (where as { rating?: { gte?: number; lte?: number } }).rating;
      if (!matchesRatingFilter(rf, v.rating)) return false;
      return true;
    });
    if (args.orderBy?.updatedAt === 'desc') {
      rows = [...rows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    if (args.take !== undefined) rows = rows.slice(0, args.take);
    return rows;
  }

  return {
    feedbackResponse: {
      findMany: vi.fn(legacyFindMany),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return store.state.legacy.find((r) => r.id === where.id) ?? null;
      }),
      count: vi.fn(
        (args: { where?: Record<string, unknown> }) => legacyFindMany({ where: args.where }).length
      ),
      update: vi.fn(async () => ({})),
    },
    surveyVote: {
      findMany: vi.fn(voteFindMany),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return store.state.votes.find((v) => v.id === where.id) ?? null;
      }),
    },
    clientRequest: {
      findFirst: vi.fn(async () => null),
    },
    userManager: {
      findMany: vi.fn(async ({ where }: { where: { managerId: string } }) =>
        store.state.userManagers.filter((r) => r.managerId === where.managerId)
      ),
    },
    chat: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { assignedAccountantId?: string | { in: string[] }; deletedAt?: null };
        }) => {
          void where.deletedAt;
          const idFilter = where.assignedAccountantId;
          let rows = store.state.chats;
          if (typeof idFilter === 'string') {
            rows = rows.filter((c) => c.assignedAccountantId === idFilter);
          } else if (idFilter && 'in' in idFilter) {
            rows = rows.filter(
              (c) => c.assignedAccountantId && idFilter.in.includes(c.assignedAccountantId)
            );
          }
          return rows.map((c) => ({ id: c.id }));
        }
      ),
    },
  };
});

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

// Queue module — not exercised here, but import-time resolution must succeed.
vi.mock('../../../../queues/setup.js', () => ({
  queueLowRatingAlert: vi.fn(async () => undefined),
}));

// Survey-service functions used only by submitRating.
vi.mock('../../../../services/feedback/survey.service.js', () => ({
  recordResponse: vi.fn(async () => 'fake-feedback-id'),
  getDeliveryById: vi.fn(async () => ({
    id: 'fake-delivery-id',
    chatId: 99n,
    status: 'delivered',
    survey: { status: 'active' },
  })),
}));

// Import AFTER mocks.
import { feedbackRouter } from '../feedback.js';
import { createContext } from '../../context.js';
import logger from '../../../../utils/logger.js';

type Role = 'admin' | 'manager' | 'observer' | 'accountant';

function makeCaller(
  user: {
    id: string;
    role: Role;
  },
  opts?: {
    telegramSecretToken?: string;
  }
): ReturnType<typeof feedbackRouter.createCaller> {
  return feedbackRouter.createCaller({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocked Prisma surface
    prisma: mockPrisma as any,
    user: {
      id: user.id,
      email: `${user.id}@test.local`,
      fullName: 'Test User',
      role: user.role,
      isActive: true,
    },
    session: {
      accessToken: 'test',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
    requestHeaders: {
      telegramSecretToken: opts?.telegramSecretToken,
    },
  });
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

let seq = 0;
// Build a valid RFC 4122 v4 UUID where only the last segment varies. Zod's
// `.uuid()` refines are strict, so we can't use an ad-hoc prefix.
const uuid = (_prefix: string): string => {
  seq++;
  const tail = seq.toString(16).padStart(12, '0');
  return `00000000-0000-4000-a000-${tail}`;
};

function seedLegacy(attrs: {
  rating: number;
  submittedAt: Date;
  chatId?: bigint;
  surveyId?: string | null;
  comment?: string | null;
  clientUsername?: string | null;
  chatTitle?: string | null;
  accountantName?: string | null;
  quarter?: string | null;
}): string {
  const id = uuid('fr');
  store.state.legacy.push({
    id,
    chatId: attrs.chatId ?? 1000n,
    rating: attrs.rating,
    comment: attrs.comment ?? null,
    submittedAt: attrs.submittedAt,
    clientUsername: attrs.clientUsername ?? null,
    surveyId: attrs.surveyId ?? null,
    requestId: null,
    deliveryId: null,
    chat: {
      title: attrs.chatTitle ?? 'Legacy Chat',
      assignedAccountant: attrs.accountantName
        ? {
            id: 'acc-legacy',
            fullName: attrs.accountantName,
            email: 'acc@legacy.test',
          }
        : null,
    },
    survey: attrs.surveyId
      ? { id: attrs.surveyId, quarter: attrs.quarter ?? '2025-Q1', status: 'closed' }
      : null,
  });
  return id;
}

function seedVote(attrs: {
  rating: number;
  updatedAt: Date;
  createdAt?: Date;
  chatId?: bigint;
  surveyId?: string;
  comment?: string | null;
  username?: string | null;
  telegramUserId?: bigint;
  state?: 'active' | 'removed';
  quarter?: string | null;
  deliveryId?: string;
  chatTitle?: string | null;
  accountantName?: string | null;
}): string {
  const id = uuid('sv');
  store.state.votes.push({
    id,
    deliveryId: attrs.deliveryId ?? uuid('del'),
    telegramUserId: attrs.telegramUserId ?? 1n,
    username: attrs.username ?? null,
    rating: attrs.rating,
    comment: attrs.comment ?? null,
    state: attrs.state ?? 'active',
    createdAt: attrs.createdAt ?? attrs.updatedAt,
    updatedAt: attrs.updatedAt,
    delivery: {
      chatId: attrs.chatId ?? 2000n,
      surveyId: attrs.surveyId ?? uuid('sur'),
      chat: {
        title: attrs.chatTitle ?? 'Vote Chat',
        assignedAccountant: attrs.accountantName
          ? {
              id: 'acc-vote',
              fullName: attrs.accountantName,
              email: 'acc@vote.test',
            }
          : null,
      },
      survey: {
        id: attrs.surveyId ?? 'sur-1',
        quarter: attrs.quarter ?? '2026-Q1',
        status: 'active',
      },
    },
  });
  return id;
}

beforeEach(() => {
  store.state.reset();
  seq = 0;
  vi.clearAllMocks();
  process.env['TELEGRAM_WEBHOOK_SECRET'] = 'test-webhook-secret-token-1234567890';
});

// ===========================================================================
// getAll
// ===========================================================================

describe('feedback.getAll', () => {
  it('legacy-only: returns rows from feedbackResponse', async () => {
    seedLegacy({ rating: 5, submittedAt: new Date('2025-03-01') });
    seedLegacy({ rating: 4, submittedAt: new Date('2025-03-02') });

    const caller = makeCaller({ id: 'admin-1', role: 'admin' });
    const result = await caller.getAll();

    expect(result.pagination.totalItems).toBe(2);
    expect(result.items).toHaveLength(2);
    // DESC sort.
    expect(result.items[0].rating).toBe(4);
    expect(result.items[1].rating).toBe(5);
  });

  it('vote-only: returns rows from surveyVote when legacy is empty', async () => {
    seedVote({
      rating: 4,
      updatedAt: new Date('2026-04-10'),
      username: 'alice',
    });

    const caller = makeCaller({ id: 'admin-1', role: 'admin' });
    const result = await caller.getAll();

    expect(result.pagination.totalItems).toBe(1);
    expect(result.items[0].clientUsername).toBe('alice');
    expect(result.items[0].rating).toBe(4);
  });

  it('mixed: merges and sorts DESC by submittedAt', async () => {
    seedLegacy({ rating: 5, submittedAt: new Date('2025-03-01') });
    seedVote({ rating: 3, updatedAt: new Date('2026-04-01') });
    seedLegacy({ rating: 4, submittedAt: new Date('2025-05-01') });
    seedVote({ rating: 2, updatedAt: new Date('2026-02-01') });

    const caller = makeCaller({ id: 'admin-1', role: 'admin' });
    const result = await caller.getAll();

    expect(result.pagination.totalItems).toBe(4);
    const ratings = result.items.map((i) => i.rating);
    // 2026-04 → 2026-02 → 2025-05 → 2025-03
    expect(ratings).toEqual([3, 2, 4, 5]);
  });

  it('multi-user per delivery: N entries in the listing', async () => {
    const delId = uuid('del');
    const surveyId = uuid('sur');
    seedVote({
      rating: 5,
      updatedAt: new Date('2026-04-10'),
      deliveryId: delId,
      telegramUserId: 1n,
      username: 'u1',
      surveyId,
    });
    seedVote({
      rating: 3,
      updatedAt: new Date('2026-04-11'),
      deliveryId: delId,
      telegramUserId: 2n,
      username: 'u2',
      surveyId,
    });
    seedVote({
      rating: 4,
      updatedAt: new Date('2026-04-12'),
      deliveryId: delId,
      telegramUserId: 3n,
      username: 'u3',
      surveyId,
    });

    const caller = makeCaller({ id: 'admin-1', role: 'admin' });
    const result = await caller.getAll();

    expect(result.pagination.totalItems).toBe(3);
    expect(result.items.map((i) => i.clientUsername)).toEqual(['u3', 'u2', 'u1']);
  });

  it('rating bounds filter applies across both sources', async () => {
    seedLegacy({ rating: 1, submittedAt: new Date('2025-03-01') });
    seedLegacy({ rating: 5, submittedAt: new Date('2025-03-02') });
    seedVote({ rating: 2, updatedAt: new Date('2026-04-01') });
    seedVote({ rating: 4, updatedAt: new Date('2026-04-02') });

    const caller = makeCaller({ id: 'admin-1', role: 'admin' });
    const result = await caller.getAll({
      minRating: 2,
      maxRating: 4,
      page: 1,
      pageSize: 20,
    });

    expect(result.items.map((i) => i.rating).sort()).toEqual([2, 4]);
  });

  it('scoping restricts to assigned chats (manager role)', async () => {
    // Seed chat mapping: manager -> accountant acc-1; acc-1 assigned to chat 100.
    store.state.userManagers.push({ managerId: 'mgr-1', accountantId: 'acc-1' });
    store.state.chats.push({
      id: 100n,
      assignedAccountantId: 'acc-1',
      deletedAt: null,
    });

    seedLegacy({ rating: 5, submittedAt: new Date('2025-03-01'), chatId: 100n });
    seedLegacy({ rating: 4, submittedAt: new Date('2025-03-02'), chatId: 200n }); // out of scope
    seedVote({ rating: 3, updatedAt: new Date('2026-04-01'), chatId: 100n });
    seedVote({ rating: 2, updatedAt: new Date('2026-04-02'), chatId: 300n }); // out of scope

    const caller = makeCaller({ id: 'mgr-1', role: 'manager' });
    const result = await caller.getAll();

    expect(result.pagination.totalItems).toBe(2);
    expect(result.items.map((i) => i.rating).sort()).toEqual([3, 5]);
  });

  it('numeric chatId filter is applied to both sources', async () => {
    seedLegacy({ rating: 5, submittedAt: new Date('2025-03-01'), chatId: 100n });
    seedLegacy({ rating: 4, submittedAt: new Date('2025-03-02'), chatId: 200n });
    seedVote({ rating: 3, updatedAt: new Date('2026-04-01'), chatId: 100n });
    seedVote({ rating: 2, updatedAt: new Date('2026-04-02'), chatId: 300n });

    const caller = makeCaller({ id: 'admin-1', role: 'admin' });
    const result = await caller.getAll({ chatId: '100', page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.items.every((i) => i.chatId === '100')).toBe(true);
  });

  it('rejects non-numeric chatId with BAD_REQUEST', async () => {
    const caller = makeCaller({ id: 'admin-1', role: 'admin' });
    await expect(
      caller.getAll({ chatId: 'not-a-number', page: 1, pageSize: 20 })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('DTO shape: chatId is a string, submittedAt is a Date', async () => {
    seedVote({
      rating: 5,
      updatedAt: new Date('2026-04-10'),
      chatId: 42n,
      username: 'x',
    });

    const caller = makeCaller({ id: 'admin-1', role: 'admin' });
    const result = await caller.getAll();

    expect(typeof result.items[0].chatId).toBe('string');
    expect(result.items[0].chatId).toBe('42');
    expect(result.items[0].submittedAt).toBeInstanceOf(Date);
  });
});

// ===========================================================================
// getById
// ===========================================================================

describe('feedback.getById', () => {
  it('manager can read in-scope legacy UUID', async () => {
    store.state.userManagers.push({ managerId: 'mgr-1', accountantId: 'acc-1' });
    store.state.chats.push({ id: 100n, assignedAccountantId: 'acc-1', deletedAt: null });

    const legacyId = seedLegacy({
      rating: 5,
      submittedAt: new Date('2025-03-01'),
      chatId: 100n,
      chatTitle: 'Acme',
      accountantName: 'Alice',
      clientUsername: 'client-a',
      surveyId: 'sur-legacy',
    });

    const caller = makeCaller({ id: 'mgr-1', role: 'manager' });
    const result = await caller.getById({ id: legacyId });

    expect(result.id).toBe(legacyId);
    expect(result.chatTitle).toBe('Acme');
    expect(result.rating).toBe(5);
  });

  it('manager gets FORBIDDEN for out-of-scope legacy UUID', async () => {
    store.state.userManagers.push({ managerId: 'mgr-1', accountantId: 'acc-1' });
    store.state.chats.push({ id: 100n, assignedAccountantId: 'acc-1', deletedAt: null });

    const legacyId = seedLegacy({
      rating: 4,
      submittedAt: new Date('2025-03-01'),
      chatId: 200n,
      chatTitle: 'Other Tenant',
    });

    const caller = makeCaller({ id: 'mgr-1', role: 'manager' });
    await expect(caller.getById({ id: legacyId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('manager can read in-scope vote UUID via fallback', async () => {
    store.state.userManagers.push({ managerId: 'mgr-1', accountantId: 'acc-1' });
    store.state.chats.push({ id: 100n, assignedAccountantId: 'acc-1', deletedAt: null });

    const voteId = seedVote({
      rating: 3,
      updatedAt: new Date('2026-04-15'),
      chatId: 100n,
      username: 'vote-user',
      accountantName: 'Bob',
      chatTitle: 'Vote Corp',
    });

    const caller = makeCaller({ id: 'mgr-1', role: 'manager' });
    const result = await caller.getById({ id: voteId });

    expect(result.id).toBe(voteId);
    expect(result.clientUsername).toBe('vote-user');
    expect(result.chatTitle).toBe('Vote Corp');
    expect(result.accountant?.fullName).toBe('Bob');
  });

  it('manager gets FORBIDDEN for out-of-scope vote UUID', async () => {
    store.state.userManagers.push({ managerId: 'mgr-1', accountantId: 'acc-1' });
    store.state.chats.push({ id: 100n, assignedAccountantId: 'acc-1', deletedAt: null });

    const voteId = seedVote({
      rating: 2,
      updatedAt: new Date('2026-04-15'),
      chatId: 200n,
      username: 'outside-user',
    });

    const caller = makeCaller({ id: 'mgr-1', role: 'manager' });
    await expect(caller.getById({ id: voteId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('admin can read legacy UUID without scope restrictions', async () => {
    const legacyId = seedLegacy({
      rating: 5,
      submittedAt: new Date('2025-03-01'),
      chatId: 999n,
      chatTitle: 'Admin Visible',
    });

    const caller = makeCaller({ id: 'admin-1', role: 'admin' });
    const result = await caller.getById({ id: legacyId });

    expect(result.id).toBe(legacyId);
    expect(result.rating).toBe(5);
  });

  it('throws NOT_FOUND when UUID exists in neither table', async () => {
    const caller = makeCaller({ id: 'mgr-1', role: 'manager' });
    await expect(
      caller.getById({ id: '00000000-0000-4000-a000-000000000000' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ===========================================================================
// exportCsv
// ===========================================================================

describe('feedback.exportCsv', () => {
  it('includes both legacy and vote rows with proper escaping', async () => {
    seedLegacy({
      rating: 5,
      submittedAt: new Date('2025-03-01T10:00:00Z'),
      comment: 'good, legacy',
      chatTitle: 'Client A',
      clientUsername: 'client-a',
    });
    seedVote({
      rating: 4,
      updatedAt: new Date('2026-04-10T10:00:00Z'),
      comment: 'vote-comment',
      chatTitle: 'Client B',
      username: 'client-b',
    });

    const caller = makeCaller({ id: 'admin-1', role: 'admin' });
    const result = await caller.exportCsv();

    const lines = result.content.split('\n');
    expect(lines[0]).toContain('Rating');
    // Header + 2 data rows.
    expect(lines).toHaveLength(3);
    // Vote row is newer → appears first.
    expect(lines[1]).toContain('client-b');
    expect(lines[2]).toContain('client-a');
    // "good, legacy" must be quoted because it contains a comma.
    expect(result.content).toContain('"good, legacy"');
    expect(result.rowCount).toBe(2);
  });
});

// ===========================================================================
// getAggregates (scoped vs unrestricted)
// ===========================================================================

describe('feedback.getAggregates', () => {
  it('unrestricted (admin): unions aggregates across both sources', async () => {
    seedLegacy({ rating: 5, submittedAt: new Date('2025-03-01') });
    seedLegacy({ rating: 4, submittedAt: new Date('2025-03-02') });
    seedVote({ rating: 3, updatedAt: new Date('2026-04-01') });
    seedVote({ rating: 2, updatedAt: new Date('2026-04-02') });

    const caller = makeCaller({ id: 'admin-1', role: 'admin' });
    const result = await caller.getAggregates();

    expect(result.totalResponses).toBe(4);
    expect(result.averageRating).toBe(3.5);
  });

  it('scoped (manager): unions only for assigned chats', async () => {
    store.state.userManagers.push({ managerId: 'mgr-1', accountantId: 'acc-1' });
    store.state.chats.push({
      id: 100n,
      assignedAccountantId: 'acc-1',
      deletedAt: null,
    });

    seedLegacy({ rating: 5, submittedAt: new Date('2025-03-01'), chatId: 100n });
    seedVote({ rating: 4, updatedAt: new Date('2026-04-01'), chatId: 100n });
    // out of scope:
    seedLegacy({ rating: 1, submittedAt: new Date('2025-03-02'), chatId: 200n });
    seedVote({ rating: 1, updatedAt: new Date('2026-04-02'), chatId: 300n });

    const caller = makeCaller({ id: 'mgr-1', role: 'manager' });
    const result = await caller.getAggregates();

    expect(result.totalResponses).toBe(2);
    expect(result.averageRating).toBe(4.5);
  });
});

// ===========================================================================
// submitRating — deprecation
// ===========================================================================

describe('feedback.submitRating (deprecated)', () => {
  it('still processes the request with valid bot signature and logs deprecation warning', async () => {
    const caller = makeCaller(
      { id: 'admin-1', role: 'admin' },
      { telegramSecretToken: process.env['TELEGRAM_WEBHOOK_SECRET'] }
    );
    const result = await caller.submitRating({
      deliveryId: '00000000-0000-4000-a000-000000000001',
      rating: 5,
      telegramUsername: 'x',
    });

    expect(result.success).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[deprecated]'),
      expect.objectContaining({ adr: 'ADR-007' })
    );
  });

  it('rejects submitRating without bot signature', async () => {
    const caller = makeCaller({ id: 'admin-1', role: 'admin' });

    await expect(
      caller.submitRating({
        deliveryId: '00000000-0000-4000-a000-000000000001',
        rating: 5,
        telegramUsername: 'x',
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects submitRating with invalid bot signature', async () => {
    const caller = makeCaller(
      { id: 'admin-1', role: 'admin' },
      { telegramSecretToken: 'invalid-secret' }
    );

    await expect(
      caller.submitRating({
        deliveryId: '00000000-0000-4000-a000-000000000001',
        rating: 5,
        telegramUsername: 'x',
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('allows addComment with valid bot signature', async () => {
    const feedbackId = seedLegacy({
      rating: 4,
      submittedAt: new Date('2025-03-01'),
      comment: null,
    });

    const caller = makeCaller(
      { id: 'admin-1', role: 'admin' },
      { telegramSecretToken: process.env['TELEGRAM_WEBHOOK_SECRET'] }
    );

    const result = await caller.addComment({
      feedbackId,
      comment: 'Thanks for the service',
    });

    expect(result.success).toBe(true);
  });

  it('rejects addComment without bot signature', async () => {
    const feedbackId = seedLegacy({
      rating: 4,
      submittedAt: new Date('2025-03-01'),
      comment: null,
    });

    const caller = makeCaller({ id: 'admin-1', role: 'admin' });

    await expect(
      caller.addComment({
        feedbackId,
        comment: 'Should be blocked',
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects addComment with invalid bot signature', async () => {
    const feedbackId = seedLegacy({
      rating: 4,
      submittedAt: new Date('2025-03-01'),
      comment: null,
    });

    const caller = makeCaller(
      { id: 'admin-1', role: 'admin' },
      { telegramSecretToken: 'invalid-secret' }
    );

    await expect(
      caller.addComment({
        feedbackId,
        comment: 'Should be blocked',
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('createContext propagates telegram secret header for botProcedure auth', async () => {
    const secret = 'integration-test-webhook-secret-1234567890';
    process.env['TELEGRAM_WEBHOOK_SECRET'] = secret;

    const feedbackId = seedLegacy({
      rating: 5,
      submittedAt: new Date('2025-03-01'),
      comment: null,
    });

    const req = {
      headers: {
        'x-telegram-bot-api-secret-token': secret,
      },
    };
    const ctx = await createContext({ req } as never);
    const caller = feedbackRouter.createCaller(ctx);

    const result = await caller.addComment({
      feedbackId,
      comment: 'Context propagated signature',
    });

    expect(result.success).toBe(true);
  });
});
