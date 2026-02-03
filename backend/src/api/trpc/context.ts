/**
 * tRPC Context for BuhBot Admin Panel API
 *
 * This module creates the request context for all tRPC procedures, providing:
 * - Supabase session validation (JWT authentication)
 * - User profile fetching from database (with role for authorization)
 * - Prisma Client for database operations
 *
 * Context Structure:
 * - prisma: PrismaClient instance for database queries
 * - user: Authenticated user info (null if unauthenticated)
 * - session: Supabase session info (null if unauthenticated)
 *
 * Authentication Flow:
 * 1. Extract JWT from Authorization header (Bearer token)
 * 2. Validate JWT with Supabase Auth
 * 3. Fetch user profile from database (includes role for RBAC)
 * 4. Return context with user info or null for unauthenticated requests
 *
 * @module api/trpc/context
 */

import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { PrismaClient } from '@prisma/client';
import { supabase } from '../../lib/supabase.js';
import { prisma } from '../../lib/prisma.js';
import { isDevMode } from '../../config/env.js';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * User information extracted from session and database
 */
interface ContextUser {
  id: string;           // UUID from Supabase Auth
  email: string;        // User email
  role: 'admin' | 'manager' | 'observer'; // Role for RBAC
  fullName: string;     // Display name
}

/**
 * Mock admin user for DEV MODE
 *
 * This user is used when DEV_MODE=true to bypass Supabase authentication.
 * The UUID matches the dev user in seed.ts.
 */
const DEV_MODE_USER: ContextUser = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: env.DEV_USER_EMAIL || 'admin@buhbot.local',
  role: 'admin',
  fullName: 'DEV Admin',
};

/**
 * Supabase session information
 */
interface ContextSession {
  accessToken: string;  // JWT access token
  expiresAt: number;    // Token expiration timestamp (seconds)
}

/**
 * tRPC context structure
 *
 * Available to all tRPC procedures via `ctx` parameter
 */
export interface Context {
  prisma: PrismaClient;           // Database client
  user: ContextUser | null;       // Authenticated user (null if unauthenticated)
  session: ContextSession | null; // Session info (null if unauthenticated)
}

/**
 * Extract JWT token from Authorization header
 *
 * @param authHeader - Authorization header value (e.g., "Bearer <token>")
 * @returns JWT token or null if missing/malformed
 */
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] || null;
}

/**
 * Create tRPC context for each request
 *
 * This function is called for every tRPC request to build the context object.
 * It handles authentication by:
 * 1. DEV MODE: If Supabase is not configured, bypass auth with mock user
 * 2. Extracting JWT from Authorization header
 * 3. Validating JWT with Supabase Auth
 * 4. Fetching user profile from database
 * 5. Building context with user info or null for unauthenticated
 *
 * Error Handling:
 * - Invalid/missing JWT → Returns unauthenticated context (user: null)
 * - User not in database → Returns unauthenticated context (user: null)
 * - Database errors → Returns unauthenticated context (user: null)
 *
 * @param opts - Express request/response objects
 * @returns Context object with user, session, and prisma client
 */
export async function createContext({
  req,
}: CreateExpressContextOptions): Promise<Context> {
  const reqId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  // DEV MODE: Bypass all authentication
  if (isDevMode) {
    logger.debug('[context] DEV MODE: Using mock admin user', { reqId, duration: Date.now() - startTime });
    return {
      prisma,
      user: DEV_MODE_USER,
      session: {
        accessToken: 'dev-mode-token',
        expiresAt: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      },
    };
  }

  // Extract JWT from Authorization header
  const token = extractToken(req.headers.authorization);

  // If no token, return unauthenticated context
  if (!token) {
    console.log(`[CTX:${reqId}] No token, returning unauthenticated context (${Date.now() - startTime}ms)`);
    return {
      prisma,
      user: null,
      session: null,
    };
  }

  // If Supabase is not configured and not in dev mode, return unauthenticated
  if (!supabase) {
    console.log(`[CTX:${reqId}] Supabase not configured, returning unauthenticated context`);
    return {
      prisma,
      user: null,
      session: null,
    };
  }

  try {
    // Validate JWT with Supabase Auth
    console.log(`[CTX:${reqId}] Starting supabase.auth.getUser()...`);
    const authStart = Date.now();
    const { data, error } = await supabase.auth.getUser(token);
    console.log(`[CTX:${reqId}] supabase.auth.getUser() completed in ${Date.now() - authStart}ms`);

    // If JWT validation fails, return unauthenticated context
    if (error || !data.user) {
      console.log(`[CTX:${reqId}] Auth failed: ${error?.message || 'no user'} (${Date.now() - startTime}ms)`);
      return {
        prisma,
        user: null,
        session: null,
      };
    }

    const supabaseUser = data.user;

    // Fetch user profile from database (includes role for RBAC)
    console.log(`[CTX:${reqId}] Starting prisma.user.findUnique()...`);
    const dbStart = Date.now();
    const dbUser = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });
    console.log(`[CTX:${reqId}] prisma.user.findUnique() completed in ${Date.now() - dbStart}ms`);

    // If user not found in database, return unauthenticated context
    if (!dbUser) {
      console.log(`[CTX:${reqId}] User not in DB (${Date.now() - startTime}ms)`);
      return {
        prisma,
        user: null,
        session: null,
      };
    }

    console.log(`[CTX:${reqId}] Context created successfully (${Date.now() - startTime}ms)`);
    // Build authenticated context
    return {
      prisma,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        fullName: dbUser.fullName,
        role: dbUser.role as 'admin' | 'manager' | 'observer',
      },
      session: {
        accessToken: token,
        // Calculate token expiration (Supabase JWTs typically expire in 1 hour)
        // Default to current time + 1 hour if no exp claim available
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
    };
  } catch (error) {
    // Log error for debugging (production: use structured logging)
    console.error(`[CTX:${reqId}] Error creating tRPC context (${Date.now() - startTime}ms):`, error);

    // Return unauthenticated context on any error
    return {
      prisma,
      user: null,
      session: null,
    };
  }
}
