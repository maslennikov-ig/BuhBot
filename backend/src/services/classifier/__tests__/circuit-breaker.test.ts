/**
 * Circuit Breaker Tests
 * Tests for the CircuitBreaker class - state transitions and failure/success counting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker.js';

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics
vi.mock('../../../utils/metrics.js', () => ({
  classifierCircuitBreakerState: { set: vi.fn() },
  classifierCircuitBreakerTripsTotal: { inc: vi.fn() },
}));

describe('CircuitBreaker - State Transitions', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 60000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start in CLOSED state', () => {
    expect(circuitBreaker.getState()).toBe('CLOSED');
  });

  it('should allow requests in CLOSED state', () => {
    expect(circuitBreaker.canRequest()).toBe(true);
  });

  it('should transition CLOSED → OPEN after 5 consecutive failures', () => {
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure();
    }
    expect(circuitBreaker.getState()).toBe('OPEN');
  });

  it('should NOT transition to OPEN with fewer than threshold failures', () => {
    for (let i = 0; i < 4; i++) {
      circuitBreaker.recordFailure();
    }
    expect(circuitBreaker.getState()).toBe('CLOSED');
  });

  it('should deny requests in OPEN state before timeout', () => {
    // Trip to OPEN
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure();
    }
    expect(circuitBreaker.getState()).toBe('OPEN');
    expect(circuitBreaker.canRequest()).toBe(false);
  });

  it('should transition OPEN → HALF_OPEN after timeout', () => {
    // Trip to OPEN
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure();
    }
    expect(circuitBreaker.getState()).toBe('OPEN');

    // Advance time past timeout
    vi.advanceTimersByTime(60001);

    // canRequest() triggers transition
    expect(circuitBreaker.canRequest()).toBe(true);
    expect(circuitBreaker.getState()).toBe('HALF_OPEN');
  });

  it('should transition HALF_OPEN → CLOSED after 2 consecutive successes', () => {
    // Trip to OPEN, then HALF_OPEN
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure();
    }
    vi.advanceTimersByTime(60001);
    circuitBreaker.canRequest(); // triggers HALF_OPEN

    expect(circuitBreaker.getState()).toBe('HALF_OPEN');

    // First success
    circuitBreaker.recordSuccess();
    expect(circuitBreaker.getState()).toBe('HALF_OPEN');

    // Second success - should close
    circuitBreaker.recordSuccess();
    expect(circuitBreaker.getState()).toBe('CLOSED');
  });

  it('should transition HALF_OPEN → OPEN on any failure', () => {
    // Trip to OPEN, then HALF_OPEN
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure();
    }
    vi.advanceTimersByTime(60001);
    circuitBreaker.canRequest();
    expect(circuitBreaker.getState()).toBe('HALF_OPEN');

    // One failure trips back to OPEN
    circuitBreaker.recordFailure();
    expect(circuitBreaker.getState()).toBe('OPEN');
  });

  it('should reset failure count on success in CLOSED state', () => {
    // 4 failures (not enough to trip)
    for (let i = 0; i < 4; i++) {
      circuitBreaker.recordFailure();
    }
    expect(circuitBreaker.getState()).toBe('CLOSED');

    // Success resets failure count
    circuitBreaker.recordSuccess();

    // 4 more failures should NOT trip (count was reset)
    for (let i = 0; i < 4; i++) {
      circuitBreaker.recordFailure();
    }
    expect(circuitBreaker.getState()).toBe('CLOSED');
  });

  it('should respect configurable thresholds', () => {
    const customBreaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 1,
      timeoutMs: 30000,
    });

    // 3 failures should trip (custom threshold)
    for (let i = 0; i < 3; i++) {
      customBreaker.recordFailure();
    }
    expect(customBreaker.getState()).toBe('OPEN');

    // 30s timeout (custom)
    vi.advanceTimersByTime(30001);
    customBreaker.canRequest();
    expect(customBreaker.getState()).toBe('HALF_OPEN');

    // 1 success should close (custom threshold)
    customBreaker.recordSuccess();
    expect(customBreaker.getState()).toBe('CLOSED');
  });

  it('should reset to CLOSED state via reset()', () => {
    // Trip to OPEN
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure();
    }
    expect(circuitBreaker.getState()).toBe('OPEN');

    // Reset
    circuitBreaker.reset();
    expect(circuitBreaker.getState()).toBe('CLOSED');
    expect(circuitBreaker.canRequest()).toBe(true);
  });
});

describe('CircuitBreaker - Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set initial state metric on construction', async () => {
    const { classifierCircuitBreakerState } = await import('../../../utils/metrics.js');

    new CircuitBreaker();

    expect(classifierCircuitBreakerState.set).toHaveBeenCalledWith(0); // CLOSED
  });

  it('should record state transition metrics', async () => {
    const { classifierCircuitBreakerState, classifierCircuitBreakerTripsTotal } =
      await import('../../../utils/metrics.js');

    const cb = new CircuitBreaker({ failureThreshold: 2 });

    // Trip to OPEN
    cb.recordFailure();
    cb.recordFailure();

    expect(classifierCircuitBreakerTripsTotal.inc).toHaveBeenCalledWith({
      from_state: 'CLOSED',
      to_state: 'OPEN',
    });
    expect(classifierCircuitBreakerState.set).toHaveBeenCalledWith(1); // OPEN
  });
});
