/**
 * Shared Zod schemas for tRPC routers.
 *
 * Keeps primitives (like the Telegram chatId wire format) in one place so
 * routers don't drift on the regex / error message.
 *
 * @module api/trpc/helpers/zod-schemas
 */

import { z } from 'zod';

/**
 * Accept Telegram chat IDs as decimal strings.
 *
 * Supergroup chat IDs are large negative integers whose absolute value exceeds
 * `Number.MAX_SAFE_INTEGER`, so we can't use `z.number()` — JS would silently
 * truncate the least significant digits. Routers parse this to `BigInt` after
 * validation.
 */
export const chatIdStringSchema = z
  .string()
  .regex(/^-?\d+$/, 'chatId must be a decimal integer (may start with "-")');
