/**
 * tRPC Type Exports (Types Only - No Runtime Dependencies)
 *
 * This file exports only TYPE information for the tRPC router,
 * allowing the frontend to import types without triggering
 * runtime module resolution.
 *
 * Usage in frontend:
 * ```typescript
 * import type { AppRouter } from '@backend/api/trpc/types';
 * ```
 *
 * @module api/trpc/types
 */

// Re-export the AppRouter type from the main router
// Using 'export type' ensures no runtime code is included
export type { AppRouter } from './router.js';
