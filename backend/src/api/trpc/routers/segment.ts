/**
 * Segment Router (gh-313) — Chat Segment Management
 *
 * Manager-only procedures for CRUD + membership on reusable chat segments used
 * by FeedbackSurvey audience targeting.
 *
 * Procedures:
 *   - list:           List segments (optionally scoped to the caller's own)
 *   - getById:        Fetch a single segment with its members
 *   - create:         Create a new named segment
 *   - update:         Rename / change description
 *   - delete:         Hard-delete segment + cascade members
 *   - addChat:        Add a chat to the segment
 *   - removeChat:     Remove a chat from the segment
 *   - getChats:       List chats currently in the segment
 *
 * Error mapping (service → tRPC):
 *   - `SEGMENT_NOT_FOUND` → NOT_FOUND
 *   - `CHAT_NOT_FOUND`    → NOT_FOUND
 *   - `NAME_TAKEN`        → CONFLICT
 *   - `NAME_INVALID`      → BAD_REQUEST
 *   - `UPDATE_EMPTY`      → BAD_REQUEST
 *
 * @module api/trpc/routers/segment
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import { router, managerProcedure } from '../trpc.js';
import { chatIdStringSchema } from '../helpers/zod-schemas.js';
import {
  createSegment,
  updateSegment,
  deleteSegment,
  listSegments,
  addChatToSegment,
  removeChatFromSegment,
  getSegmentChats,
} from '../../../services/feedback/segment.service.js';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Enforce segment ownership for mutating procedures (update / delete).
 *
 * Managers may only modify segments they created themselves; admins may modify any.
 * Missing segment → NOT_FOUND; unauthorized → FORBIDDEN.
 *
 * Centralized so the invariant is identical across `update` and `delete` — and any
 * future per-segment mutation procedure picks the same behavior up for free.
 */
async function assertSegmentOwnership(
  prisma: Pick<PrismaClient, 'chatSegment'>,
  segmentId: string,
  user: { id: string; role: string }
): Promise<void> {
  const segment = await prisma.chatSegment.findUnique({
    where: { id: segmentId },
    select: { createdById: true },
  });
  if (!segment) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Segment ${segmentId} not found` });
  }
  if (user.role !== 'admin' && segment.createdById !== user.id) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this segment' });
  }
}

/**
 * Translate a `service-level` named Error into a TRPCError with the expected
 * HTTP-ish code. Keeps the router thin and consistent across procedures.
 */
function mapServiceError(err: unknown): never {
  if (err instanceof Error) {
    switch (err.name) {
      case 'SEGMENT_NOT_FOUND':
      case 'CHAT_NOT_FOUND':
        throw new TRPCError({ code: 'NOT_FOUND', message: err.message });
      case 'NAME_TAKEN':
        throw new TRPCError({ code: 'CONFLICT', message: err.message });
      case 'NAME_INVALID':
      case 'UPDATE_EMPTY':
        throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
    }
  }
  throw err;
}

// ============================================================================
// ROUTER
// ============================================================================

export const segmentRouter = router({
  /**
   * List segments.
   *
   * By default returns ALL segments so managers can share them across the team.
   * Pass `ownedOnly: true` to restrict to the caller's own segments.
   */
  list: managerProcedure
    .input(
      z
        .object({
          ownedOnly: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const ownerFilter = input?.ownedOnly ? ctx.user.id : undefined;
      return listSegments(ownerFilter);
    }),

  /**
   * Fetch a single segment along with its members (chat IDs + titles).
   *
   * Single round-trip: we eagerly include membership rows (plus their chat
   * title) alongside the segment row so the UI detail page doesn't pay for a
   * second `getSegmentChats` query.
   */
  getById: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const segment = await ctx.prisma.chatSegment.findUnique({
        where: { id: input.id },
        include: {
          createdBy: { select: { id: true, fullName: true } },
          members: {
            orderBy: { addedAt: 'desc' },
            include: { chat: { select: { id: true, title: true } } },
          },
        },
      });
      if (!segment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Segment ${input.id} not found` });
      }
      return {
        id: segment.id,
        name: segment.name,
        description: segment.description,
        createdAt: segment.createdAt,
        updatedAt: segment.updatedAt,
        createdById: segment.createdById,
        createdBy: segment.createdBy,
        // Derive count from the already-fetched membership list — no separate
        // `_count` round-trip needed.
        memberCount: segment.members.length,
        // Serialize BigInt chatIds as strings for the tRPC JSON boundary.
        members: segment.members.map((m) => ({
          chatId: m.chat.id.toString(),
          title: m.chat.title,
          addedAt: m.addedAt,
        })),
      };
    }),

  /**
   * Create a new segment owned by the caller.
   */
  create: managerProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createSegment({
          name: input.name,
          description: input.description ?? null,
          createdById: ctx.user.id,
        });
      } catch (err) {
        mapServiceError(err);
      }
    }),

  /**
   * Update segment metadata (name / description). Requires at least one field.
   *
   * Ownership: managers may only update segments they created. Admins may update any.
   */
  update: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertSegmentOwnership(ctx.prisma, input.id, ctx.user);
      try {
        return await updateSegment({
          segmentId: input.id,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        });
      } catch (err) {
        mapServiceError(err);
      }
    }),

  /**
   * Hard-delete segment. The segment id may still linger in historical
   * `FeedbackSurvey.audienceSegmentIds` rows — that's intentional.
   *
   * Ownership: managers may only delete segments they created. Admins may delete any.
   */
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertSegmentOwnership(ctx.prisma, input.id, ctx.user);
      try {
        await deleteSegment(input.id);
        return { success: true };
      } catch (err) {
        mapServiceError(err);
      }
    }),

  /**
   * Add a single chat to a segment. Idempotent.
   */
  addChat: managerProcedure
    .input(
      z.object({
        segmentId: z.string().uuid(),
        chatId: chatIdStringSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await addChatToSegment(input.segmentId, BigInt(input.chatId), ctx.user.id);
        return { success: true };
      } catch (err) {
        mapServiceError(err);
      }
    }),

  /**
   * Remove a chat from a segment. Idempotent.
   */
  removeChat: managerProcedure
    .input(
      z.object({
        segmentId: z.string().uuid(),
        chatId: chatIdStringSchema,
      })
    )
    .mutation(async ({ input }) => {
      try {
        await removeChatFromSegment(input.segmentId, BigInt(input.chatId));
        return { success: true };
      } catch (err) {
        mapServiceError(err);
      }
    }),

  /**
   * List chats currently in a segment (chatId is stringified for JSON).
   */
  getChats: managerProcedure
    .input(z.object({ segmentId: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        const rows = await getSegmentChats(input.segmentId);
        return rows.map((r) => ({
          chatId: r.chatId.toString(),
          title: r.title,
          addedAt: r.addedAt,
        }));
      } catch (err) {
        mapServiceError(err);
      }
    }),
});
