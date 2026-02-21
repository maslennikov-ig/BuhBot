/**
 * Metadata Sanitization Utility
 *
 * Recursively sanitizes metadata objects by redacting sensitive fields.
 * Used to ensure secrets, tokens, and credentials are never logged.
 *
 * @module services/logging/sanitize-metadata
 */

const REDACTED = '[REDACTED]';

/**
 * Sensitive key patterns (case-insensitive, uses `includes` matching).
 */
const SENSITIVE_PATTERNS: string[] = [
  'password',
  'passwd',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'credential',
  'private_key',
  'privatekey',
  'access_token',
  'refresh_token',
];

/**
 * Check whether a key matches any sensitive pattern (case-insensitive).
 * Hyphens are normalised to underscores so that header-style keys like
 * `x-api-key` match patterns such as `api_key`.
 */
function isSensitiveKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/-/g, '_');
  return SENSITIVE_PATTERNS.some((pattern) => normalised.includes(pattern));
}

/**
 * Recursively sanitize a value.
 *
 * - Objects are deep-cloned with sensitive keys redacted.
 * - Arrays are mapped element-wise.
 * - Primitives and nullish values pass through unchanged.
 */
function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === 'object') {
    return sanitizeMetadata(value as Record<string, any>);
  }

  return value;
}

/**
 * Recursively sanitize metadata by redacting sensitive fields.
 *
 * Returns a new object — the input is never mutated.
 *
 * @param data - The metadata object to sanitize
 * @returns A deep copy with sensitive values replaced by `[REDACTED]`
 */
export function sanitizeMetadata(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key of Object.keys(data)) {
    const value = data[key];

    if (isSensitiveKey(key)) {
      // If the value is a non-null object or array, recurse into it so that
      // structural keys like "credentials" preserve their nested shape while
      // leaf sensitive values inside are still redacted.
      if (value !== null && value !== undefined && typeof value === 'object') {
        result[key] = sanitizeValue(value);
      } else {
        result[key] = REDACTED;
      }
    } else {
      result[key] = sanitizeValue(value);
    }
  }

  return result;
}
