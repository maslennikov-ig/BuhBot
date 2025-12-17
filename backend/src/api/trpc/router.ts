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

import { router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { chatsRouter } from './routers/chats.js';
import { requestsRouter } from './routers/requests.js';
import { alertsRouter } from './routers/alerts.js';
import { alertRouter } from './routers/alert.js';
import { analyticsRouter } from './routers/analytics.js';
import { templatesRouter } from './routers/templates.js';
import { faqRouter } from './routers/faq.js';
import { settingsRouter } from './routers/settings.js';
import { slaRouter } from './routers/sla.js';
import { feedbackRouter } from './routers/feedback.js';
import { surveyRouter } from './routers/survey.js';
import { contactRouter } from './routers/contact.js';
import { userRouter } from './routers/user.js';
import { notificationRouter } from './routers/notification.js';
import { messagesRouter } from './routers/messages.js';

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
   * Alerts router - SLA alert management (legacy)
   *
   * Procedures:
   * - listUnacknowledged: List unacknowledged alerts (dashboard widget)
   * - acknowledge: Acknowledge an SLA alert
   */
  alerts: alertsRouter,

  /**
   * Alert router - Full SLA alert management (T049-T051)
   *
   * Mutations:
   * - createAlert: Create new SLA alert
   * - resolveAlert: Resolve alert with action type
   * - notifyAccountant: Send notification to accountant
   * - updateDeliveryStatus: Update Telegram delivery status
   *
   * Queries:
   * - getAlerts: List alerts with filters and pagination
   * - getAlertById: Get alert details
   * - getActiveAlerts: Get unresolved alerts
   * - getActiveAlertCount: Dashboard metric
   * - getAlertStats: Get alert statistics
   */
  alert: alertRouter,

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

  /**
   * Settings router - Global settings & holidays management
   *
   * Procedures:
   * Queries:
   * - getGlobalSettings: Get current global settings
   * - getGlobalHolidays: Get list of holidays (optional year filter)
   *
   * Mutations (admin only):
   * - updateGlobalSettings: Update global settings
   * - addGlobalHoliday: Add a new holiday
   * - removeGlobalHoliday: Remove a holiday by date
   * - bulkAddHolidays: Add multiple holidays at once
   * - seedRussianHolidays: Seed Russian federal holidays for a year
   */
  settings: settingsRouter,

  /**
   * SLA router - SLA monitoring operations
   *
   * Procedures:
   * Mutations:
   * - createRequest: Create new client request from Telegram message
   * - classifyMessage: Classify message (REQUEST/SPAM/GRATITUDE/CLARIFICATION)
   * - startTimer: Start SLA timer for a request
   * - stopTimer: Stop SLA timer when accountant responds
   *
   * Queries:
   * - getRequests: List requests with filters and pagination
   * - getRequestById: Get single request details
   * - getActiveTimers: Get list of active SLA timers
   */
  sla: slaRouter,

  /**
   * Feedback router - Client satisfaction analytics
   *
   * Procedures:
   * - getAggregates: Get aggregate feedback statistics (all roles)
   * - getAll: Get full feedback details (manager only)
   * - getById: Get single feedback entry (manager only)
   * - submitRating: Record client rating from Telegram callback
   * - addComment: Add comment to existing feedback
   * - exportCsv: Export feedback data as CSV (manager only)
   */
  feedback: feedbackRouter,

  /**
   * Survey router - Survey campaign management
   *
   * Procedures (manager only):
   * - list: List all survey campaigns
   * - getById: Get detailed survey campaign info
   * - create: Schedule a new survey campaign
   * - close: Manually close an active survey
   * - sendNow: Immediately start sending a scheduled survey
   * - getDeliveries: List delivery status for a survey
   * - getSettings: Get survey-related global settings
   * - updateSettings: Update survey settings (admin only)
   */
  survey: surveyRouter,

  /**
   * Contact router - Landing page lead capture
   *
   * Procedures:
   * - submit: Submit new contact form (public)
   */
  contact: contactRouter,

  /**
   * User router - User account management
   * 
   * Procedures:
   * - linkTelegram: Link Telegram account to user
   * - unlinkTelegram: Unlink Telegram account
   */
  user: userRouter,

  /**
   * Notification router - In-app notifications
   */
  notification: notificationRouter,

  /**
   * Messages router - Chat message history
   *
   * Procedures:
   * - listByChat: List messages for a chat with cursor-based pagination
   */
  messages: messagesRouter,
});

/**
 * Export AppRouter type for frontend type inference
 *
 * This type is used by the tRPC client to provide end-to-end type safety.
 * Import this type in your frontend to get full autocomplete and type checking.
 */
export type AppRouter = typeof appRouter;
