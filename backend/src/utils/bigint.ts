/**
 * BigInt Utilities for safe conversion
 *
 * Telegram IDs can exceed Number.MAX_SAFE_INTEGER (2^53 - 1).
 * Use these utilities for safe conversion.
 */

/**
 * Safely convert BigInt to Number with overflow check
 * @throws Error if BigInt exceeds safe integer range
 */
export function safeNumberFromBigInt(value: bigint): number {
  const num = Number(value);
  if (!Number.isSafeInteger(num)) {
    throw new Error(`BigInt ${value} exceeds safe integer range (max: ${Number.MAX_SAFE_INTEGER})`);
  }
  return num;
}

/**
 * Convert BigInt to string for JSON serialization
 * Use when the number might exceed safe integer range
 */
export function bigIntToString(value: bigint): string {
  return value.toString();
}

/**
 * Safe BigInt to Number, falls back to string on overflow
 * Returns number if safe, otherwise string
 */
export function safeBigIntConvert(value: bigint): number | string {
  const num = Number(value);
  if (Number.isSafeInteger(num)) {
    return num;
  }
  return value.toString();
}
