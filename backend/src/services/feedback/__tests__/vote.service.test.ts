/**
 * Vote Service Tests (gh-294)
 *
 * Covers submitVote / removeVote / aggregateSurvey / getVoteHistory.
 *
 * Strategy: in-memory Prisma mock that emulates the subset of the client the
 * vote service calls (`surveyDelivery`, `surveyVote`, `surveyVoteHistory`,
 * `$transaction`). The mock is deliberately simple: a flat array store for
 * each table, with the composite unique constraint enforced in `upsert`.
 * This lets us run real async logic (including concurrent submits) without a
 * database.
 *
 * @module services/feedback/__tests__/vote.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ----------------------------------------------------------------------------
// In-memory store shared by the mock. Declared via vi.hoisted so vi.mock (which
// is hoisted above regular imports by Vitest) can reach it.
// ----------------------------------------------------------------------------
const store = vi.hoisted(() => {
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
  };
  type HistoryRow = {
    id: string;
    voteId: string;
    deliveryId: string;
    telegramUserId: bigint;
    username: string | null;
    action: 'create' | 'update' | 'remove';
    oldRating: number | null;
    newRating: number | null;
    changedAt: Date;
  };
  type DeliveryRow = {
    id: string;
    surveyId: string;
    status: string;
    survey: { id: string; status: string };
  };

  let idCounter = 0;
  const nextId = () => `id-${++idCounter}`;

  const state = {
    votes: [] as VoteRow[],
    history: [] as HistoryRow[],
    deliveries: [] as DeliveryRow[],
    reset(): void {
      state.votes = [];
      state.history = [];
      state.deliveries = [];
      idCounter = 0;
    },
  };

  return { state, nextId, type: {} as { VoteRow: VoteRow; HistoryRow: HistoryRow } };
});

// ----------------------------------------------------------------------------
// Mock Prisma client. We implement only what vote.service.ts uses.
// ----------------------------------------------------------------------------
const mockPrisma = vi.hoisted(() => {
  const s = (globalThis as unknown as { __store?: typeof store.state }).__store;
  void s; // silences unused in case linter complains
  return {
    // Transactions in Prisma 7: callback receives the "tx" client. We pass
    // ourselves back because the operations mutate the shared store
    // synchronously, which mirrors the atomicity we want to assert.
    $transaction: vi.fn(async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => {
      return cb(mockPrisma);
    }),
    surveyDelivery: {
      findUnique: vi.fn(
        async ({ where, include }: { where: { id: string }; include?: { survey?: true } }) => {
          const d = store.state.deliveries.find((x) => x.id === where.id);
          if (!d) return null;
          return include?.survey
            ? { ...d, survey: d.survey }
            : {
                id: d.id,
                surveyId: d.surveyId,
                status: d.status,
              };
        }
      ),
    },
    surveyVote: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            survey_votes_delivery_user_unique?: { deliveryId: string; telegramUserId: bigint };
            id?: string;
          };
        }) => {
          if (where.survey_votes_delivery_user_unique) {
            const { deliveryId, telegramUserId } = where.survey_votes_delivery_user_unique;
            return (
              store.state.votes.find(
                (v) => v.deliveryId === deliveryId && v.telegramUserId === telegramUserId
              ) ?? null
            );
          }
          if (where.id) {
            return store.state.votes.find((v) => v.id === where.id) ?? null;
          }
          return null;
        }
      ),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where?: {
            state?: string;
            deliveryId?: string;
            delivery?: { surveyId?: string };
          };
          select?: unknown;
        } = {}) => {
          return store.state.votes.filter((v) => {
            if (where?.state && v.state !== where.state) return false;
            if (where?.deliveryId && v.deliveryId !== where.deliveryId) return false;
            if (where?.delivery?.surveyId) {
              const d = store.state.deliveries.find((x) => x.id === v.deliveryId);
              if (!d || d.surveyId !== where.delivery.surveyId) return false;
            }
            return true;
          });
        }
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: {
            survey_votes_delivery_user_unique: { deliveryId: string; telegramUserId: bigint };
          };
          create: {
            deliveryId: string;
            telegramUserId: bigint;
            username: string | null;
            rating: number;
            comment: string | null;
            state: 'active' | 'removed';
          };
          update: {
            rating?: number;
            state?: 'active' | 'removed';
            username?: string | null;
            comment?: string | null;
            updatedAt?: Date;
          };
        }) => {
          const { deliveryId, telegramUserId } = where.survey_votes_delivery_user_unique;
          const now = new Date();
          const idx = store.state.votes.findIndex(
            (v) => v.deliveryId === deliveryId && v.telegramUserId === telegramUserId
          );
          if (idx === -1) {
            const row = {
              id: store.nextId(),
              deliveryId: create.deliveryId,
              telegramUserId: create.telegramUserId,
              username: create.username,
              rating: create.rating,
              comment: create.comment,
              state: create.state,
              createdAt: now,
              updatedAt: now,
            };
            store.state.votes.push(row);
            return row;
          }
          const existing = store.state.votes[idx]!;
          const merged = {
            ...existing,
            ...(update.rating !== undefined ? { rating: update.rating } : {}),
            ...(update.state !== undefined ? { state: update.state } : {}),
            ...(update.username !== undefined ? { username: update.username } : {}),
            ...(update.comment !== undefined ? { comment: update.comment } : {}),
            updatedAt: update.updatedAt ?? now,
          };
          store.state.votes[idx] = merged;
          return merged;
        }
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { state?: 'active' | 'removed'; updatedAt?: Date };
        }) => {
          const idx = store.state.votes.findIndex((v) => v.id === where.id);
          if (idx === -1) throw new Error('vote not found');
          const existing = store.state.votes[idx]!;
          const merged = {
            ...existing,
            ...(data.state !== undefined ? { state: data.state } : {}),
            updatedAt: data.updatedAt ?? new Date(),
          };
          store.state.votes[idx] = merged;
          return merged;
        }
      ),
    },
    surveyVoteHistory: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            voteId: string;
            deliveryId: string;
            telegramUserId: bigint;
            username: string | null;
            action: 'create' | 'update' | 'remove';
            oldRating: number | null;
            newRating: number | null;
          };
        }) => {
          const row = {
            id: store.nextId(),
            voteId: data.voteId,
            deliveryId: data.deliveryId,
            telegramUserId: data.telegramUserId,
            username: data.username,
            action: data.action,
            oldRating: data.oldRating,
            newRating: data.newRating,
            changedAt: new Date(),
          };
          store.state.history.push(row);
          return row;
        }
      ),
      findMany: vi.fn(
        async ({
          where,
          orderBy,
        }: {
          where: { deliveryId: string };
          orderBy?: { changedAt?: 'asc' | 'desc' };
        }) => {
          const rows = store.state.history.filter((r) => r.deliveryId === where.deliveryId);
          if (orderBy?.changedAt === 'asc') {
            rows.sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
          } else if (orderBy?.changedAt === 'desc') {
            rows.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
          }
          return rows;
        }
      ),
    },
  };
});

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));

vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Minimal stub of the Prisma runtime namespace used only for type imports
// by the service. vote.service.ts only references types from `@prisma/client`;
// we don't need to mock it explicitly because vitest resolves types from
// node_modules.

// ----------------------------------------------------------------------------
// Import service AFTER mocks so the service binds to the mocked prisma.
// ----------------------------------------------------------------------------
import {
  submitVote,
  removeVote,
  aggregateSurvey,
  aggregateDelivery,
  getVoteHistory,
  getEffectiveVote,
  SurveyClosedError,
} from '../vote.service.js';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function seedDelivery(
  deliveryId = 'delivery-1',
  surveyId = 'survey-1',
  status: string = 'active'
): void {
  store.state.deliveries.push({
    id: deliveryId,
    surveyId,
    status: 'delivered',
    survey: { id: surveyId, status },
  });
}

beforeEach(() => {
  store.state.reset();
  vi.clearAllMocks();
});

// ============================================================================
// submitVote
// ============================================================================
describe('submitVote', () => {
  it('creates a new vote and appends history action=create when no prior row exists', async () => {
    seedDelivery();
    const vote = await submitVote({
      deliveryId: 'delivery-1',
      telegramUserId: BigInt(100),
      rating: 4,
      username: 'alice',
    });

    expect(vote.rating).toBe(4);
    expect(vote.state).toBe('active');
    expect(store.state.votes).toHaveLength(1);
    expect(store.state.history).toHaveLength(1);
    expect(store.state.history[0]).toMatchObject({
      action: 'create',
      oldRating: null,
      newRating: 4,
      telegramUserId: BigInt(100),
    });
  });

  it('is idempotent when the same rating is submitted again (no history row appended)', async () => {
    seedDelivery();
    await submitVote({
      deliveryId: 'delivery-1',
      telegramUserId: BigInt(100),
      rating: 4,
    });
    expect(store.state.history).toHaveLength(1);

    await submitVote({
      deliveryId: 'delivery-1',
      telegramUserId: BigInt(100),
      rating: 4,
    });

    expect(store.state.votes).toHaveLength(1);
    // Critical: no duplicate history row. Repeated button taps must NOT
    // pollute the audit log with noise.
    expect(store.state.history).toHaveLength(1);
  });

  it('updates rating and appends history action=update with oldRating=prev', async () => {
    seedDelivery();
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(100), rating: 3 });
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(100), rating: 5 });

    expect(store.state.votes).toHaveLength(1);
    expect(store.state.votes[0]!.rating).toBe(5);
    expect(store.state.history).toHaveLength(2);
    expect(store.state.history[1]).toMatchObject({
      action: 'update',
      oldRating: 3,
      newRating: 5,
    });
  });

  it('flips a removed vote back to active and appends update with oldRating=null', async () => {
    seedDelivery();
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(100), rating: 2 });
    await removeVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(100) });
    // After remove: state=removed, history has [create, remove]
    expect(store.state.votes[0]!.state).toBe('removed');
    expect(store.state.history).toHaveLength(2);

    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(100), rating: 4 });

    expect(store.state.votes).toHaveLength(1);
    expect(store.state.votes[0]!.state).toBe('active');
    expect(store.state.votes[0]!.rating).toBe(4);
    expect(store.state.history).toHaveLength(3);
    // oldRating=null because the *immediately prior* state was 'removed'
    // (no effective active rating to compare against).
    expect(store.state.history[2]).toMatchObject({
      action: 'update',
      oldRating: null,
      newRating: 4,
    });
  });

  it('rejects submissions when the parent survey is closed', async () => {
    seedDelivery('delivery-1', 'survey-1', 'closed');

    await expect(
      submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(100), rating: 3 })
    ).rejects.toBeInstanceOf(SurveyClosedError);

    expect(store.state.votes).toHaveLength(0);
    expect(store.state.history).toHaveLength(0);
  });

  it('rejects submissions when the parent survey is expired', async () => {
    seedDelivery('delivery-1', 'survey-1', 'expired');

    await expect(
      submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(100), rating: 3 })
    ).rejects.toBeInstanceOf(SurveyClosedError);
  });
});

// ============================================================================
// removeVote
// ============================================================================
describe('removeVote', () => {
  it('flips active→removed and appends action=remove with oldRating=prev', async () => {
    seedDelivery();
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(100), rating: 5 });

    const result = await removeVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(100) });

    expect(result).not.toBeNull();
    expect(store.state.votes[0]!.state).toBe('removed');
    expect(store.state.history).toHaveLength(2);
    expect(store.state.history[1]).toMatchObject({
      action: 'remove',
      oldRating: 5,
      newRating: null,
    });
  });

  it('is a no-op when the user has no prior vote (no history row, no error)', async () => {
    seedDelivery();

    const result = await removeVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(999) });

    expect(result).toBeNull();
    expect(store.state.votes).toHaveLength(0);
    expect(store.state.history).toHaveLength(0);
  });

  it('is a no-op when the user vote is already removed (no duplicate remove entry)', async () => {
    seedDelivery();
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(100), rating: 5 });
    await removeVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(100) });
    expect(store.state.history).toHaveLength(2);

    const result = await removeVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(100) });

    expect(result).toBeNull();
    // History must remain at 2: no duplicate 'remove' row for the same event.
    expect(store.state.history).toHaveLength(2);
  });
});

// ============================================================================
// aggregation
// ============================================================================
describe('aggregateSurvey / aggregateDelivery', () => {
  it('excludes removed rows from aggregates', async () => {
    seedDelivery('delivery-1', 'survey-1');
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(1), rating: 5 });
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(2), rating: 3 });
    await removeVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(2) });

    const agg = await aggregateSurvey('survey-1');
    expect(agg.count).toBe(1);
    expect(agg.average).toBe(5);
    expect(agg.distribution[5]).toBe(1);
    expect(agg.distribution[3]).toBe(0);
  });

  it('returns correct count/avg/distribution for mixed ratings', async () => {
    seedDelivery('delivery-1', 'survey-1');
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(1), rating: 5 });
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(2), rating: 5 });
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(3), rating: 4 });
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(4), rating: 2 });

    const agg = await aggregateDelivery('delivery-1');
    expect(agg.count).toBe(4);
    expect(agg.average).toBeCloseTo(4);
    expect(agg.distribution).toEqual({ 1: 0, 2: 1, 3: 0, 4: 1, 5: 2 });
  });

  it('returns count=0, average=null for empty survey', async () => {
    seedDelivery('delivery-1', 'survey-1');
    const agg = await aggregateSurvey('survey-1');
    expect(agg.count).toBe(0);
    expect(agg.average).toBeNull();
  });
});

// ============================================================================
// concurrency
// ============================================================================
describe('concurrency', () => {
  it('10 parallel submitVote calls for the SAME user collapse to exactly 1 row', async () => {
    seedDelivery();
    const deliveryId = 'delivery-1';
    const userId = BigInt(500);

    // Fire 10 concurrent submits with varying ratings. In the real DB, the
    // composite unique constraint + upsert makes this safe. In the mock, the
    // sequential event loop gives the same invariant.
    await Promise.all(
      [1, 2, 3, 4, 5, 1, 2, 3, 4, 5].map((rating) =>
        submitVote({ deliveryId, telegramUserId: userId, rating })
      )
    );

    const rows = store.state.votes.filter(
      (v) => v.deliveryId === deliveryId && v.telegramUserId === userId
    );
    expect(rows).toHaveLength(1);
    // At least one history row should exist; upper bound is 10.
    expect(store.state.history.length).toBeGreaterThanOrEqual(1);
    expect(store.state.history.length).toBeLessThanOrEqual(10);
  });

  it('10 DIFFERENT users concurrent → 10 distinct vote rows, each with a create history row', async () => {
    seedDelivery();
    const deliveryId = 'delivery-1';

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        submitVote({
          deliveryId,
          telegramUserId: BigInt(1000 + i),
          rating: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
          username: `user-${i}`,
        })
      )
    );

    expect(store.state.votes).toHaveLength(10);
    expect(store.state.history).toHaveLength(10);
    for (const h of store.state.history) {
      expect(h.action).toBe('create');
    }
  });
});

// ============================================================================
// getVoteHistory / getEffectiveVote
// ============================================================================
describe('getVoteHistory', () => {
  it('returns all history rows for a delivery in chronological order', async () => {
    seedDelivery();
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(1), rating: 3 });
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(1), rating: 5 });
    await removeVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(1) });

    const history = await getVoteHistory('delivery-1');
    expect(history.map((h) => h.action)).toEqual(['create', 'update', 'remove']);
    expect(history[0]!.oldRating).toBeNull();
    expect(history[1]!.oldRating).toBe(3);
    expect(history[2]!.newRating).toBeNull();
  });
});

describe('getEffectiveVote', () => {
  it('returns the active vote for a user or null if removed/missing', async () => {
    seedDelivery();
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(7), rating: 4 });
    expect((await getEffectiveVote('delivery-1', BigInt(7)))?.rating).toBe(4);

    await removeVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(7) });
    expect(await getEffectiveVote('delivery-1', BigInt(7))).toBeNull();

    expect(await getEffectiveVote('delivery-1', BigInt(999))).toBeNull();
  });
});
