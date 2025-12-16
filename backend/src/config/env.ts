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
  TELEGRAM_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .describe('Base URL for Telegram webhook (e.g., https://example.com)'),
  TELEGRAM_WEBHOOK_SECRET: z
    .string()
    .min(32)
    .optional()
    .describe('Secret token for webhook signature validation (min 32 chars)'),
  TELEGRAM_ADMIN_CHAT_ID: z
    .string()
    .optional()
    .describe('Telegram chat ID for admin alerts and notifications'),

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

  // OpenRouter AI Classification
  OPENROUTER_API_KEY: z
    .string()
    .optional()
    .describe('OpenRouter API key for AI message classification'),
  APP_URL: z
    .string()
    .url()
    .optional()
    .default('https://buhbot.ru')
    .describe('Application URL for OpenRouter HTTP-Referer header'),

  // Frontend & Bot
  FRONTEND_URL: z
    .string()
    .url()
    .optional()
    .default('https://buhbot.aidevteam.ru')
    .describe('Frontend URL for password reset redirects'),
  BOT_USERNAME: z
    .string()
    .optional()
    .describe('Telegram bot username without @ for invite links'),

  // Supabase
  SUPABASE_URL: z
    .string()
    .url()
    .optional()
    .describe('Supabase project URL'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .optional()
    .describe('Supabase service role key for admin operations'),

  // Prisma Direct Connection
  DIRECT_URL: z
    .string()
    .url()
    .optional()
    .describe('Direct PostgreSQL connection URL (bypasses pooler)'),

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
    // eslint-disable-next-line no-console
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
