-- Verification script for error capture testing
-- Run this after executing test-error-capture.ts

-- Show recent error logs with fingerprint grouping
SELECT
  fingerprint,
  message,
  level,
  service,
  occurrence_count,
  status,
  first_seen_at,
  last_seen_at,
  created_at,
  metadata
FROM error_logs
ORDER BY created_at DESC
LIMIT 10;

-- Count errors by fingerprint (should show deduplication)
SELECT
  fingerprint,
  message,
  COUNT(*) as entry_count,
  SUM(occurrence_count) as total_occurrences,
  MIN(first_seen_at) as earliest,
  MAX(last_seen_at) as latest
FROM error_logs
GROUP BY fingerprint, message
ORDER BY total_occurrences DESC
LIMIT 10;
