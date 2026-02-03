/**
 * tRPC Initialization and Middleware for BuhBot Admin Panel
 *
 * This module initializes tRPC with context and provides procedure factories with
 * built-in authentication and authorization middleware.
 *
 * Procedure Types:
 * - publicProcedure: No authentication required
 * - authedProcedure: Requires valid JWT session
 * - managerProcedure: Requires admin or manager role
 * - adminProcedure: Requires admin role only
 *
 * Authorization Matrix:
 * - Observer: Read-only access to chats, requests, analytics
 * - Manager: + Write access (assignments, templates, FAQ)
 * - Admin: + Delete operations (templates, FAQ)
 *
 * @module api/trpc/trpc
 */

import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context.js';

/**
 * Initialize tRPC with context type
 *
 * Context includes:
 * - prisma: Database client
 * - user: Authenticated user (null if unauthenticated)
 * - session: Session info (null if unauthenticated)
 */
const t = initTRPC.context<Context>().create();

/**
 * Router factory for creating tRPC routers
 *
 * Usage:
 * ```typescript
 * export const myRouter = router({
 *   myProcedure: authedProcedure.query(() => { ... }),
 * });
 * ```
 */
export const router = t.router;

/**
 * Public procedure (no authentication required)
 *
 * Use for:
 * - Health check endpoints
 * - Public documentation
 *
 * WARNING: Most procedures should use authedProcedure instead
 */
export const publicProcedure = t.procedure;

/**
 * Middleware: Require authentication
 *
 * Checks for valid user in context (validated by context.ts)
 * Throws UNAUTHORIZED if user is null
 *
 * Available to all authenticated users (admin, manager, observer)
 */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please provide a valid JWT token.',
    });
  }

  // Narrow context type to ensure user is non-null in procedures
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Middleware: Require admin or manager role
 *
 * Checks for admin or manager role in user context
 * Throws FORBIDDEN if user is observer or unauthenticated
 *
 * Use for write operations (UPDATE, CREATE):
 * - Chat assignments
 * - Request status updates
 * - Template creation
 * - FAQ creation
 */
const isManager = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please provide a valid JWT token.',
    });
  }

  if (!['admin', 'manager'].includes(ctx.user.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied. This operation requires admin or manager role.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Middleware: Require admin role only
 *
 * Checks for admin role in user context
 * Throws FORBIDDEN if user is manager, observer, or unauthenticated
 *
 * Use for destructive operations (DELETE):
 * - Template deletion
 * - FAQ deletion
 * - User management
 */
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please provide a valid JWT token.',
    });
  }

  if (ctx.user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied. This operation requires admin role.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Authenticated procedure (requires valid JWT)
 *
 * Available to: admin, manager, observer
 *
 * Use for read operations:
 * - Listing chats, requests, alerts
 * - Viewing analytics
 * - Fetching templates and FAQ
 */
export const authedProcedure = publicProcedure.use(isAuthed);

/**
 * Manager procedure (requires admin or manager role)
 *
 * Available to: admin, manager
 *
 * Use for write operations:
 * - Updating chat assignments
 * - Changing request status
 * - Creating/updating templates
 * - Creating/updating FAQ
 */
export const managerProcedure = publicProcedure.use(isManager);

/**
 * Admin procedure (requires admin role only)
 *
 * Available to: admin
 *
 * Use for destructive operations:
 * - Deleting templates
 * - Deleting FAQ items
 * - User management
 */
export const adminProcedure = publicProcedure.use(isAdmin);
