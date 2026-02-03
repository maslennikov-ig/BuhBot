import crypto from 'crypto';
import env from '../../config/env.js';

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string | undefined;
  username?: string | undefined;
  photo_url?: string | undefined;
  auth_date: number;
  hash: string;
}

class TelegramAuthService {
  /**
   * Verifies the integrity of the data received from Telegram Login Widget
   * @param authData The data received from the widget
   * @returns The validated data (excluding hash) or null if invalid/expired
   */
  verifyAuthData(authData: TelegramAuthData): Omit<TelegramAuthData, 'hash'> | null {
    const { hash, ...data } = authData;

    if (!env.TELEGRAM_BOT_TOKEN) {
      console.error('[TelegramAuth] Bot token not configured');
      return null;
    }

    // 1. Check if auth_date is fresh (within 24 hours)
    // Telegram auth_date is in seconds
    const now = Math.floor(Date.now() / 1000);
    const authDate = data.auth_date;
    if (now - authDate > 86400) {
      console.warn('[TelegramAuth] Auth data expired');
      return null;
    }

    // 2. Construct data-check-string
    // "The data-check-string is a concatenation of all received fields,
    // sorted alphabetically, in the format key=value with a line feed character ('\n') as separator."
    const dataCheckArr = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key as keyof typeof data]}`);

    const dataCheckString = dataCheckArr.join('\n');

    // 3. Compute secret key
    // secret_key = SHA256(<bot_token>)
    const secretKey = crypto.createHash('sha256').update(env.TELEGRAM_BOT_TOKEN).digest();

    // 4. Calculate HMAC-SHA256
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // 5. Compare hash
    if (calculatedHash !== hash) {
      console.warn('[TelegramAuth] Hash mismatch');
      return null;
    }

    return data;
  }
}

export const telegramAuthService = new TelegramAuthService();
