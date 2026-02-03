/**
 * Contact Form tRPC Contract
 *
 * Defines input/output schemas and router interface for the landing page
 * contact form submission endpoint.
 *
 * @module contracts/contact
 */

import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

/**
 * Contact form submission input schema
 *
 * Validates user input from the landing page contact form.
 * Includes honeypot field for spam detection.
 */
export const ContactFormInput = z.object({
  /** Full name of the person requesting demo */
  name: z
    .string()
    .min(1, 'Имя обязательно для заполнения')
    .max(255, 'Имя слишком длинное')
    .transform((s) => s.trim()),

  /** Email address for follow-up contact */
  email: z
    .string()
    .min(1, 'Email обязателен для заполнения')
    .email('Некорректный формат email')
    .max(254, 'Email слишком длинный')
    .transform((s) => s.trim().toLowerCase()),

  /** Company or organization name (optional) */
  company: z
    .string()
    .max(255, 'Название компании слишком длинное')
    .optional()
    .transform((s) => s?.trim() || undefined),

  /** Additional message or notes (optional) */
  message: z
    .string()
    .max(2000, 'Сообщение слишком длинное')
    .optional()
    .transform((s) => s?.trim() || undefined),

  /** Honeypot field - should always be empty for valid submissions */
  honeypot: z.string().optional(),
});

export type ContactFormInputType = z.infer<typeof ContactFormInput>;

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

/**
 * Contact form submission response
 *
 * Returned after successful form submission.
 * Intentionally minimal to avoid information leakage.
 */
export const ContactFormOutput = z.object({
  /** Whether the submission was recorded successfully */
  success: z.boolean(),

  /** User-facing message (success or error) */
  message: z.string(),
});

export type ContactFormOutputType = z.infer<typeof ContactFormOutput>;

// ============================================================================
// ROUTER INTERFACE
// ============================================================================

/**
 * Contact Router Interface
 *
 * Procedures:
 * - submit: Submit contact form (public, no auth)
 * - list: List contact requests (manager only)
 * - updateStatus: Update request status (manager only)
 *
 * Usage:
 * ```typescript
 * // Frontend (public)
 * const result = await trpc.contact.submit.mutate({
 *   name: 'Иван Петров',
 *   email: 'ivan@company.ru',
 *   company: 'ООО Бухгалтерия',
 *   message: 'Интересует демо продукта',
 * });
 *
 * // Admin panel (authenticated)
 * const requests = await trpc.contact.list.query({ status: 'NEW' });
 * await trpc.contact.updateStatus.mutate({ id: '...', status: 'CONTACTED' });
 * ```
 */
export interface ContactRouterInterface {
  /**
   * Submit contact form (PUBLIC - no authentication)
   *
   * Validates input, checks honeypot, stores to database,
   * and sends Telegram notification to managers.
   *
   * Rate limiting should be applied at infrastructure level.
   */
  submit: {
    input: typeof ContactFormInput;
    output: typeof ContactFormOutput;
  };

  /**
   * List contact requests (MANAGER ONLY)
   *
   * Returns paginated list of contact requests.
   * Supports filtering by status.
   */
  list: {
    input: z.ZodObject<{
      status: z.ZodOptional<z.ZodEnum<['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']>>;
      limit: z.ZodDefault<z.ZodNumber>;
      offset: z.ZodDefault<z.ZodNumber>;
    }>;
    output: z.ZodObject<{
      items: z.ZodArray<
        z.ZodObject<{
          id: z.ZodString;
          name: z.ZodString;
          email: z.ZodString;
          company: z.ZodOptional<z.ZodString>;
          message: z.ZodOptional<z.ZodString>;
          status: z.ZodEnum<['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']>;
          createdAt: z.ZodDate;
        }>
      >;
      total: z.ZodNumber;
    }>;
  };

  /**
   * Update contact request status (MANAGER ONLY)
   *
   * Transitions request to new status.
   */
  updateStatus: {
    input: z.ZodObject<{
      id: z.ZodString;
      status: z.ZodEnum<['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']>;
    }>;
    output: z.ZodObject<{
      success: z.ZodBoolean;
    }>;
  };
}

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Contact form error codes for client handling
 */
export const ContactErrorCodes = {
  /** Form validation failed */
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  /** Honeypot triggered (spam detected) */
  SPAM_DETECTED: 'SPAM_DETECTED',

  /** Rate limit exceeded */
  RATE_LIMITED: 'RATE_LIMITED',

  /** Database error */
  DATABASE_ERROR: 'DATABASE_ERROR',

  /** Notification failed (form still saved) */
  NOTIFICATION_FAILED: 'NOTIFICATION_FAILED',
} as const;
