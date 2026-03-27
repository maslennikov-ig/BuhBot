/**
 * OpenRouterClient Fallback Model Tests (H-1)
 *
 * Tests for OpenRouterClient class in openrouter-client.ts
 *
 * H-1 - Fallback Model Tests:
 * 1. Primary model fails all retries → fallback model succeeds → result has [fallback: model]
 *    in reasoning; model is 'openrouter' (implementation detail)
 * 2. Both primary and fallback fail → throws original (primary) error
 * 3. Fallback model same as primary → fallback skipped, throws
 * 4. Circuit breaker OPEN → fallback not attempted, throws immediately
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterClient } from '../openrouter-client.js';
import type { ICircuitBreaker } from '../circuit-breaker.js';

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics (circuit breaker module uses these at construction time)
vi.mock('../../../utils/metrics.js', () => ({
  classifierRequestsTotal: { inc: vi.fn() },
  classifierLatencySeconds: { observe: vi.fn() },
  classifierErrorsTotal: { inc: vi.fn() },
  classifierCacheHitsTotal: { inc: vi.fn() },
  classifierCacheMissesTotal: { inc: vi.fn() },
  classifierCircuitBreakerState: { set: vi.fn() },
  classifierCircuitBreakerTripsTotal: { inc: vi.fn() },
}));

// Mock OpenAI SDK at module level.
// IMPORTANT: vi.mock factory is hoisted before variable declarations.
// Error subclasses must be defined INSIDE the factory to avoid TDZ errors.
// The `create` function references `mockCreate` lazily so it can be configured
// per test after vi.mock hoisting.
vi.mock('openai', () => {
  class RateLimitError extends Error {
    status = 429;
    constructor(msg = 'Rate limit') {
      super(msg);
      this.name = 'RateLimitError';
    }
  }
  class InternalServerError extends Error {
    constructor(msg = 'Server error') {
      super(msg);
      this.name = 'InternalServerError';
    }
  }
  class APIConnectionError extends Error {
    constructor(msg = 'Connection error') {
      super(msg);
      this.name = 'APIConnectionError';
    }
  }
  class APIConnectionTimeoutError extends Error {
    constructor(msg = 'Timeout') {
      super(msg);
      this.name = 'APIConnectionTimeoutError';
    }
  }

  // Real constructor function so `new OpenAI(...)` works.
  // Delegates to mockCreate lazily to avoid hoisting issues.
  function MockOpenAI(this: any, _opts: unknown) {
    this.chat = {
      completions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    };
  }
  MockOpenAI.RateLimitError = RateLimitError;
  MockOpenAI.InternalServerError = InternalServerError;
  MockOpenAI.APIConnectionError = APIConnectionError;
  MockOpenAI.APIConnectionTimeoutError = APIConnectionTimeoutError;

  return { default: MockOpenAI };
});

// Declared after vi.mock (hoisting) but lazily referenced inside the factory
const mockCreate = vi.fn();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a mock ICircuitBreaker that allows requests by default
 */
function makeCircuitBreaker(overrides: Partial<ICircuitBreaker> = {}): ICircuitBreaker {
  return {
    canRequest: vi.fn().mockReturnValue(true),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    getState: vi.fn().mockReturnValue('CLOSED'),
    reset: vi.fn(),
    ...overrides,
  };
}

/**
 * Build a valid AI JSON response string
 */
function makeAIResponse(
  classification = 'REQUEST',
  confidence = 0.9,
  reasoning = 'test reasoning'
): string {
  return JSON.stringify({ classification, confidence, reasoning });
}

/**
 * Build a mock chat completion response object
 */
function makeChatCompletion(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OpenRouterClient - Fallback Model (H-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Once queues in addition to clearing call history
    mockCreate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should use fallback model when primary fails all retries and return reasoning prefixed with [fallback: model]', async () => {
    const primaryModel = 'xiaomi/mimo-v2-flash';
    const fallbackModel = 'google/gemini-2.0-flash-001';
    const cb = makeCircuitBreaker();

    const client = new OpenRouterClient(
      {
        openRouterApiKey: 'test-key',
        openRouterModel: primaryModel,
        fallbackModel,
        maxRetries: 1, // single attempt; non-retryable error exits loop immediately
      },
      cb
    );

    // Primary fails with a generic (non-retryable) error — no sleep() involved
    mockCreate
      .mockRejectedValueOnce(new Error('Primary model unavailable'))
      .mockResolvedValueOnce(
        makeChatCompletion(makeAIResponse('SPAM', 0.85, 'fallback reasoning'))
      );

    const result = await client.classify('test message');

    expect(result.model).toBe('openrouter-fallback');
    expect(result.reasoning).toContain(`[fallback: ${fallbackModel}]`);
    expect(result.reasoning).toContain('fallback reasoning');
    expect(result.classification).toBe('SPAM');
    expect(result.confidence).toBe(0.85);

    // Primary called first, fallback called second
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].model).toBe(primaryModel);
    expect(mockCreate.mock.calls[1][0].model).toBe(fallbackModel);
  });

  it('should throw original (primary) error when both primary and fallback fail', async () => {
    const primaryModel = 'xiaomi/mimo-v2-flash';
    const fallbackModel = 'google/gemini-2.0-flash-001';
    const cb = makeCircuitBreaker();

    const client = new OpenRouterClient(
      {
        openRouterApiKey: 'test-key',
        openRouterModel: primaryModel,
        fallbackModel,
        maxRetries: 1,
      },
      cb
    );

    mockCreate
      .mockRejectedValueOnce(new Error('Primary model failed'))
      .mockRejectedValueOnce(new Error('Fallback model also failed'));

    // Should throw the ORIGINAL primary error, not the fallback error
    await expect(client.classify('test message')).rejects.toThrow('Primary model failed');
  });

  it('should skip fallback and throw when fallback model is same as primary', async () => {
    const model = 'xiaomi/mimo-v2-flash';
    const cb = makeCircuitBreaker();

    const client = new OpenRouterClient(
      {
        openRouterApiKey: 'test-key',
        openRouterModel: model,
        fallbackModel: model, // identical → fallback guard prevents attempt
        maxRetries: 1,
      },
      cb
    );

    mockCreate.mockRejectedValueOnce(new Error('Primary model failed'));

    await expect(client.classify('test message')).rejects.toThrow('Primary model failed');

    // Only the single primary attempt; no fallback call
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should throw immediately when circuit breaker is OPEN, without attempting primary or fallback', async () => {
    const cb = makeCircuitBreaker({
      canRequest: vi.fn().mockReturnValue(false),
      getState: vi.fn().mockReturnValue('OPEN'),
    });

    const client = new OpenRouterClient(
      {
        openRouterApiKey: 'test-key',
        openRouterModel: 'xiaomi/mimo-v2-flash',
        fallbackModel: 'google/gemini-2.0-flash-001',
        maxRetries: 3,
      },
      cb
    );

    await expect(client.classify('test message')).rejects.toThrow(
      'Circuit breaker OPEN - OpenRouter unavailable'
    );

    // No API calls at all
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should record circuit breaker success after fallback model succeeds', async () => {
    const cb = makeCircuitBreaker();

    const client = new OpenRouterClient(
      {
        openRouterApiKey: 'test-key',
        openRouterModel: 'xiaomi/mimo-v2-flash',
        fallbackModel: 'google/gemini-2.0-flash-001',
        maxRetries: 1,
      },
      cb
    );

    mockCreate
      .mockRejectedValueOnce(new Error('Primary failed'))
      .mockResolvedValueOnce(makeChatCompletion(makeAIResponse('REQUEST', 0.9, 'ok')));

    await client.classify('test message');

    expect(cb.recordSuccess).toHaveBeenCalled();
  });

  it('should not attempt fallback when fallbackModel is empty string', async () => {
    const cb = makeCircuitBreaker();

    const client = new OpenRouterClient(
      {
        openRouterApiKey: 'test-key',
        openRouterModel: 'xiaomi/mimo-v2-flash',
        fallbackModel: '', // falsy → condition `this.config.fallbackModel && ...` is false
        maxRetries: 1,
      },
      cb
    );

    mockCreate.mockRejectedValueOnce(new Error('Primary failed'));

    await expect(client.classify('test message')).rejects.toThrow('Primary failed');

    // Only 1 call — primary only, no fallback
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
