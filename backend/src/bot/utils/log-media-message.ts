import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

interface LogMediaParams {
  chatId: number;
  messageId: number;
  from: { id?: number; username?: string; first_name?: string; last_name?: string } | undefined;
  date: number;
  messageType: 'document' | 'photo';
  mediaFileId: string;
  mediaFileName: string;
  caption?: string | null | undefined;
  isAccountant: boolean;
}

export async function logMediaMessage(params: LogMediaParams): Promise<void> {
  try {
    const label = params.messageType === 'photo' ? 'Фото' : 'Документ';
    await prisma.chatMessage.createMany({
      data: [
        {
          chatId: BigInt(params.chatId),
          messageId: BigInt(params.messageId),
          telegramUserId: BigInt(params.from?.id ?? 0),
          username: params.from?.username ?? null,
          firstName: params.from?.first_name ?? null,
          lastName: params.from?.last_name ?? null,
          messageText: params.caption || `[${label}: ${params.mediaFileName}]`,
          isAccountant: params.isAccountant,
          telegramDate: new Date(params.date * 1000),
          editVersion: 0,
          messageType: params.messageType,
          mediaFileId: params.mediaFileId,
          mediaFileName: params.mediaFileName,
          caption: params.caption ?? null,
        },
      ],
      skipDuplicates: true,
    });
  } catch (error) {
    logger.warn(`Failed to log ${params.messageType} to ChatMessage`, {
      chatId: params.chatId,
      error: error instanceof Error ? error.message : String(error),
      service: 'log-media-message',
    });
  }
}
