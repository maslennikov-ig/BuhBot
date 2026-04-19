/**
 * Chat Segment Service (gh-313)
 *
 * Reusable named groups of chats used by FeedbackSurvey audience targeting.
 *
 * Ownership model:
 *   - Each ChatSegment has a `createdById` (User UUID).
 *   - `(createdById, name)` is unique — owners can reuse names independently.
 *   - For now we don't enforce per-segment ACLs at the service layer; the tRPC
 *     router layer guards with `managerProcedure`. Listings can be filtered to
 *     just the caller's segments via `ownedById`.
 *
 * Error contract (Error.name → tRPC mapping):
 *   - `'NAME_TAKEN'`     — duplicate (createdById, name) on create/update.
 *   - `'SEGMENT_NOT_FOUND'` — referenced segment id does not exist.
 *   - `'CHAT_NOT_FOUND'`    — referenced chat id does not exist.
 *
 * @module services/feedback/segment
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateSegmentInput {
  name: string;
  description?: string | null;
  /** UUID of the User creating the segment (from authed context). */
  createdById: string;
}

export interface UpdateSegmentInput {
  segmentId: string;
  name?: string;
  description?: string | null;
}

export interface SegmentListItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  /** Number of chats currently in the segment. */
  memberCount: number;
}

export interface SegmentChat {
  chatId: bigint;
  title: string | null;
  addedAt: Date;
}

// ============================================================================
// HELPERS
// ============================================================================

function namedError(name: string, message: string): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

/**
 * Detect Prisma's P2002 unique-constraint violation. We can't rely on
 * `instanceof Prisma.PrismaClientKnownRequestError` because tests stub Prisma
 * with a plain object — we duck-type on `.code`.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

// ============================================================================
// CRUD
// ============================================================================

/**
 * Create a new chat segment owned by the calling user.
 *
 * Throws `Error.name='NAME_TAKEN'` when the same owner already has a segment with
 * that name (Prisma P2002 on the unique `(created_by_id, name)` index).
 */
export async function createSegment(input: CreateSegmentInput) {
  const trimmed = input.name.trim();
  if (!trimmed) {
    throw namedError('NAME_INVALID', 'Segment name must be a non-empty string');
  }

  try {
    const segment = await prisma.chatSegment.create({
      data: {
        name: trimmed,
        description: input.description ?? null,
        createdById: input.createdById,
      },
    });
    logger.info('Chat segment created', {
      segmentId: segment.id,
      createdById: input.createdById,
      service: 'segment-service',
    });
    return segment;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw namedError('NAME_TAKEN', `Segment "${trimmed}" already exists for this owner`);
    }
    throw err;
  }
}

/**
 * Update segment metadata (name and/or description). At least one field is required.
 * Returns the updated row, or throws `SEGMENT_NOT_FOUND`/`NAME_TAKEN` on errors.
 */
export async function updateSegment(input: UpdateSegmentInput) {
  if (input.name === undefined && input.description === undefined) {
    throw namedError('UPDATE_EMPTY', 'updateSegment requires at least one field');
  }

  // Pre-check existence so we can emit a typed error (Prisma's P2025 is too generic
  // and would otherwise leak through as a 500 in tRPC).
  const existing = await prisma.chatSegment.findUnique({
    where: { id: input.segmentId },
    select: { id: true },
  });
  if (!existing) {
    throw namedError('SEGMENT_NOT_FOUND', `Segment ${input.segmentId} not found`);
  }

  const data: Prisma.ChatSegmentUpdateInput = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw namedError('NAME_INVALID', 'Segment name must be a non-empty string');
    }
    data.name = trimmed;
  }
  if (input.description !== undefined) {
    data.description = input.description;
  }

  try {
    const updated = await prisma.chatSegment.update({
      where: { id: input.segmentId },
      data,
    });
    logger.info('Chat segment updated', {
      segmentId: updated.id,
      service: 'segment-service',
    });
    return updated;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw namedError('NAME_TAKEN', `Segment name "${data.name as string}" already exists`);
    }
    throw err;
  }
}

/**
 * Hard-delete a segment. Cascade-removes all `ChatSegmentMember` rows.
 *
 * The segment id is NOT cleaned out of any pre-existing
 * `FeedbackSurvey.audienceSegmentIds` arrays — those are immutable historical
 * records. The worker is defensive and tolerates a missing segment by treating
 * it as "no chats from this segment" (see `getChatsInSegments`).
 */
export async function deleteSegment(segmentId: string): Promise<void> {
  const existing = await prisma.chatSegment.findUnique({
    where: { id: segmentId },
    select: { id: true },
  });
  if (!existing) {
    throw namedError('SEGMENT_NOT_FOUND', `Segment ${segmentId} not found`);
  }
  await prisma.chatSegment.delete({ where: { id: segmentId } });
  logger.info('Chat segment deleted', { segmentId, service: 'segment-service' });
}

/**
 * List segments. When `ownedById` is given, only that owner's segments are returned;
 * otherwise all segments are listed (for admin views).
 */
export async function listSegments(ownedById?: string): Promise<SegmentListItem[]> {
  const where: Prisma.ChatSegmentWhereInput = {};
  if (ownedById !== undefined) {
    where.createdById = ownedById;
  }

  const rows = await prisma.chatSegment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { members: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    createdById: r.createdById,
    memberCount: r._count.members,
  }));
}

// ============================================================================
// MEMBERSHIP
// ============================================================================

/**
 * Add a chat to a segment. No-ops gracefully when the membership row already
 * exists (treat as idempotent — admins re-clicking the UI shouldn't crash).
 *
 * Soft-deleted chats (`Chat.deletedAt !== null`, gh-209) are treated as
 * non-existent and cause `CHAT_NOT_FOUND` — otherwise a chat that was archived
 * elsewhere could reappear in segment membership and leak into audience
 * expansion results.
 */
export async function addChatToSegment(
  segmentId: string,
  chatId: bigint,
  addedById: string
): Promise<void> {
  // Validate parents exist so we can emit typed errors instead of bubbling P2003.
  // The `deletedAt: null` clause excludes soft-deleted chats — see doc above.
  const [segment, chat] = await Promise.all([
    prisma.chatSegment.findUnique({ where: { id: segmentId }, select: { id: true } }),
    prisma.chat.findUnique({ where: { id: chatId, deletedAt: null }, select: { id: true } }),
  ]);
  if (!segment) throw namedError('SEGMENT_NOT_FOUND', `Segment ${segmentId} not found`);
  if (!chat)
    throw namedError('CHAT_NOT_FOUND', `Chat ${chatId.toString()} not found или soft-deleted`);

  try {
    await prisma.chatSegmentMember.create({
      data: { segmentId, chatId, addedById },
    });
    logger.info('Chat added to segment', {
      segmentId,
      chatId: chatId.toString(),
      addedById,
      service: 'segment-service',
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Duplicate membership — silently ignore for idempotency.
      return;
    }
    throw err;
  }
}

/**
 * Remove a chat from a segment. Idempotent — succeeds even when the membership
 * does not exist (no-op).
 */
export async function removeChatFromSegment(segmentId: string, chatId: bigint): Promise<void> {
  await prisma.chatSegmentMember.deleteMany({
    where: { segmentId, chatId },
  });
  logger.info('Chat removed from segment', {
    segmentId,
    chatId: chatId.toString(),
    service: 'segment-service',
  });
}

/**
 * Return the chats currently in a segment (with chat title for display).
 * Throws `SEGMENT_NOT_FOUND` when the segment doesn't exist so callers get a
 * clean 404 instead of an empty array masking a typo.
 */
export async function getSegmentChats(segmentId: string): Promise<SegmentChat[]> {
  const segment = await prisma.chatSegment.findUnique({
    where: { id: segmentId },
    select: { id: true },
  });
  if (!segment) throw namedError('SEGMENT_NOT_FOUND', `Segment ${segmentId} not found`);

  const rows = await prisma.chatSegmentMember.findMany({
    where: { segmentId },
    orderBy: { addedAt: 'desc' },
    include: {
      chat: { select: { id: true, title: true } },
    },
  });

  return rows.map((r) => ({
    chatId: r.chat.id,
    title: r.chat.title,
    addedAt: r.addedAt,
  }));
}

// ============================================================================
// AUDIENCE EXPANSION (used by survey delivery)
// ============================================================================

/**
 * Expand a list of segment UUIDs to the union of their member chatIds.
 * Missing or empty segments are silently skipped — the survey worker should not
 * crash when an admin deletes a referenced segment after creating the campaign.
 */
export async function getChatsInSegments(segmentIds: string[]): Promise<bigint[]> {
  if (segmentIds.length === 0) return [];

  const rows = await prisma.chatSegmentMember.findMany({
    where: { segmentId: { in: segmentIds } },
    select: { chatId: true },
  });

  // De-duplicate (a chat may belong to multiple segments).
  const unique = new Set<string>();
  const out: bigint[] = [];
  for (const r of rows) {
    const key = r.chatId.toString();
    if (!unique.has(key)) {
      unique.add(key);
      out.push(r.chatId);
    }
  }
  return out;
}

// Named exports only — callers import individual functions. No default export is
// provided because the barrel-style re-export was unused and added noise.
