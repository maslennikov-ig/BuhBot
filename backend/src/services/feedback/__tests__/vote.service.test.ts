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
    chatId: bigint;
    status: string;
    survey: { id: string; status: string };
  };
  type ChatMessageRow = {
    id: string;
    chatId: bigint;
    telegramUserId: bigint;
    isAccountant: boolean;
  };

  let idCounter = 0;
  const nextId = () => `id-${++idCounter}`;

  const state = {
    votes: [] as VoteRow[],
    history: [] as HistoryRow[],
    deliveries: [] as DeliveryRow[],
    chatMessages: [] as ChatMessageRow[],
    reset(): void {
      state.votes = [];
      state.history = [];
      state.deliveries = [];
      state.chatMessages = [];
      idCounter = 0;
    },
  };

  return {
    state,
    nextId,
    type: {} as { VoteRow: VoteRow; HistoryRow: HistoryRow; ChatMessageRow: ChatMessageRow },
  };
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
      findMany: vi.fn(
        async ({
          where,
          select,
        }: {
          where?: { surveyId?: string };
          select?: { chatId?: boolean };
        } = {}) => {
          let filtered = store.state.deliveries;
          if (where?.surveyId) {
            filtered = filtered.filter((d) => d.surveyId === where.surveyId);
          }
          if (select?.chatId) {
            return filtered.map((d) => ({ chatId: d.chatId }));
          }
          return filtered;
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
          select,
        }: {
          where?: {
            state?: string;
            deliveryId?: string;
            delivery?: { surveyId?: string | { in?: string[] } };
          };
          select?: {
            rating?: boolean;
            delivery?: { select?: { surveyId?: boolean; id?: boolean; chatId?: boolean } };
            deliveryId?: boolean;
            telegramUserId?: boolean;
            state?: boolean;
          };
        } = {}) => {
          const filtered = store.state.votes.filter((v) => {
            if (where?.state && v.state !== where.state) return false;
            if (where?.deliveryId && v.deliveryId !== where.deliveryId) return false;
            if (where?.delivery?.surveyId) {
              const surveyIdFilter = where.delivery.surveyId;
              const d = store.state.deliveries.find((x) => x.id === v.deliveryId);
              if (!d) return false;
              if (typeof surveyIdFilter === 'string') {
                if (d.surveyId !== surveyIdFilter) return false;
              } else if (
                surveyIdFilter &&
                typeof surveyIdFilter === 'object' &&
                surveyIdFilter.in
              ) {
                if (!surveyIdFilter.in.includes(d.surveyId)) return false;
              }
            }
            return true;
          });
          // When caller requests `select` with a `delivery` sub-select, enrich
          // each row with the delivery object so aggregateSurveys can read
          // v.delivery.surveyId, v.delivery.id, and v.delivery.chatId.
          if (select?.delivery) {
            return filtered.map((v) => {
              const d = store.state.deliveries.find((x) => x.id === v.deliveryId);
              return {
                ...v,
                delivery: d
                  ? {
                      id: d.id,
                      surveyId: d.surveyId,
                      chatId: d.chatId,
                    }
                  : { id: v.deliveryId, surveyId: '', chatId: BigInt(0) },
              };
            });
          }
          return filtered;
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
    chatMessage: {
      findMany: vi.fn(
        async ({
          where,
          select,
          distinct,
        }: {
          where?: {
            chatId?: { in?: bigint[] };
            isAccountant?: boolean;
          };
          select?: {
            chatId?: boolean;
            telegramUserId?: boolean;
          };
          distinct?: string[];
        } = {}) => {
          let filtered = store.state.chatMessages;
          if (where?.chatId?.in) {
            filtered = filtered.filter((m) => where.chatId!.in!.includes(m.chatId));
          }
          if (where?.isAccountant !== undefined) {
            filtered = filtered.filter((m) => m.isAccountant === where.isAccountant);
          }

          // Project row to selected columns.
          const project = (m: { chatId: bigint; telegramUserId: bigint }) => {
            const row: { chatId?: bigint; telegramUserId?: bigint } = {};
            if (!select || select.chatId) row.chatId = m.chatId;
            if (!select || select.telegramUserId) row.telegramUserId = m.telegramUserId;
            return row;
          };

          // buh-8moj (M-1): the batch path now uses distinct: ['chatId', 'telegramUserId']
          // to return one row per unique (chat, user) pair. Keep legacy
          // distinct: ['telegramUserId'] working for aggregateInternal (single-scope path).
          if (distinct && distinct.length > 0) {
            const seen = new Set<string>();
            const unique: Array<{ chatId?: bigint; telegramUserId?: bigint }> = [];
            for (const m of filtered) {
              const key = distinct
                .map((field) => {
                  if (field === 'chatId') return m.chatId.toString();
                  if (field === 'telegramUserId') return m.telegramUserId.toString();
                  return '';
                })
                .join('|');
              if (!seen.has(key)) {
                seen.add(key);
                unique.push(project(m));
              }
            }
            return unique;
          }

          return filtered.map((m) => project(m));
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
  aggregateSurveys,
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
  status: string = 'active',
  chatId: bigint = BigInt(100)
): void {
  store.state.deliveries.push({
    id: deliveryId,
    surveyId,
    chatId,
    status: 'delivered',
    survey: { id: surveyId, status },
  });
}

function seedChatMessage(
  chatId: bigint,
  telegramUserId: bigint,
  isAccountant: boolean = false
): void {
  store.state.chatMessages.push({
    id: store.nextId(),
    chatId,
    telegramUserId,
    isAccountant,
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

  // buh-c4ya (m-2): cover the getById path independently — aggregateInternal has its
  // own chatMessage.findMany call separate from the batch path tested by TC-15.
  it('returns totalRecipientsCount for aggregateSurvey (getById path)', async () => {
    const chatId = BigInt(300);
    seedChatMessage(chatId, BigInt(10), false);
    seedChatMessage(chatId, BigInt(11), false);
    seedChatMessage(chatId, BigInt(99), true); // accountant, excluded

    seedDelivery('delivery-300', 'survey-300', 'active', chatId);
    await submitVote({ deliveryId: 'delivery-300', telegramUserId: BigInt(10), rating: 4 });

    const agg = await aggregateSurvey('survey-300');
    expect(agg.count).toBe(1);
    // 2 non-accountant users in the chat; the accountant (id=99) is excluded.
    expect(agg.totalRecipientsCount).toBe(2);
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

// ============================================================================
// aggregateSurveys (gh-333)
// ============================================================================
describe('aggregateSurveys', () => {
  // ── TC-1: empty input ─────────────────────────────────────────────────────
  it('returns empty Map for empty input array', async () => {
    const result = await aggregateSurveys([]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  // ── TC-2: survey exists but has no SurveyVote records ────────────────────
  it('returns empty Map when the requested survey has no votes', async () => {
    seedDelivery('delivery-1', 'survey-1');

    const result = await aggregateSurveys(['survey-1']);

    // Surveys with no active votes are absent from the map (by spec)
    expect(result.size).toBe(0);
  });

  // ── TC-3: single survey, multiple votes ───────────────────────────────────
  it('computes correct count / average / distribution for a single survey', async () => {
    seedDelivery('delivery-1', 'survey-1');
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(1), rating: 5 });
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(2), rating: 5 });
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(3), rating: 4 });
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(4), rating: 3 });
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(5), rating: 3 });

    const result = await aggregateSurveys(['survey-1']);

    expect(result.size).toBe(1);
    const agg = result.get('survey-1')!;
    expect(agg.count).toBe(5);
    // average = (5+5+4+3+3)/5 = 20/5 = 4
    expect(agg.average).toBeCloseTo(4);
    expect(agg.distribution).toEqual({ 1: 0, 2: 0, 3: 2, 4: 1, 5: 2 });
    // All votes came from one delivery → respondedDeliveryCount=1
    expect(agg.respondedDeliveryCount).toBe(1);
  });

  // ── TC-4: multiple surveys, votes split across them ───────────────────────
  it('isolates aggregates per survey when multiple surveys share the batch', async () => {
    seedDelivery('delivery-A', 'survey-A');
    seedDelivery('delivery-B', 'survey-B');
    seedDelivery('delivery-C', 'survey-C');

    // survey-A: 2 votes (ratings 5, 3)
    await submitVote({ deliveryId: 'delivery-A', telegramUserId: BigInt(1), rating: 5 });
    await submitVote({ deliveryId: 'delivery-A', telegramUserId: BigInt(2), rating: 3 });

    // survey-B: 1 vote (rating 4)
    await submitVote({ deliveryId: 'delivery-B', telegramUserId: BigInt(3), rating: 4 });

    // survey-C: no votes

    const result = await aggregateSurveys(['survey-A', 'survey-B', 'survey-C']);

    // survey-A
    expect(result.has('survey-A')).toBe(true);
    const aggA = result.get('survey-A')!;
    expect(aggA.count).toBe(2);
    expect(aggA.average).toBeCloseTo(4);
    expect(aggA.distribution[5]).toBe(1);
    expect(aggA.distribution[3]).toBe(1);
    expect(aggA.respondedDeliveryCount).toBe(1);

    // survey-B
    expect(result.has('survey-B')).toBe(true);
    const aggB = result.get('survey-B')!;
    expect(aggB.count).toBe(1);
    expect(aggB.average).toBe(4);

    // survey-C has no votes → absent from map
    expect(result.has('survey-C')).toBe(false);
  });

  // ── TC-5: invalid ratings filtered out (only 1-5 count) ──────────────────
  it('excludes out-of-range ratings from count and distribution but still tracks delivery', async () => {
    seedDelivery('delivery-1', 'survey-1');

    // Inject out-of-range vote rows directly into store (bypassing assertRating
    // in submitVote which would throw). This simulates corrupt / legacy data
    // that could exist in the DB, ensuring the guard in aggregateSurveys works.
    store.state.votes.push(
      {
        id: store.nextId(),
        deliveryId: 'delivery-1',
        telegramUserId: BigInt(10),
        username: null,
        rating: 0, // invalid
        comment: null,
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: store.nextId(),
        deliveryId: 'delivery-1',
        telegramUserId: BigInt(11),
        username: null,
        rating: 6, // invalid
        comment: null,
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: store.nextId(),
        deliveryId: 'delivery-1',
        telegramUserId: BigInt(12),
        username: null,
        rating: 3, // valid
        comment: null,
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );

    const result = await aggregateSurveys(['survey-1']);

    expect(result.size).toBe(1);
    const agg = result.get('survey-1')!;
    // Only rating=3 is in range
    expect(agg.count).toBe(1);
    expect(agg.average).toBe(3);
    expect(agg.distribution[3]).toBe(1);
    // All 3 active rows are from the same delivery → respondedDeliveryCount=1
    // (the delivery is tracked before the rating guard, so out-of-range rows
    // still increment the responded set — they are "responded" just with bad data)
    expect(agg.respondedDeliveryCount).toBe(1);
  });

  // ── TC-6: inactive (removed) votes excluded ───────────────────────────────
  it('excludes state=removed votes from aggregate', async () => {
    seedDelivery('delivery-1', 'survey-1');

    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(1), rating: 5 });
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(2), rating: 4 });
    await removeVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(2) }); // flipped to removed

    const result = await aggregateSurveys(['survey-1']);

    const agg = result.get('survey-1')!;
    // Only the active vote for user-1 should be counted
    expect(agg.count).toBe(1);
    expect(agg.average).toBe(5);
    expect(agg.distribution[5]).toBe(1);
    expect(agg.distribution[4]).toBe(0);
  });

  // ── TC-7: distinct deliveries tracked – same deliveryId in N votes ────────
  it('counts respondedDeliveryCount=1 when all active votes share one delivery', async () => {
    seedDelivery('delivery-1', 'survey-1');

    // 5 different users, same delivery
    for (let i = 1; i <= 5; i++) {
      await submitVote({
        deliveryId: 'delivery-1',
        telegramUserId: BigInt(100 + i),
        rating: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      });
    }

    const result = await aggregateSurveys(['survey-1']);

    const agg = result.get('survey-1')!;
    expect(agg.count).toBe(5);
    expect(agg.respondedDeliveryCount).toBe(1);
  });

  // ── TC-8: multiple deliveries per survey ──────────────────────────────────
  it('counts respondedDeliveryCount=3 when votes come from 3 distinct deliveries', async () => {
    // Same survey distributed to 3 separate deliveries (e.g. 3 client groups)
    seedDelivery('delivery-X', 'survey-multi');
    seedDelivery('delivery-Y', 'survey-multi');
    seedDelivery('delivery-Z', 'survey-multi');

    await submitVote({ deliveryId: 'delivery-X', telegramUserId: BigInt(1), rating: 5 });
    await submitVote({ deliveryId: 'delivery-X', telegramUserId: BigInt(2), rating: 4 });
    await submitVote({ deliveryId: 'delivery-Y', telegramUserId: BigInt(3), rating: 3 });
    await submitVote({ deliveryId: 'delivery-Z', telegramUserId: BigInt(4), rating: 2 });

    const result = await aggregateSurveys(['survey-multi']);

    expect(result.size).toBe(1);
    const agg = result.get('survey-multi')!;
    expect(agg.count).toBe(4);
    // average = (5+4+3+2)/4 = 3.5
    expect(agg.average).toBeCloseTo(3.5);
    expect(agg.respondedDeliveryCount).toBe(3);
  });

  // ── TC-9: concurrent calls do not interfere ───────────────────────────────
  it('two parallel aggregateSurveys calls return consistent independent results', async () => {
    seedDelivery('delivery-1', 'survey-1');
    seedDelivery('delivery-2', 'survey-2');

    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(1), rating: 5 });
    await submitVote({ deliveryId: 'delivery-2', telegramUserId: BigInt(2), rating: 2 });

    // Fire both calls in parallel
    const [result1, result2] = await Promise.all([
      aggregateSurveys(['survey-1']),
      aggregateSurveys(['survey-2']),
    ]);

    expect(result1.get('survey-1')!.count).toBe(1);
    expect(result1.get('survey-1')!.average).toBe(5);
    expect(result1.has('survey-2')).toBe(false);

    expect(result2.get('survey-2')!.count).toBe(1);
    expect(result2.get('survey-2')!.average).toBe(2);
    expect(result2.has('survey-1')).toBe(false);
  });

  // ── TC-9b: parallel calls on overlapping ID sets stay isolated ────────────
  it('parallel calls with overlapping survey sets both return correct aggregates', async () => {
    seedDelivery('delivery-shared', 'survey-shared');
    seedDelivery('delivery-only1', 'survey-only1');
    seedDelivery('delivery-only2', 'survey-only2');

    await submitVote({ deliveryId: 'delivery-shared', telegramUserId: BigInt(1), rating: 4 });
    await submitVote({ deliveryId: 'delivery-only1', telegramUserId: BigInt(2), rating: 3 });
    await submitVote({ deliveryId: 'delivery-only2', telegramUserId: BigInt(3), rating: 5 });

    const [resA, resB] = await Promise.all([
      aggregateSurveys(['survey-shared', 'survey-only1']),
      aggregateSurveys(['survey-shared', 'survey-only2']),
    ]);

    // Both should see survey-shared with count=1
    expect(resA.get('survey-shared')!.count).toBe(1);
    expect(resB.get('survey-shared')!.count).toBe(1);
    // Each sees only its own exclusive survey
    expect(resA.has('survey-only2')).toBe(false);
    expect(resB.has('survey-only1')).toBe(false);
  });

  // ── TC-10: large batch (100+ survey IDs) ─────────────────────────────────
  it('handles a large batch of 100 survey IDs without errors', async () => {
    // Seed 5 surveys with votes; the rest are no-op ghost IDs
    const activeSurveyIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const sid = `survey-large-${i}`;
      const did = `delivery-large-${i}`;
      seedDelivery(did, sid);
      await submitVote({
        deliveryId: did,
        telegramUserId: BigInt(200 + i),
        rating: i as 1 | 2 | 3 | 4 | 5,
      });
      activeSurveyIds.push(sid);
    }

    // Build a 100-element array: 5 real + 95 ghost IDs
    const ghostIds = Array.from({ length: 95 }, (_, k) => `ghost-survey-${k}`);
    const allIds = [...activeSurveyIds, ...ghostIds];
    expect(allIds).toHaveLength(100);

    const result = await aggregateSurveys(allIds);

    // Only the 5 seeded surveys should appear
    expect(result.size).toBe(5);
    for (const sid of activeSurveyIds) {
      expect(result.has(sid)).toBe(true);
      expect(result.get(sid)!.count).toBe(1);
    }
    // Ghost IDs produce no entries
    for (const gid of ghostIds) {
      expect(result.has(gid)).toBe(false);
    }
  });

  // ── TC-11: average is null when count is 0 ────────────────────────────────
  it('sets average to null when a survey entry has count=0 (all votes invalid range)', async () => {
    seedDelivery('delivery-1', 'survey-1');

    // All out-of-range: rating=0
    store.state.votes.push({
      id: store.nextId(),
      deliveryId: 'delivery-1',
      telegramUserId: BigInt(20),
      username: null,
      rating: 0,
      comment: null,
      state: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await aggregateSurveys(['survey-1']);

    // Entry exists because the delivery is "responded" even though rating is bad
    if (result.has('survey-1')) {
      const agg = result.get('survey-1')!;
      // count excludes the bad rating
      expect(agg.count).toBe(0);
      // average must be null, not NaN, when count=0
      expect(agg.average).toBeNull();
    }
    // It's equally valid for the implementation to omit the survey entirely
    // (no valid votes → no entry). Both behaviours are acceptable.
    // The critical assertion is that if it IS present, average is not NaN.
    if (!result.has('survey-1')) {
      expect(result.size).toBe(0);
    }
  });

  // ── TC-12: distribution keys always cover 1..5 ────────────────────────────
  it('returns a complete 1-5 distribution object even when only some ratings present', async () => {
    seedDelivery('delivery-1', 'survey-1');
    await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(1), rating: 5 });

    const result = await aggregateSurveys(['survey-1']);

    const agg = result.get('survey-1')!;
    expect(Object.keys(agg.distribution).map(Number).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(agg.distribution[1]).toBe(0);
    expect(agg.distribution[2]).toBe(0);
    expect(agg.distribution[3]).toBe(0);
    expect(agg.distribution[4]).toBe(0);
    expect(agg.distribution[5]).toBe(1);
  });

  // ── TC-13: chunked batch processing (H-2 optimization) ─────────────────────
  it('correctly aggregates surveys split across multiple chunks with custom batchSize', async () => {
    // Create 250 survey IDs: 10 with votes, 240 without
    const surveyIds: string[] = [];
    const surveysWithVotes: string[] = [];

    for (let i = 0; i < 10; i++) {
      const sid = `survey-chunk-${i}`;
      const did = `delivery-chunk-${i}`;
      seedDelivery(did, sid);
      // Add 2 votes per survey
      await submitVote({
        deliveryId: did,
        telegramUserId: BigInt(1000 + i * 2),
        rating: (i % 5) + 1,
      });
      await submitVote({
        deliveryId: did,
        telegramUserId: BigInt(1000 + i * 2 + 1),
        rating: ((i + 1) % 5) + 1,
      });
      surveyIds.push(sid);
      surveysWithVotes.push(sid);
    }

    // Add 240 ghost IDs
    for (let i = 0; i < 240; i++) {
      surveyIds.push(`ghost-chunk-${i}`);
    }

    expect(surveyIds).toHaveLength(250);

    // Call with custom batchSize=50 to force 5 chunks
    // (250 IDs / 50 = 5 chunks)
    const result = await aggregateSurveys(surveyIds, 50);

    // Should find exactly 10 surveys (only those with votes)
    expect(result.size).toBe(10);

    // Verify all seeded surveys are present with correct counts
    for (const sid of surveysWithVotes) {
      expect(result.has(sid)).toBe(true);
      const agg = result.get(sid)!;
      expect(agg.count).toBe(2);
      expect(agg.respondedDeliveryCount).toBe(1);
    }

    // Verify ghost IDs produce no entries
    for (let i = 0; i < 240; i++) {
      expect(result.has(`ghost-chunk-${i}`)).toBe(false);
    }
  });

  // ── TC-14: default batchSize of 100 ──────────────────────────────────────
  it('uses default batchSize of 100 when not specified', async () => {
    // Create 150 survey IDs to trigger chunking with default batchSize=100
    const surveyIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const sid = `survey-default-${i}`;
      const did = `delivery-default-${i}`;
      seedDelivery(did, sid);
      await submitVote({
        deliveryId: did,
        telegramUserId: BigInt(2000 + i),
        rating: 3,
      });
      surveyIds.push(sid);
    }

    // Add 147 ghost IDs (total 150, which triggers 2 chunks with batchSize=100)
    for (let i = 0; i < 147; i++) {
      surveyIds.push(`ghost-default-${i}`);
    }

    expect(surveyIds).toHaveLength(150);

    // Call without batchSize parameter to use default
    const result = await aggregateSurveys(surveyIds);

    // Should find exactly 3 surveys
    expect(result.size).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(result.has(`survey-default-${i}`)).toBe(true);
    }
  });

  // ── TC-15: totalRecipientsCount = distinct users in chats (gh-334) ────────
  it('calculates totalRecipientsCount as unique users in delivery chats (not voters)', async () => {
    // Chat A has users, Survey sent to 1 delivery in chat A
    const chatA = BigInt(100);
    seedChatMessage(chatA, BigInt(1), false); // user 1
    seedChatMessage(chatA, BigInt(2), false); // user 2
    seedChatMessage(chatA, BigInt(3), false); // user 3
    seedChatMessage(chatA, BigInt(4), false); // user 4
    seedChatMessage(chatA, BigInt(5), false); // user 5
    seedChatMessage(chatA, BigInt(7), false); // user 7
    seedChatMessage(chatA, BigInt(999), true); // accountant (should be excluded)

    // Chat B has users, Survey sent to 1 delivery in chat B
    const chatB = BigInt(200);
    seedChatMessage(chatB, BigInt(6), false); // user 6
    seedChatMessage(chatB, BigInt(8), false); // user 8

    // Create survey with 2 deliveries (one per chat)
    seedDelivery('delivery-A', 'survey-multi-chat', 'active', chatA);
    seedDelivery('delivery-B', 'survey-multi-chat', 'active', chatB);

    // Only 1 user votes in chat A delivery
    await submitVote({ deliveryId: 'delivery-A', telegramUserId: BigInt(1), rating: 5 });

    // Only 1 user votes in chat B delivery
    await submitVote({ deliveryId: 'delivery-B', telegramUserId: BigInt(6), rating: 4 });

    const result = await aggregateSurveys(['survey-multi-chat']);

    const agg = result.get('survey-multi-chat')!;
    expect(agg.count).toBe(2); // 2 actual votes
    expect(agg.respondedDeliveryCount).toBe(2); // 2 deliveries have votes

    // CRITICAL (gh-334): totalRecipientsCount should be the count of unique users
    // in the chats that received this survey, excluding accountants.
    // Chat A: users 1,2,3,4,5,7 (6 users, user 999 excluded as accountant)
    // Chat B: users 6,8 (2 users)
    // Total unique users: 1,2,3,4,5,6,7,8 = 8 unique users
    // responseRate = 2 voters / 8 total = 25%
    expect(agg.totalRecipientsCount).toBe(8);
  });
});
