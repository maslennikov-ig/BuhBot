/**
 * Survey Callback Handler Tests
 *
 * Validates that the survey rating callback produces the expected chat-visible
 * message after a user rates. gh-291 requires that the post-rating message
 * contain ONLY the thank-you text — no stars. The rating itself is persisted
 * via recordResponse and visible to managers in the admin UI.
 *
 * Strategy: mock bot, logger, prisma, and survey service, import the handler
 * registration function, capture the rating action callback registered on
 * bot.action(pattern, handler), and invoke it directly with a mock context.
 *
 * @module bot/handlers/__tests__/survey.handler.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockBot, mockLogger, mockPrisma, mockSurveyService } = vi.hoisted(() => {
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
      feedbackResponse: {
        update: vi.fn(),
      },
    },
    mockSurveyService: {
      recordResponse: vi.fn(),
      getDeliveryById: vi.fn(),
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

import { registerSurveyHandler } from '../survey.handler.js';
import { THANK_YOU_MESSAGE } from '../../keyboards/survey.keyboard.js';

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
  }> = {}
) {
  const deliveryId = overrides.deliveryId ?? 'delivery-123';
  const rating = overrides.rating ?? '4';
  const chatId = overrides.chatId ?? 111222333;

  return {
    match: [`survey:rating:${deliveryId}:${rating}`, deliveryId, rating],
    chat: { id: chatId },
    from: { id: 999, username: overrides.fromUsername ?? 'tester' },
    answerCbQuery: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
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

  it('sends THANK_YOU_MESSAGE without ⭐ stars after successful rating (gh-291)', async () => {
    const deliveryId = 'delivery-abc';
    const chatId = 12345;

    mockSurveyService.getDeliveryById.mockResolvedValue({
      chatId: BigInt(chatId),
      status: 'sent',
      survey: { status: 'active' },
    });
    mockSurveyService.recordResponse.mockResolvedValue('feedback-xyz');

    const handler = getRatingActionHandler();
    const ctx = buildMockCtx({ deliveryId, rating: '5', chatId });

    await handler(ctx);

    expect(mockSurveyService.recordResponse).toHaveBeenCalledWith(deliveryId, 5, 'tester');
    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);

    const [text, options] = ctx.editMessageText.mock.calls[0]!;
    expect(text).toBe(THANK_YOU_MESSAGE);
    expect(text).not.toContain('\u2B50'); // ⭐
    expect(options).toEqual({ parse_mode: 'Markdown' });
  });

  it('still awards toast reply via answerCbQuery showing rating (transient, not chat-visible)', async () => {
    mockSurveyService.getDeliveryById.mockResolvedValue({
      chatId: BigInt(42),
      status: 'sent',
      survey: { status: 'active' },
    });
    mockSurveyService.recordResponse.mockResolvedValue('fb-1');

    const handler = getRatingActionHandler();
    const ctx = buildMockCtx({ rating: '3', chatId: 42 });

    await handler(ctx);

    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Thank you! You rated 3 stars');
  });

  it('uses SURVEY_EXPIRED_MESSAGE (without stars) when delivery not found', async () => {
    mockSurveyService.getDeliveryById.mockResolvedValue(null);

    const handler = getRatingActionHandler();
    const ctx = buildMockCtx();

    await handler(ctx);

    expect(mockSurveyService.recordResponse).not.toHaveBeenCalled();
    const [text] = ctx.editMessageText.mock.calls[0]!;
    expect(text).not.toContain('\u2B50');
  });
});
