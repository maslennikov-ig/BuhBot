/**
 * Logs Router - System Error Logs Management
 *
 * Procedures:
 * - list: List error logs with filters and pagination (manager/admin)
 * - listGrouped: Group errors by fingerprint, default view (manager/admin)
 * - getById: Get single error + related errors, same fingerprint (manager/admin)
 * - updateStatus: Update error status/notes/assignee (admin only)
 * - bulkUpdateStatus: Batch status updates (admin only)
 * - delete: Delete error log (admin only)
 *
 * @module api/trpc/routers/logs
 */

import { router, managerProcedure, adminProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';

/**
 * Error level schema (matches ErrorLog.level field)
 */
const ErrorLevelSchema = z.enum(['error', 'warn', 'info']);

/**
 * Error status schema (matches Prisma ErrorStatus enum)
 */
const ErrorStatusSchema = z.enum(['new', 'in_progress', 'resolved', 'ignored']);

/**
 * Logs router for system error logs management
 */
export const logsRouter = router({
  /**
   * List error logs with filters and pagination
   *
   * Supports filtering by level, status, service, and text search.
   * Uses cursor-based pagination for efficient scrolling.
   *
   * @param level - Filter by log level (optional)
   * @param status - Filter by error status (optional)
   * @param service - Filter by service name (optional)
   * @param search - Search in message field (optional)
   * @param limit - Number of records per page (default: 50, max: 100)
   * @param cursor - Cursor for pagination (UUID of last record)
   * @returns Array of error logs with nextCursor for pagination
   * @authorization Admin and Manager roles (read-only)
   */
  list: managerProcedure
    .input(
      z.object({
        level: ErrorLevelSchema.optional(),
        status: ErrorStatusSchema.optional(),
        service: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().uuid().optional(),
      })
    )
    .output(
      z.object({
        errors: z.array(
          z.object({
            id: z.string().uuid(),
            timestamp: z.date(),
            level: z.string(),
            service: z.string(),
            message: z.string(),
            stack: z.string().nullable(),
            fingerprint: z.string(),
            metadata: z.any(),
            status: ErrorStatusSchema,
            assignedTo: z.string().uuid().nullable(),
            notes: z.string().nullable(),
            occurrenceCount: z.number().int(),
            firstSeenAt: z.date(),
            lastSeenAt: z.date(),
            assignedUser: z
              .object({
                id: z.string().uuid(),
                email: z.string(),
                fullName: z.string(),
              })
              .nullable(),
          })
        ),
        nextCursor: z.string().uuid().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build where clause with filters
      const where: Prisma.ErrorLogWhereInput = {};

      if (input.level) {
        where.level = input.level;
      }

      if (input.status) {
        where.status = input.status;
      }

      if (input.service) {
        where.service = input.service;
      }

      if (input.search) {
        where.message = {
          contains: input.search,
          mode: 'insensitive',
        };
      }

      // Fetch error logs with cursor pagination
      const errors = await ctx.prisma.errorLog.findMany({
        where,
        select: {
          id: true,
          timestamp: true,
          level: true,
          service: true,
          message: true,
          stack: true,
          fingerprint: true,
          metadata: true,
          status: true,
          assignedTo: true,
          notes: true,
          occurrenceCount: true,
          firstSeenAt: true,
          lastSeenAt: true,
          assignedUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: input.limit + 1, // Fetch one extra to determine if there's a next page
        ...(input.cursor && {
          cursor: {
            id: input.cursor,
          },
          skip: 1, // Skip the cursor itself
        }),
      });

      // Determine if there are more results
      let nextCursor: string | null = null;
      if (errors.length > input.limit) {
        const nextItem = errors.pop(); // Remove the extra item
        nextCursor = nextItem!.id;
      }

      return {
        errors,
        nextCursor,
      };
    }),

  /**
   * Group errors by fingerprint (default view)
   *
   * Groups errors with the same fingerprint, showing the latest error
   * and total occurrence count. Useful for identifying recurring issues.
   *
   * @param level - Filter by log level (optional)
   * @param status - Filter by error status (optional)
   * @param service - Filter by service name (optional)
   * @param search - Search in message field (optional)
   * @param limit - Number of groups per page (default: 50, max: 100)
   * @param offset - Offset for pagination (default: 0)
   * @returns Array of grouped errors with total count
   * @authorization Admin and Manager roles (read-only)
   */
  listGrouped: managerProcedure
    .input(
      z.object({
        level: ErrorLevelSchema.optional(),
        status: ErrorStatusSchema.optional(),
        service: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .output(
      z.object({
        groups: z.array(
          z.object({
            fingerprint: z.string(),
            latestError: z.object({
              id: z.string().uuid(),
              timestamp: z.date(),
              level: z.string(),
              service: z.string(),
              message: z.string(),
              stack: z.string().nullable(),
              fingerprint: z.string(),
              metadata: z.any(),
              status: ErrorStatusSchema,
              assignedTo: z.string().uuid().nullable(),
              notes: z.string().nullable(),
              occurrenceCount: z.number().int(),
              firstSeenAt: z.date(),
              lastSeenAt: z.date(),
              assignedUser: z
                .object({
                  id: z.string().uuid(),
                  email: z.string(),
                  fullName: z.string(),
                })
                .nullable(),
            }),
            totalOccurrences: z.number().int(),
            firstSeenAt: z.date(),
            lastSeenAt: z.date(),
          })
        ),
        total: z.number().int(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build where clause with filters
      const where: Prisma.ErrorLogWhereInput = {};

      if (input.level) {
        where.level = input.level;
      }

      if (input.status) {
        where.status = input.status;
      }

      if (input.service) {
        where.service = input.service;
      }

      if (input.search) {
        where.message = {
          contains: input.search,
          mode: 'insensitive',
        };
      }

      // Get distinct fingerprints with their latest errors
      // Prisma doesn't support DISTINCT ON directly, so we use groupBy + findFirst approach
      const groupedData = await ctx.prisma.errorLog.groupBy({
        by: ['fingerprint'],
        where,
        _count: {
          id: true,
        },
        _min: {
          firstSeenAt: true,
        },
        _max: {
          lastSeenAt: true,
        },
        orderBy: {
          _max: {
            lastSeenAt: 'desc',
          },
        },
        take: input.limit,
        skip: input.offset,
      });

      // Get total count for pagination
      const totalCount = await ctx.prisma.errorLog.groupBy({
        by: ['fingerprint'],
        where,
        _count: {
          id: true,
        },
      });

      // Fetch latest error for each fingerprint
      const groups = await Promise.all(
        groupedData.map(async (group) => {
          const latestError = await ctx.prisma.errorLog.findFirst({
            where: {
              fingerprint: group.fingerprint,
              ...where,
            },
            select: {
              id: true,
              timestamp: true,
              level: true,
              service: true,
              message: true,
              stack: true,
              fingerprint: true,
              metadata: true,
              status: true,
              assignedTo: true,
              notes: true,
              occurrenceCount: true,
              firstSeenAt: true,
              lastSeenAt: true,
              assignedUser: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                },
              },
            },
            orderBy: {
              timestamp: 'desc',
            },
          });

          return {
            fingerprint: group.fingerprint,
            latestError: latestError!,
            totalOccurrences: group._count.id,
            firstSeenAt: group._min.firstSeenAt!,
            lastSeenAt: group._max.lastSeenAt!,
          };
        })
      );

      return {
        groups,
        total: totalCount.length,
      };
    }),

  /**
   * Get single error + related errors (same fingerprint)
   *
   * Fetches a specific error log and all related errors with the same fingerprint.
   * Useful for viewing error details and occurrence history.
   *
   * @param id - Error log UUID
   * @returns Error details and related errors
   * @throws NOT_FOUND if error doesn't exist
   * @authorization Admin and Manager roles (read-only)
   */
  getById: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .output(
      z.object({
        error: z.object({
          id: z.string().uuid(),
          timestamp: z.date(),
          level: z.string(),
          service: z.string(),
          message: z.string(),
          stack: z.string().nullable(),
          fingerprint: z.string(),
          metadata: z.any(),
          status: ErrorStatusSchema,
          assignedTo: z.string().uuid().nullable(),
          notes: z.string().nullable(),
          occurrenceCount: z.number().int(),
          firstSeenAt: z.date(),
          lastSeenAt: z.date(),
          assignedUser: z
            .object({
              id: z.string().uuid(),
              email: z.string(),
              fullName: z.string(),
            })
            .nullable(),
        }),
        relatedErrors: z.array(
          z.object({
            id: z.string().uuid(),
            timestamp: z.date(),
            level: z.string(),
            service: z.string(),
            message: z.string(),
            status: ErrorStatusSchema,
            occurrenceCount: z.number().int(),
          })
        ),
      })
    )
    .query(async ({ ctx, input }) => {
      // Fetch the error log
      const error = await ctx.prisma.errorLog.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          timestamp: true,
          level: true,
          service: true,
          message: true,
          stack: true,
          fingerprint: true,
          metadata: true,
          status: true,
          assignedTo: true,
          notes: true,
          occurrenceCount: true,
          firstSeenAt: true,
          lastSeenAt: true,
          assignedUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      });

      if (!error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Error log with ID ${input.id} not found`,
        });
      }

      // Fetch related errors with same fingerprint (last 30 days, max 20)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const relatedErrors = await ctx.prisma.errorLog.findMany({
        where: {
          fingerprint: error.fingerprint,
          id: {
            not: input.id, // Exclude the current error
          },
          timestamp: {
            gte: thirtyDaysAgo,
          },
        },
        select: {
          id: true,
          timestamp: true,
          level: true,
          service: true,
          message: true,
          status: true,
          occurrenceCount: true,
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 20,
      });

      return {
        error,
        relatedErrors,
      };
    }),

  /**
   * Update error status, notes, assignedTo (admin only)
   *
   * Allows administrators to update error status, add resolution notes,
   * or assign the error to a specific user for tracking.
   *
   * @param id - Error log UUID
   * @param status - New error status (optional)
   * @param notes - Resolution notes (optional)
   * @param assignedTo - User UUID to assign to (optional, nullable)
   * @returns Updated error details
   * @throws NOT_FOUND if error doesn't exist
   * @authorization Admins only
   */
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: ErrorStatusSchema.optional(),
        notes: z.string().optional(),
        assignedTo: z.string().uuid().nullable().optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        error: z.object({
          id: z.string().uuid(),
          status: ErrorStatusSchema,
          notes: z.string().nullable(),
          assignedTo: z.string().uuid().nullable(),
          updatedAt: z.date(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify error exists
      const existingError = await ctx.prisma.errorLog.findUnique({
        where: { id: input.id },
      });

      if (!existingError) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Error log with ID ${input.id} not found`,
        });
      }

      // Build update data object
      const updateData: Prisma.ErrorLogUpdateInput = {};

      if (input.status !== undefined) {
        updateData.status = input.status;
      }

      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      if (input.assignedTo !== undefined) {
        if (input.assignedTo === null) {
          updateData.assignedUser = { disconnect: true };
        } else {
          updateData.assignedUser = { connect: { id: input.assignedTo } };
        }
      }

      // Update error log
      const updatedError = await ctx.prisma.errorLog.update({
        where: { id: input.id },
        data: updateData,
        select: {
          id: true,
          status: true,
          notes: true,
          assignedTo: true,
          updatedAt: true,
        },
      });

      return {
        success: true,
        error: updatedError,
      };
    }),

  /**
   * Batch status updates (admin only)
   *
   * Allows bulk updating status and notes for multiple error logs.
   * Useful for resolving or ignoring multiple errors at once.
   *
   * @param ids - Array of error log UUIDs (min: 1, max: 50)
   * @param status - New error status
   * @param notes - Resolution notes (optional)
   * @returns Success status and count of updated records
   * @authorization Admins only
   */
  bulkUpdateStatus: adminProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()).min(1).max(50),
        status: ErrorStatusSchema,
        notes: z.string().optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        count: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Build update data object
      const updateData: Prisma.ErrorLogUpdateManyMutationInput = {
        status: input.status,
      };

      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      // Perform bulk update
      const result = await ctx.prisma.errorLog.updateMany({
        where: {
          id: {
            in: input.ids,
          },
        },
        data: updateData,
      });

      return {
        success: true,
        count: result.count,
      };
    }),

  /**
   * Delete error log (admin only)
   *
   * Permanently deletes an error log from the database.
   * Use with caution as this operation cannot be undone.
   *
   * @param id - Error log UUID
   * @returns Success status
   * @throws NOT_FOUND if error doesn't exist
   * @authorization Admins only
   */
  delete: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify error exists before deleting
      const existingError = await ctx.prisma.errorLog.findUnique({
        where: { id: input.id },
      });

      if (!existingError) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Error log with ID ${input.id} not found`,
        });
      }

      // Delete error log
      await ctx.prisma.errorLog.delete({
        where: { id: input.id },
      });

      return {
        success: true,
      };
    }),
});
