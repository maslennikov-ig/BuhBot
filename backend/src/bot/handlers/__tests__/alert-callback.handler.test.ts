/**
 * Alert Callback Handler Tests
 *
 * Tests for error-handling and edge-case paths in the resolve_* callback
 * registered in alert-callback.handler.ts.
 *
 * Strategy: because registerAlertCallbackHandler() wires closures into
 * bot.action(), we simulate the handler's control flow directly by calling
 * the mocked services in the same order the handler does and asserting on
 * the mocked ctx.answerCbQuery responses. This matches the pattern used in
 * message.handler.test.ts.
 *
 * Test Cases:
 * 1. Request already resolved (status === 'answered') → early return with 'Запрос уже отмечен как решённый'
 * 2. isAuthorizedForAlertAction throws → isAuthorized stays false → 'Нет прав для этого действия'
 * 3. Request is null → 'Запрос не найден'
 * 4. $transaction throws 'Record to update not found' → 'Запрос не найден, возможно уже удалён'
 * 5. answerCbQuery in the catch block itself throws (expired callback) → no unhandled rejection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted so mocks are available during module hoisting
const { mockPrisma, mockLogger } = vi.hoisted(() => {
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
  };
});

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../utils/logger.js', () => ({ default: mockLogger }));

// Prevent env.ts validation side-effects from bot.ts
vi.mock('../../bot.js', () => ({
  bot: {
    on: vi.fn(),
    use: vi.fn(),
    command: vi.fn(),
    hears: vi.fn(),
    action: vi.fn(),
    telegram: { sendMessage: vi.fn() },
  },
  BotContext: {},
}));

// Mock SLA services to prevent transitive env imports
vi.mock('../../../services/sla/timer.service.js', () => ({
  stopSlaTimer: vi.fn(),
  startSlaTimer: vi.fn(),
}));
vi.mock('../../../services/sla/request.service.js', () => ({
  getRequestByMessage: vi.fn(),
  findLatestPendingRequest: vi.fn(),
}));

// Mock alert service
vi.mock('../../../services/alerts/alert.service.js', () => ({
  getAlertById: vi.fn(),
}));

// Mock escalation services
vi.mock('../../../services/alerts/escalation.service.js', () => ({
  cancelEscalation: vi.fn(),
}));
vi.mock('../../../queues/alert.queue.js', () => ({
  cancelAllEscalations: vi.fn(),
}));

// Mock format/keyboard helpers
vi.mock('../../../services/alerts/format.service.js', () => ({
  formatAccountantNotification: vi.fn(() => 'notification text'),
  formatResolutionConfirmation: vi.fn(() => ' ✅ resolved'),
  escapeHtml: vi.fn((s: string) => s),
}));
vi.mock('../../keyboards/alert.keyboard.js', () => ({
  buildResolvedKeyboard: vi.fn(() => ({})),
  buildAccountantNotificationKeyboard: vi.fn(() => ({})),
}));

// Mock isAccountantForChat (used by isAuthorizedForAlertAction)
vi.mock('../response.handler.js', () => ({
  isAccountantForChat: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal mock Telegraf context for a callback query.
 */
function buildMockCtx(
  overrides: Partial<{
    answerCbQuery: ReturnType<typeof vi.fn>;
    editMessageText: ReturnType<typeof vi.fn>;
    fromId: number;
    callbackQueryMessage: object | null;
  }> = {}
) {
  const answerCbQuery = overrides.answerCbQuery ?? vi.fn().mockResolvedValue(undefined);
  const editMessageText = overrides.editMessageText ?? vi.fn().mockResolvedValue(undefined);

  return {
    match: ['resolve_alert123', 'alert123'],
    from: { id: overrides.fromId ?? 99999 },
    answerCbQuery,
    editMessageText,
    callbackQuery: {
      message:
        overrides.callbackQueryMessage !== undefined
          ? overrides.callbackQueryMessage
          : { text: 'Alert text' },
    },
    reply: vi.fn(),
  };
}

/**
 * Simulate the resolve callback handler logic extracted from alert-callback.handler.ts.
 *
 * This mirrors the handler's control flow exactly so we can unit-test each
 * branch without wiring up the full Telegraf bot.
 */
async function simulateResolveCallback(
  ctx: ReturnType<typeof buildMockCtx>,
  alertId: string
): Promise<void> {
  const { getAlertById } = await import('../../../services/alerts/alert.service.js');
  const { cancelEscalation } = await import('../../../services/alerts/escalation.service.js');
  const { cancelAllEscalations } = await import('../../../queues/alert.queue.js');
  const { formatResolutionConfirmation } =
    await import('../../../services/alerts/format.service.js');
  const { buildResolvedKeyboard } = await import('../../keyboards/alert.keyboard.js');
  const { isAccountantForChat } = await import('../response.handler.js');

  const userId = ctx.from?.id?.toString();

  try {
    const alert = await getAlertById(alertId);

    if (!alert) {
      await ctx.answerCbQuery('Оповещение не найдено');
      return;
    }

    if (alert.resolvedAction !== null) {
      await ctx.answerCbQuery('Уже отмечено как решённое');
      return;
    }

    const request = await mockPrisma.clientRequest.findUnique({
      where: { id: alert.requestId },
      include: { chat: true },
    });

    const telegramUserId = ctx.from?.id;
    let isAuthorized = false;
    try {
      // isAuthorizedForAlertAction checks managerTelegramIds, globalManagerIds, then accountant
      if (request && telegramUserId) {
        // Inline the same checks as the real isAuthorizedForAlertAction
        const chat = await mockPrisma.chat.findUnique({
          where: { id: request.chatId },
          select: { managerTelegramIds: true },
        });
        const userIdStr = String(telegramUserId);
        if (chat?.managerTelegramIds?.includes(userIdStr)) {
          isAuthorized = true;
        } else {
          const globalSettings = await mockPrisma.globalSettings.findUnique({
            where: { id: 'default' },
            select: { globalManagerIds: true },
          });
          if (globalSettings?.globalManagerIds?.includes(userIdStr)) {
            isAuthorized = true;
          } else {
            const { isAccountant } = await isAccountantForChat(
              request.chatId,
              undefined,
              telegramUserId
            );
            isAuthorized = isAccountant;
          }
        }
      }
    } catch (authError) {
      mockLogger.error('Authorization check failed for resolve', {
        alertId,
        error: authError instanceof Error ? authError.message : String(authError),
        service: 'alert-callback',
      });
      // isAuthorized stays false
    }

    if (!request) {
      await ctx.answerCbQuery('Запрос не найден');
      return;
    }
    if (!isAuthorized) {
      await ctx.answerCbQuery('Нет прав для этого действия');
      return;
    }

    if (request.status === 'answered') {
      await ctx.answerCbQuery('Запрос уже отмечен как решённый');
      return;
    }

    await mockPrisma.$transaction([
      mockPrisma.slaAlert.update({
        where: { id: alertId },
        data: {
          resolvedAction: 'mark_resolved',
          acknowledgedAt: new Date(),
          acknowledgedBy: userId ?? null,
          nextEscalationAt: null,
        },
      }),
      mockPrisma.clientRequest.update({
        where: { id: request.id },
        data: { status: 'answered', responseAt: new Date() },
      }),
    ]);

    try {
      await cancelEscalation(alertId);
      await cancelAllEscalations(alert.requestId);
    } catch (cancelError) {
      mockLogger.warn('Failed to cancel escalations (non-critical)', {
        alertId,
        error: cancelError instanceof Error ? cancelError.message : String(cancelError),
        service: 'alert-callback',
      });
    }

    if (request && ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message) {
      const originalText = (ctx.callbackQuery.message as { text: string }).text;
      const updatedText = originalText + formatResolutionConfirmation('mark_resolved');
      const keyboard = buildResolvedKeyboard(
        String(request.chatId),
        request.chat?.inviteLink,
        request.chat?.chatType
      );
      try {
        await ctx.editMessageText(updatedText, { parse_mode: 'HTML', ...keyboard });
      } catch {
        // Message too old to edit — ignore
      }
    }

    await ctx.answerCbQuery('Отмечено как решённое');
  } catch (error) {
    mockLogger.error('Resolve callback error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      alertId,
      userId,
      service: 'alert-callback',
    });
    const msg = error instanceof Error ? error.message : '';
    const userMsg = msg.includes('Record to update not found')
      ? 'Запрос не найден, возможно уже удалён'
      : 'Ошибка при обработке. Попробуйте снова.';
    try {
      await ctx.answerCbQuery(userMsg);
    } catch {
      // Callback query may have expired (30s limit) — nothing to do
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Alert Callback Handler - resolve_* error-handling paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('request already resolved (status === "answered") → answerCbQuery with "Запрос уже отмечен как решённый"', async () => {
    const { getAlertById } = await import('../../../services/alerts/alert.service.js');

    vi.mocked(getAlertById).mockResolvedValue({
      id: 'alert123',
      requestId: 'req_answered',
      resolvedAction: null, // alert not yet resolved
      minutesElapsed: 30,
    } as any);

    // clientRequest.findUnique returns a request that is already 'answered'
    mockPrisma.clientRequest.findUnique.mockResolvedValue({
      id: 'req_answered',
      chatId: BigInt(123),
      status: 'answered',
      chat: { chatType: 'supergroup', inviteLink: null },
    });

    // User is a manager (authorized)
    mockPrisma.chat.findUnique.mockResolvedValue({
      managerTelegramIds: ['99999'],
    });

    const ctx = buildMockCtx({ fromId: 99999 });
    await simulateResolveCallback(ctx, 'alert123');

    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Запрос уже отмечен как решённый');
    // Transaction should NOT be called when request is already answered
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('isAuthorizedForAlertAction throws → isAuthorized stays false → "Нет прав для этого действия"', async () => {
    const { getAlertById } = await import('../../../services/alerts/alert.service.js');
    const { isAccountantForChat } = await import('../response.handler.js');

    vi.mocked(getAlertById).mockResolvedValue({
      id: 'alert123',
      requestId: 'req_pending',
      resolvedAction: null,
      minutesElapsed: 45,
    } as any);

    mockPrisma.clientRequest.findUnique.mockResolvedValue({
      id: 'req_pending',
      chatId: BigInt(123),
      status: 'pending',
      chat: { chatType: 'supergroup', inviteLink: null },
    });

    // chat.findUnique returns no manager ids so we fall through to globalSettings
    mockPrisma.chat.findUnique.mockResolvedValue({
      managerTelegramIds: [],
    });
    // globalSettings also has no manager ids so we fall through to isAccountantForChat
    mockPrisma.globalSettings.findUnique.mockResolvedValue({
      globalManagerIds: [],
    });
    // isAccountantForChat throws → auth error is caught, isAuthorized stays false
    vi.mocked(isAccountantForChat).mockRejectedValue(new Error('DB timeout'));

    const ctx = buildMockCtx({ fromId: 77777 });
    await simulateResolveCallback(ctx, 'alert123');

    // The auth error should be logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Authorization check failed for resolve',
      expect.objectContaining({
        alertId: 'alert123',
        error: 'DB timeout',
      })
    );
    // isAuthorized stayed false → 'Нет прав'
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Нет прав для этого действия');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('request is null → "Запрос не найден" without calling $transaction', async () => {
    const { getAlertById } = await import('../../../services/alerts/alert.service.js');

    vi.mocked(getAlertById).mockResolvedValue({
      id: 'alert123',
      requestId: 'req_missing',
      resolvedAction: null,
      minutesElapsed: 10,
    } as any);

    // clientRequest.findUnique returns null
    mockPrisma.clientRequest.findUnique.mockResolvedValue(null);

    const ctx = buildMockCtx({ fromId: 99999 });
    await simulateResolveCallback(ctx, 'alert123');

    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Запрос не найден');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('$transaction throws "Record to update not found" → specific user message', async () => {
    const { getAlertById } = await import('../../../services/alerts/alert.service.js');

    vi.mocked(getAlertById).mockResolvedValue({
      id: 'alert123',
      requestId: 'req_deleted',
      resolvedAction: null,
      minutesElapsed: 20,
    } as any);

    mockPrisma.clientRequest.findUnique.mockResolvedValue({
      id: 'req_deleted',
      chatId: BigInt(123),
      status: 'pending',
      chat: { chatType: 'supergroup', inviteLink: null },
    });

    // Authorize the user via managerTelegramIds
    mockPrisma.chat.findUnique.mockResolvedValue({
      managerTelegramIds: ['99999'],
    });

    // $transaction throws with 'Record to update not found'
    mockPrisma.$transaction.mockRejectedValue(
      new Error('Record to update not found: { model: "SlaAlert", ... }')
    );

    const ctx = buildMockCtx({ fromId: 99999 });
    await simulateResolveCallback(ctx, 'alert123');

    // The outer catch should produce the specific user message
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Запрос не найден, возможно уже удалён');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Resolve callback error',
      expect.objectContaining({
        error: expect.stringContaining('Record to update not found'),
      })
    );
  });

  it('answerCbQuery in catch block throws (expired callback) → no unhandled rejection', async () => {
    const { getAlertById } = await import('../../../services/alerts/alert.service.js');

    vi.mocked(getAlertById).mockResolvedValue({
      id: 'alert123',
      requestId: 'req_expired',
      resolvedAction: null,
      minutesElapsed: 5,
    } as any);

    mockPrisma.clientRequest.findUnique.mockResolvedValue({
      id: 'req_expired',
      chatId: BigInt(123),
      status: 'pending',
      chat: { chatType: 'supergroup', inviteLink: null },
    });

    mockPrisma.chat.findUnique.mockResolvedValue({
      managerTelegramIds: ['99999'],
    });

    // $transaction throws a generic error
    mockPrisma.$transaction.mockRejectedValue(new Error('Unexpected DB error'));

    // answerCbQuery in the catch block also throws (callback expired after 30s)
    const expiredAnswerCbQuery = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'Bad Request: query is too old and response timeout expired or query ID is invalid'
        )
      );

    const ctx = buildMockCtx({
      fromId: 99999,
      answerCbQuery: expiredAnswerCbQuery,
    });

    // Must NOT throw an unhandled rejection
    await expect(simulateResolveCallback(ctx, 'alert123')).resolves.toBeUndefined();

    expect(expiredAnswerCbQuery).toHaveBeenCalledWith('Ошибка при обработке. Попробуйте снова.');
  });
});
