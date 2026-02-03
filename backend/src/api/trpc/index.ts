/**
 * tRPC API Exports
 *
 * Main export file for tRPC API.
 * Use these exports to integrate tRPC with Express.
 *
 * @module api/trpc
 */

// Export app router and type for frontend
export { appRouter, type AppRouter } from './router.js';

// Export context creator for Express middleware
export { createContext, type Context } from './context.js';
