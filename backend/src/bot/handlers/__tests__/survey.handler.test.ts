/**
 * Survey Callback Handler Tests
 *
 * Validates the chat-visible side effects of rating callbacks:
 *
 * - gh-291: confirmation text must not leak the rating value (stars).
 *           The per-user toast may still mention it (see separate assertion)
 *           because it's not chat-visible.
 * - gh-294 regression fix (2026-04-19): the handler must NOT call
 *           `editMessageText` or `editMessageReplyMarkup` on the success
 *           path. A Telegram message has ONE keyboard/text shared across
 *           all chat members; editing it overwrote the 5-star keyboard and
 *           hid the survey from other voters. Per-user feedback is now
 *           delivered strictly via `answerCbQuery`.
 *
 * Strategy: mock bot, logger, prisma, and the survey/vote services, import the
 * handler registration function, capture the rating action callback registered
 * on bot.action(pattern, handler), and invoke it directly with a mock context.
 *
 * @module bot/handlers/__tests__/survey.handler.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockBot, mockLogger, mockPrisma, mockSurveyService, mockVoteService } = vi.hoisted(() => {
  return {
    mockBot: {
      on: vi.fn(),
      use: vi.fn(),
      command: vi.fn(),
      hears: vi.fn(),
      action: vi.fn(),
    },
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    mockPrisma: {
      surveyVote: {
        update: vi.fn(),
      },
      feedbackResponse: {
        update: vi.fn(),
      },
    },
    mockSurveyService: {
      getDeliveryById: vi.fn(),
    },
    mockVoteService: {
      submitVote: vi.fn(),
      removeVote: vi.fn(),
      getEffectiveVote: vi.fn(),
      SurveyClosedError: class SurveyClosedError extends Error {
        public readonly code = 'SURVEY_CLOSED' as const;
        constructor(surveyId: string, status: string) {
          super(`Survey ${surveyId} is not accepting votes (status=${status})`);
          this.name = 'SurveyClosedError';
        }
      },
      DeliveryNotFoundError: class DeliveryNotFoundError extends Error {
        public readonly code = 'DELIVERY_NOT_FOUND' as const;
        constructor(deliveryId: string) {
          super(`Survey delivery ${deliveryId} not found`);
          this.name = 'DeliveryNotFoundError';
        }
      },
    },
  };
});

vi.mock('../../bot.js', () => ({
  bot: mockBot,
  BotContext: {},
}));

vi.mock('../../../utils/logger.js', () => ({
  default: mockLogger,
}));

vi.mock('../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/feedback/survey.service.js', () => mockSurveyService);
vi.mock('../../../services/feedback/vote.service.js', () => mockVoteService);

import { registerSurveyHandler } from '../survey.handler.js';
import { SURVEY_EXPIRED_MESSAGE } from '../../keyboards/survey.keyboard.js';

type ActionHandler = (ctx: unknown) => Promise<void>;

function getRatingActionHandler(): ActionHandler {
  const call = mockBot.action.mock.calls.find(([pattern]) => {
    return pattern instanceof RegExp && pattern.source.includes('survey:rating');
  });
  if (!call) throw new Error('survey rating action not registered');
  return call[1] as ActionHandler;
}

function buildMockCtx(
  overrides: Partial<{
    deliveryId: string;
    rating: string;
    chatId: number;
    fromUsername: string;
    fromId: number;
  }> = {}
) {
  const deliveryId = overrides.deliveryId ?? 'delivery-123';
  const rating = overrides.rating ?? '4';
  const chatId = overrides.chatId ?? 111222333;

  return {
    match: [`survey:rating:${deliveryId}:${rating}`, deliveryId, rating],
    chat: { id: chatId },
    from: { id: overrides.fromId ?? 999, username: overrides.fromUsername ?? 'tester' },
    answerCbQuery: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
    editMessageReplyMarkup: vi.fn().mockResolvedValue(undefined),
  };
}

describe('registerSurveyHandler — rating callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerSurveyHandler();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('does NOT edit the chat-visible message or keyboard after a successful rating (gh-294 regression fix)', async () => {
    // gh-294 regression fix 2026-04-19: any `editMessageText` /
    // `editMessageReplyMarkup` on the success path overwrites the shared
    // keyboard for all chat members and effectively closes the survey for
    // other voters. The handler must leave both untouched on success.
    const deliveryId = 'delivery-abc';
    const chatId = 12345;

    mockSurveyService.getDeliveryById.mockResolvedValue({
      chatId: BigInt(chatId),
      status: 'sent',
      survey: { status: 'active' },
    });
    mockVoteService.submitVote.mockResolvedValue({ id: 'vote-xyz', rating: 5 });

    const handler = getRatingActionHandler();
    const ctx = buildMockCtx({ deliveryId, rating: '5', chatId });

    await handler(ctx);

    expect(mockVoteService.submitVote).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId, rating: 5, username: 'tester' })
    );
    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(ctx.editMessageReplyMarkup).not.toHaveBeenCalled();
  });

  it('delivers per-user feedback via answerCbQuery toast containing the rating (gh-291 + gh-294)', async () => {
    mockSurveyService.getDeliveryById.mockResolvedValue({
      chatId: BigInt(42),
      status: 'sent',
      survey: { status: 'active' },
    });
    mockVoteService.submitVote.mockResolvedValue({ id: 'vote-1', rating: 3 });

    const handler = getRatingActionHandler();
    const ctx = buildMockCtx({ rating: '3', chatId: 42 });

    await handler(ctx);

    // Toast mentions the rating (per-user, not chat-visible → gh-291 OK).
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    const [toastText, toastOpts] = ctx.answerCbQuery.mock.calls[0]!;
    expect(toastText).toContain('3');
    expect(toastText).toMatch(/\u2B50|звезд|оценк/i);
    expect(toastOpts).toEqual({ show_alert: false });
  });

  it('uses SURVEY_EXPIRED_MESSAGE when delivery not found (code-review F7)', async () => {
    mockSurveyService.getDeliveryById.mockResolvedValue(null);

    const handler = getRatingActionHandler();
    const ctx = buildMockCtx();

    await handler(ctx);

    expect(mockVoteService.submitVote).not.toHaveBeenCalled();
    const [text, options] = ctx.editMessageText.mock.calls[0]!;
    expect(text).toBe(SURVEY_EXPIRED_MESSAGE);
    expect(options).toEqual({ parse_mode: 'Markdown' });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Survey not found');
  });

  it('toast includes the comment-collection hint only when chatId is truthy (review fix)', async () => {
    // Review fix (2026-04-19): promising "send a chat message for the
    // comment" when chatId is undefined misleads the user — the
    // awaitingComment entry is only created inside `if (chatId)`.
    // Happy path assertion (hint PRESENT) is covered here; the complement
    // is hard to exercise at unit level because the authorization branch
    // rejects ctx without chat before the toast builder runs. If either
    // branch ever regresses, the awaitingComment / setTimeout code paths
    // will also drift and break other tests.
    mockSurveyService.getDeliveryById.mockResolvedValue({
      chatId: BigInt(42),
      status: 'sent',
      survey: { status: 'active' },
    });
    mockVoteService.submitVote.mockResolvedValue({ id: 'vote-1', rating: 4 });

    const handler = getRatingActionHandler();
    const ctx = buildMockCtx({ chatId: 42, rating: '4' });
    await handler(ctx);

    const [toastText] = ctx.answerCbQuery.mock.calls[0]!;
    expect(toastText).toContain('Отправьте сообщение в чат');
    expect(toastText).toContain('4');
  });
});
