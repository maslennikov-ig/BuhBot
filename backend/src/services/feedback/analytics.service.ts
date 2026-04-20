/**
 * Feedback Analytics Service
 *
 * Provides analytics calculations for client feedback:
 * - NPS (Net Promoter Score) calculation
 * - Rating distribution
 * - Trend analysis
 *
 * NPS Formula: % Promoters (4-5) - % Detractors (1-3)
 *
 * ## Unified read model (gh-324 / ADR-007)
 *
 * Read-path unifies two write sources:
 *   - `FeedbackResponse` — legacy, historical rows pre-gh-294 (immutable).
 *   - `SurveyVote (state='active')` — canonical, multi-user voting post-gh-294.
 *
 * The unified helpers below (`fetchUnifiedRatings`, `fetchUnifiedEntries`,
 * `fetchUnifiedComments`) issue both queries in parallel via `Promise.all`,
 * then merge and sort in memory. Prisma does not support UNION natively; at
 * /feedback volumes (<10k rows per tenant) the in-memory merge is cheap.
 *
 * Public API signatures (`getAggregates`, `getTrendData`, `getRecentComments`,
 * `getSurveySummary`) are UNCHANGED — callers need not care about the
 * underlying UNION. Dedup is NOT performed: write-periods do not overlap by
 * design (see ADR-007 §5). The `no-deliveryId-in-both` invariant is enforced
 * by tests as a safety net.
 *
 * @module services/feedback/analytics
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RatingDistribution {
  rating: number;
  count: number;
  percentage: number;
}

export interface NPSResult {
  score: number; // -100 to +100
  promoters: number; // count of 4-5 ratings
  detractors: number; // count of 1-3 ratings
  total: number;
  promoterPercentage: number;
  detractorPercentage: number;
}

export interface FeedbackAggregates {
  totalResponses: number;
  averageRating: number;
  nps: NPSResult;
  distribution: RatingDistribution[];
}

export interface TrendDataPoint {
  period: string; // "2025-Q1"
  averageRating: number;
  responseCount: number;
  npsScore: number;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

// ============================================================================
// UNIFIED READ HELPERS (gh-324 / ADR-007)
// ============================================================================

/**
 * Shape of a unified rating row, used by aggregate/trend calculations.
 * Minimal fields (no joins) to keep the query light.
 */
export interface UnifiedRatingRow {
  rating: number;
  submittedAt: Date; // For SurveyVote rows this is `updatedAt` (see ADR-007 §4).
  chatId: bigint;
  surveyId: string | null;
}

/**
 * Shape of a unified feedback entry row — full DTO for listings and export.
 *
 * Field mapping (legacy → vote):
 *   id               → response.id                              / vote.id
 *   chatId           → response.chatId                          / vote.delivery.chatId
 *   chatTitle        → response.chat.title                      / vote.delivery.chat.title
 *   clientUsername   → response.clientUsername                  / vote.username
 *   accountantName   → response.chat.assignedAccountant.fullName / vote.delivery.chat.assignedAccountant.fullName
 *   rating           → response.rating                          / vote.rating
 *   comment          → response.comment                         / vote.comment
 *   submittedAt      → response.submittedAt                     / vote.updatedAt
 *   surveyId         → response.surveyId                        / vote.delivery.surveyId
 *   surveyQuarter    → response.survey.quarter                  / vote.delivery.survey.quarter
 */
export interface UnifiedEntryRow {
  id: string;
  chatId: bigint;
  chatTitle: string | null;
  clientUsername: string | null;
  accountantName: string | null;
  rating: number;
  comment: string | null;
  submittedAt: Date;
  surveyId: string | null;
  surveyQuarter: string | null;
  source: 'legacy' | 'vote';
}

interface UnifiedReadFilters {
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  surveyId?: string | undefined;
  /** Optional chat scoping. `null` = no restriction (admin). */
  scopedChatIds?: bigint[] | null | undefined;
}

interface UnifiedEntryFilters extends UnifiedReadFilters {
  minRating?: number | undefined;
  maxRating?: number | undefined;
  /** Chat filter applied independently from scoping. */
  chatId?: bigint | undefined;
}

/**
 * Build the common submitted-at/updated-at range filter.
 * Returns `undefined` when no bounds are present (so we can spread conditionally).
 */
function buildTimeFilter(dateFrom?: Date, dateTo?: Date): Prisma.DateTimeFilter | undefined {
  if (!dateFrom && !dateTo) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (dateFrom) filter.gte = dateFrom;
  if (dateTo) filter.lte = dateTo;
  return filter;
}

/**
 * Parallel read of legacy `feedbackResponse` + active `surveyVote` rows,
 * merged into a single `UnifiedRatingRow[]` for lightweight aggregation.
 *
 * Note: the helper does NOT deduplicate by deliveryId — dedup is a write-time
 * invariant (see ADR-007 §5). If the invariant is violated in the future the
 * caller would see two rows for the same delivery — this is intentional so
 * that the violation surfaces rather than being silently hidden.
 */
export async function fetchUnifiedRatings(opts: UnifiedReadFilters): Promise<UnifiedRatingRow[]> {
  const timeFilter = buildTimeFilter(opts.dateFrom, opts.dateTo);

  const legacyWhere: Prisma.FeedbackResponseWhereInput = {};
  if (timeFilter) legacyWhere.submittedAt = timeFilter;
  if (opts.surveyId) legacyWhere.surveyId = opts.surveyId;
  if (opts.scopedChatIds) legacyWhere.chatId = { in: opts.scopedChatIds };

  const voteWhere: Prisma.SurveyVoteWhereInput = { state: 'active' };
  if (timeFilter) voteWhere.updatedAt = timeFilter;
  if (opts.surveyId || opts.scopedChatIds) {
    const deliveryWhere: Prisma.SurveyDeliveryWhereInput = {};
    if (opts.surveyId) deliveryWhere.surveyId = opts.surveyId;
    if (opts.scopedChatIds) deliveryWhere.chatId = { in: opts.scopedChatIds };
    voteWhere.delivery = deliveryWhere;
  }

  const [legacy, votes] = await Promise.all([
    prisma.feedbackResponse.findMany({
      where: legacyWhere,
      select: {
        rating: true,
        submittedAt: true,
        chatId: true,
        surveyId: true,
      },
    }),
    prisma.surveyVote.findMany({
      where: voteWhere,
      select: {
        rating: true,
        updatedAt: true,
        delivery: {
          select: { chatId: true, surveyId: true },
        },
      },
    }),
  ]);

  const out: UnifiedRatingRow[] = [
    ...legacy.map((r) => ({
      rating: r.rating,
      submittedAt: r.submittedAt,
      chatId: r.chatId,
      surveyId: r.surveyId,
    })),
    ...votes.map((v) => ({
      rating: v.rating,
      submittedAt: v.updatedAt,
      chatId: v.delivery.chatId,
      surveyId: v.delivery.surveyId,
    })),
  ];

  return out;
}

/**
 * Parallel read of full feedback entries from both sources, optionally
 * paginated. `total` is the raw count (before pagination) and includes
 * rows from both sources.
 */
export async function fetchUnifiedEntries(
  opts: UnifiedEntryFilters & { page?: number; pageSize?: number }
): Promise<{ items: UnifiedEntryRow[]; total: number }> {
  const timeFilter = buildTimeFilter(opts.dateFrom, opts.dateTo);
  const scopedChatIds = Array.isArray(opts.scopedChatIds) ? opts.scopedChatIds : undefined;

  // Intersection guard: when both scope and explicit chatId are supplied,
  // the explicit chat must belong to scope, otherwise return an empty result.
  if (scopedChatIds && opts.chatId !== undefined && !scopedChatIds.includes(opts.chatId)) {
    return { items: [], total: 0 };
  }

  const legacyWhere: Prisma.FeedbackResponseWhereInput = {};
  if (timeFilter) legacyWhere.submittedAt = timeFilter;
  if (opts.surveyId) legacyWhere.surveyId = opts.surveyId;
  if (opts.chatId !== undefined) {
    legacyWhere.chatId = opts.chatId;
  } else if (scopedChatIds) {
    legacyWhere.chatId = { in: scopedChatIds };
  }
  if (opts.minRating !== undefined || opts.maxRating !== undefined) {
    const ratingFilter: Prisma.IntFilter = {};
    if (opts.minRating !== undefined) ratingFilter.gte = opts.minRating;
    if (opts.maxRating !== undefined) ratingFilter.lte = opts.maxRating;
    legacyWhere.rating = ratingFilter;
  }

  const voteWhere: Prisma.SurveyVoteWhereInput = { state: 'active' };
  if (timeFilter) voteWhere.updatedAt = timeFilter;
  const needsDeliveryJoin =
    opts.surveyId !== undefined || scopedChatIds !== undefined || opts.chatId !== undefined;
  if (needsDeliveryJoin) {
    const deliveryWhere: Prisma.SurveyDeliveryWhereInput = {};
    if (opts.surveyId) deliveryWhere.surveyId = opts.surveyId;
    if (opts.chatId !== undefined) {
      deliveryWhere.chatId = opts.chatId;
    } else if (scopedChatIds) {
      deliveryWhere.chatId = { in: scopedChatIds };
    }
    voteWhere.delivery = deliveryWhere;
  }
  if (opts.minRating !== undefined || opts.maxRating !== undefined) {
    const ratingFilter: Prisma.IntFilter = {};
    if (opts.minRating !== undefined) ratingFilter.gte = opts.minRating;
    if (opts.maxRating !== undefined) ratingFilter.lte = opts.maxRating;
    voteWhere.rating = ratingFilter;
  }

  const [legacyRows, voteRows] = await Promise.all([
    prisma.feedbackResponse.findMany({
      where: legacyWhere,
      include: {
        chat: {
          include: {
            assignedAccountant: { select: { fullName: true } },
          },
        },
        survey: { select: { quarter: true } },
      },
      orderBy: { submittedAt: 'desc' },
    }),
    prisma.surveyVote.findMany({
      where: voteWhere,
      include: {
        delivery: {
          include: {
            chat: {
              include: {
                assignedAccountant: { select: { fullName: true } },
              },
            },
            survey: { select: { quarter: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const merged: UnifiedEntryRow[] = [
    ...legacyRows.map((r) => ({
      id: r.id,
      chatId: r.chatId,
      chatTitle: r.chat?.title ?? null,
      clientUsername: r.clientUsername,
      accountantName: r.chat?.assignedAccountant?.fullName ?? null,
      rating: r.rating,
      comment: r.comment,
      submittedAt: r.submittedAt,
      surveyId: r.surveyId,
      surveyQuarter: r.survey?.quarter ?? null,
      source: 'legacy' as const,
    })),
    ...voteRows.map((v) => ({
      id: v.id,
      chatId: v.delivery.chatId,
      chatTitle: v.delivery.chat?.title ?? null,
      clientUsername: v.username,
      accountantName: v.delivery.chat?.assignedAccountant?.fullName ?? null,
      rating: v.rating,
      comment: v.comment,
      submittedAt: v.updatedAt,
      surveyId: v.delivery.surveyId,
      surveyQuarter: v.delivery.survey?.quarter ?? null,
      source: 'vote' as const,
    })),
  ];

  // Global merge-sort by submittedAt DESC (tie-break by id for stability).
  merged.sort((a, b) => {
    const diff = b.submittedAt.getTime() - a.submittedAt.getTime();
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  const total = merged.length;

  let items = merged;
  if (opts.page !== undefined && opts.pageSize !== undefined) {
    const skip = (opts.page - 1) * opts.pageSize;
    items = merged.slice(skip, skip + opts.pageSize);
  }

  return { items, total };
}

/**
 * Parallel read of comments (only rows with non-null comment) from both
 * sources, sorted by submittedAt DESC and limited.
 */
export async function fetchUnifiedComments(
  opts: UnifiedReadFilters & { limit: number }
): Promise<
  Array<Pick<UnifiedEntryRow, 'comment' | 'rating' | 'submittedAt' | 'chatId' | 'clientUsername'>>
> {
  const timeFilter = buildTimeFilter(opts.dateFrom, opts.dateTo);

  const legacyWhere: Prisma.FeedbackResponseWhereInput = { comment: { not: null } };
  if (timeFilter) legacyWhere.submittedAt = timeFilter;
  if (opts.surveyId) legacyWhere.surveyId = opts.surveyId;
  if (opts.scopedChatIds) legacyWhere.chatId = { in: opts.scopedChatIds };

  const voteWhere: Prisma.SurveyVoteWhereInput = {
    state: 'active',
    comment: { not: null },
  };
  if (timeFilter) voteWhere.updatedAt = timeFilter;
  if (opts.surveyId || opts.scopedChatIds) {
    const deliveryWhere: Prisma.SurveyDeliveryWhereInput = {};
    if (opts.surveyId) deliveryWhere.surveyId = opts.surveyId;
    if (opts.scopedChatIds) deliveryWhere.chatId = { in: opts.scopedChatIds };
    voteWhere.delivery = deliveryWhere;
  }

  const [legacy, votes] = await Promise.all([
    prisma.feedbackResponse.findMany({
      where: legacyWhere,
      select: {
        comment: true,
        rating: true,
        submittedAt: true,
        chatId: true,
        clientUsername: true,
      },
      orderBy: { submittedAt: 'desc' },
      take: opts.limit,
    }),
    prisma.surveyVote.findMany({
      where: voteWhere,
      select: {
        comment: true,
        rating: true,
        updatedAt: true,
        username: true,
        delivery: { select: { chatId: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: opts.limit,
    }),
  ]);

  const merged: Array<
    Pick<UnifiedEntryRow, 'comment' | 'rating' | 'submittedAt' | 'chatId' | 'clientUsername'>
  > = [
    ...legacy.map((r) => ({
      comment: r.comment,
      rating: r.rating,
      submittedAt: r.submittedAt,
      chatId: r.chatId,
      clientUsername: r.clientUsername,
    })),
    ...votes.map((v) => ({
      comment: v.comment,
      rating: v.rating,
      submittedAt: v.updatedAt,
      chatId: v.delivery.chatId,
      clientUsername: v.username,
    })),
  ];

  merged.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

  return merged.slice(0, opts.limit);
}

// ============================================================================
// ANALYTICS FUNCTIONS
// ============================================================================

/**
 * Calculate NPS from rating distribution
 *
 * NPS = (% Promoters) - (% Detractors)
 * - Promoters: ratings 4-5
 * - Detractors: ratings 1-3
 *
 * @param ratings - Array of rating values (1-5)
 * @returns NPS result object
 */
export function calculateNPS(ratings: number[]): NPSResult {
  if (ratings.length === 0) {
    return {
      score: 0,
      promoters: 0,
      detractors: 0,
      total: 0,
      promoterPercentage: 0,
      detractorPercentage: 0,
    };
  }

  const promoters = ratings.filter((r) => r >= 4).length;
  const detractors = ratings.filter((r) => r <= 3).length;
  const total = ratings.length;

  const promoterPercentage = (promoters / total) * 100;
  const detractorPercentage = (detractors / total) * 100;
  const score = Math.round(promoterPercentage - detractorPercentage);

  return {
    score,
    promoters,
    detractors,
    total,
    promoterPercentage: Math.round(promoterPercentage * 10) / 10,
    detractorPercentage: Math.round(detractorPercentage * 10) / 10,
  };
}

/**
 * Calculate rating distribution from ratings array
 *
 * @param ratings - Array of rating values (1-5)
 * @returns Distribution for each rating level
 */
export function calculateDistribution(ratings: number[]): RatingDistribution[] {
  const counts = new Map<number, number>();

  // Initialize all ratings to 0
  for (let i = 1; i <= 5; i++) {
    counts.set(i, 0);
  }

  // Count occurrences
  for (const rating of ratings) {
    counts.set(rating, (counts.get(rating) || 0) + 1);
  }

  const total = ratings.length || 1; // Avoid division by zero

  return Array.from(counts.entries()).map(([rating, count]) => ({
    rating,
    count,
    percentage: Math.round((count / total) * 100 * 10) / 10,
  }));
}

/**
 * Get aggregate feedback statistics.
 *
 * Reads from `feedbackResponse ∪ surveyVote(active)` (see ADR-007).
 *
 * @param dateRange - Optional date filter
 * @param surveyId - Optional survey filter
 * @returns Aggregate statistics
 */
export async function getAggregates(
  dateRange?: DateRange,
  surveyId?: string
): Promise<FeedbackAggregates> {
  const rows = await fetchUnifiedRatings({
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
    surveyId,
  });

  const ratings = rows.map((r) => r.rating);
  const totalResponses = ratings.length;

  const averageRating =
    totalResponses > 0
      ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / totalResponses) * 10) / 10
      : 0;

  const nps = calculateNPS(ratings);
  const distribution = calculateDistribution(ratings);

  logger.debug('Feedback aggregates calculated', {
    totalResponses,
    averageRating,
    npsScore: nps.score,
    dateRange,
    surveyId,
    service: 'analytics-service',
  });

  return {
    totalResponses,
    averageRating,
    nps,
    distribution,
  };
}

/**
 * Get trend data grouped by quarter.
 *
 * Reads from `feedbackResponse ∪ surveyVote(active)` (see ADR-007). Rows are
 * bucketed by quarter in memory using the unified `submittedAt` timestamp
 * (which is `updatedAt` for vote rows — re-votes shift the bucket).
 *
 * @param quarters - Number of quarters to include (default: 4)
 * @returns Array of trend data points (oldest first)
 */
export async function getTrendData(quarters: number = 4): Promise<TrendDataPoint[]> {
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const currentYear = now.getFullYear();

  // Compute the oldest quarter we care about to narrow the DB read window.
  let oldestQuarter = currentQuarter - (quarters - 1);
  let oldestYear = currentYear;
  while (oldestQuarter <= 0) {
    oldestQuarter += 4;
    oldestYear -= 1;
  }
  const windowStart = new Date(oldestYear, (oldestQuarter - 1) * 3, 1);
  const windowEnd = new Date(currentYear, currentQuarter * 3, 0, 23, 59, 59);

  const rows = await fetchUnifiedRatings({
    dateFrom: windowStart,
    dateTo: windowEnd,
  });

  // Bucket by quarter label "YYYY-QN".
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < quarters; i++) {
    let quarter = currentQuarter - i;
    let year = currentYear;
    while (quarter <= 0) {
      quarter += 4;
      year -= 1;
    }
    buckets.set(`${year}-Q${quarter}`, []);
  }

  for (const row of rows) {
    const d = row.submittedAt;
    const q = Math.floor(d.getMonth() / 3) + 1;
    const label = `${d.getFullYear()}-Q${q}`;
    const bucket = buckets.get(label);
    if (bucket) bucket.push(row.rating);
  }

  const results: TrendDataPoint[] = [];
  for (const [period, ratings] of buckets.entries()) {
    const responseCount = ratings.length;
    const averageRating =
      responseCount > 0
        ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / responseCount) * 10) / 10
        : 0;
    const nps = calculateNPS(ratings);
    results.push({
      period,
      averageRating,
      responseCount,
      npsScore: nps.score,
    });
  }

  // Sort by period (oldest first)
  results.sort((a, b) => a.period.localeCompare(b.period));

  logger.debug('Trend data calculated', {
    quarters,
    dataPoints: results.length,
    service: 'analytics-service',
  });

  return results;
}

/**
 * Get recent comments (anonymized for accountant view).
 *
 * Reads from `feedbackResponse ∪ surveyVote(active)` (see ADR-007).
 *
 * @param limit - Maximum number of comments to return
 * @param includeClientInfo - Whether to include client identifying info (manager only)
 * @returns Array of comment objects
 */
export async function getRecentComments(
  limit: number = 10,
  includeClientInfo: boolean = false
): Promise<
  Array<{
    comment: string;
    rating: number;
    submittedAt: Date;
    chatId?: string;
    clientUsername?: string | null;
  }>
> {
  const rows = await fetchUnifiedComments({ limit });

  return rows.map((r) => ({
    comment: r.comment!,
    rating: r.rating,
    submittedAt: r.submittedAt,
    ...(includeClientInfo && {
      chatId: r.chatId?.toString(),
      clientUsername: r.clientUsername,
    }),
  }));
}

/**
 * Get feedback summary for a specific survey.
 *
 * Aggregates go through the unified helper (legacy + active votes). The
 * "low rating" count is also unified so the manager UI reflects both sources.
 *
 * @param surveyId - Survey ID to get summary for
 * @returns Survey feedback summary
 */
export async function getSurveySummary(surveyId: string): Promise<{
  // gh-292: quarter is nullable now that range-mode surveys exist.
  survey: { id: string; quarter: string | null; status: string } | null;
  aggregates: FeedbackAggregates;
  lowRatingCount: number;
}> {
  const survey = await prisma.feedbackSurvey.findUnique({
    where: { id: surveyId },
    select: {
      id: true,
      quarter: true,
      status: true,
    },
  });

  if (!survey) {
    return {
      survey: null,
      aggregates: {
        totalResponses: 0,
        averageRating: 0,
        nps: calculateNPS([]),
        distribution: calculateDistribution([]),
      },
      lowRatingCount: 0,
    };
  }

  const aggregates = await getAggregates(undefined, surveyId);

  // Count low ratings (1-3) across both sources.
  const rows = await fetchUnifiedRatings({ surveyId });
  const lowRatingCount = rows.filter((r) => r.rating <= 3).length;

  logger.info('Survey summary retrieved', {
    surveyId,
    quarter: survey.quarter,
    totalResponses: aggregates.totalResponses,
    lowRatingCount,
    service: 'analytics-service',
  });

  return {
    survey,
    aggregates,
    lowRatingCount,
  };
}

export default {
  calculateNPS,
  calculateDistribution,
  getAggregates,
  getTrendData,
  getRecentComments,
  getSurveySummary,
  fetchUnifiedRatings,
  fetchUnifiedEntries,
  fetchUnifiedComments,
};
