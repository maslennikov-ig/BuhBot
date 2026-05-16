import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBot,
  registeredHandlers,
  mockGetGlobalSettings,
  mockIsAccountantForChat,
  mockLogMediaMessage,
  mockReplyAndLog,
  mockLogger,
} = vi.hoisted(() => {
  const handlers: Array<{ filter: unknown; handler: (ctx: unknown) => Promise<void> }> = [];

  return {
    mockBot: {
      on: vi.fn((filter: unknown, handler: (ctx: unknown) => Promise<void>) => {
        handlers.push({ filter, handler });
      }),
    },
    registeredHandlers: handlers,
    mockGetGlobalSettings: vi.fn(),
    mockIsAccountantForChat: vi.fn(),
    mockLogMediaMessage: vi.fn(),
    mockReplyAndLog: vi.fn(),
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('../../bot.js', () => ({
  bot: mockBot,
  BotContext: {},
}));

vi.mock('../../../config/config.service.js', () => ({
  getGlobalSettings: mockGetGlobalSettings,
}));

vi.mock('../../../utils/logger.js', () => ({ default: mockLogger }));

vi.mock('../response.handler.js', () => ({
  isAccountantForChat: mockIsAccountantForChat,
}));

vi.mock('../../utils/log-media-message.js', () => ({
  logMediaMessage: mockLogMediaMessage,
}));

vi.mock('../../utils/log-outgoing.js', () => ({
  replyAndLog: mockReplyAndLog,
}));

const { registerFileHandler } = await import('../file.handler.js');

function registerAndGetHandler(index: number) {
  registerFileHandler();
  const entry = registeredHandlers[index];
  if (!entry) {
    throw new Error(`Expected handler at index ${index}`);
  }
  return entry.handler;
}

function buildDocumentCtx() {
  return {
    chat: { id: -100123, type: 'supergroup' },
    from: { id: 42, username: 'client_user', first_name: 'Client' },
    message: {
      message_id: 10,
      date: 1_700_000_000,
      document: {
        file_id: 'doc-file-id',
        file_name: 'invoice.pdf',
        file_size: 2048,
        mime_type: 'application/pdf',
      },
      caption: 'Счет за май',
    },
  };
}

function buildPhotoCtx() {
  return {
    chat: { id: -100123, type: 'supergroup' },
    from: { id: 42, username: 'client_user', first_name: 'Client' },
    message: {
      message_id: 11,
      date: 1_700_000_000,
      photo: [
        { file_id: 'small-photo-id', width: 320, height: 240, file_size: 1024 },
        { file_id: 'large-photo-id', width: 1280, height: 960, file_size: 4096 },
      ],
      caption: 'Фото счета',
    },
  };
}

describe('registerFileHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers.length = 0;
    mockGetGlobalSettings.mockResolvedValue({ fileConfirmationEnabled: true });
    mockIsAccountantForChat.mockResolvedValue({ isAccountant: false });
    mockLogMediaMessage.mockResolvedValue(undefined);
    mockReplyAndLog.mockResolvedValue({ message_id: 99 });
  });

  it('logs a document but does not send confirmation when file confirmations are disabled', async () => {
    mockGetGlobalSettings.mockResolvedValue({ fileConfirmationEnabled: false });
    const documentHandler = registerAndGetHandler(0);

    await documentHandler(buildDocumentCtx());

    expect(mockLogMediaMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: 'document',
        mediaFileId: 'doc-file-id',
        mediaFileName: 'invoice.pdf',
      })
    );
    expect(mockReplyAndLog).not.toHaveBeenCalled();
  });

  it('logs a photo but does not send confirmation when file confirmations are disabled', async () => {
    mockGetGlobalSettings.mockResolvedValue({ fileConfirmationEnabled: false });
    const photoHandler = registerAndGetHandler(1);

    await photoHandler(buildPhotoCtx());

    expect(mockLogMediaMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: 'photo',
        mediaFileId: 'large-photo-id',
        mediaFileName: 'photo_1280x960.jpg',
      })
    );
    expect(mockReplyAndLog).not.toHaveBeenCalled();
  });

  it('sends document confirmation when file confirmations are enabled', async () => {
    const documentHandler = registerAndGetHandler(0);

    await documentHandler(buildDocumentCtx());

    expect(mockReplyAndLog).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('Файл получен')
    );
  });

  it('sends document confirmation when reading settings fails', async () => {
    mockGetGlobalSettings.mockRejectedValue(new Error('settings unavailable'));
    const documentHandler = registerAndGetHandler(0);

    await documentHandler(buildDocumentCtx());

    expect(mockReplyAndLog).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('Файл получен')
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to read file confirmation setting, using enabled default',
      expect.objectContaining({ chatId: -100123 })
    );
  });

  it('sends photo confirmation when file confirmations are enabled', async () => {
    const photoHandler = registerAndGetHandler(1);

    await photoHandler(buildPhotoCtx());

    expect(mockReplyAndLog).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('Файл получен')
    );
  });
});
