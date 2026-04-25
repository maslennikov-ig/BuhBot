/**
 * Survey Vote Service (gh-294)
 *
 * Implements multi-user voting on surveys with vote changes and audit history.
 *
 * Model:
 * - One row in `survey_votes` per (deliveryId, telegramUserId), concurrency-
 *   anchored by a composite unique constraint.
 * - Effective vote per user = latest row with state='active'.
 * - Rows with state='removed' are preserved (for audit) but excluded from
 *   aggregates.
 * - Every transition (create / update / remove) appends a row to
 *   `survey_vote_history` inside the same transaction, so history and
 *   current state never drift.
 *
 * Write atomicity is achieved by wrapping the read-modify-write in a Prisma
 * interactive transaction and delegating dedup to the composite unique
 * constraint. Serializable isolation is not needed because every writer
 * targets the same row via `upsert(where: deliveryId_telegramUserId)`.
 *
 * @module services/feedback/vote
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import type { SurveyVote, SurveyVoteHistory } from '@prisma/client';

// ============================================================================
// ERRORS
// ============================================================================

/**
 * Thrown when a vote is submitted against a survey whose status does not
 * accept votes (e.g. `closed`, `expired`). Callers (bot handler, tRPC) can
 * use `instanceof` to pick the right user-facing message.
 */
export class SurveyClosedError extends Error {
  public readonly code = 'SURVEY_CLOSED' as const;
  constructor(surveyId: string, status: string) {
    super(`Survey ${surveyId} is not accepting votes (status=${status})`);
    this.name = 'SurveyClosedError';
  }
}

/**
 * Thrown when the referenced delivery does not exist. Distinct from
 * SurveyClosedError so callers can present "survey not found" vs "closed".
 */
export class DeliveryNotFoundError extends Error {
  public readonly code = 'DELIVERY_NOT_FOUND' as const;
  constructor(deliveryId: string) {
    super(`Survey delivery ${deliveryId} not found`);
    this.name = 'DeliveryNotFoundError';
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface SubmitVoteInput {
  deliveryId: string;
  telegramUserId: bigint;
  rating: number;
  username?: string | null;
  comment?: string | null;
}

export interface RemoveVoteInput {
  deliveryId: string;
  telegramUserId: bigint;
  username?: string | null;
}

export interface SurveyAggregate {
  /** Number of effective votes (state='active') included in the aggregate. */
  count: number;
  /** Arithmetic mean of effective rating values; null when count is 0. */
  average: number | null;
  /** Count of distinct deliveries that have at least one active vote (for response rate calculation). */
  respondedDeliveryCount?: number;
  /**
   * Count of distinct users (by telegramUserId) in all chats that received this
   * survey, excluding accountants (isAccountant=false). Used to calculate
   * user-level response rate as: (voters) / (totalRecipientsCount) * 100.
   * gh-334: responseRate should be % of unique users who voted, not % of chats.
   */
  totalRecipientsCount?: number;
  /**
   * Per-rating histogram. Keys are rating values 1..5; values are counts of
   * effective (active) votes at that rating.
   */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface VoteHistoryEntry {
  timestamp: Date;
  username: string | null;
  telegramUserId: bigint;
  action: 'create' | 'update' | 'remove';
  oldRating: number | null;
  newRating: number | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function emptyDistribution(): Record<1 | 2 | 3 | 4 | 5, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

function assertRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error(`Rating must be an integer between 1 and 5, got ${rating}`);
  }
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Submit or update a user's vote on a survey delivery.
 *
 * Behavior:
 * - No prior vote → create row (state='active') + history action='create'.
 * - Prior active vote, SAME rating → no-op, no history row appended (prevents
 *   log noise when users tap the same button twice; history is for *changes*).
 * - Prior active vote, DIFFERENT rating → update rating, append 'update' with
 *   oldRating=prev, newRating=new.
 * - Prior removed vote → flip to active with new rating, append 'update' with
 *   oldRating=null (there was no active rating immediately before), newRating=new.
 *
 * Concurrency: the composite unique constraint (delivery_id, telegram_user_id)
 * combined with Prisma's upsert guarantees exactly one row per user even under
 * high-contention races.
 *
 * @throws {DeliveryNotFoundError} when the delivery does not exist.
 * @throws {SurveyClosedError} when the parent survey is not accepting votes.
 */
export async function submitVote(input: SubmitVoteInput): Promise<SurveyVote> {
  assertRating(input.rating);

  const delivery = await prisma.surveyDelivery.findUnique({
    where: { id: input.deliveryId },
    include: { survey: true },
  });
  if (!delivery) {
    throw new DeliveryNotFoundError(input.deliveryId);
  }
  if (delivery.survey.status !== 'active' && delivery.survey.status !== 'sending') {
    throw new SurveyClosedError(delivery.surveyId, delivery.survey.status);
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.surveyVote.findUnique({
      where: {
        survey_votes_delivery_user_unique: {
          deliveryId: input.deliveryId,
          telegramUserId: input.telegramUserId,
        },
      },
    });

    // Decide action + oldRating using prior row state.
    let action: 'create' | 'update' | null;
    let oldRating: number | null;
    if (!existing) {
      action = 'create';
      oldRating = null;
    } else if (existing.state === 'removed') {
      action = 'update';
      oldRating = null; // no active rating immediately prior
    } else if (existing.rating === input.rating) {
      // Idempotent — active vote with same rating. Skip history append.
      action = null;
      oldRating = existing.rating;
    } else {
      action = 'update';
      oldRating = existing.rating;
    }

    const vote = await tx.surveyVote.upsert({
      where: {
        survey_votes_delivery_user_unique: {
          deliveryId: input.deliveryId,
          telegramUserId: input.telegramUserId,
        },
      },
      create: {
        deliveryId: input.deliveryId,
        telegramUserId: input.telegramUserId,
        username: input.username ?? null,
        rating: input.rating,
        comment: input.comment ?? null,
        state: 'active',
      },
      update: {
        rating: input.rating,
        state: 'active',
        username: input.username ?? null,
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
        updatedAt: now,
      },
    });

    if (action !== null) {
      await tx.surveyVoteHistory.create({
        data: {
          voteId: vote.id,
          deliveryId: input.deliveryId,
          telegramUserId: input.telegramUserId,
          username: input.username ?? null,
          action,
          oldRating,
          newRating: input.rating,
        },
      });
    }

    return vote;
  });

  logger.info('Survey vote submitted', {
    deliveryId: input.deliveryId,
    telegramUserId: input.telegramUserId.toString(),
    rating: input.rating,
    voteId: result.id,
    service: 'vote-service',
  });

  return result;
}

/**
 * Remove (soft-delete) a user's vote on a survey delivery.
 *
 * Behavior:
 * - Prior active vote → flip state to 'removed', append history 'remove' with
 *   oldRating=previousRating, newRating=null.
 * - Prior removed vote or no prior vote → no-op (no history row).
 *
 * Returning the updated row (or null for no-op) lets the caller decide how to
 * render the keyboard without re-fetching.
 */
export async function removeVote(input: RemoveVoteInput): Promise<SurveyVote | null> {
  const delivery = await prisma.surveyDelivery.findUnique({
    where: { id: input.deliveryId },
    include: { survey: true },
  });
  if (!delivery) {
    throw new DeliveryNotFoundError(input.deliveryId);
  }
  // Allow removal only while the survey is still accepting votes. Removing
  // after close would retroactively alter historical aggregates.
  if (delivery.survey.status !== 'active' && delivery.survey.status !== 'sending') {
    throw new SurveyClosedError(delivery.surveyId, delivery.survey.status);
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.surveyVote.findUnique({
      where: {
        survey_votes_delivery_user_unique: {
          deliveryId: input.deliveryId,
          telegramUserId: input.telegramUserId,
        },
      },
    });

    if (!existing || existing.state === 'removed') {
      // No-op: nothing to remove, no history row.
      return null;
    }

    const updated = await tx.surveyVote.update({
      where: { id: existing.id },
      data: { state: 'removed', updatedAt: new Date() },
    });

    await tx.surveyVoteHistory.create({
      data: {
        voteId: updated.id,
        deliveryId: input.deliveryId,
        telegramUserId: input.telegramUserId,
        username: input.username ?? existing.username ?? null,
        action: 'remove',
        oldRating: existing.rating,
        newRating: null,
      },
    });

    return updated;
  });

  if (result) {
    logger.info('Survey vote removed', {
      deliveryId: input.deliveryId,
      telegramUserId: input.telegramUserId.toString(),
      voteId: result.id,
      service: 'vote-service',
    });
  }

  return result;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get the effective active vote for a given (delivery, user), or null if the
 * user has no active vote. Used by the bot handler to render the per-user
 * keyboard with the correct "checkmark" state.
 */
export async function getEffectiveVote(
  deliveryId: string,
  telegramUserId: bigint
): Promise<SurveyVote | null> {
  const vote = await prisma.surveyVote.findUnique({
    where: {
      survey_votes_delivery_user_unique: {
        deliveryId,
        telegramUserId,
      },
    },
  });
  if (!vote || vote.state !== 'active') {
    return null;
  }
  return vote;
}

/**
 * Aggregate effective (active) votes for a single delivery.
 *
 * Excludes state='removed' rows from count/average/distribution.
 */
export async function aggregateDelivery(deliveryId: string): Promise<SurveyAggregate> {
  return aggregateInternal({ deliveryId });
}

/**
 * Aggregate effective (active) votes for an entire survey campaign. Walks all
 * deliveries for the survey.
 */
export async function aggregateSurvey(surveyId: string): Promise<SurveyAggregate> {
  return aggregateInternal({ surveyId });
}

/**
 * Batch aggregate surveys by ID. Returns a Map<surveyId, SurveyAggregate>
 * with live vote counts. Surveys with no votes will be absent from the map.
 * (gh-333: used by list procedure to overlay aggregates)
 *
 * Implements chunked processing (H-2) to prevent OOM when aggregating large
 * numbers of surveys. Splits surveyIds into batches and executes aggregation
 * in parallel, then merges results.
 *
 * @param surveyIds Survey IDs to aggregate
 * @param batchSize Maximum surveys per batch (default: 100). Tune based on
 *   expected vote count and available memory.
 */
export async function aggregateSurveys(
  surveyIds: string[],
  batchSize: number = 100
): Promise<Map<string, SurveyAggregate>> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`batchSize must be a positive integer, got ${batchSize}`);
  }

  // Split surveyIds into chunks to prevent unbounded memory growth
  const chunks: string[][] = [];
  for (let i = 0; i < surveyIds.length; i += batchSize) {
    chunks.push(surveyIds.slice(i, i + batchSize));
  }

  // Aggregate each chunk in parallel with error resilience (buh-8bad)
  const results = await Promise.allSettled(chunks.map((chunk) => aggregateSurveysInternal(chunk)));

  // Merge results from all chunks into a single map, skipping failed chunks
  const merged = new Map<string, SurveyAggregate>();
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const [surveyId, aggregate] of result.value) {
        merged.set(surveyId, aggregate);
      }
    } else {
      logger.error('Chunk aggregation failed, skipping partial batch', {
        error: result.reason,
        service: 'vote-service',
      });
    }
  }

  return merged;
}

/**
 * Internal batch aggregation for a single chunk of surveys.
 * Does not enforce batch size limits; caller is responsible for chunking.
 *
 * Query strategy (buh-lako): Selects only necessary columns with delivery join
 * to enable database-level filtering and sorting before JS aggregation.
 * Single findMany query with careful select minimizes data transfer and
 * memory footprint.
 *
 * @internal
 */
async function aggregateSurveysInternal(
  surveyIds: string[]
): Promise<Map<string, SurveyAggregate>> {
  // Query all active votes with delivery info for given surveys
  // The database handles filtering (state, surveyId) before JS receives results
  const votes = await prisma.surveyVote.findMany({
    where: {
      state: 'active',
      delivery: { surveyId: { in: surveyIds } },
    },
    select: {
      rating: true,
      delivery: { select: { id: true, surveyId: true, chatId: true } },
    },
  });

  // Accumulate per-survey and track distinct deliveries with votes
  const sums = new Map<
    string,
    {
      sum: number;
      count: number;
      dist: ReturnType<typeof emptyDistribution>;
      deliveryIds: Set<string>;
      chatIds: Set<bigint>;
    }
  >();

  for (const v of votes) {
    const sid = v.delivery.surveyId;
    if (!sums.has(sid)) {
      sums.set(sid, {
        sum: 0,
        count: 0,
        dist: emptyDistribution(),
        deliveryIds: new Set(),
        chatIds: new Set(),
      });
    }
    const s = sums.get(sid)!;
    s.deliveryIds.add(v.delivery.id);
    s.chatIds.add(v.delivery.chatId);
    const rating = v.rating as 1 | 2 | 3 | 4 | 5;
    if (rating >= 1 && rating <= 5) {
      s.count += 1;
      s.sum += rating;
      s.dist[rating] += 1;
    }
  }

  // gh-334: For each survey, get count of distinct users in all chats that
  // received it, excluding accountants. This is the denominator for user-level
  // response rate calculation.
  //
  // buh-8moj (M-1): Batch all chatIds across all surveys into a single query
  // to avoid N+1 (one findMany per survey). We then build a
  // chatId → Set<telegramUserId> map and union per-survey in JS.
  // DB round-trips: 1+N → 2, regardless of page size.
  const allChatIds = new Set<bigint>();
  for (const s of sums.values()) {
    for (const cid of s.chatIds) allChatIds.add(cid);
  }

  const allRecipients =
    allChatIds.size > 0
      ? await prisma.chatMessage.findMany({
          where: {
            chatId: { in: Array.from(allChatIds) },
            isAccountant: false,
          },
          select: { chatId: true, telegramUserId: true },
          distinct: ['chatId', 'telegramUserId'],
        })
      : [];

  // Build chatId → Set<telegramUserId> map for per-survey union below.
  const chatUserMap = new Map<bigint, Set<bigint>>();
  for (const row of allRecipients) {
    if (!chatUserMap.has(row.chatId)) chatUserMap.set(row.chatId, new Set());
    chatUserMap.get(row.chatId)!.add(row.telegramUserId);
  }

  // Per-survey count: union of distinct users across all its chats.
  // A user in two chats of the same survey counts once.
  const totalRecipientsMap = new Map<string, number>();
  for (const [sid, s] of sums) {
    const uniqueUsers = new Set<bigint>();
    for (const cid of s.chatIds) {
      for (const uid of chatUserMap.get(cid) ?? []) uniqueUsers.add(uid);
    }
    if (uniqueUsers.size > 0) totalRecipientsMap.set(sid, uniqueUsers.size);
  }

  // Convert to SurveyAggregate map (buh-5jpa: type-safe)
  const result = new Map<string, SurveyAggregate>();
  for (const [sid, s] of sums) {
    const totalRecipients = totalRecipientsMap.get(sid);
    const agg: SurveyAggregate = {
      count: s.count,
      average: s.count > 0 ? s.sum / s.count : null,
      respondedDeliveryCount: s.deliveryIds.size,
      distribution: s.dist,
      ...(totalRecipients !== undefined && { totalRecipientsCount: totalRecipients }),
    };
    result.set(sid, agg);
  }
  return result;
}

async function aggregateInternal(
  scope: { deliveryId: string } | { surveyId: string }
): Promise<SurveyAggregate> {
  const where: Prisma.SurveyVoteWhereInput = {
    state: 'active',
    ...('deliveryId' in scope
      ? { deliveryId: scope.deliveryId }
      : { delivery: { surveyId: scope.surveyId } }),
  };

  // For surveyId scope, also fetch deliveries to get chatIds
  let chatIds: Set<bigint> | null = null;
  if ('surveyId' in scope) {
    const deliveries = await prisma.surveyDelivery.findMany({
      where: { surveyId: scope.surveyId },
      select: { chatId: true },
    });
    chatIds = new Set(deliveries.map((d) => d.chatId));
  }

  const votes = await prisma.surveyVote.findMany({
    where,
    select: { rating: true },
  });

  const distribution = emptyDistribution();
  let sum = 0;
  for (const v of votes) {
    const rating = v.rating as 1 | 2 | 3 | 4 | 5;
    if (rating >= 1 && rating <= 5) {
      distribution[rating] += 1;
      sum += rating;
    }
  }

  const count = votes.length;
  const average = count > 0 ? sum / count : null;

  // gh-334: Calculate totalRecipientsCount for surveyId scope
  let totalRecipientsCount: number | undefined;
  if (chatIds && chatIds.size > 0) {
    const recipients = await prisma.chatMessage.findMany({
      where: {
        chatId: { in: Array.from(chatIds) },
        isAccountant: false,
      },
      select: { telegramUserId: true },
      distinct: ['telegramUserId'],
    });
    totalRecipientsCount = recipients.length;
  }

  const result: SurveyAggregate = {
    count,
    average,
    distribution,
    ...(totalRecipientsCount !== undefined && { totalRecipientsCount }),
  };
  return result;
}

/**
 * Get the full audit history for a delivery in chronological order.
 *
 * Returns every SurveyVoteHistory row for the given delivery. The manager UI
 * renders this as a table (timestamp / user / action / old→new rating).
 */
export async function getVoteHistory(deliveryId: string): Promise<VoteHistoryEntry[]> {
  const rows: SurveyVoteHistory[] = await prisma.surveyVoteHistory.findMany({
    where: { deliveryId },
    orderBy: { changedAt: 'asc' },
  });

  return rows.map((r) => ({
    timestamp: r.changedAt,
    username: r.username,
    telegramUserId: r.telegramUserId,
    action: r.action,
    oldRating: r.oldRating,
    newRating: r.newRating,
  }));
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  submitVote,
  removeVote,
  getEffectiveVote,
  aggregateDelivery,
  aggregateSurvey,
  aggregateSurveys,
  getVoteHistory,
  SurveyClosedError,
  DeliveryNotFoundError,
};
