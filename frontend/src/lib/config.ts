/**
 * Frontend Configuration for BuhBot Admin Panel
 *
 * Centralized configuration including DEV MODE settings
 *
 * @module lib/config
 */

/**
 * Check if running in DEV MODE (local development without Supabase)
 *
 * DEV MODE is only enabled when:
 * - NEXT_PUBLIC_DEV_MODE=true is explicitly set
 * - NODE_ENV is 'development'
 */
export const isDevMode =
  process.env.NEXT_PUBLIC_DEV_MODE === 'true' && process.env.NODE_ENV === 'development';

/**
 * Mock user for DEV MODE
 *
 * This user is used when DEV MODE is enabled to bypass authentication.
 * The ID matches the backend context.ts mock user.
 */
export const devMockUser = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: process.env.NEXT_PUBLIC_DEV_USER_EMAIL || 'admin@buhbot.local',
  role: 'admin' as const,
  fullName: 'DEV Admin',
};
