import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockPrisma,
  mockLogger,
  mockBot,
  registeredActions,
  mockBuildResolvedKeyboard,
  mockBuildAccountantNotificationKeyboard,
  mockFormatAccountantNotification,
  mockFormatResolutionConfirmation,
} = vi.hoisted(() => {
  const registered: Array<{
    pattern: RegExp | string;
    handler: (ctx: unknown) => Promise<void>;
  }> = [];

  return {
    mockPrisma: {
      chat: {
        findUnique: vi.fn(),
      },
      globalSettings: {
        findUnique: vi.fn(),
      },
      clientRequest: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
      slaAlert: {
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    mockBot: {
      on: vi.fn(),
      use: vi.fn(),
      command: vi.fn(),
      hears: vi.fn(),
      action: vi.fn((pattern: RegExp | string, handler: (ctx: unknown) => Promise<void>) => {
        registered.push({ pattern, handler });
      }),
      telegram: {
        sendMessage: vi.fn(),
      },
    },
    registeredActions: registered,
    mockBuildResolvedKeyboard: vi.fn(() => ({})),
    mockBuildAccountantNotificationKeyboard: vi.fn(() => ({})),
    mockFormatAccountantNotification: vi.fn(() => 'notification text'),
    mockFormatResolutionConfirmation: vi.fn(() => ' ✅ resolved'),
  };
});

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../utils/logger.js', () => ({ default: mockLogger }));
vi.mock('../../bot.js', () => ({
  bot: mockBot,
  BotContext: {},
}));
vi.mock('../../../services/alerts/alert.service.js', () => ({
  getAlertById: vi.fn(),
}));
vi.mock('../../../services/alerts/escalation.service.js', () => ({
  cancelEscalation: vi.fn(),
}));
vi.mock('../../../queues/alert.queue.js', () => ({
  cancelAllEscalations: vi.fn(),
}));
vi.mock('../../../services/alerts/format.service.js', () => ({
  formatAccountantNotification: mockFormatAccountantNotification,
  formatResolutionConfirmation: mockFormatResolutionConfirmation,
  escapeHtml: vi.fn((value: string) => value),
}));
vi.mock('../../keyboards/alert.keyboard.js', () => ({
  buildResolvedKeyboard: mockBuildResolvedKeyboard,
  buildAccountantNotificationKeyboard: mockBuildAccountantNotificationKeyboard,
}));
vi.mock('../response.handler.js', () => ({
  isAccountantForChat: vi.fn(),
}));

const { registerAlertCallbackHandler } = await import('../alert-callback.handler.js');
const { getAlertById } = await import('../../../services/alerts/alert.service.js');
const { cancelEscalation } = await import('../../../services/alerts/escalation.service.js');
const { cancelAllEscalations } = await import('../../../queues/alert.queue.js');

const ALERT_ID = '463b0da4-1707-460c-b1fe-f2d4ce4da2c3';

function getRegisteredAction(source: string) {
  const match = registeredActions.find(
    (entry) => entry.pattern instanceof RegExp && entry.pattern.source === source
  );
  if (!match) {
    throw new Error(`Handler for ${source} was not registered`);
  }
  return match.handler;
}

function buildMockCtx(
  match: [string, string],
  overrides: Partial<{
    answerCbQuery: ReturnType<typeof vi.fn>;
    editMessageText: ReturnType<typeof vi.fn>;
    fromId: number;
    callbackQueryMessage: object | null;
  }> = {}
) {
  return {
    match,
    from: { id: overrides.fromId ?? 99999 },
    answerCbQuery: overrides.answerCbQuery ?? vi.fn().mockResolvedValue(undefined),
    editMessageText: overrides.editMessageText ?? vi.fn().mockResolvedValue(undefined),
    callbackQuery: {
      message:
        overrides.callbackQueryMessage !== undefined
          ? overrides.callbackQueryMessage
          : { text: 'Alert text' },
    },
    reply: vi.fn(),
  };
}

describe('alert-callback handler registered actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredActions.length = 0;
    mockBot.telegram.sendMessage.mockResolvedValue({ message_id: 123 });
    mockPrisma.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === 'function') {
        return input(mockPrisma);
      }
      return Promise.all(input as Promise<unknown>[]);
    });
    mockPrisma.slaAlert.update.mockResolvedValue({ id: ALERT_ID });
    mockPrisma.clientRequest.update.mockResolvedValue({ id: 'request-uuid' });
    vi.mocked(cancelEscalation).mockResolvedValue(undefined);
    vi.mocked(cancelAllEscalations).mockResolvedValue(undefined);
    registerAlertCallbackHandler();
  });

  it('notify callback uses accountantTelegramIds even when no usernames are configured', async () => {
    vi.mocked(getAlertById).mockResolvedValue({
      id: ALERT_ID,
      requestId: 'request-uuid',
      resolvedAction: null,
      minutesElapsed: 75,
    } as unknown as Awaited<ReturnType<typeof getAlertById>>);

    mockPrisma.clientRequest.findUnique.mockResolvedValue({
      id: 'request-uuid',
      requestId: 'request-uuid',
      chatId: BigInt(-1001234567890),
      messageText: 'Нужна помощь',
      chat: {
        id: BigInt(-1001234567890),
        title: 'Important chat',
        inviteLink: null,
        chatType: 'supergroup',
        assignedAccountantId: null,
        assignedAccountant: null,
        accountantTelegramIds: [BigInt(111), BigInt(222)],
        accountantUsernames: [],
      },
    });

    mockPrisma.chat.findUnique.mockResolvedValue({
      managerTelegramIds: ['99999'],
    });

    const ctx = buildMockCtx([`notify_${ALERT_ID}`, ALERT_ID]);
    const notifyHandler = getRegisteredAction('^notify_(.+)$');

    await notifyHandler(ctx);

    expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
      '111',
      'notification text',
      expect.any(Object)
    );
    expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
      '222',
      'notification text',
      expect.any(Object)
    );
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Уведомление отправлено бухгалтеру');
  });

  it('notify callback mentions all configured usernames when DM delivery is unavailable', async () => {
    vi.mocked(getAlertById).mockResolvedValue({
      id: ALERT_ID,
      requestId: 'request-uuid',
      resolvedAction: null,
      minutesElapsed: 75,
    } as unknown as Awaited<ReturnType<typeof getAlertById>>);

    mockPrisma.clientRequest.findUnique.mockResolvedValue({
      id: 'request-uuid',
      requestId: 'request-uuid',
      chatId: BigInt(-1001234567890),
      messageText: 'Нужна помощь',
      chat: {
        id: BigInt(-1001234567890),
        title: 'Important chat',
        inviteLink: null,
        chatType: 'supergroup',
        assignedAccountantId: null,
        assignedAccountant: null,
        accountantTelegramIds: [],
        accountantUsernames: ['acc_one', 'acc_two'],
      },
    });

    mockPrisma.chat.findUnique.mockResolvedValue({
      managerTelegramIds: ['99999'],
    });
    mockPrisma.user.findMany.mockResolvedValue([]);

    const ctx = buildMockCtx([`notify_${ALERT_ID}`, ALERT_ID]);
    const notifyHandler = getRegisteredAction('^notify_(.+)$');

    await notifyHandler(ctx);

    expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
      '-1001234567890',
      expect.stringContaining('@acc_one @acc_two'),
      expect.any(Object)
    );
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Уведомление отправлено бухгалтеру');
  });

  it('resolve callback closes a pending request without fabricating response metrics', async () => {
    vi.mocked(getAlertById).mockResolvedValue({
      id: ALERT_ID,
      requestId: 'request-uuid',
      resolvedAction: null,
      minutesElapsed: 30,
    } as unknown as Awaited<ReturnType<typeof getAlertById>>);

    mockPrisma.clientRequest.findUnique.mockResolvedValue({
      id: 'request-uuid',
      chatId: BigInt(-1001234567890),
      status: 'pending',
      chat: {
        inviteLink: null,
        chatType: 'supergroup',
      },
    });

    mockPrisma.chat.findUnique.mockResolvedValue({
      managerTelegramIds: ['99999'],
    });

    const ctx = buildMockCtx([`resolve_${ALERT_ID}`, ALERT_ID]);
    const resolveHandler = getRegisteredAction('^resolve_(.+)$');

    await resolveHandler(ctx);

    expect(mockPrisma.clientRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'request-uuid' },
        data: { status: 'closed' },
      })
    );
    expect(mockPrisma.clientRequest.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responseAt: expect.any(Date),
        }),
      })
    );
  });

  it('resolve callback does not reopen a closed request', async () => {
    vi.mocked(getAlertById).mockResolvedValue({
      id: ALERT_ID,
      requestId: 'request-uuid',
      resolvedAction: null,
      minutesElapsed: 30,
    } as unknown as Awaited<ReturnType<typeof getAlertById>>);

    mockPrisma.clientRequest.findUnique.mockResolvedValue({
      id: 'request-uuid',
      chatId: BigInt(-1001234567890),
      status: 'closed',
      chat: {
        inviteLink: null,
        chatType: 'supergroup',
      },
    });

    mockPrisma.chat.findUnique.mockResolvedValue({
      managerTelegramIds: ['99999'],
    });

    const ctx = buildMockCtx([`resolve_${ALERT_ID}`, ALERT_ID]);
    const resolveHandler = getRegisteredAction('^resolve_(.+)$');

    await resolveHandler(ctx);

    expect(mockPrisma.clientRequest.update).not.toHaveBeenCalled();
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Запрос уже закрыт');
  });

  it('resolve callback re-checks request status inside the transaction before closing', async () => {
    vi.mocked(getAlertById).mockResolvedValue({
      id: ALERT_ID,
      requestId: 'request-uuid',
      resolvedAction: null,
      minutesElapsed: 30,
    } as unknown as Awaited<ReturnType<typeof getAlertById>>);

    mockPrisma.clientRequest.findUnique
      .mockResolvedValueOnce({
        id: 'request-uuid',
        chatId: BigInt(-1001234567890),
        status: 'pending',
        chat: {
          inviteLink: null,
          chatType: 'supergroup',
        },
      })
      .mockResolvedValueOnce({
        status: 'answered',
      });

    mockPrisma.chat.findUnique.mockResolvedValue({
      managerTelegramIds: ['99999'],
    });

    const ctx = buildMockCtx([`resolve_${ALERT_ID}`, ALERT_ID]);
    const resolveHandler = getRegisteredAction('^resolve_(.+)$');

    await resolveHandler(ctx);

    expect(mockPrisma.clientRequest.findUnique).toHaveBeenCalledTimes(2);
    expect(mockPrisma.slaAlert.update).not.toHaveBeenCalled();
    expect(mockPrisma.clientRequest.update).not.toHaveBeenCalled();
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Запрос уже отмечен как решённый');
  });
});
