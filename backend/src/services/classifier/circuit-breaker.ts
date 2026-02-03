/**
 * Circuit Breaker for API protection
 * Extracted as a separate module for testability.
 * @module services/classifier/circuit-breaker
 */

import type { CircuitBreakerConfig } from './types.js';
import logger from '../../utils/logger.js';
import {
  classifierCircuitBreakerState,
  classifierCircuitBreakerTripsTotal,
} from '../../utils/metrics.js';

/**
 * Circuit Breaker State
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Interface for circuit breaker (enables dependency injection)
 */
export interface ICircuitBreaker {
  canRequest(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
  getState(): CircuitState;
  reset(): void;
}

/**
 * Circuit Breaker implementation
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * when the OpenRouter API is experiencing issues.
 *
 * Three states:
 * - CLOSED (normal): Requests pass through to OpenRouter
 * - OPEN (failing): Requests immediately fail, caller uses keyword fallback
 * - HALF_OPEN (testing): Allow ONE request to test if service recovered
 *
 * Parameters:
 * - failureThreshold: 5 consecutive failures to OPEN the circuit
 * - successThreshold: 2 consecutive successes in HALF_OPEN to CLOSE circuit
 * - timeout: 60 seconds before transitioning from OPEN to HALF_OPEN
 */
export class CircuitBreaker implements ICircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeoutMs: number;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.successThreshold = config.successThreshold ?? 2;
    this.timeoutMs = config.timeoutMs ?? 60000;
    classifierCircuitBreakerState.set(0); // CLOSED
  }

  /**
   * Check if circuit allows request
   */
  canRequest(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      // Check if timeout has passed
      if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.timeoutMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        classifierCircuitBreakerTripsTotal.inc({ from_state: 'OPEN', to_state: 'HALF_OPEN' });
        classifierCircuitBreakerState.set(2); // HALF_OPEN
        logger.info('Circuit breaker transitioning to HALF_OPEN', {
          service: 'classifier',
        });
        return true;
      }
      return false;
    }

    // HALF_OPEN: allow request
    return true;
  }

  /**
   * Record successful request
   */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        classifierCircuitBreakerTripsTotal.inc({ from_state: 'HALF_OPEN', to_state: 'CLOSED' });
        classifierCircuitBreakerState.set(0); // CLOSED
        logger.info('Circuit breaker CLOSED after recovery', {
          service: 'classifier',
        });
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Record failed request
   */
  recordFailure(): void {
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Immediate trip back to OPEN
      this.state = 'OPEN';
      this.successCount = 0;
      classifierCircuitBreakerTripsTotal.inc({ from_state: 'HALF_OPEN', to_state: 'OPEN' });
      classifierCircuitBreakerState.set(1); // OPEN
      logger.warn('Circuit breaker tripped back to OPEN from HALF_OPEN', {
        service: 'classifier',
      });
    } else if (this.state === 'CLOSED') {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        classifierCircuitBreakerTripsTotal.inc({ from_state: 'CLOSED', to_state: 'OPEN' });
        classifierCircuitBreakerState.set(1); // OPEN
        logger.warn('Circuit breaker OPENED after failures', {
          failureCount: this.failureCount,
          service: 'classifier',
        });
      }
    }
  }

  /**
   * Get current state (for monitoring)
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker (for testing)
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    classifierCircuitBreakerState.set(0); // CLOSED
  }
}

/**
 * Factory function for creating circuit breaker instances
 */
export function createCircuitBreaker(config?: CircuitBreakerConfig): ICircuitBreaker {
  return new CircuitBreaker(config);
}
