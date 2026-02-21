-- Fix: Disable RLS on error_logs table (gh-186)
--
-- error_logs is an internal system table for backend error telemetry.
-- Access control is enforced at the tRPC layer (adminProcedure).
-- The existing RLS policies required auth.uid() which returns NULL for
-- backend service connections via pg.Pool, blocking all INSERT operations
-- since the table was created on 2026-01-16.
--
-- This is consistent with all other internal tables (users, chats,
-- client_requests, etc.) which do not use RLS.

-- Drop existing policies
DROP POLICY IF EXISTS "Admin users can view error logs" ON "error_logs";
DROP POLICY IF EXISTS "Admin users can modify error logs" ON "error_logs";

-- Disable RLS
ALTER TABLE "error_logs" DISABLE ROW LEVEL SECURITY;
