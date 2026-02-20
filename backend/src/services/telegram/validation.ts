interface TelegramMeResponse {
  ok: boolean;
  result: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
    can_join_groups: boolean;
    can_read_all_group_messages: boolean;
    supports_inline_queries: boolean;
  };
  description?: string;
}

export async function validateBotToken(token: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await response.json()) as TelegramMeResponse;

    if (!data.ok) {
      return {
        isValid: false,
        error: data.description || 'Invalid token',
      };
    }

    return {
      isValid: true,
      botId: data.result.id,
      botUsername: data.result.username,
      firstName: data.result.first_name,
    };
  } catch (error) {
    const err = error as Error;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        isValid: false,
        error: 'Telegram API не отвечает. Попробуйте позже.',
      };
    }
    if ('code' in err && (err as NodeJS.ErrnoException).code === 'ENOTFOUND') {
      return {
        isValid: false,
        error: 'Не удалось подключиться к Telegram. Проверьте сеть.',
      };
    }
    console.error('Telegram validation error:', error);
    return {
      isValid: false,
      error: 'Ошибка сети. Проверьте соединение и попробуйте снова.',
    };
  }
}
