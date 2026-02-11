/**
 * Analytics Router Regression Tests
 *
 * These tests prevent regressions in the SLA field naming bug fix.
 * They verify that analytics.ts uses the correct field name (slaThresholdMinutes)
 * and not the deprecated field (slaResponseMinutes).
 *
 * @see https://github.com/maslennikov-ig/BuhBot/issues/[ISSUE_NUMBER]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

describe('Analytics SLA field regression', () => {
  const analyticsSource = readFileSync(resolve(__dirname, '../analytics.ts'), 'utf-8');

  it('should NOT reference deprecated slaResponseMinutes field', () => {
    expect(analyticsSource).not.toContain('slaResponseMinutes');
  });

  it('should use slaThresholdMinutes for SLA calculations', () => {
    expect(analyticsSource).toContain('slaThresholdMinutes');
  });
});
