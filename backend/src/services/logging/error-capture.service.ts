/**
 * Error Capture Service
 *
 * Provides error fingerprinting and database persistence for error deduplication.
 *
 * Features:
 * - MD5 fingerprinting for error grouping
 * - Automatic deduplication (24-hour window)
 * - Occurrence counting and time tracking
 * - Metadata merging for recurring errors
 *
 * Usage:
 * ```typescript
 * const errorCapture = new ErrorCaptureService();
 * await errorCapture.captureError({
 *   level: 'error',
 *   message: 'Database connection failed',
 *   stack: new Error().stack,
 *   service: 'buhbot-backend',
 *   metadata: { attemptCount: 3 }
 * });
 * ```
 *
 * @module services/logging/error-capture
 */

import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import type { ErrorStatus } from '@prisma/client';

/**
 * Options for capturing an error
 */
export interface ErrorCaptureOptions {
  /** Log level: error, warn, or info */
  level: 'error' | 'warn' | 'info';
  /** Error message */
  message: string;
  /** Stack trace (optional) */
  stack?: string;
  /** Service name (defaults to 'buhbot-backend') */
  service?: string;
  /** Additional metadata (JSON) */
  metadata?: Record<string, any>;
}

/**
 * Error Capture Service
 *
 * Handles error fingerprinting and database persistence with deduplication.
 */
export class ErrorCaptureService {
  /**
   * Generate a deterministic fingerprint for an error
   *
   * Normalizes error message and stack trace to ensure the same error
   * produces the same fingerprint regardless of dynamic values.
   *
   * Normalization rules:
   * - UUIDs → <UUID>
   * - Timestamps (ISO8601, Unix) → <TIMESTAMP>
   * - Line/column numbers in stack → :0:0
   * - Large numbers (3+ digits) → <NUM>
   * - Whitespace trimmed, text lowercased
   *
   * @param message - Error message
   * @param stack - Stack trace (optional)
   * @returns MD5 hash (hex string)
   */
  generateFingerprint(message: string, stack?: string): string {
    // Normalize message
    const normalizedMessage = message
      // Remove UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
      // Remove ISO8601 timestamps
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/g, '<TIMESTAMP>')
      // Remove Unix timestamps (10-13 digits)
      .replace(/\b\d{10,13}\b/g, '<TIMESTAMP>')
      // Remove large numbers (3+ digits)
      .replace(/\b\d{3,}\b/g, '<NUM>')
      .trim()
      .toLowerCase();

    // Normalize stack (if provided)
    // For fingerprinting, we only use the first line of stack trace (error name and message)
    // to avoid variations from different call sites generating different fingerprints
    let normalizedStack = '';
    if (stack) {
      // Extract only the first line (error type and message)
      const firstLine = stack.split('\n')[0] || '';
      normalizedStack = firstLine
        // Remove UUIDs
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
        // Remove timestamps
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/g, '<TIMESTAMP>')
        .replace(/\b\d{10,13}\b/g, '<TIMESTAMP>')
        // Remove large numbers
        .replace(/\b\d{3,}\b/g, '<NUM>')
        .trim()
        .toLowerCase();
    }

    // Combine normalized message + stack first line
    const combinedText = `${normalizedMessage}|||${normalizedStack}`;

    // Generate MD5 hash
    const hash = crypto.createHash('md5');
    hash.update(combinedText);
    return hash.digest('hex');
  }

  /**
   * Capture an error to the database
   *
   * If an error with the same fingerprint exists in the last 24 hours,
   * updates occurrence count and timestamp. Otherwise, creates a new entry.
   *
   * Fails silently to prevent logging recursion.
   *
   * @param options - Error capture options
   */
  async captureError(options: ErrorCaptureOptions): Promise<void> {
    try {
      const { level, message, stack, service = 'buhbot-backend', metadata } = options;

      // Generate fingerprint
      const fingerprint = this.generateFingerprint(message, stack);

      // Check for existing error in last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const existingError = await prisma.errorLog.findFirst({
        where: {
          fingerprint,
          timestamp: { gte: twentyFourHoursAgo },
        },
        orderBy: { timestamp: 'desc' },
      });

      if (existingError) {
        // Update existing error
        await prisma.errorLog.update({
          where: { id: existingError.id },
          data: {
            occurrenceCount: { increment: 1 },
            lastSeenAt: new Date(),
            // Merge metadata (preserve existing, add new)
            metadata: {
              ...((existingError.metadata as Record<string, any>) || {}),
              ...(metadata || {}),
              lastOccurrenceMetadata: metadata,
            },
          },
        });
      } else {
        // Create new error log entry
        const createData: any = {
          level,
          message,
          stack: stack || null,
          fingerprint,
          service,
          status: 'new' as ErrorStatus,
          occurrenceCount: 1,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        };

        // Only add metadata if present (Prisma requires omission, not undefined)
        if (metadata) {
          createData.metadata = metadata;
        }

        await prisma.errorLog.create({ data: createData });
      }
    } catch (error) {
      // Fail silently to prevent logging recursion
      // Only log to console to avoid triggering another database write
      console.error(
        '[ErrorCaptureService] Failed to capture error:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

/**
 * Singleton instance
 */
export const errorCaptureService = new ErrorCaptureService();

export default errorCaptureService;
