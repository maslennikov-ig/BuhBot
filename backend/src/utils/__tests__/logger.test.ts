/**
 * Logger Smoke Test
 *
 * Validates that the Winston logger initializes correctly and
 * handles typical use cases without throwing.
 *
 * @module utils/__tests__/logger
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock ErrorCaptureService to avoid DB calls during tests
vi.mock('../../services/logging/error-capture.service.js', () => {
  return {
    ErrorCaptureService: class {
      captureError = vi.fn().mockResolvedValue(undefined);
    },
  };
});

describe('logger', () => {
  let logger: typeof import('../logger.js').default;

  beforeAll(async () => {
    const mod = await import('../logger.js');
    logger = mod.default;
  });

  it('should export a logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should log at info level without throwing', () => {
    expect(() => logger.info('smoke test info')).not.toThrow();
  });

  it('should log at warn level without throwing', () => {
    expect(() => logger.warn('smoke test warn')).not.toThrow();
  });

  it('should log at error level without throwing', () => {
    expect(() => logger.error('smoke test error')).not.toThrow();
  });

  it('should handle metadata objects', () => {
    expect(() => logger.info('with metadata', { service: 'test', requestId: '123' })).not.toThrow();
  });

  it('should handle BigInt values in metadata', () => {
    expect(() => logger.info('with bigint', { chatId: BigInt('9007199254740993') })).not.toThrow();
  });

  it('should handle nested BigInt values', () => {
    expect(() =>
      logger.info('nested bigint', {
        data: { ids: [BigInt(1), BigInt(2)], nested: { id: BigInt(3) } },
      })
    ).not.toThrow();
  });

  it('should have configured transports', () => {
    expect(logger.transports.length).toBeGreaterThan(0);
  });

  it('should export stream for middleware integration', async () => {
    const mod = await import('../logger.js');
    expect(mod.stream).toBeDefined();
    expect(typeof mod.stream.write).toBe('function');
    expect(() => mod.stream.write('test stream message')).not.toThrow();
  });
});
