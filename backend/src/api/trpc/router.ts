/**
 * App Router - Main tRPC Router
 *
 * Combines all sub-routers into a single tRPC app router.
 *
 * Router Structure:
 * - auth: Authentication & user management
 * - chats: Chat management & assignments
 * - requests: Client request management & SLA monitoring
 * - alerts: SLA alert management
 * - analytics: Reports & dashboards
 * - templates: Message templates management
 * - faq: FAQ items management
 *
 * @module api/trpc/router
 */

import { router } from './trpc';
import { authRouter } from './routers/auth';
import { chatsRouter } from './routers/chats';
import { requestsRouter } from './routers/requests';
import { alertsRouter } from './routers/alerts';
import { analyticsRouter } from './routers/analytics';
import { templatesRouter } from './routers/templates';
import { faqRouter } from './routers/faq';

/**
 * App router combining all sub-routers
 *
 * This is the main tRPC router that combines all feature routers.
 * It provides end-to-end type safety between backend and frontend.
 *
 * Usage in backend (Express integration):
 * ```typescript
 * import { createExpressMiddleware } from '@trpc/server/adapters/express';
 * import { createContext } from './api/trpc/context';
 * import { appRouter } from './api/trpc/router';
 *
 * app.use(
 *   '/api/trpc',
 *   createExpressMiddleware({
 *     router: appRouter,
 *     createContext,
 *   })
 * );
 * ```
 *
 * Usage in frontend (Next.js):
 * ```typescript
 * import { createTRPCNext } from '@trpc/next';
 * import type { AppRouter } from '@buhbot/backend/api/trpc/router';
 *
 * export const trpc = createTRPCNext<AppRouter>({
 *   config({ ctx }) {
 *     return {
 *       url: '/api/trpc',
 *     };
 *   },
 * });
 * ```
 */
export const appRouter = router({
  /**
   * Auth router - Authentication & user management
   *
   * Procedures:
   * - me: Get current authenticated user profile
   * - listUsers: List all users (for assignment dropdowns)
   */
  auth: authRouter,

  /**
   * Chats router - Chat management & assignments
   *
   * Procedures:
   * - list: List all chats with optional filtering
   * - getById: Get single chat details
   * - update: Update chat settings (assignment, SLA config)
   */
  chats: chatsRouter,

  /**
   * Requests router - Client request management & SLA monitoring
   *
   * Procedures:
   * - list: List client requests with filtering and pagination
   * - getById: Get single request with related alerts
   * - update: Update request status or assignment
   * - markAsSpam: Mark request as spam
   */
  requests: requestsRouter,

  /**
   * Alerts router - SLA alert management
   *
   * Procedures:
   * - listUnacknowledged: List unacknowledged alerts (dashboard widget)
   * - acknowledge: Acknowledge an SLA alert
   */
  alerts: alertsRouter,

  /**
   * Analytics router - Reports & dashboards
   *
   * Procedures:
   * - slaCompliance: Get SLA compliance metrics for dashboard
   * - feedbackSummary: Get feedback summary statistics
   * - accountantPerformance: Get accountant performance comparison
   */
  analytics: analyticsRouter,

  /**
   * Templates router - Message templates management
   *
   * Procedures:
   * - list: List all templates with optional category filter
   * - create: Create new template
   * - update: Update existing template
   * - delete: Delete template
   */
  templates: templatesRouter,

  /**
   * FAQ router - FAQ items management
   *
   * Procedures:
   * - list: List all FAQ items
   * - search: Search FAQ by keywords
   * - create: Create new FAQ item
   * - update: Update existing FAQ item
   * - delete: Delete FAQ item
   */
  faq: faqRouter,
});

/**
 * Export AppRouter type for frontend type inference
 *
 * This type is used by the tRPC client to provide end-to-end type safety.
 * Import this type in your frontend to get full autocomplete and type checking.
 */
export type AppRouter = typeof appRouter;
