# Quickstart: Telegram Login Integration

## Prerequisites

1.  **Telegram Bot**: You need a Telegram Bot Token.
    - Create one via [@BotFather](https://t.me/BotFather).
    - Set the domain for the bot using `/setdomain` to your local dev domain (e.g., `localhost` or a tunnel URL). **Note**: Telegram Login Widget requires the domain to be configured. For local development, you might need to use `127.0.0.1` or a tunnel like `ngrok`.

2.  **Environment Variables**:
    - Add `TELEGRAM_BOT_TOKEN` to `backend/.env` and `.env`.
    - Add `NEXT_PUBLIC_BOT_NAME` to `frontend/.env` (for the widget configuration).

## Running Locally

1.  **Database**:

    ```bash
    cd backend
    npm run prisma:migrate
    ```

2.  **Backend**:

    ```bash
    cd backend
    npm run dev
    ```

3.  **Frontend**:

    ```bash
    cd frontend
    npm run dev
    ```

4.  **Testing the Widget**:
    - Navigate to `/settings`.
    - Click "Login with Telegram".
    - **Note**: If using `localhost`, ensure your bot is configured to allow it, or map a real domain via hosts file/ngrok if Telegram refuses `localhost`.

## Verification

- Check the database: `npx prisma studio` -> `TelegramAccount` table should have a new entry.
- Logs: Backend logs should show "Telegram auth verified for user [ID]".
