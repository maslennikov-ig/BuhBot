/**
 * Test Script for Error Capture Service
 *
 * Tests error fingerprinting and deduplication logic.
 * Run with: node --import tsx src/test-error-capture.ts
 *
 * Expected behavior:
 * 1. First error creates new error_logs entry
 * 2. Second error (same fingerprint, different UUID/timestamp) increments occurrenceCount
 * 3. Both errors have same fingerprint despite different dynamic values
 */

import 'dotenv/config';
import logger from './utils/logger.js';

async function testErrorCapture() {
  console.log('\n=== Testing Error Capture Service ===\n');

  // Test 1: Trigger first error with UUID and timestamp
  console.log('Test 1: Triggering first error with dynamic values...');
  try {
    throw new Error('Test error for fingerprinting');
  } catch (error) {
    logger.error('Test error for fingerprinting', {
      stack: error instanceof Error ? error.stack : undefined,
      userId: '123e4567-e89b-12d3-a456-426614174000',
      timestamp: '2024-01-16T12:00:00Z',
      attemptCount: 1,
    });
  }

  console.log('✓ First error logged (should create new entry)\n');

  // Wait 2 seconds to allow database write
  console.log('Waiting 2 seconds for database write...\n');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test 2: Trigger same error with different UUID/timestamp
  console.log('Test 2: Triggering same error with different dynamic values...');
  try {
    throw new Error('Test error for fingerprinting');
  } catch (error) {
    logger.error('Test error for fingerprinting', {
      stack: error instanceof Error ? error.stack : undefined,
      userId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      timestamp: '2024-01-16T12:05:00Z',
      attemptCount: 2,
    });
  }

  console.log('✓ Second error logged (should increment occurrenceCount)\n');

  // Wait 2 seconds to allow database write
  console.log('Waiting 2 seconds for database write...\n');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test 3: Different error (should create new entry)
  console.log('Test 3: Triggering different error...');
  logger.error('Different error message for testing', {
    errorCode: 'DB_CONNECTION_FAILED',
    retryCount: 3,
  });

  console.log('✓ Different error logged (should create new entry)\n');

  // Wait 2 seconds to allow database write
  console.log('Waiting 2 seconds for final database write...\n');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('=== Test Complete ===\n');
  console.log('Verify in database:');
  console.log('SELECT fingerprint, message, occurrence_count, first_seen_at, last_seen_at');
  console.log('FROM error_logs');
  console.log('ORDER BY created_at DESC');
  console.log('LIMIT 5;\n');

  console.log('Expected results:');
  console.log('1. Entry with message "Different error message for testing" (occurrence_count = 1)');
  console.log('2. Entry with message "Test error for fingerprinting" (occurrence_count = 2)');
  console.log('   - Both occurrences should have same fingerprint');
  console.log('   - metadata should contain lastOccurrenceMetadata from second error\n');

  process.exit(0);
}

// Run test
testErrorCapture().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
