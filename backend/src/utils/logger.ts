import winston from 'winston';
import TransportStream from 'winston-transport';
import path from 'path';
import { fileURLToPath } from 'url';
import { ErrorCaptureService } from '@/services/logging/error-capture.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import env config for validated LOG_LEVEL
// Note: We can't import env directly here due to circular dependency
// (env.ts may log during validation). Use process.env as fallback.
const LOG_LEVEL = process.env['LOG_LEVEL'] || 'info';
const NODE_ENV = process.env['NODE_ENV'] || 'development';

/**
 * Winston Logger Configuration
 *
 * Features:
 * - Structured JSON logging for production
 * - Colored console output for development
 * - Separate error.log for errors
 * - Combined.log for all logs
 * - Log rotation ready
 * - Service metadata included
 */

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, ...metadata }) => {
    let msg = `${timestamp} [${level}] [${service || 'buhbot'}]: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }

    return msg;
  })
);

/**
 * Custom Winston transport for persisting errors to database
 *
 * Captures error and warn level logs to the database with fingerprinting
 * for deduplication and occurrence tracking.
 */
class DatabaseTransport extends TransportStream {
  private errorCapture: ErrorCaptureService;

  constructor(opts?: TransportStream.TransportStreamOptions) {
    super(opts);
    this.errorCapture = new ErrorCaptureService();
  }

  override log(info: any, callback: () => void): void {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Only capture errors and warnings
    if (['error', 'warn'].includes(info.level)) {
      // Extract metadata (exclude Winston internal fields)
      const { level, message, stack, service, timestamp, ...metadata } = info;

      this.errorCapture.captureError({
        level: info.level as 'error' | 'warn',
        message: info.message || 'Unknown error',
        stack: info.stack,
        service: info.service || 'buhbot-backend',
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      }).catch((err) => {
        // Fail silently to avoid logging loops
        console.error('[DatabaseTransport] Failed to capture error:', err instanceof Error ? err.message : String(err));
      });
    }

    callback();
  }
}

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'buhbot-backend' },
  transports: [
    // Database transport for error persistence (errors and warnings only)
    new DatabaseTransport({}),
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// If not in production, log to console with human-readable format
if (NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat
    })
  );
} else {
  // In production, still log to console but with JSON format
  logger.add(
    new winston.transports.Console({
      format: logFormat
    })
  );
}

// Create a stream object for Morgan or other middleware
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

export default logger;
