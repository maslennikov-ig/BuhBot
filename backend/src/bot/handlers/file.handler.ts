/**
 * File Handler for Auto-File Confirmation (US7)
 *
 * Handles document and photo uploads from Telegram users:
 * 1. Listens for document and photo messages
 * 2. Extracts file metadata (name, size, dimensions)
 * 3. Sends confirmation message in Russian
 *
 * @module bot/handlers/file.handler
 */

import { message } from 'telegraf/filters';
import { bot, BotContext } from '../bot.js';
import logger from '../../utils/logger.js';

/**
 * Format file size for human-readable display
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 KB" or "2.3 MB")
 *
 * @example
 * ```typescript
 * formatFileSize(1536); // "1.5 KB"
 * formatFileSize(2621440); // "2.5 MB"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

/**
 * Format timestamp in Russian format
 *
 * @param date - Date object to format
 * @returns Formatted string (e.g., "24.11.2025 15:30")
 *
 * @example
 * ```typescript
 * formatTimestamp(new Date()); // "24.11.2025 15:30"
 * ```
 */
export function formatTimestamp(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Build confirmation message for received file
 *
 * @param filename - Name of the file
 * @param size - Formatted file size
 * @param timestamp - Formatted timestamp
 * @returns Confirmation message in Russian
 */
function buildConfirmationMessage(
  filename: string,
  size: string,
  timestamp: string
): string {
  return `\u2705 Файл получен!

\uD83D\uDCC4 Название: ${filename}
\uD83D\uDCCA Размер: ${size}
\uD83D\uDD50 Время: ${timestamp}

Ваш бухгалтер получит уведомление о новом документе.`;
}

/**
 * Register the file handler for auto-confirmation
 *
 * Listens for document and photo messages and sends
 * a confirmation message with file details.
 *
 * @example
 * ```typescript
 * import { registerFileHandler } from './handlers/file.handler.js';
 *
 * // Register handler before launching bot
 * registerFileHandler();
 * bot.launch();
 * ```
 */
export function registerFileHandler(): void {
  // Handle document uploads
  bot.on(message('document'), async (ctx: BotContext) => {
    // Type guard for document messages
    if (!ctx.message || !('document' in ctx.message)) {
      return;
    }

    const document = ctx.message.document;
    const chatId = ctx.chat?.id;
    const username = ctx.from?.username;

    const filename = document.file_name ?? 'Без названия';
    const fileSize = document.file_size ?? 0;
    const mimeType = document.mime_type ?? 'unknown';

    logger.info('Document received', {
      chatId,
      username,
      filename,
      fileSize,
      mimeType,
      service: 'file-handler',
    });

    try {
      const formattedSize = formatFileSize(fileSize);
      const timestamp = formatTimestamp(new Date());
      const confirmationMessage = buildConfirmationMessage(
        filename,
        formattedSize,
        timestamp
      );

      await ctx.reply(confirmationMessage);

      logger.debug('File confirmation sent', {
        chatId,
        filename,
        service: 'file-handler',
      });
    } catch (error) {
      logger.error('Error sending file confirmation', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        chatId,
        filename,
        service: 'file-handler',
      });
    }
  });

  // Handle photo uploads
  bot.on(message('photo'), async (ctx: BotContext) => {
    // Type guard for photo messages
    if (!ctx.message || !('photo' in ctx.message)) {
      return;
    }

    const photos = ctx.message.photo;
    const chatId = ctx.chat?.id;
    const username = ctx.from?.username;

    // Get the largest photo (last in array)
    const largestPhoto = photos[photos.length - 1];

    if (!largestPhoto) {
      logger.warn('No photo sizes available', {
        chatId,
        service: 'file-handler',
      });
      return;
    }

    const fileSize = largestPhoto.file_size ?? 0;
    const width = largestPhoto.width;
    const height = largestPhoto.height;

    // Generate filename based on dimensions
    const filename = `photo_${width}x${height}.jpg`;

    logger.info('Photo received', {
      chatId,
      username,
      filename,
      fileSize,
      width,
      height,
      service: 'file-handler',
    });

    try {
      const formattedSize = formatFileSize(fileSize);
      const timestamp = formatTimestamp(new Date());
      const confirmationMessage = buildConfirmationMessage(
        filename,
        formattedSize,
        timestamp
      );

      await ctx.reply(confirmationMessage);

      logger.debug('Photo confirmation sent', {
        chatId,
        filename,
        service: 'file-handler',
      });
    } catch (error) {
      logger.error('Error sending photo confirmation', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        chatId,
        filename,
        service: 'file-handler',
      });
    }
  });

  logger.info('File handler registered', { service: 'file-handler' });
}

export default registerFileHandler;
