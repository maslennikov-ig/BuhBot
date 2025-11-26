# Quickstart: Onboarding & Dashboard Feature

## Setup

1.  **Database Migration**:
    ```bash
    cd backend
    npx prisma migrate dev --name add_onboarding_fields
    ```

2.  **Environment**:
    Ensure `TELEGRAM_BOT_TOKEN` is NOT hardcoded if using the dynamic wizard. The wizard will save it to the DB.

## Testing the Wizard

1.  Login as a user with `isOnboardingComplete = false`.
    - *Tip*: Manually toggle this in Supabase Dashboard or via SQL:
      ```sql
      UPDATE users SET is_onboarding_complete = false WHERE email = 'admin@example.com';
      ```
2.  Navigate to `/dashboard`. You should be redirected to `/onboarding`.
3.  Complete the steps.
4.  Verify `GlobalSettings` and `WorkingSchedule` tables are populated.

## Testing the Dashboard

1.  **Generate Traffic**: Use the Telegram bot to send messages to a connected chat.
2.  **View Metrics**: Refresh the dashboard.
    - "Active Alerts" should appear immediately for unanswered messages.
    - "SLA Compliance" should update after you reply (or after time passes).
