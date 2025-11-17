import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Environment Configuration Loader
 *
 * Features:
 * - Runtime validation with Zod schemas
 * - Type-safe environment access
 * - Required variables enforced
 * - Clear error messages on validation failure
 * - Support for multiple .env files
 */

// Load .env file from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Environment schema with Zod
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Server Configuration
  PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(65535))
    .default('3000'),

  // Database (Supabase PostgreSQL)
  DATABASE_URL: z
    .string()
    .url()
    .describe('PostgreSQL connection string from Supabase'),

  // Redis (for BullMQ)
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(65535))
    .default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z
    .string()
    .transform(Number)
    .pipe(z.number().min(0).max(15))
    .default('0'),

  // Telegram Bot
  TELEGRAM_BOT_TOKEN: z
    .string()
    .min(1)
    .describe('Telegram Bot Token from @BotFather'),

  // Logging
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug'])
    .default('info'),

  // Security & Encryption
  JWT_SECRET: z
    .string()
    .min(32)
    .optional()
    .describe('JWT secret for authentication (min 32 chars)'),
  ENCRYPTION_KEY: z
    .string()
    .min(32)
    .optional()
    .describe('Encryption key for sensitive data (min 32 chars)'),

  // Yandex GPT (for LLM services)
  YANDEX_GPT_API_KEY: z
    .string()
    .optional()
    .describe('Yandex GPT API key for AI features'),
  YANDEX_FOLDER_ID: z
    .string()
    .optional()
    .describe('Yandex Cloud folder ID'),

  // Metrics & Monitoring
  PROMETHEUS_PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(65535))
    .optional()
    .describe('Port for Prometheus metrics endpoint'),

  // Feature Flags
  ENABLE_METRICS: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  ENABLE_SENTRY: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Sentry (optional error tracking)
  SENTRY_DSN: z.string().url().optional(),
});

// Export validated environment type
export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);

  // Log successful validation (but don't log in production to avoid noise)
  if (process.env['NODE_ENV'] !== 'production') {
    console.log('[ENV] Environment variables validated successfully');
  }
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('[ENV] Environment validation failed:');
    console.error(
      JSON.stringify(
        error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code
        })),
        null,
        2
      )
    );
    throw new Error(
      `Invalid environment configuration. Check the errors above and ensure all required variables are set in .env file.`
    );
  }
  throw error;
}

export default env;

/**
 * Type-safe environment getter with fallback
 */
export function getEnv<K extends keyof Env>(key: K, fallback?: Env[K]): Env[K] {
  const value = env[key];
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }
  return value;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return env.NODE_ENV === 'test';
}
