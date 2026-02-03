/**
 * tRPC API Contract for BuhBot Admin Panel
 *
 * This file defines the TypeScript contract for the admin panel API.
 * Used for end-to-end type safety between Next.js frontend and Node.js backend.
 *
 * Authentication: All routes require Supabase Auth session (verified in tRPC context)
 * Authorization: RLS policies enforced at database level
 */

import { z } from 'zod';

// ============================================================================
// Shared Types & Validators
// ============================================================================

export const UserRoleSchema = z.enum(['admin', 'manager', 'observer']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const RequestStatusSchema = z.enum(['pending', 'in_progress', 'answered', 'escalated']);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

export const AlertTypeSchema = z.enum(['warning', 'breach']);
export type AlertType = z.infer<typeof AlertTypeSchema>;

export const TemplateCategorySchema = z.enum([
  'greeting',
  'status',
  'document_request',
  'reminder',
  'closing',
]);
export type TemplateCategory = z.infer<typeof TemplateCategorySchema>;

// ============================================================================
// Router: auth (Authentication & User Management)
// ============================================================================

export const authRouter = {
  /**
   * Get current authenticated user profile
   *
   * @returns User profile with role
   * @throws UNAUTHORIZED if no session
   */
  me: {
    input: z.void(),
    output: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      fullName: z.string(),
      role: UserRoleSchema,
      createdAt: z.date(),
    }),
  },

  /**
   * List all users (for admin/manager assignment dropdowns)
   *
   * @returns Array of users
   * @authorization All authenticated users
   */
  listUsers: {
    input: z.object({
      role: UserRoleSchema.optional(),
    }),
    output: z.array(
      z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        fullName: z.string(),
        role: UserRoleSchema,
      })
    ),
  },
};

// ============================================================================
// Router: chats (Chat Management & Assignments)
// ============================================================================

export const chatsRouter = {
  /**
   * List all chats with optional filtering
   *
   * @authorization All authenticated users
   */
  list: {
    input: z.object({
      assignedTo: z.string().uuid().optional(),
      slaEnabled: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }),
    output: z.object({
      chats: z.array(
        z.object({
          id: z.number(),
          chatType: z.enum(['private', 'group', 'supergroup']),
          title: z.string().nullable(),
          accountantUsername: z.string().nullable(),
          assignedAccountantId: z.string().uuid().nullable(),
          slaEnabled: z.boolean(),
          slaResponseMinutes: z.number().int(),
          createdAt: z.date(),
        })
      ),
      total: z.number().int(),
    }),
  },

  /**
   * Get single chat details
   *
   * @authorization All authenticated users
   */
  getById: {
    input: z.object({
      id: z.number(),
    }),
    output: z.object({
      id: z.number(),
      chatType: z.enum(['private', 'group', 'supergroup']),
      title: z.string().nullable(),
      accountantUsername: z.string().nullable(),
      assignedAccountantId: z.string().uuid().nullable(),
      slaEnabled: z.boolean(),
      slaResponseMinutes: z.number().int(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
  },

  /**
   * Update chat settings (assignment, SLA config)
   *
   * @authorization Admins and managers only
   */
  update: {
    input: z.object({
      id: z.number(),
      assignedAccountantId: z.string().uuid().nullable().optional(),
      slaEnabled: z.boolean().optional(),
      slaResponseMinutes: z.number().int().min(15).max(480).optional(),
    }),
    output: z.object({
      success: z.boolean(),
      chat: z.object({
        id: z.number(),
        assignedAccountantId: z.string().uuid().nullable(),
        slaEnabled: z.boolean(),
        slaResponseMinutes: z.number().int(),
        updatedAt: z.date(),
      }),
    }),
  },
};

// ============================================================================
// Router: requests (Client Requests & SLA Monitoring)
// ============================================================================

export const requestsRouter = {
  /**
   * List client requests with filtering and pagination
   *
   * @authorization All authenticated users
   */
  list: {
    input: z.object({
      chatId: z.number().optional(),
      assignedTo: z.string().uuid().optional(),
      status: RequestStatusSchema.optional(),
      isSpam: z.boolean().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
      sortBy: z.enum(['received_at', 'response_time_minutes']).default('received_at'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    }),
    output: z.object({
      requests: z.array(
        z.object({
          id: z.string().uuid(),
          chatId: z.number(),
          messageId: z.number(),
          messageText: z.string(),
          clientUsername: z.string().nullable(),
          receivedAt: z.date(),
          assignedTo: z.string().uuid().nullable(),
          responseAt: z.date().nullable(),
          responseTimeMinutes: z.number().int().nullable(),
          status: RequestStatusSchema,
          isSpam: z.boolean(),
          createdAt: z.date(),
        })
      ),
      total: z.number().int(),
    }),
  },

  /**
   * Get single request with related alerts
   *
   * @authorization All authenticated users
   */
  getById: {
    input: z.object({
      id: z.string().uuid(),
    }),
    output: z.object({
      request: z.object({
        id: z.string().uuid(),
        chatId: z.number(),
        messageId: z.number(),
        messageText: z.string(),
        clientUsername: z.string().nullable(),
        receivedAt: z.date(),
        assignedTo: z.string().uuid().nullable(),
        responseAt: z.date().nullable(),
        responseTimeMinutes: z.number().int().nullable(),
        status: RequestStatusSchema,
        isSpam: z.boolean(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
      alerts: z.array(
        z.object({
          id: z.string().uuid(),
          alertType: AlertTypeSchema,
          minutesElapsed: z.number().int(),
          alertSentAt: z.date(),
          acknowledgedAt: z.date().nullable(),
          acknowledgedBy: z.string().uuid().nullable(),
          resolutionNotes: z.string().nullable(),
        })
      ),
    }),
  },

  /**
   * Update request status or assignment
   *
   * @authorization Admins and managers only
   */
  update: {
    input: z.object({
      id: z.string().uuid(),
      assignedTo: z.string().uuid().nullable().optional(),
      status: RequestStatusSchema.optional(),
    }),
    output: z.object({
      success: z.boolean(),
      request: z.object({
        id: z.string().uuid(),
        assignedTo: z.string().uuid().nullable(),
        status: RequestStatusSchema,
        updatedAt: z.date(),
      }),
    }),
  },

  /**
   * Mark request as spam
   *
   * @authorization Admins and managers only
   */
  markAsSpam: {
    input: z.object({
      id: z.string().uuid(),
      isSpam: z.boolean(),
    }),
    output: z.object({
      success: z.boolean(),
    }),
  },
};

// ============================================================================
// Router: alerts (SLA Alert Management)
// ============================================================================

export const alertsRouter = {
  /**
   * List unacknowledged alerts (dashboard widget)
   *
   * @authorization All authenticated users
   */
  listUnacknowledged: {
    input: z.object({
      limit: z.number().int().min(1).max(50).default(20),
    }),
    output: z.array(
      z.object({
        id: z.string().uuid(),
        requestId: z.string().uuid(),
        alertType: AlertTypeSchema,
        minutesElapsed: z.number().int(),
        alertSentAt: z.date(),
        // Related request fields for context
        chatId: z.number(),
        messageText: z.string(),
        clientUsername: z.string().nullable(),
      })
    ),
  },

  /**
   * Acknowledge an SLA alert
   *
   * @authorization Admins and managers only
   */
  acknowledge: {
    input: z.object({
      id: z.string().uuid(),
      resolutionNotes: z.string().optional(),
    }),
    output: z.object({
      success: z.boolean(),
      alert: z.object({
        id: z.string().uuid(),
        acknowledgedAt: z.date(),
        acknowledgedBy: z.string().uuid(),
        resolutionNotes: z.string().nullable(),
      }),
    }),
  },
};

// ============================================================================
// Router: analytics (Reports & Dashboards)
// ============================================================================

export const analyticsRouter = {
  /**
   * Get SLA compliance metrics for dashboard
   *
   * @authorization All authenticated users
   */
  slaCompliance: {
    input: z.object({
      startDate: z.date(),
      endDate: z.date(),
      assignedTo: z.string().uuid().optional(),
    }),
    output: z.object({
      totalRequests: z.number().int(),
      answeredWithinSLA: z.number().int(),
      breachedSLA: z.number().int(),
      compliancePercentage: z.number(),
      averageResponseMinutes: z.number(),
      medianResponseMinutes: z.number(),
      p95ResponseMinutes: z.number(),
    }),
  },

  /**
   * Get feedback summary statistics
   *
   * @authorization All authenticated users
   */
  feedbackSummary: {
    input: z.object({
      startDate: z.date(),
      endDate: z.date(),
    }),
    output: z.object({
      totalResponses: z.number().int(),
      averageRating: z.number(),
      ratingDistribution: z.object({
        star1: z.number().int(),
        star2: z.number().int(),
        star3: z.number().int(),
        star4: z.number().int(),
        star5: z.number().int(),
      }),
    }),
  },

  /**
   * Get accountant performance comparison
   *
   * @authorization Admins and managers only
   */
  accountantPerformance: {
    input: z.object({
      startDate: z.date(),
      endDate: z.date(),
    }),
    output: z.array(
      z.object({
        accountantId: z.string().uuid(),
        accountantName: z.string(),
        totalRequests: z.number().int(),
        answeredWithinSLA: z.number().int(),
        averageResponseMinutes: z.number(),
        averageFeedbackRating: z.number().nullable(),
      })
    ),
  },
};

// ============================================================================
// Router: templates (Message Templates Management)
// ============================================================================

export const templatesRouter = {
  /**
   * List all templates with optional category filter
   *
   * @authorization All authenticated users
   */
  list: {
    input: z.object({
      category: TemplateCategorySchema.optional(),
      sortBy: z.enum(['usage_count', 'created_at']).default('usage_count'),
    }),
    output: z.array(
      z.object({
        id: z.string().uuid(),
        title: z.string(),
        content: z.string(),
        category: TemplateCategorySchema,
        createdBy: z.string().uuid(),
        usageCount: z.number().int(),
        createdAt: z.date(),
        updatedAt: z.date(),
      })
    ),
  },

  /**
   * Create new template
   *
   * @authorization Admins and managers only
   */
  create: {
    input: z.object({
      title: z.string().min(1).max(100),
      content: z.string().min(1).max(2000),
      category: TemplateCategorySchema,
    }),
    output: z.object({
      success: z.boolean(),
      template: z.object({
        id: z.string().uuid(),
        title: z.string(),
        content: z.string(),
        category: TemplateCategorySchema,
        createdBy: z.string().uuid(),
        createdAt: z.date(),
      }),
    }),
  },

  /**
   * Update existing template
   *
   * @authorization Admins/managers (all), users (own templates only)
   */
  update: {
    input: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(100).optional(),
      content: z.string().min(1).max(2000).optional(),
      category: TemplateCategorySchema.optional(),
    }),
    output: z.object({
      success: z.boolean(),
      template: z.object({
        id: z.string().uuid(),
        title: z.string(),
        content: z.string(),
        category: TemplateCategorySchema,
        updatedAt: z.date(),
      }),
    }),
  },

  /**
   * Delete template
   *
   * @authorization Admins only
   */
  delete: {
    input: z.object({
      id: z.string().uuid(),
    }),
    output: z.object({
      success: z.boolean(),
    }),
  },
};

// ============================================================================
// Router: faq (FAQ Items Management)
// ============================================================================

export const faqRouter = {
  /**
   * List all FAQ items
   *
   * @authorization All authenticated users
   */
  list: {
    input: z.object({
      sortBy: z.enum(['usage_count', 'created_at']).default('usage_count'),
    }),
    output: z.array(
      z.object({
        id: z.string().uuid(),
        question: z.string(),
        answer: z.string(),
        keywords: z.array(z.string()),
        usageCount: z.number().int(),
        createdBy: z.string().uuid(),
        createdAt: z.date(),
        updatedAt: z.date(),
      })
    ),
  },

  /**
   * Search FAQ by keywords
   *
   * @authorization All authenticated users (used by bot application)
   */
  search: {
    input: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(10).default(5),
    }),
    output: z.array(
      z.object({
        id: z.string().uuid(),
        question: z.string(),
        answer: z.string(),
        relevanceScore: z.number(),
      })
    ),
  },

  /**
   * Create new FAQ item
   *
   * @authorization Admins and managers only
   */
  create: {
    input: z.object({
      question: z.string().min(1).max(200),
      answer: z.string().min(1).max(2000),
      keywords: z.array(z.string()).min(1).max(20),
    }),
    output: z.object({
      success: z.boolean(),
      faq: z.object({
        id: z.string().uuid(),
        question: z.string(),
        answer: z.string(),
        keywords: z.array(z.string()),
        createdBy: z.string().uuid(),
        createdAt: z.date(),
      }),
    }),
  },

  /**
   * Update existing FAQ item
   *
   * @authorization Admins/managers (all), users (own FAQs only)
   */
  update: {
    input: z.object({
      id: z.string().uuid(),
      question: z.string().min(1).max(200).optional(),
      answer: z.string().min(1).max(2000).optional(),
      keywords: z.array(z.string()).min(1).max(20).optional(),
    }),
    output: z.object({
      success: z.boolean(),
      faq: z.object({
        id: z.string().uuid(),
        question: z.string(),
        answer: z.string(),
        keywords: z.array(z.string()),
        updatedAt: z.date(),
      }),
    }),
  },

  /**
   * Delete FAQ item
   *
   * @authorization Admins only
   */
  delete: {
    input: z.object({
      id: z.string().uuid(),
    }),
    output: z.object({
      success: z.boolean(),
    }),
  },
};

// ============================================================================
// Root Router Export
// ============================================================================

/**
 * Complete tRPC router structure for BuhBot Admin Panel
 *
 * Usage in backend:
 * ```typescript
 * import { router } from '@trpc/server';
 * import { authRouter, chatsRouter, ... } from './contracts/trpc-admin-api';
 *
 * export const appRouter = router({
 *   auth: router(authRouter),
 *   chats: router(chatsRouter),
 *   // ... implement other routers
 * });
 * ```
 *
 * Usage in frontend:
 * ```typescript
 * import { createTRPCNext } from '@trpc/next';
 * import type { AppRouter } from '../server/routers/_app';
 *
 * export const trpc = createTRPCNext<AppRouter>({ ... });
 * ```
 */
export const apiContract = {
  auth: authRouter,
  chats: chatsRouter,
  requests: requestsRouter,
  alerts: alertsRouter,
  analytics: analyticsRouter,
  templates: templatesRouter,
  faq: faqRouter,
} as const;

export type ApiContract = typeof apiContract;
