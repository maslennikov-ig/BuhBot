# Technical Specification: Telegram Login Widget & Role-Based Integration

## 1. Context & Objective
Currently, the "Profile Settings" (`frontend/src/components/settings/ProfileSettingsForm.tsx`) allows users to manually input their `telegramUsername`. This is error-prone and insecure (anyone can claim any username). 

**The goal** is to replace manual input with the official **Telegram Login Widget**. This provides cryptographic proof of identity. Once linked, the system will leverage existing User Roles (`manager`, `admin`) to enable specific bot capabilities.

## 2. Current Architecture Analysis
*   **Stack:** Next.js 16 (App Router), tRPC v11, Prisma 7, Supabase.
*   **Database:** `User` model has `telegramId` (BigInt), `telegramUsername` (String), `role` (Enum).
*   **API:** `backend/src/api/trpc/routers/auth.ts` handles user updates.
*   **Validation:** Zod schemas are used for input validation.

## 3. Architecture Design

### 3.1. Database Changes
We need to store the user's avatar to improve UX (visual confirmation of the correct account).
*   **Table:** `users`
*   **New Column:** `telegram_photo_url` (String, nullable).

### 3.2. Backend Logic (tRPC)
We need a secure way to verify the data received from the Telegram Widget.

1.  **New Utility:** `backend/src/utils/telegram-auth.ts`
    *   Function `verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean`.
    *   **Algorithm:** HMAC-SHA-256.
        *   Data-check-string: sort keys alphabetically (`auth_date`, `first_name`, `id`, `photo_url`, `username`) -> `key=value` strings joined by `
`.
        *   Secret key: SHA256 hash of the Bot Token.
        *   Compare calculated hash with `data.hash`.
    *   *Security Check:* Validate `auth_date` is not older than 24 hours (prevent replay attacks).

2.  **Update Router:** `backend/src/api/trpc/routers/auth.ts`
    *   **New Mutation:** `linkTelegramAccount`
    *   **Input:** Zod object matching Telegram Widget data:
        ```typescript
        z.object({
          id: z.number(), // Telegram sends number, we convert to BigInt
          first_name: z.string(),
          username: z.string().optional(),
          photo_url: z.string().optional(),
          auth_date: z.number(),
          hash: z.string(),
        })
        ```
    *   **Logic:**
        1.  Fetch Bot Token (from env `TELEGRAM_BOT_TOKEN` or `GlobalSettings`).
        2.  Call `verifyTelegramAuth`. If invalid -> throw TRPCError `UNAUTHORIZED`.
        3.  Update `ctx.user.id` in DB:
            *   `telegramId`: `input.id` (convert to BigInt)
            *   `telegramUsername`: `input.username`
            *   `telegramPhotoUrl`: `input.photo_url`
        4.  Return success.

### 3.3. Frontend Implementation
1.  **New Component:** `frontend/src/components/ui/TelegramLoginButton.tsx`
    *   Wrapper for the script: `<script async src="https://telegram.org/js/telegram-widget.js?22" ...>`
    *   Props: `botName`, `onAuth(user: TelegramUser)`.
    *   **Note:** Since script tags in React can be tricky, use a `useEffect` to append the script dynamically to a container `div`.

2.  **Update:** `frontend/src/components/settings/ProfileSettingsForm.tsx`
    *   **Remove:** Manual `Input` for `telegramUsername`.
    *   **State:** Check `user.telegramId`.
    *   **Condition:**
        *   *If NOT linked:* Show `TelegramLoginButton`.
        *   *If Linked:* Show a "Card" with:
            *   Avatar (`telegramPhotoUrl` or default placeholder).
            *   Username & ID.
            *   "Disconnect" button (mutation to set fields to null).

## 4. Role-Based Capabilities (Future Foundation)
The integration must account for the user's role to enable future features. This logic belongs in the "Post-Link" actions or specific event triggers, not necessarily the link mutation itself, but the data structure must support it.

| Role | Capability Enabled by Linking | Implementation Note |
| :--- | :--- | :--- |
| **Manager (Accountant)** | **SLA Alerts:** Receive immediate push notifications when a client request breaches SLA time. | System checks `Chat.assignedAccountantId` -> `User.telegramId` to send alert. |
| **Admin** | **System Monitoring:** Receive daily digests and critical error reports. | System checks `GlobalSettings.adminIds` (can now map via `User` table). |
| **Observer** | **Read-Only Reports:** Access to generate PDF reports via bot commands. | Bot command `/report` checks `User.role === 'observer'`. |

## 5. Implementation Plan (Step-by-Step)

1.  **Database:**
    *   Create migration: `npx prisma migrate dev --name add_telegram_photo` to add `telegram_photo_url`.
    *   Update `schema.prisma`.

2.  **Backend:**
    *   Implement `verifyTelegramAuth` utility.
    *   Add `TELEGRAM_BOT_TOKEN` to `.env` (and ensure it matches the bot used in the frontend widget).
    *   Add `linkTelegramAccount` and `unlinkTelegramAccount` to `auth` router.

3.  **Frontend:**
    *   Create `TelegramLoginButton` component.
    *   Refactor `ProfileSettingsForm` to use the new flow.
    *   Add UI for "Connected Account" state.

4.  **Verification:**
    *   Test with a real Telegram account.
    *   Verify database updates.
    *   Verify error handling (invalid hash).
