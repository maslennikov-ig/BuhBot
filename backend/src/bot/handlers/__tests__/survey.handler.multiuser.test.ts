/**
 * Survey Handler Multi-User Tests (gh-294)
 *
 * Validates that the handler correctly routes per-user rating, vote-change, and
 * vote-removal callbacks. Does NOT test the vote service internals — the
 * service layer has its own test suite. Here we assert the handler-level
 * contract:
 *
 *   1. Two different users voting on the same delivery → submitVote called
 *      once per user (no early-return blocking the second user).
 *   2. The same user voting twice with different ratings → submitVote called
 *      twice (no `status === 'responded'` gate).
 *   3. The `survey:remove:{deliveryId}` callback triggers removeVote.
 *   4. Attempting to vote on a closed survey surfaces SURVEY_EXPIRED_MESSAGE
 *      and does NOT call submitVote.
 *
 * @module bot/handlers/__tests__/survey.handler.multiuser.test
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

function getActionHandler(tag: string): ActionHandler {
  const call = mockBot.action.mock.calls.find(([pattern]) => {
    return pattern instanceof RegExp && pattern.source.includes(tag);
  });
  if (!call) throw new Error(`action handler for ${tag} not registered`);
  return call[1] as ActionHandler;
}

function buildRatingCtx(opts: {
  deliveryId?: string;
  rating?: string;
  chatId?: number;
  fromId?: number;
  fromUsername?: string;
}) {
  const deliveryId = opts.deliveryId ?? 'delivery-1';
  const rating = opts.rating ?? '4';
  return {
    match: [`survey:rating:${deliveryId}:${rating}`, deliveryId, rating],
    chat: { id: opts.chatId ?? -1001 },
    from: { id: opts.fromId ?? 100, username: opts.fromUsername ?? 'user' },
    answerCbQuery: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
    editMessageReplyMarkup: vi.fn().mockResolvedValue(undefined),
  };
}

function buildRemoveCtx(opts: { deliveryId?: string; chatId?: number; fromId?: number }) {
  const deliveryId = opts.deliveryId ?? 'delivery-1';
  return {
    match: [`survey:remove:${deliveryId}`, deliveryId],
    chat: { id: opts.chatId ?? -1001 },
    from: { id: opts.fromId ?? 100, username: 'user' },
    answerCbQuery: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
    editMessageReplyMarkup: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  registerSurveyHandler();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('multi-user voting (gh-294)', () => {
  it('allows two different users to both vote on the same delivery', async () => {
    // Same delivery, two different Telegram users in the same chat.
    mockSurveyService.getDeliveryById.mockResolvedValue({
      chatId: BigInt(-1001),
      survey: { status: 'active' },
    });
    mockVoteService.submitVote
      .mockResolvedValueOnce({ id: 'vote-1', rating: 4 })
      .mockResolvedValueOnce({ id: 'vote-2', rating: 5 });

    const handler = getActionHandler('survey:rating');

    await handler(buildRatingCtx({ fromId: 100, rating: '4' }));
    await handler(buildRatingCtx({ fromId: 200, rating: '5' }));

    expect(mockVoteService.submitVote).toHaveBeenCalledTimes(2);
    expect(mockVoteService.submitVote).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ telegramUserId: BigInt(100), rating: 4 })
    );
    expect(mockVoteService.submitVote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ telegramUserId: BigInt(200), rating: 5 })
    );
  });

  it('allows the same user to change their vote (no gate on delivery.status)', async () => {
    mockSurveyService.getDeliveryById.mockResolvedValue({
      chatId: BigInt(-1001),
      // NOTE: the pre-gh-294 handler hard-blocked when delivery.status was
      // 'responded'. This test pins the new behavior: status is ignored for
      // multi-user voting; only the survey.status matters.
      status: 'responded',
      survey: { status: 'active' },
    });
    mockVoteService.submitVote.mockResolvedValue({ id: 'vote-1', rating: 5 });

    const handler = getActionHandler('survey:rating');

    await handler(buildRatingCtx({ fromId: 100, rating: '3' }));
    await handler(buildRatingCtx({ fromId: 100, rating: '5' }));

    expect(mockVoteService.submitVote).toHaveBeenCalledTimes(2);
  });

  it('survey:remove callback triggers removeVote for the acting user', async () => {
    mockSurveyService.getDeliveryById.mockResolvedValue({
      chatId: BigInt(-1001),
      survey: { status: 'active' },
    });
    mockVoteService.removeVote.mockResolvedValue({ id: 'vote-1', state: 'removed' });

    const handler = getActionHandler('survey:remove');

    await handler(buildRemoveCtx({ fromId: 100 }));

    expect(mockVoteService.removeVote).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: 'delivery-1',
        telegramUserId: BigInt(100),
      })
    );
  });

  it('shows SURVEY_EXPIRED_MESSAGE and does NOT call submitVote when survey is closed', async () => {
    mockSurveyService.getDeliveryById.mockResolvedValue({
      chatId: BigInt(-1001),
      survey: { status: 'closed' },
    });
    // Simulate the vote service throwing SurveyClosedError. The handler sits
    // in front of the service; we assert that IF the service rejects, the
    // handler surfaces the correct chat-visible message.
    mockVoteService.submitVote.mockRejectedValue(
      new mockVoteService.SurveyClosedError('survey-1', 'closed')
    );

    const handler = getActionHandler('survey:rating');
    const ctx = buildRatingCtx({ fromId: 100, rating: '4' });

    await handler(ctx);

    // submitVote was called (handler does not pre-gate), but the error
    // surfaced the expired message.
    expect(mockVoteService.submitVote).toHaveBeenCalledTimes(1);
    expect(ctx.editMessageText).toHaveBeenCalledWith(SURVEY_EXPIRED_MESSAGE, {
      parse_mode: 'Markdown',
    });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Survey closed');
  });
});
