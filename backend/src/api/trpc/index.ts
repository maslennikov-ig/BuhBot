/**
 * tRPC API Exports
 *
 * Main export file for tRPC API.
 * Use these exports to integrate tRPC with Express.
 *
 * @module api/trpc
 */

// Export app router and type for frontend
export { appRouter, type AppRouter } from './router';

// Export context creator for Express middleware
export { createContext, type Context } from './context';

// Export procedure factories for custom routers (if needed)
export { router, publicProcedure, authedProcedure, managerProcedure, adminProcedure } from './trpc';
