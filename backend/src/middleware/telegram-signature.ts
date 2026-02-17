/**
 * Telegram Webhook Signature Validation Middleware
 *
 * Validates the X-Telegram-Bot-Api-Secret-Token header against
 * the configured webhook secret to prevent unauthorized requests.
 *
 * Security features:
 * - Constant-time comparison to prevent timing attacks
 * - Logging of invalid signature attempts with request IP
 * - Prometheus metrics for monitoring signature failures
 *
 * @module middleware/telegram-signature
 * @see https://core.telegram.org/bots/api#setwebhook
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { timingSafeEqual } from 'crypto';
import logger from '../utils/logger.js';
import { botWebhookSignatureFailures } from '../utils/metrics.js';

/**
 * Header name for Telegram webhook secret token
 * Telegram sends this header with every webhook request when secretToken is configured
 */
const TELEGRAM_SECRET_HEADER = 'x-telegram-bot-api-secret-token';

// Startup check: warn if webhook secret is not configured (gh-155)
if (!process.env['TELEGRAM_WEBHOOK_SECRET'] && process.env['NODE_ENV'] === 'production') {
  logger.error(
    'TELEGRAM_WEBHOOK_SECRET not set in production! ' +
      'Webhook requests will be rejected until configured.'
  );
}

/**
 * Configuration options for the signature validation middleware
 */
export interface TelegramSignatureOptions {
  /**
   * The secret token to validate against
   * Must match the secretToken used when setting up the webhook
   */
  secret: string;

  /**
   * Whether to log invalid signature attempts
   * @default true
   */
  logFailures?: boolean;

  /**
   * Whether to increment Prometheus metrics on failures
   * @default true
   */
  trackMetrics?: boolean;
}

/**
 * Error response structure for invalid signatures
 */
interface SignatureErrorResponse {
  error: string;
  code: string;
  timestamp: string;
}

/**
 * Extracts client IP from request, handling proxies
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0] || 'unknown';
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Performs constant-time comparison of two strings
 * Prevents timing attacks by ensuring comparison takes the same time
 * regardless of where strings differ
 */
function safeCompare(a: string, b: string): boolean {
  // If lengths differ, we still need to do a comparison to prevent timing leaks
  // We use the longer string's length for buffer creation
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  // If lengths don't match, result will be false, but we still compare
  // to prevent timing-based length detection
  if (aBuffer.length !== bBuffer.length) {
    // Create equal-length buffers for comparison to avoid timing leaks
    const maxLength = Math.max(aBuffer.length, bBuffer.length);
    const aPadded = Buffer.alloc(maxLength);
    const bPadded = Buffer.alloc(maxLength);
    aBuffer.copy(aPadded);
    bBuffer.copy(bPadded);

    // Perform comparison (will return false) but take constant time
    timingSafeEqual(aPadded, bPadded);
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Creates Express middleware that validates Telegram webhook signatures
 *
 * @param options - Configuration options for the middleware
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import { createTelegramSignatureMiddleware } from './middleware/telegram-signature.js';
 *
 * const signatureMiddleware = createTelegramSignatureMiddleware({
 *   secret: process.env.TELEGRAM_WEBHOOK_SECRET!,
 * });
 *
 * app.use('/api/telegram/webhook', signatureMiddleware);
 * ```
 */
export function createTelegramSignatureMiddleware(
  options: TelegramSignatureOptions
): RequestHandler {
  const { secret, logFailures = true, trackMetrics = true } = options;

  if (!secret || secret.length === 0) {
    throw new Error(
      'TELEGRAM_WEBHOOK_SECRET is required for webhook signature validation. ' +
        'Generate a secure secret with: openssl rand -hex 32'
    );
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const receivedToken = req.headers[TELEGRAM_SECRET_HEADER];

    // Check if header is present
    if (!receivedToken || typeof receivedToken !== 'string') {
      handleInvalidSignature(req, res, 'Missing signature header', {
        logFailures,
        trackMetrics,
      });
      return;
    }

    // Perform constant-time comparison
    if (!safeCompare(receivedToken, secret)) {
      handleInvalidSignature(req, res, 'Invalid signature', {
        logFailures,
        trackMetrics,
      });
      return;
    }

    // Signature is valid, proceed to next middleware
    next();
  };
}

/**
 * Handles invalid signature responses with logging and metrics
 */
function handleInvalidSignature(
  req: Request,
  res: Response,
  reason: string,
  options: { logFailures: boolean; trackMetrics: boolean }
): void {
  const clientIp = getClientIp(req);
  const timestamp = new Date().toISOString();

  if (options.logFailures) {
    logger.warn('Webhook signature validation failed', {
      reason,
      ip: clientIp,
      userAgent: req.headers['user-agent'] || 'unknown',
      path: req.path,
      method: req.method,
      timestamp,
    });
  }

  if (options.trackMetrics) {
    botWebhookSignatureFailures.inc();
  }

  const errorResponse: SignatureErrorResponse = {
    error: 'Unauthorized',
    code: 'INVALID_WEBHOOK_SIGNATURE',
    timestamp,
  };

  res.status(401).json(errorResponse);
}

/**
 * Default middleware instance using TELEGRAM_WEBHOOK_SECRET from environment
 *
 * @throws Error if TELEGRAM_WEBHOOK_SECRET is not set
 *
 * @example
 * ```typescript
 * import telegramSignatureMiddleware from './middleware/telegram-signature.js';
 *
 * // Use default middleware (requires TELEGRAM_WEBHOOK_SECRET env var)
 * app.use('/api/telegram/webhook', telegramSignatureMiddleware);
 * ```
 */
const telegramSignatureMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const secret = process.env['TELEGRAM_WEBHOOK_SECRET'];

  if (!secret) {
    logger.error(
      'TELEGRAM_WEBHOOK_SECRET environment variable is not set. ' +
        'Webhook signature validation cannot proceed.'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'WEBHOOK_SECRET_NOT_CONFIGURED',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Create and execute middleware with the secret
  const middleware = createTelegramSignatureMiddleware({ secret });
  middleware(req, res, next);
};

export default telegramSignatureMiddleware;

// Named exports for flexibility
export { telegramSignatureMiddleware };
