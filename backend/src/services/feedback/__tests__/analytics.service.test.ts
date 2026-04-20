/**
 * Feedback Analytics Service Tests (gh-324 / ADR-007)
 *
 * Covers the unified read model that merges legacy `feedbackResponse` with
 * post-gh-294 `surveyVote(state='active')`. Uses an in-memory Prisma mock so
 * we can exercise the real merge/sort logic without a database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory store for the mock Prisma client. Declared via vi.hoisted so the
// (hoisted) vi.mock factory can read it.
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
    deliveryId: string | null;
    chat: {
      title: string | null;
      assignedAccountant: { fullName: string } | null;
    } | null;
    survey: { quarter: string | null } | null;
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
        assignedAccountant: { fullName: string } | null;
      } | null;
      survey: { quarter: string | null } | null;
    };
  };

  type SurveyRow = {
    id: string;
    quarter: string | null;
    status: string;
  };

  const state = {
    legacy: [] as LegacyRow[],
    votes: [] as VoteRow[],
    surveys: [] as SurveyRow[],
    reset(): void {
      state.legacy = [];
      state.votes = [];
      state.surveys = [];
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
// Minimal Prisma mock. Implements only what analytics.service.ts calls.
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
      count: vi.fn((args: { where?: Record<string, unknown> }) => {
        return legacyFindMany({ where: args.where }).length;
      }),
    },
    surveyVote: {
      findMany: vi.fn(voteFindMany),
    },
    feedbackSurvey: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return store.state.surveys.find((s) => s.id === where.id) ?? null;
      }),
    },
  };
});

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

// Import AFTER mocks.
import {
  fetchUnifiedRatings,
  fetchUnifiedEntries,
  fetchUnifiedComments,
  getAggregates,
  getTrendData,
  getRecentComments,
} from '../analytics.service.js';

// ---------------------------------------------------------------------------
// Helpers to seed rows.
// ---------------------------------------------------------------------------

let seq = 0;
const uuid = (prefix: string): string =>
  `${prefix}-${(++seq).toString().padStart(12, '0')}-0000-0000-0000-000000000000`;

function legacy(attrs: {
  rating: number;
  submittedAt: Date;
  chatId?: bigint;
  surveyId?: string | null;
  comment?: string | null;
  clientUsername?: string | null;
  quarter?: string | null;
  accountantName?: string | null;
  chatTitle?: string | null;
}): void {
  store.state.legacy.push({
    id: uuid('fr'),
    chatId: attrs.chatId ?? 1000n,
    rating: attrs.rating,
    comment: attrs.comment ?? null,
    submittedAt: attrs.submittedAt,
    clientUsername: attrs.clientUsername ?? null,
    surveyId: attrs.surveyId ?? null,
    deliveryId: null,
    chat: {
      title: attrs.chatTitle ?? 'Legacy Chat',
      assignedAccountant: attrs.accountantName ? { fullName: attrs.accountantName } : null,
    },
    survey: attrs.surveyId ? { quarter: attrs.quarter ?? '2025-Q1' } : null,
  });
}

function vote(attrs: {
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
  accountantName?: string | null;
  chatTitle?: string | null;
}): void {
  store.state.votes.push({
    id: uuid('sv'),
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
        assignedAccountant: attrs.accountantName ? { fullName: attrs.accountantName } : null,
      },
      survey: { quarter: attrs.quarter ?? '2026-Q1' },
    },
  });
}

beforeEach(() => {
  store.state.reset();
  seq = 0;
  vi.clearAllMocks();
});

// ===========================================================================
// fetchUnifiedRatings
// ===========================================================================

describe('fetchUnifiedRatings', () => {
  it('legacy-only: returns all legacy rows', async () => {
    legacy({ rating: 5, submittedAt: new Date('2025-03-01') });
    legacy({ rating: 3, submittedAt: new Date('2025-03-15') });

    const rows = await fetchUnifiedRatings({});
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.rating).sort()).toEqual([3, 5]);
  });

  it('vote-only: returns only active vote rows', async () => {
    vote({ rating: 4, updatedAt: new Date('2026-04-01') });
    vote({ rating: 2, updatedAt: new Date('2026-04-02'), state: 'removed' });

    const rows = await fetchUnifiedRatings({});
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(4);
  });

  it('mixed: sums both sources', async () => {
    legacy({ rating: 5, submittedAt: new Date('2025-03-01') });
    vote({ rating: 1, updatedAt: new Date('2026-04-01') });

    const rows = await fetchUnifiedRatings({});
    expect(rows).toHaveLength(2);
  });

  it('excludes removed votes', async () => {
    vote({ rating: 5, updatedAt: new Date('2026-04-01'), state: 'active' });
    vote({ rating: 1, updatedAt: new Date('2026-04-02'), state: 'removed' });

    const rows = await fetchUnifiedRatings({});
    expect(rows.map((r) => r.rating)).toEqual([5]);
  });

  it('date bounds apply to submittedAt (legacy) and updatedAt (votes)', async () => {
    legacy({ rating: 5, submittedAt: new Date('2025-01-15') }); // in range
    legacy({ rating: 4, submittedAt: new Date('2024-12-15') }); // out
    vote({ rating: 3, updatedAt: new Date('2025-01-20') }); // in range
    vote({ rating: 2, updatedAt: new Date('2025-02-05') }); // out

    const rows = await fetchUnifiedRatings({
      dateFrom: new Date('2025-01-01'),
      dateTo: new Date('2025-01-31'),
    });
    expect(rows.map((r) => r.rating).sort()).toEqual([3, 5]);
  });

  it('scopedChatIds applies to both sources', async () => {
    legacy({ rating: 5, submittedAt: new Date('2025-03-01'), chatId: 100n });
    legacy({ rating: 4, submittedAt: new Date('2025-03-02'), chatId: 200n });
    vote({ rating: 3, updatedAt: new Date('2026-04-01'), chatId: 100n });
    vote({ rating: 2, updatedAt: new Date('2026-04-02'), chatId: 300n });

    const rows = await fetchUnifiedRatings({ scopedChatIds: [100n] });
    expect(rows.map((r) => r.rating).sort()).toEqual([3, 5]);
  });

  it('surveyId filter applies to both sources', async () => {
    const s = uuid('sur');
    legacy({ rating: 5, submittedAt: new Date('2025-03-01'), surveyId: s });
    legacy({ rating: 4, submittedAt: new Date('2025-03-02'), surveyId: uuid('sur') });
    vote({ rating: 3, updatedAt: new Date('2026-04-01'), surveyId: s });
    vote({ rating: 2, updatedAt: new Date('2026-04-02'), surveyId: uuid('sur') });

    const rows = await fetchUnifiedRatings({ surveyId: s });
    expect(rows.map((r) => r.rating).sort()).toEqual([3, 5]);
  });

  it('invariant: helper does NOT dedup — if the same deliveryId exists in both sources, both rows surface', async () => {
    // ADR-007 §5: write-periods do not overlap. If they ever did, the helper
    // must NOT silently hide the violation — both rows must be visible so
    // the invariant test can catch it.
    const delId = uuid('del');
    legacy({
      rating: 5,
      submittedAt: new Date('2025-03-01'),
      chatId: 42n,
    });
    // mutate last legacy row to have deliveryId
    store.state.legacy[store.state.legacy.length - 1].deliveryId = delId;
    vote({
      rating: 1,
      updatedAt: new Date('2026-04-01'),
      chatId: 42n,
      deliveryId: delId,
    });

    const rows = await fetchUnifiedRatings({});
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.rating).sort()).toEqual([1, 5]);
  });
});

// ===========================================================================
// fetchUnifiedEntries
// ===========================================================================

describe('fetchUnifiedEntries', () => {
  it('merges and sorts by submittedAt DESC (vote updatedAt)', async () => {
    legacy({ rating: 5, submittedAt: new Date('2025-03-01'), chatTitle: 'A' });
    vote({ rating: 3, updatedAt: new Date('2026-04-01'), chatTitle: 'B' });
    legacy({ rating: 4, submittedAt: new Date('2025-03-02'), chatTitle: 'C' });

    const { items, total } = await fetchUnifiedEntries({});
    expect(total).toBe(3);
    expect(items[0].chatTitle).toBe('B'); // 2026-04-01 newest
    expect(items[1].chatTitle).toBe('C'); // 2025-03-02
    expect(items[2].chatTitle).toBe('A'); // 2025-03-01
  });

  it('tags rows with source', async () => {
    legacy({ rating: 5, submittedAt: new Date('2025-03-01') });
    vote({ rating: 3, updatedAt: new Date('2026-04-01') });

    const { items } = await fetchUnifiedEntries({});
    const sources = items.map((i) => i.source).sort();
    expect(sources).toEqual(['legacy', 'vote']);
  });

  it('maps vote fields to DTO shape (username, chat.title, accountant, quarter)', async () => {
    vote({
      rating: 4,
      updatedAt: new Date('2026-04-15'),
      chatId: 555n,
      username: 'alice',
      chatTitle: 'Acme Ltd',
      accountantName: 'Bob Smith',
      quarter: '2026-Q2',
    });

    const { items } = await fetchUnifiedEntries({});
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      chatId: 555n,
      chatTitle: 'Acme Ltd',
      clientUsername: 'alice',
      accountantName: 'Bob Smith',
      rating: 4,
      surveyQuarter: '2026-Q2',
      source: 'vote',
    });
  });

  it('pagination: slices the merged sorted array', async () => {
    for (let i = 1; i <= 12; i++) {
      legacy({ rating: 5, submittedAt: new Date(`2025-03-${String(i).padStart(2, '0')}`) });
    }
    for (let i = 1; i <= 8; i++) {
      vote({ rating: 4, updatedAt: new Date(`2026-04-${String(i).padStart(2, '0')}`) });
    }

    const { items, total } = await fetchUnifiedEntries({ page: 2, pageSize: 10 });
    expect(total).toBe(20);
    expect(items).toHaveLength(10);
  });

  it('rating bounds filter both sources', async () => {
    legacy({ rating: 1, submittedAt: new Date('2025-03-01') });
    legacy({ rating: 5, submittedAt: new Date('2025-03-02') });
    vote({ rating: 2, updatedAt: new Date('2026-04-01') });
    vote({ rating: 4, updatedAt: new Date('2026-04-02') });

    const { items } = await fetchUnifiedEntries({ minRating: 2, maxRating: 4 });
    expect(items.map((i) => i.rating).sort()).toEqual([2, 4]);
  });

  it('multi-user per delivery produces N entries in the list', async () => {
    const delId = uuid('del');
    const surveyId = uuid('sur');
    vote({
      rating: 5,
      updatedAt: new Date('2026-04-10'),
      deliveryId: delId,
      telegramUserId: 1n,
      username: 'u1',
      surveyId,
    });
    vote({
      rating: 3,
      updatedAt: new Date('2026-04-11'),
      deliveryId: delId,
      telegramUserId: 2n,
      username: 'u2',
      surveyId,
    });
    vote({
      rating: 4,
      updatedAt: new Date('2026-04-12'),
      deliveryId: delId,
      telegramUserId: 3n,
      username: 'u3',
      surveyId,
    });

    const { items, total } = await fetchUnifiedEntries({});
    expect(total).toBe(3);
    expect(items.map((i) => i.clientUsername)).toEqual(['u3', 'u2', 'u1']);
  });

  it('re-vote (higher updatedAt) bubbles to the top of the sort', async () => {
    vote({
      rating: 3,
      createdAt: new Date('2026-03-01'),
      updatedAt: new Date('2026-03-01'),
      username: 'old-vote',
    });
    vote({
      rating: 5,
      createdAt: new Date('2026-03-02'),
      updatedAt: new Date('2026-04-20'),
      username: 'revoted',
    });

    const { items } = await fetchUnifiedEntries({});
    expect(items[0].clientUsername).toBe('revoted');
  });

  it('scopedChatIds applies to both sources in entries', async () => {
    legacy({ rating: 5, submittedAt: new Date('2025-03-01'), chatId: 1n });
    legacy({ rating: 4, submittedAt: new Date('2025-03-02'), chatId: 2n });
    vote({ rating: 3, updatedAt: new Date('2026-04-01'), chatId: 1n });
    vote({ rating: 2, updatedAt: new Date('2026-04-02'), chatId: 3n });

    const { items, total } = await fetchUnifiedEntries({ scopedChatIds: [1n] });
    expect(total).toBe(2);
    expect(items.map((i) => i.rating).sort()).toEqual([3, 5]);
  });

  it('chatId filter narrows both sources', async () => {
    legacy({ rating: 5, submittedAt: new Date('2025-03-01'), chatId: 100n });
    legacy({ rating: 4, submittedAt: new Date('2025-03-02'), chatId: 200n });
    vote({ rating: 3, updatedAt: new Date('2026-04-01'), chatId: 100n });
    vote({ rating: 2, updatedAt: new Date('2026-04-02'), chatId: 300n });

    const { items } = await fetchUnifiedEntries({ chatId: 100n });
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.rating).sort()).toEqual([3, 5]);
  });
});

// ===========================================================================
// fetchUnifiedComments
// ===========================================================================

describe('fetchUnifiedComments', () => {
  it('returns merged comments sorted DESC', async () => {
    legacy({
      rating: 5,
      submittedAt: new Date('2025-03-01'),
      comment: 'legacy comment',
    });
    vote({
      rating: 3,
      updatedAt: new Date('2026-04-05'),
      comment: 'vote comment',
    });
    vote({
      rating: 4,
      updatedAt: new Date('2026-04-01'),
      comment: null, // filtered out
    });

    const rows = await fetchUnifiedComments({ limit: 10 });
    expect(rows).toHaveLength(2);
    expect(rows[0].comment).toBe('vote comment'); // newer
  });

  it('re-vote lifts comment to top (updatedAt semantics)', async () => {
    vote({
      rating: 2,
      createdAt: new Date('2026-02-10'),
      updatedAt: new Date('2026-02-10'),
      comment: 'old',
    });
    vote({
      rating: 5,
      createdAt: new Date('2026-02-15'),
      updatedAt: new Date('2026-04-20'),
      comment: 'freshly revoted',
    });

    const rows = await fetchUnifiedComments({ limit: 10 });
    expect(rows[0].comment).toBe('freshly revoted');
  });

  it('limit applies after merge', async () => {
    for (let i = 1; i <= 15; i++) {
      legacy({
        rating: 5,
        submittedAt: new Date(`2025-03-${String(i).padStart(2, '0')}`),
        comment: `legacy ${i}`,
      });
    }
    for (let i = 1; i <= 5; i++) {
      vote({
        rating: 4,
        updatedAt: new Date(`2026-04-${String(i).padStart(2, '0')}`),
        comment: `vote ${i}`,
      });
    }

    const rows = await fetchUnifiedComments({ limit: 10 });
    expect(rows).toHaveLength(10);
    // Top 10 by date desc — 5 votes (April 2026) + 5 newest legacy (March 15, 14, 13, 12, 11).
    expect(rows.slice(0, 5).every((r) => r.comment?.startsWith('vote'))).toBe(true);
  });
});

// ===========================================================================
// getAggregates (unified)
// ===========================================================================

describe('getAggregates (unified)', () => {
  it('legacy-only scenario', async () => {
    legacy({ rating: 5, submittedAt: new Date('2025-03-01') });
    legacy({ rating: 4, submittedAt: new Date('2025-03-02') });
    legacy({ rating: 3, submittedAt: new Date('2025-03-03') });

    const agg = await getAggregates();
    expect(agg.totalResponses).toBe(3);
    expect(agg.averageRating).toBe(4);
    expect(agg.nps.promoters).toBe(2); // 5, 4
    expect(agg.nps.detractors).toBe(1); // 3
  });

  it('vote-only scenario', async () => {
    vote({ rating: 5, updatedAt: new Date('2026-04-01') });
    vote({ rating: 5, updatedAt: new Date('2026-04-02') });

    const agg = await getAggregates();
    expect(agg.totalResponses).toBe(2);
    expect(agg.averageRating).toBe(5);
    expect(agg.nps.score).toBe(100);
  });

  it('mixed scenario sums both sources', async () => {
    legacy({ rating: 5, submittedAt: new Date('2025-03-01') });
    vote({ rating: 1, updatedAt: new Date('2026-04-01') });

    const agg = await getAggregates();
    expect(agg.totalResponses).toBe(2);
    expect(agg.averageRating).toBe(3); // (5+1)/2
  });

  it('ignores removed votes', async () => {
    vote({ rating: 5, updatedAt: new Date('2026-04-01'), state: 'active' });
    vote({ rating: 1, updatedAt: new Date('2026-04-02'), state: 'removed' });

    const agg = await getAggregates();
    expect(agg.totalResponses).toBe(1);
    expect(agg.averageRating).toBe(5);
  });
});

// ===========================================================================
// getTrendData (quarters — union)
// ===========================================================================

describe('getTrendData (unified, quarters)', () => {
  it('buckets rows from both sources into the correct quarter', async () => {
    // Current moment is 2026-Q2 (April 20, 2026). Request 5 quarters: 2025-Q2..2026-Q2.
    legacy({ rating: 5, submittedAt: new Date('2025-05-15') }); // 2025-Q2
    legacy({ rating: 4, submittedAt: new Date('2025-08-15') }); // 2025-Q3
    vote({ rating: 3, updatedAt: new Date('2026-01-15') }); // 2026-Q1
    vote({ rating: 2, updatedAt: new Date('2026-04-10') }); // 2026-Q2

    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'));

    const trend = await getTrendData(5);
    const byPeriod = Object.fromEntries(trend.map((t) => [t.period, t.responseCount]));

    expect(byPeriod['2025-Q2']).toBe(1);
    expect(byPeriod['2025-Q3']).toBe(1);
    expect(byPeriod['2026-Q1']).toBe(1);
    expect(byPeriod['2026-Q2']).toBe(1);

    vi.useRealTimers();
  });
});

// ===========================================================================
// getRecentComments (unified)
// ===========================================================================

describe('getRecentComments (unified)', () => {
  it('returns comments from both sources (newest first)', async () => {
    legacy({ rating: 5, submittedAt: new Date('2025-03-01'), comment: 'old-legacy' });
    vote({ rating: 4, updatedAt: new Date('2026-04-10'), comment: 'new-vote' });

    const rows = await getRecentComments(5, false);
    expect(rows.map((r) => r.comment)).toEqual(['new-vote', 'old-legacy']);
  });

  it('includes client info when requested', async () => {
    vote({
      rating: 2,
      updatedAt: new Date('2026-04-10'),
      comment: 'bad',
      chatId: 777n,
      username: 'alice',
    });

    const rows = await getRecentComments(1, true);
    expect(rows[0].chatId).toBe('777');
    expect(rows[0].clientUsername).toBe('alice');
  });
});
