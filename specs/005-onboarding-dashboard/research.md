# Research: Onboarding & Real-Time Dashboard

**Feature**: 005-onboarding-dashboard
**Date**: 2025-11-25

## 1. Onboarding State Management

**Problem**: How to track if a user has completed the onboarding wizard?

**Options**:

1.  **Boolean Flag in `User`**: Simple `isOnboardingComplete` field.
2.  **Dedicated `OnboardingStatus` Table**: Tracks individual steps completed (e.g., `step_bot_connected`, `step_hours_set`).
3.  **Infer from Data**: Check if `GlobalSettings` has a token and working hours set.

**Decision**: **Option 1 (Boolean Flag)** + **Option 3 (Inference)**.
**Rationale**:

- We need a quick way to redirect from login (`isOnboardingComplete`).
- Individual step tracking is overkill for a 3-step linear wizard; client-side state is sufficient for the wizard session.
- Backend should validate "completeness" by checking required fields (token, hours) before flipping the flag.

## 2. Telegram Bot Validation

**Problem**: How to verify the Bot Token is valid without storing invalid tokens?

**Solution**:

- **Endpoint**: `settings.validateBotToken(token)`
- **Action**: Backend calls `https://api.telegram.org/bot<token>/getMe`.
- **Success**: Returns bot info (username, id).
- **Security**: Token is **NOT** saved during validation, only on the final "Save Step" or immediate save if valid. Ideally, immediate save to `GlobalSettings` upon successful validation to prevent re-entry.

## 3. Dashboard Analytics Performance

**Problem**: Aggregating "Response Time" and "SLA Compliance" on every dashboard load could be slow for large datasets.

**Options**:

1.  **Live Queries**: Run `count` and `avg` on `ClientRequest` table.
2.  **Materialized View**: Refresh periodically (e.g., every hour).
3.  **Cached Statistics**: Calculate on write (when request is closed) and store in a `Stats` table.

**Decision**: **Option 1 (Live Queries)** for MVP.
**Rationale**:

- Volume is low for MVP (dozens/hundreds of requests per day).
- Postgres indexes on `createdAt`, `status`, `responseTime` will make live queries sub-second for up to ~100k rows.
- Premature optimization (caching) adds complexity (cache invalidation).

## 4. Working Hours Storage

**Problem**: How to store "Monday-Friday, 09:00-18:00"?

**Schema Design**:

- **Table**: `WorkingSchedule` (already exists per Phase 1 schema).
- **Fields**: `dayOfWeek` (Int 0-6), `startTime` (Time), `endTime` (Time), `isActive` (Boolean).
- **Default**: Seed with Mon-Fri 09-18 on workspace creation (or during wizard).

## 5. Authentication Polish

**Problem**: Supabase Auth UI is unstyled.

**Solution**:

- Use Supabase Auth Helpers for Next.js.
- Create a custom `LoginForm` component using `react-hook-form` and `zod`.
- Call `supabase.auth.signInWithPassword` (or OAuth) directly.
- **Do NOT** use the pre-built `<Auth />` widget from Supabase UI library as it's hard to style to match the "Aurora" theme exactly.

## 6. Legal Pages

**Decision**: Static Markdown or TSX pages.

- `/privacy` and `/terms` are static.
- Use the main `layout.tsx` (with Header/Footer) but simpler content container.

## Summary of Decisions

- **Onboarding**: `isOnboardingComplete` flag on User/Settings.
- **Validation**: Real-time Telegram API check.
- **Dashboard**: Direct SQL/Prisma aggregations with indexes.
- **Auth**: Custom UI calling Supabase SDK.
