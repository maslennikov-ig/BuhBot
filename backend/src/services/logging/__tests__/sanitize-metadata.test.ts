/**
 * Sanitize Metadata Tests
 *
 * Tests for the sanitizeMetadata utility — redaction of sensitive fields
 * in arbitrary nested metadata objects.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeMetadata } from '../sanitize-metadata.js';

describe('sanitizeMetadata', () => {
  it('should return empty object for empty input', () => {
    expect(sanitizeMetadata({})).toEqual({});
  });

  it('should pass through non-sensitive fields unchanged', () => {
    const input = { name: 'Alice', age: 30, active: true };
    expect(sanitizeMetadata(input)).toEqual({ name: 'Alice', age: 30, active: true });
  });

  describe('sensitive key redaction', () => {
    it('should redact password', () => {
      expect(sanitizeMetadata({ password: 'secret123' })).toEqual({
        password: '[REDACTED]',
      });
    });

    it('should redact token', () => {
      expect(sanitizeMetadata({ token: 'abc' })).toEqual({ token: '[REDACTED]' });
    });

    it('should redact secret', () => {
      expect(sanitizeMetadata({ secret: 'xyz' })).toEqual({ secret: '[REDACTED]' });
    });

    it('should redact apiKey', () => {
      expect(sanitizeMetadata({ apiKey: 'key-1' })).toEqual({ apiKey: '[REDACTED]' });
    });

    it('should redact api_key', () => {
      expect(sanitizeMetadata({ api_key: 'key-2' })).toEqual({ api_key: '[REDACTED]' });
    });

    it('should redact authorization', () => {
      expect(sanitizeMetadata({ authorization: 'Bearer tok' })).toEqual({
        authorization: '[REDACTED]',
      });
    });

    it('should redact cookie', () => {
      expect(sanitizeMetadata({ cookie: 'sid=abc' })).toEqual({ cookie: '[REDACTED]' });
    });
  });

  describe('case-insensitive matching', () => {
    it('should redact PASSWORD (upper case)', () => {
      expect(sanitizeMetadata({ PASSWORD: 'val' })).toEqual({ PASSWORD: '[REDACTED]' });
    });

    it('should redact Token (mixed case)', () => {
      expect(sanitizeMetadata({ Token: 'val' })).toEqual({ Token: '[REDACTED]' });
    });

    it('should redact API_KEY (upper case)', () => {
      expect(sanitizeMetadata({ API_KEY: 'val' })).toEqual({ API_KEY: '[REDACTED]' });
    });
  });

  describe('partial key matching (includes)', () => {
    it('should redact x-api-key (contains api_key)', () => {
      expect(sanitizeMetadata({ 'x-api-key': 'val' })).toEqual({
        'x-api-key': '[REDACTED]',
      });
    });

    it('should redact userPassword (contains password)', () => {
      expect(sanitizeMetadata({ userPassword: 'val' })).toEqual({
        userPassword: '[REDACTED]',
      });
    });

    it('should redact accessToken (contains token)', () => {
      expect(sanitizeMetadata({ accessToken: 'val' })).toEqual({
        accessToken: '[REDACTED]',
      });
    });

    it('should redact refreshToken (contains token)', () => {
      expect(sanitizeMetadata({ refreshToken: 'val' })).toEqual({
        refreshToken: '[REDACTED]',
      });
    });
  });

  describe('nested objects', () => {
    it('should redact sensitive keys inside nested objects', () => {
      const input = {
        user: {
          name: 'Bob',
          credentials: {
            password: 'hunter2',
            token: 'tok123',
          },
        },
      };

      const result = sanitizeMetadata(input);

      expect(result).toEqual({
        user: {
          name: 'Bob',
          credentials: {
            password: '[REDACTED]',
            token: '[REDACTED]',
          },
        },
      });
    });
  });

  describe('arrays of objects', () => {
    it('should redact sensitive keys inside array elements', () => {
      const input = {
        users: [
          { name: 'Alice', password: 'p1' },
          { name: 'Bob', token: 't1' },
        ],
      };

      const result = sanitizeMetadata(input);

      expect(result).toEqual({
        users: [
          { name: 'Alice', password: '[REDACTED]' },
          { name: 'Bob', token: '[REDACTED]' },
        ],
      });
    });
  });

  describe('null and undefined sensitive values', () => {
    it('should redact null value for a sensitive key', () => {
      expect(sanitizeMetadata({ password: null })).toEqual({ password: '[REDACTED]' });
    });

    it('should redact undefined value for a sensitive key', () => {
      expect(sanitizeMetadata({ token: undefined })).toEqual({ token: '[REDACTED]' });
    });
  });

  describe('immutability', () => {
    it('should NOT mutate the original object', () => {
      const input = {
        name: 'Test',
        nested: {
          password: 'secret',
          data: 'visible',
        },
      };

      const inputCopy = JSON.parse(JSON.stringify(input));

      sanitizeMetadata(input);

      expect(input).toEqual(inputCopy);
    });
  });

  describe('deeply nested structures', () => {
    it('should redact sensitive keys at arbitrary depth (a.b.c.d.secret)', () => {
      const input = {
        a: {
          b: {
            c: {
              d: {
                secret: 'deep-secret',
                value: 'keep-me',
              },
            },
          },
        },
      };

      const result = sanitizeMetadata(input);

      expect(result).toEqual({
        a: {
          b: {
            c: {
              d: {
                secret: '[REDACTED]',
                value: 'keep-me',
              },
            },
          },
        },
      });
    });
  });
});
