import { z } from 'zod';

/**
 * Validation schema for incoming Telegram message text and user fields.
 * Prevents oversized strings and XSS before database insertion.
 */
export const TelegramMessageSchema = z.object({
  text: z.string().min(1).max(10000),
  username: z.string().max(255).optional().nullable(),
  firstName: z.string().max(255).optional().nullable(),
  lastName: z.string().max(255).optional().nullable(),
});
