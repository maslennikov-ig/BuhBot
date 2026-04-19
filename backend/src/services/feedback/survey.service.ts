/**
 * Survey Service
 *
 * Manages survey campaigns including creation, delivery, and lifecycle.
 * Handles quarterly client feedback collection with delivery tracking.
 *
 * Campaign Lifecycle:
 * - scheduled: Created and waiting for scheduled time
 * - sending: Actively delivering to clients
 * - active: All deliveries complete, accepting responses
 * - closed: Manually closed by manager
 * - expired: Past expiration date
 *
 * @module services/feedback/survey
 */

import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import type { SurveyStatus, DeliveryStatus, SurveyAudienceType } from '@prisma/client';
import { getChatsInSegments } from './segment.service.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input for creating a campaign with an explicit reporting-period range (gh-292).
 */
export interface CreateCampaignInput {
  /** Reporting-period start (used for getActiveClients filtering and UI display) */
  startDate: Date;
  /** Reporting-period end (must be strictly after startDate) */
  endDate: Date;
  /**
   * When the bot should start delivering. Defaults to `startDate`.
   * If scheduledFor is in the past, delivery still starts immediately via the caller.
   */
  scheduledFor?: Date;
  /**
   * Legacy quarter label (e.g. "2025-Q1"). Null/undefined = range mode.
   * When provided, stored on the row so admins can filter by quarter in the UI.
   */
  quarter?: string | null;
  /**
   * Days after `scheduledFor` when the survey stops accepting responses.
   * Defaults to GlobalSettings.surveyValidityDays (typically 7).
   */
  validityDays?: number;
  /**
   * gh-313: Targeted audience selector. Defaults to `{ type: 'all' }` for
   * back-compat — callers that don't pass `audience` get the historical
   * "blast every active client" behavior.
   */
  audience?: AudienceInput;
}

/**
 * gh-313: Discriminated audience selector for createCampaign.
 *
 *  - `all`            — every active client in the reporting period (legacy).
 *  - `specific_chats` — explicit set of chat IDs (subject to the active-period filter).
 *  - `segments`       — union of chat memberships for the given ChatSegment UUIDs.
 *
 * Validation/error contract (Error.name):
 *   - `'AUDIENCE_INVALID'` — empty list for specific_chats/segments, or unknown segment UUID.
 */
export type AudienceInput =
  | { type: 'all' }
  | { type: 'specific_chats'; chatIds: bigint[] }
  | { type: 'segments'; segmentIds: string[] };

/**
 * Survey with calculated statistics.
 *
 * `quarter` is nullable as of gh-292 — range-mode campaigns don't have a quarter.
 * `startDate`/`endDate` describe the reporting period; for legacy quarter-only rows
 * they are backfilled from `scheduledAt`/`expiresAt`.
 */
export interface SurveyWithStats {
  id: string;
  quarter: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: SurveyStatus;
  scheduledAt: Date;
  sentAt: Date | null;
  expiresAt: Date;
  closedAt: Date | null;
  totalClients: number;
  deliveredCount: number;
  responseCount: number;
  responseRate: number;
  averageRating: number | null;
  // gh-313: audience selector surfaced to callers for UI display.
  // These columns are non-null in the DB (with a default of 'all' / [] on migration),
  // so the return shape here reflects that — avoiding spurious `?.length` guards
  // downstream and keeping the type aligned with `SurveyAudienceType`.
  audienceType: SurveyAudienceType;
  audienceChatIds: bigint[];
  audienceSegmentIds: string[];
}

/**
 * Result of a per-chat cooldown gate check (gh-292).
 */
export interface CooldownStatus {
  /** true when the chat is eligible to receive a survey right now */
  allowed: boolean;
  /** Cooldown reason tag, set only when `allowed` is false. Currently always 'cooldown'. */
  reason?: 'cooldown';
  /** Earliest UTC instant when the chat becomes eligible again. Undefined when no prior delivery. */
  nextEligibleAt?: Date;
  /** Previous successful delivery timestamp (echoed for UI). */
  lastSurveySentAt?: Date | null;
}

/**
 * Active client for survey delivery
 */
export interface ActiveClient {
  chatId: bigint;
  title: string | null;
}

// ============================================================================
// SURVEY CAMPAIGN FUNCTIONS
// ============================================================================

/**
 * Quarter/range helpers (gh-292)
 * ---------------------------------------------------------------------------
 * Shared by both the legacy quarter wrapper and the new createCampaign path.
 */

/**
 * Regex for quarter identifiers in the format "YYYY-QN" (N = 1-4).
 * Exported for the tRPC input schema to avoid drift between frontend and backend.
 */
export const QUARTER_REGEX = /^\d{4}-Q[1-4]$/;

/**
 * Derive a UTC start/end range from a quarter identifier.
 *
 * - Q1 → Jan 1 00:00:00 UTC .. Mar 31 23:59:59 UTC
 * - Q4 → Oct 1 00:00:00 UTC .. Dec 31 23:59:59 UTC
 *
 * Note: using `Date.UTC(...)` (instead of the locale-dependent `new Date(y, m, d)`)
 * guarantees identical behaviour on Moscow and UTC servers, which matters for
 * DST transitions (Europe/Moscow is permanently UTC+3 since 2014, but the bot
 * still stores/queries timestamps as tz-aware).
 */
export function quarterToRange(quarter: string): { startDate: Date; endDate: Date } {
  if (!QUARTER_REGEX.test(quarter)) {
    throw new Error(`Invalid quarter format: ${quarter}. Expected format: YYYY-Q1 to YYYY-Q4`);
  }
  const parts = quarter.split('-Q');
  const year = parseInt(parts[0]!, 10);
  const quarterNum = parseInt(parts[1]!, 10);
  const startMonth = (quarterNum - 1) * 3;
  const startDate = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
  // Day 0 of startMonth+3 = last day of startMonth+2.
  const endDate = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));
  return { startDate, endDate };
}

/**
 * Read the cooldown hours knob from GlobalSettings (gh-292).
 *
 * Falls back to 24h when the singleton row is missing (fresh DB / first boot).
 */
export async function getSurveyCooldownHours(): Promise<number> {
  const settings = await prisma.globalSettings.findUnique({
    where: { id: 'default' },
    select: { surveyCooldownHours: true },
  });
  return settings?.surveyCooldownHours ?? 24;
}

/**
 * Read the max allowed reporting-range span (in days) from GlobalSettings (gh-292).
 * Defaults to 90 days when settings row is absent.
 */
export async function getSurveyMaxRangeDays(): Promise<number> {
  const settings = await prisma.globalSettings.findUnique({
    where: { id: 'default' },
    select: { surveyMaxRangeDays: true },
  });
  return settings?.surveyMaxRangeDays ?? 90;
}

/**
 * Check whether the given chat may receive a survey right now (gh-292).
 *
 * Looks at `Chat.lastSurveySentAt` and compares to `now - cooldownHours`.
 * A null `lastSurveySentAt` (chat never received a survey) is always allowed.
 *
 * The worker MUST call this before `bot.telegram.sendMessage`. On block, the worker
 * sets `SurveyDelivery.status='failed'` with `skipReason` and RETURNS (no throw),
 * so BullMQ won't retry the job.
 *
 * @param chatId - Telegram chat ID
 * @param cooldownHours - Cooldown period in hours (from GlobalSettings)
 * @returns `{ allowed, reason?, nextEligibleAt?, lastSurveySentAt? }`
 */
export async function canSendSurveyToChat(
  chatId: bigint,
  cooldownHours: number
): Promise<CooldownStatus> {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: { lastSurveySentAt: true },
  });

  // Chat may not exist yet in this codepath (e.g. race before ingestion).
  if (!chat) {
    return { allowed: true, lastSurveySentAt: null };
  }

  if (!chat.lastSurveySentAt) {
    return { allowed: true, lastSurveySentAt: null };
  }

  const nextEligibleAt = new Date(chat.lastSurveySentAt.getTime() + cooldownHours * 3_600_000);
  if (nextEligibleAt.getTime() <= Date.now()) {
    return { allowed: true, lastSurveySentAt: chat.lastSurveySentAt };
  }

  return {
    allowed: false,
    reason: 'cooldown',
    nextEligibleAt,
    lastSurveySentAt: chat.lastSurveySentAt,
  };
}

/**
 * Milliseconds per day (used for range-span validation).
 * Not a UI conversion — purely mathematical.
 */
const MS_PER_DAY = 86_400_000;

/**
 * Create a survey campaign with an explicit reporting-period range (gh-292).
 *
 * Rules:
 * 1. `endDate` must be strictly after `startDate`.
 * 2. Range span (`endDate - startDate`) must not exceed `surveyMaxRangeDays`.
 * 3. The range must not overlap with any existing survey in status
 *    `scheduled|sending|active` (SQL-style range overlap:
 *    `new.start <= existing.end AND new.end >= existing.start`).
 *
 * Error codes emitted via `Error.name`:
 *  - `'RANGE_INVALID'` — rules 1 or 2 violated
 *  - `'OVERLAP'` — rule 3 violated (`error.cause` carries conflicting survey id)
 *
 * Callers (tRPC router) should map these into TRPCError with the matching `cause.kind`.
 */
export async function createCampaign(input: CreateCampaignInput): Promise<SurveyWithStats> {
  // 1. Range sanity
  if (input.endDate.getTime() <= input.startDate.getTime()) {
    const err = new Error('endDate must be strictly after startDate');
    err.name = 'RANGE_INVALID';
    throw err;
  }
  // 2. Max range guard
  const maxRangeDays = await getSurveyMaxRangeDays();
  const rangeDays = (input.endDate.getTime() - input.startDate.getTime()) / MS_PER_DAY;
  if (rangeDays > maxRangeDays) {
    const err = new Error(`Range span ${rangeDays.toFixed(1)}d exceeds maximum ${maxRangeDays}d`);
    err.name = 'RANGE_INVALID';
    throw err;
  }

  // 3. Overlap guard — reject if any active/queued campaign overlaps.
  //    SQL semantics: overlap iff new.start <= existing.end AND new.end >= existing.start.
  //    Translated to Prisma: startDate <= new.endDate AND endDate >= new.startDate.
  const conflicting = await prisma.feedbackSurvey.findFirst({
    where: {
      status: { in: ['scheduled', 'sending', 'active'] },
      // Only consider rows that HAVE a range (legacy quarter-only rows have
      // start_date/end_date backfilled by the migration).
      startDate: { not: null, lte: input.endDate },
      endDate: { not: null, gte: input.startDate },
    },
    select: { id: true, quarter: true, startDate: true, endDate: true },
  });
  if (conflicting) {
    const err = new Error(`Survey ${conflicting.id} overlaps with the requested range`);
    err.name = 'OVERLAP';
    // Typed payload for the tRPC layer.
    (err as Error & { conflictingSurveyId?: string }).conflictingSurveyId = conflicting.id;
    throw err;
  }

  // gh-313: normalize + validate audience selector. Missing audience defaults to 'all'.
  const audience: AudienceInput = input.audience ?? { type: 'all' };
  if (audience.type === 'specific_chats' && audience.chatIds.length === 0) {
    const err = new Error('audience.specific_chats requires at least one chatId');
    err.name = 'AUDIENCE_INVALID';
    throw err;
  }
  if (audience.type === 'segments' && audience.segmentIds.length === 0) {
    const err = new Error('audience.segments requires at least one segmentId');
    err.name = 'AUDIENCE_INVALID';
    throw err;
  }
  // Fail fast when a segment UUID is unknown — we'd rather reject at creation
  // than silently blast zero chats.
  if (audience.type === 'segments') {
    const found = await prisma.chatSegment.findMany({
      where: { id: { in: audience.segmentIds } },
      select: { id: true },
    });
    if (found.length !== audience.segmentIds.length) {
      const knownIds = new Set(found.map((r) => r.id));
      const missing = audience.segmentIds.filter((id) => !knownIds.has(id));
      const err = new Error(`Unknown segment id(s): ${missing.join(', ')}`);
      err.name = 'AUDIENCE_INVALID';
      throw err;
    }
  }

  // 4. Validity → expiresAt. Default to GlobalSettings.surveyValidityDays when caller
  //    didn't pass one. Use `scheduledFor` as the base; fall back to `startDate`.
  const scheduledAt = input.scheduledFor ?? input.startDate;
  let validityDays = input.validityDays;
  if (validityDays === undefined) {
    const settings = await prisma.globalSettings.findUnique({
      where: { id: 'default' },
      select: { surveyValidityDays: true },
    });
    validityDays = settings?.surveyValidityDays ?? 7;
  }
  const expiresAt = new Date(scheduledAt.getTime() + validityDays * MS_PER_DAY);

  // Persist the audience selector. Storing both the chat-id array AND the
  // segment-id array on the same row lets us keep a single discriminator column
  // (`audienceType`) and avoid a parallel join table for the survey→chatId list,
  // which would be overkill for a one-shot snapshot.
  const audienceType: SurveyAudienceType = audience.type;
  const audienceChatIds = audience.type === 'specific_chats' ? audience.chatIds : [];
  const audienceSegmentIds = audience.type === 'segments' ? audience.segmentIds : [];

  const survey = await prisma.feedbackSurvey.create({
    data: {
      quarter: input.quarter ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      scheduledAt,
      expiresAt,
      status: 'scheduled',
      audienceType,
      audienceChatIds,
      audienceSegmentIds,
    },
  });

  logger.info('Survey campaign created', {
    surveyId: survey.id,
    mode: input.quarter ? 'quarter' : 'range',
    quarter: survey.quarter,
    startDate: survey.startDate,
    endDate: survey.endDate,
    scheduledAt: survey.scheduledAt,
    expiresAt: survey.expiresAt,
    // gh-313: audience logging falls back to the normalized input when Prisma
    // echoes back a partial row (e.g. test mocks that don't include the new columns).
    audienceType: survey.audienceType ?? audienceType,
    audienceChatCount: survey.audienceChatIds?.length ?? audienceChatIds.length,
    audienceSegmentCount: survey.audienceSegmentIds?.length ?? audienceSegmentIds.length,
    service: 'survey-service',
  });

  return {
    ...survey,
    responseRate: 0,
  };
}

// Note: the legacy `createSurvey(input)` quarter-only wrapper and its
// `CreateSurveyInput` type have been removed — no callers remained after the
// tRPC `create` procedure switched to `createCampaign()` directly in gh-313.
// New code should always use `createCampaign()` which accepts an explicit
// `startDate`/`endDate` range and an optional `audience` selector.

/**
 * gh-313: Options object for audience-aware `getActiveClients`.
 *
 * When `audience` is omitted or `{ type: 'all' }`, the function behaves as before:
 * return every chat with at least one ClientRequest inside the reporting period.
 *
 * When `audience` is `{ type: 'specific_chats' }` or `{ type: 'segments' }`,
 * the result is the intersection of:
 *   (a) the chats resolved from the audience selector, AND
 *   (b) chats that actually exist and aren't soft-deleted.
 * NOTE: For targeted modes we intentionally DROP the "had a request in range"
 * filter — admins sometimes want to survey quiet chats too. The reporting-period
 * columns stay meaningful as UI metadata and for retroactive analytics.
 */
export interface GetActiveClientsOptions {
  audience?: AudienceInput;
}

/**
 * Get active clients for survey delivery.
 *
 * A client is "active" when they sent at least one ClientRequest inside the
 * survey's reporting period. Soft-deleted chats (gh-209) are always excluded.
 *
 * Three call signatures supported:
 *   - `getActiveClients('2025-Q1')` — legacy quarter input, derives range via `quarterToRange`.
 *   - `getActiveClients(startDate, endDate)` — explicit range for custom campaigns.
 *   - `getActiveClients(startDate, endDate, { audience })` — gh-313 targeted audience.
 *
 * @returns Array of active client chats
 *
 * @example
 * ```typescript
 * const byQuarter = await getActiveClients('2025-Q1');
 * const byRange = await getActiveClients(new Date('2026-01-01'), new Date('2026-03-31'));
 * const byAudience = await getActiveClients(
 *   new Date('2026-01-01'),
 *   new Date('2026-03-31'),
 *   { audience: { type: 'specific_chats', chatIds: [-100123n] } },
 * );
 * ```
 */
export async function getActiveClients(quarter: string): Promise<ActiveClient[]>;
export async function getActiveClients(startDate: Date, endDate: Date): Promise<ActiveClient[]>;
export async function getActiveClients(
  startDate: Date,
  endDate: Date,
  options: GetActiveClientsOptions
): Promise<ActiveClient[]>;
export async function getActiveClients(
  quarterOrStart: string | Date,
  endDate?: Date,
  options?: GetActiveClientsOptions
): Promise<ActiveClient[]> {
  let rangeStart: Date;
  let rangeEnd: Date;
  let quarterLabel: string | null = null;

  if (typeof quarterOrStart === 'string') {
    // Quarter mode. quarterToRange validates the format and throws on bad input.
    const range = quarterToRange(quarterOrStart);
    rangeStart = range.startDate;
    rangeEnd = range.endDate;
    quarterLabel = quarterOrStart;
  } else {
    if (!endDate) {
      throw new Error('getActiveClients(startDate, endDate): endDate is required in range mode');
    }
    rangeStart = quarterOrStart;
    rangeEnd = endDate;
  }

  const audience: AudienceInput = options?.audience ?? { type: 'all' };

  // gh-313 — targeted modes short-circuit the "active in range" filter so
  // admins can survey quiet chats too (see GetActiveClientsOptions comment).
  if (audience.type === 'specific_chats') {
    const chatIds = audience.chatIds;
    if (chatIds.length === 0) return [];
    const rows = await prisma.chat.findMany({
      where: {
        id: { in: chatIds },
        deletedAt: null,
      },
      select: { id: true, title: true },
    });
    logger.info('Active clients fetched (specific_chats)', {
      quarter: quarterLabel,
      requestedCount: chatIds.length,
      resolvedCount: rows.length,
      service: 'survey-service',
    });
    return rows.map((c) => ({ chatId: c.id, title: c.title }));
  }

  if (audience.type === 'segments') {
    const chatIds = await getChatsInSegments(audience.segmentIds);
    if (chatIds.length === 0) return [];
    const rows = await prisma.chat.findMany({
      where: {
        id: { in: chatIds },
        deletedAt: null,
      },
      select: { id: true, title: true },
    });
    logger.info('Active clients fetched (segments)', {
      quarter: quarterLabel,
      segmentCount: audience.segmentIds.length,
      resolvedCount: rows.length,
      service: 'survey-service',
    });
    return rows.map((c) => ({ chatId: c.id, title: c.title }));
  }

  // audience.type === 'all' — legacy behavior.
  const activeChats = await prisma.chat.findMany({
    where: {
      deletedAt: null,
      clientRequests: {
        some: {
          receivedAt: {
            gte: rangeStart,
            lte: rangeEnd,
          },
        },
      },
    },
    select: {
      id: true,
      title: true,
    },
  });

  logger.info('Active clients fetched', {
    quarter: quarterLabel,
    count: activeChats.length,
    dateRange: { from: rangeStart, to: rangeEnd },
    service: 'survey-service',
  });

  return activeChats.map((c) => ({ chatId: c.id, title: c.title }));
}

/**
 * Start survey delivery (change status to sending)
 *
 * Transitions survey from 'scheduled' to 'sending' status.
 * Creates delivery records for all active clients.
 *
 * @param surveyId - Survey UUID
 * @throws Error if survey not found or not in scheduled status
 *
 * @example
 * ```typescript
 * await startSurveyDelivery('survey-uuid');
 * // Survey is now in 'sending' status with pending deliveries
 * ```
 */
export async function startSurveyDelivery(surveyId: string): Promise<void> {
  const survey = await prisma.feedbackSurvey.findUnique({
    where: { id: surveyId },
  });

  if (!survey) {
    throw new Error(`Survey ${surveyId} not found`);
  }

  if (survey.status !== 'scheduled') {
    throw new Error(`Survey ${surveyId} is not in scheduled status`);
  }

  // Get active clients — prefer the explicit reporting-period range (gh-292);
  // fall back to quarter for legacy rows created before the migration backfill.
  // gh-313: honor the persisted audience selector on the survey row so
  // specific_chats / segments campaigns only enqueue deliveries for their
  // targets.
  const audience: AudienceInput =
    survey.audienceType === 'specific_chats'
      ? { type: 'specific_chats', chatIds: survey.audienceChatIds }
      : survey.audienceType === 'segments'
        ? { type: 'segments', segmentIds: survey.audienceSegmentIds }
        : { type: 'all' };

  let clients: ActiveClient[];
  if (survey.startDate && survey.endDate) {
    clients = await getActiveClients(survey.startDate, survey.endDate, { audience });
  } else if (survey.quarter) {
    // Legacy quarter-only path: derive range and apply audience.
    const { startDate, endDate } = quarterToRange(survey.quarter);
    clients = await getActiveClients(startDate, endDate, { audience });
  } else {
    throw new Error(`Survey ${surveyId} has neither a quarter nor a startDate/endDate range`);
  }

  // gh-313: observability for the TOCTOU race where a targeted segment or
  // specific_chats list is emptied (e.g. segment deleted, soft-deleted chats
  // filtered) between campaign creation and delivery. We can't prevent this at
  // the DB layer — arrays don't support FKs — so we make the failure mode
  // observable via a warn log. `all` campaigns that legitimately resolve to
  // zero active clients are logged at info level inside getActiveClients.
  if (clients.length === 0 && audience.type !== 'all') {
    logger.warn('Survey delivery expanded to zero chats (targeted audience)', {
      surveyId,
      audienceType: audience.type,
      audienceSegmentIds: survey.audienceSegmentIds,
      audienceChatIds: survey.audienceChatIds.map((id) => id.toString()),
      service: 'survey-service',
    });
  }

  // Create delivery records in transaction
  await prisma.$transaction([
    prisma.surveyDelivery.createMany({
      data: clients.map((c) => ({
        surveyId,
        chatId: c.chatId,
        status: 'pending' as const,
      })),
    }),
    prisma.feedbackSurvey.update({
      where: { id: surveyId },
      data: {
        status: 'sending',
        sentAt: new Date(),
        totalClients: clients.length,
      },
    }),
  ]);

  logger.info('Survey delivery started', {
    surveyId,
    clientCount: clients.length,
    service: 'survey-service',
  });
}

/**
 * Mark survey as active (all deliveries processed)
 *
 * Transitions survey from 'sending' to 'active' status.
 * Called when all pending deliveries have been processed.
 *
 * @param surveyId - Survey UUID
 *
 * @example
 * ```typescript
 * await markSurveyActive('survey-uuid');
 * ```
 */
export async function markSurveyActive(surveyId: string): Promise<void> {
  await prisma.feedbackSurvey.update({
    where: { id: surveyId },
    data: { status: 'active' },
  });

  logger.info('Survey marked as active', {
    surveyId,
    service: 'survey-service',
  });
}

/**
 * Close a survey manually
 *
 * Transitions survey to 'closed' status with closing user info.
 * Prevents further responses from being accepted.
 *
 * @param surveyId - Survey UUID
 * @param closedBy - User UUID who closed the survey
 *
 * @example
 * ```typescript
 * await closeSurvey('survey-uuid', 'manager-uuid');
 * ```
 */
export async function closeSurvey(surveyId: string, closedBy: string): Promise<void> {
  await prisma.feedbackSurvey.update({
    where: { id: surveyId },
    data: {
      status: 'closed',
      closedAt: new Date(),
      closedBy,
    },
  });

  logger.info('Survey closed', {
    surveyId,
    closedBy,
    service: 'survey-service',
  });
}

// ============================================================================
// DELIVERY FUNCTIONS
// ============================================================================

/**
 * Update delivery status
 *
 * Updates the status of a survey delivery and sets appropriate timestamps.
 * Also increments survey delivered count when status is 'delivered'.
 *
 * @param deliveryId - Delivery UUID
 * @param status - New delivery status
 * @param messageId - Optional Telegram message ID (for delivered status)
 *
 * @example
 * ```typescript
 * await updateDeliveryStatus('delivery-uuid', 'delivered', BigInt(12345));
 * await updateDeliveryStatus('delivery-uuid', 'reminded');
 * ```
 */
export async function updateDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus,
  messageId?: bigint | null
): Promise<void> {
  const updateData: Record<string, unknown> = { status };

  if (status === 'delivered') {
    updateData['deliveredAt'] = new Date();
    if (messageId) {
      updateData['messageId'] = messageId;
    }
  } else if (status === 'reminded') {
    updateData['reminderSentAt'] = new Date();
  } else if (status === 'expired') {
    updateData['managerNotifiedAt'] = new Date();
  }

  await prisma.surveyDelivery.update({
    where: { id: deliveryId },
    data: updateData,
  });

  // Update survey delivered count if needed
  if (status === 'delivered') {
    const delivery = await prisma.surveyDelivery.findUnique({
      where: { id: deliveryId },
      select: { surveyId: true },
    });

    if (delivery) {
      await prisma.feedbackSurvey.update({
        where: { id: delivery.surveyId },
        data: {
          deliveredCount: { increment: 1 },
        },
      });
    }
  }

  logger.debug('Delivery status updated', {
    deliveryId,
    status,
    messageId: messageId?.toString(),
    service: 'survey-service',
  });
}

/**
 * Record a survey response
 *
 * Creates a feedback response for a delivery and updates statistics.
 * Validates that the delivery exists and survey is accepting responses.
 *
 * @param deliveryId - Delivery UUID
 * @param rating - Rating value (1-5)
 * @param clientUsername - Optional client username
 * @returns Created feedback response ID
 * @throws Error if delivery not found, already responded, or survey closed
 *
 * @example
 * ```typescript
 * const feedbackId = await recordResponse('delivery-uuid', 5, 'john_doe');
 * ```
 */
export async function recordResponse(
  deliveryId: string,
  rating: number,
  clientUsername?: string | null
): Promise<string> {
  // Validate rating range (gh-104)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be an integer between 1 and 5');
  }

  const delivery = await prisma.surveyDelivery.findUnique({
    where: { id: deliveryId },
    include: { survey: true },
  });

  if (!delivery) {
    throw new Error(`Delivery ${deliveryId} not found`);
  }

  if (delivery.status === 'responded') {
    throw new Error('Already responded to this survey');
  }

  if (delivery.survey.status !== 'active' && delivery.survey.status !== 'sending') {
    throw new Error('Survey is no longer accepting responses');
  }

  // Create feedback response and update delivery atomically (gh-101)
  // Re-check delivery status inside transaction to prevent TOCTOU race.
  // The @unique constraint on deliveryId provides DB-level dedup as last resort (CR finding #10).
  let result: string;
  try {
    result = await prisma.$transaction(async (tx) => {
      // Re-fetch delivery inside transaction to prevent TOCTOU (gh-101)
      const freshDelivery = await tx.surveyDelivery.findUnique({
        where: { id: deliveryId },
        select: { status: true },
      });

      if (freshDelivery?.status === 'responded') {
        throw new Error('Already responded to this survey');
      }

      const feedback = await tx.feedbackResponse.create({
        data: {
          chatId: delivery.chatId,
          rating,
          surveyId: delivery.surveyId,
          deliveryId: delivery.id,
          clientUsername: clientUsername ?? null,
        },
      });

      await tx.surveyDelivery.update({
        where: { id: deliveryId },
        data: { status: 'responded' },
      });

      // Update survey response count
      await tx.feedbackSurvey.update({
        where: { id: delivery.surveyId },
        data: {
          responseCount: { increment: 1 },
        },
      });

      // Recalculate average rating
      const avgResult = await tx.feedbackResponse.aggregate({
        where: { surveyId: delivery.surveyId },
        _avg: { rating: true },
      });

      await tx.feedbackSurvey.update({
        where: { id: delivery.surveyId },
        data: { averageRating: avgResult._avg.rating },
      });

      return feedback.id;
    });
  } catch (error) {
    // Handle P2002 unique constraint violation on deliveryId as duplicate response (CR finding #10)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as unknown as { code: string }).code === 'P2002'
    ) {
      throw new Error('Already responded to this survey');
    }
    throw error;
  }

  logger.info('Survey response recorded', {
    deliveryId,
    surveyId: delivery.surveyId,
    rating,
    feedbackId: result,
    service: 'survey-service',
  });

  return result;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get survey by ID with calculated stats
 *
 * @param surveyId - Survey UUID
 * @returns Survey with calculated response rate, or null if not found
 *
 * @example
 * ```typescript
 * const survey = await getSurveyById('survey-uuid');
 * if (survey) {
 *   console.log(`Response rate: ${survey.responseRate}%`);
 * }
 * ```
 */
export async function getSurveyById(surveyId: string): Promise<SurveyWithStats | null> {
  const survey = await prisma.feedbackSurvey.findUnique({
    where: { id: surveyId },
  });

  if (!survey) return null;

  const responseRate =
    survey.deliveredCount > 0
      ? Math.round((survey.responseCount / survey.deliveredCount) * 100 * 10) / 10
      : 0;

  return {
    ...survey,
    responseRate,
  };
}

/**
 * Get delivery by ID with relations
 *
 * @param deliveryId - Delivery UUID
 * @returns Delivery with survey and chat, or null if not found
 *
 * @example
 * ```typescript
 * const delivery = await getDeliveryById('delivery-uuid');
 * if (delivery) {
 *   console.log(`Chat: ${delivery.chat.title}`);
 * }
 * ```
 */
export async function getDeliveryById(deliveryId: string) {
  return prisma.surveyDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      survey: true,
      chat: true,
    },
  });
}

/**
 * Get pending deliveries for a survey
 *
 * Returns deliveries in 'pending' status that need to be sent.
 * Used by the delivery worker to process batches.
 *
 * @param surveyId - Survey UUID
 * @param limit - Maximum number of deliveries to return (default: 100)
 * @returns Array of pending deliveries with chat info
 *
 * @example
 * ```typescript
 * const pending = await getPendingDeliveries('survey-uuid', 50);
 * for (const delivery of pending) {
 *   await sendSurveyMessage(delivery.chat.id);
 * }
 * ```
 */
export async function getPendingDeliveries(surveyId: string, limit: number = 100) {
  return prisma.surveyDelivery.findMany({
    where: {
      surveyId,
      status: 'pending',
    },
    include: {
      chat: true,
    },
    take: limit,
  });
}

/**
 * Get deliveries needing reminder
 *
 * Returns deliveries that were delivered but not responded to,
 * and have passed the reminder threshold.
 *
 * @param surveyId - Survey UUID
 * @param reminderDay - Days after delivery to send reminder
 * @returns Array of deliveries needing reminder
 *
 * @example
 * ```typescript
 * const needReminder = await getDeliveriesNeedingReminder('survey-uuid', 3);
 * for (const delivery of needReminder) {
 *   await sendReminderMessage(delivery.chat.id);
 * }
 * ```
 */
export async function getDeliveriesNeedingReminder(surveyId: string, reminderDay: number) {
  const reminderThreshold = new Date();
  reminderThreshold.setDate(reminderThreshold.getDate() - reminderDay);

  return prisma.surveyDelivery.findMany({
    where: {
      surveyId,
      status: 'delivered',
      deliveredAt: { lte: reminderThreshold },
      reminderSentAt: null,
    },
    include: { chat: true },
  });
}

/**
 * Get all surveys with optional status filter
 *
 * @param status - Optional status filter
 * @returns Array of surveys with stats
 *
 * @example
 * ```typescript
 * const activeSurveys = await getSurveys('active');
 * const allSurveys = await getSurveys();
 * ```
 */
export async function getSurveys(status?: SurveyStatus): Promise<SurveyWithStats[]> {
  const surveys = await prisma.feedbackSurvey.findMany({
    ...(status && { where: { status } }),
    orderBy: { scheduledAt: 'desc' },
  });

  return surveys.map((survey) => ({
    ...survey,
    responseRate:
      survey.deliveredCount > 0
        ? Math.round((survey.responseCount / survey.deliveredCount) * 100 * 10) / 10
        : 0,
  }));
}

/**
 * Check and expire overdue surveys
 *
 * Finds surveys past their expiration date and updates their status.
 * Called by a scheduled job to maintain survey lifecycle.
 *
 * @returns Number of surveys expired
 *
 * @example
 * ```typescript
 * const expiredCount = await expireOverdueSurveys();
 * console.log(`Expired ${expiredCount} surveys`);
 * ```
 */
export async function expireOverdueSurveys(): Promise<number> {
  const now = new Date();

  const result = await prisma.feedbackSurvey.updateMany({
    where: {
      status: { in: ['sending', 'active'] },
      expiresAt: { lt: now },
    },
    data: {
      status: 'expired',
    },
  });

  if (result.count > 0) {
    logger.info('Surveys expired', {
      count: result.count,
      service: 'survey-service',
    });
  }

  return result.count;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  createCampaign,
  getActiveClients,
  startSurveyDelivery,
  markSurveyActive,
  closeSurvey,
  updateDeliveryStatus,
  recordResponse,
  getSurveyById,
  getDeliveryById,
  getPendingDeliveries,
  getDeliveriesNeedingReminder,
  getSurveys,
  expireOverdueSurveys,
  canSendSurveyToChat,
  getSurveyCooldownHours,
  getSurveyMaxRangeDays,
  quarterToRange,
};
