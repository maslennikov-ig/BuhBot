-- Migration: add_rls_policies_sla_monitoring
-- Description: Add Row-Level Security policies for SLA monitoring tables
-- Date: 2025-11-23
--
-- Tables covered:
-- 1. global_settings - System configuration (admin only for all operations)
-- 2. global_holidays - Federal holidays (read for all, write for admin)
-- 3. chat_holidays - Chat-specific holidays (based on chat assignment)
-- 4. classification_cache - AI classification cache (service role only)
--
-- Pattern: Uses existing get_user_role() helper function from the project

-- ============================================================================
-- GLOBAL_SETTINGS: Admin-only access for all operations
-- ============================================================================
-- System configuration singleton - only admins can view and modify

ALTER TABLE "global_settings" ENABLE ROW LEVEL SECURITY;

-- Admin can SELECT global settings
CREATE POLICY "global_settings_select_admin"
    ON "global_settings"
    FOR SELECT
    TO authenticated
    USING (get_user_role(auth.uid()) = 'admin');

-- Admin can UPDATE global settings
CREATE POLICY "global_settings_update_admin"
    ON "global_settings"
    FOR UPDATE
    TO authenticated
    USING (get_user_role(auth.uid()) = 'admin')
    WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Admin can INSERT global settings (for initial setup/recovery)
CREATE POLICY "global_settings_insert_admin"
    ON "global_settings"
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Admin can DELETE global settings (for recovery scenarios)
CREATE POLICY "global_settings_delete_admin"
    ON "global_settings"
    FOR DELETE
    TO authenticated
    USING (get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- GLOBAL_HOLIDAYS: Read for authenticated, write for admin
-- ============================================================================
-- Federal holidays calendar - everyone can read, only admin can modify

ALTER TABLE "global_holidays" ENABLE ROW LEVEL SECURITY;

-- All authenticated users can SELECT global holidays (needed for SLA calculations)
CREATE POLICY "global_holidays_select_authenticated"
    ON "global_holidays"
    FOR SELECT
    TO authenticated
    USING (true);

-- Admin can INSERT new holidays
CREATE POLICY "global_holidays_insert_admin"
    ON "global_holidays"
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Admin can UPDATE existing holidays
CREATE POLICY "global_holidays_update_admin"
    ON "global_holidays"
    FOR UPDATE
    TO authenticated
    USING (get_user_role(auth.uid()) = 'admin')
    WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Admin can DELETE holidays
CREATE POLICY "global_holidays_delete_admin"
    ON "global_holidays"
    FOR DELETE
    TO authenticated
    USING (get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- CHAT_HOLIDAYS: Access based on chat assignment
-- ============================================================================
-- Chat-specific holidays - admin/manager can manage all, others can read assigned chats

ALTER TABLE "chat_holidays" ENABLE ROW LEVEL SECURITY;

-- All authenticated users can SELECT chat holidays for SLA calculations
-- Following the pattern of chats_select_authenticated policy
CREATE POLICY "chat_holidays_select_authenticated"
    ON "chat_holidays"
    FOR SELECT
    TO authenticated
    USING (true);

-- Admin and Manager can INSERT chat holidays for any chat
CREATE POLICY "chat_holidays_insert_admin_manager"
    ON "chat_holidays"
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin', 'manager']));

-- Admin and Manager can UPDATE chat holidays for any chat
CREATE POLICY "chat_holidays_update_admin_manager"
    ON "chat_holidays"
    FOR UPDATE
    TO authenticated
    USING (get_user_role(auth.uid()) = ANY (ARRAY['admin', 'manager']))
    WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin', 'manager']));

-- Admin can DELETE chat holidays
CREATE POLICY "chat_holidays_delete_admin"
    ON "chat_holidays"
    FOR DELETE
    TO authenticated
    USING (get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- CLASSIFICATION_CACHE: Service role only (internal system cache)
-- ============================================================================
-- AI classification results cache - only service role (backend) can access
-- This table contains no user data, only hashed message classifications

ALTER TABLE "classification_cache" ENABLE ROW LEVEL SECURITY;

-- Service role can SELECT from cache (for cache lookups)
CREATE POLICY "classification_cache_select_service_role"
    ON "classification_cache"
    FOR SELECT
    TO service_role
    USING (true);

-- Service role can INSERT new cache entries
CREATE POLICY "classification_cache_insert_service_role"
    ON "classification_cache"
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Service role can UPDATE cache entries (for TTL refresh)
CREATE POLICY "classification_cache_update_service_role"
    ON "classification_cache"
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Service role can DELETE expired cache entries (cleanup job)
CREATE POLICY "classification_cache_delete_service_role"
    ON "classification_cache"
    FOR DELETE
    TO service_role
    USING (true);

-- Admin can also view classification cache for debugging purposes
CREATE POLICY "classification_cache_select_admin"
    ON "classification_cache"
    FOR SELECT
    TO authenticated
    USING (get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- COMMENTS: Document the security model
-- ============================================================================

COMMENT ON POLICY "global_settings_select_admin" ON "global_settings" IS
    'Only admin users can view global system settings';

COMMENT ON POLICY "global_settings_update_admin" ON "global_settings" IS
    'Only admin users can modify global system settings';

COMMENT ON POLICY "global_holidays_select_authenticated" ON "global_holidays" IS
    'All authenticated users can view federal holidays for SLA calculations';

COMMENT ON POLICY "global_holidays_insert_admin" ON "global_holidays" IS
    'Only admin users can add new federal holidays';

COMMENT ON POLICY "chat_holidays_select_authenticated" ON "chat_holidays" IS
    'All authenticated users can view chat holidays for SLA calculations';

COMMENT ON POLICY "chat_holidays_insert_admin_manager" ON "chat_holidays" IS
    'Admin and manager users can create chat-specific holidays';

COMMENT ON POLICY "classification_cache_select_service_role" ON "classification_cache" IS
    'Only service role (backend) can access classification cache for AI results';

COMMENT ON POLICY "classification_cache_select_admin" ON "classification_cache" IS
    'Admin users can view classification cache for debugging and monitoring';
