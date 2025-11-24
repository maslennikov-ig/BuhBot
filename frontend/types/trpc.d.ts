/**
 * tRPC Type Definitions
 *
 * Import AppRouter type from backend for end-to-end type safety.
 *
 * @module types/trpc
 */

// Import actual AppRouter from backend
import type { AppRouter as BackendAppRouter } from '@backend/api/trpc/router';

// Export the backend AppRouter type
export type AppRouter = BackendAppRouter;

// Re-export for convenience
export type { AppRouter as Router };
