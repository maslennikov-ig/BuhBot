/**
 * Tests for adaptive duration formatter and SLA excess calculator (gh-290).
 */

import { describe, it, expect } from 'vitest';
import { formatDuration, computeSlaExcessMinutes, isSlaExcessSevere } from '../format-duration';

describe('formatDuration', () => {
  it('returns "-" for null, undefined, NaN, negative', () => {
    expect(formatDuration(null)).toBe('-');
    expect(formatDuration(undefined)).toBe('-');
    expect(formatDuration(Number.NaN)).toBe('-');
    expect(formatDuration(-10)).toBe('-');
  });

  it('renders minutes-only below 1 hour', () => {
    expect(formatDuration(0)).toBe('0м');
    expect(formatDuration(5)).toBe('5м');
    expect(formatDuration(59)).toBe('59м');
  });

  it('renders hours (+ minutes when non-zero) below 1 day', () => {
    expect(formatDuration(60)).toBe('1ч');
    expect(formatDuration(75)).toBe('1ч 15м');
    expect(formatDuration(23 * 60 + 59)).toBe('23ч 59м');
  });

  it('renders days (+ hours when non-zero) below 1 week', () => {
    expect(formatDuration(24 * 60)).toBe('1д');
    expect(formatDuration(24 * 60 + 60)).toBe('1д 1ч');
    expect(formatDuration(3 * 24 * 60 + 4 * 60 + 30)).toBe('3д 4ч');
  });

  it('renders weeks (+ days when non-zero) at 1 week and above', () => {
    expect(formatDuration(7 * 24 * 60)).toBe('1н');
    expect(formatDuration(8 * 24 * 60)).toBe('1н 1д');
    expect(formatDuration(14 * 24 * 60 + 3 * 24 * 60)).toBe('2н 3д');
  });

  it('truncates fractional minutes down', () => {
    expect(formatDuration(75.9)).toBe('1ч 15м');
  });
});

describe('computeSlaExcessMinutes', () => {
  const now = new Date('2026-04-17T12:00:00Z');

  it('returns null when receivedAt is missing', () => {
    expect(
      computeSlaExcessMinutes({
        receivedAt: null,
        responseAt: null,
        slaMinutes: 60,
        now,
      })
    ).toBeNull();
  });

  it('uses responseAt when present (answered breach)', () => {
    const receivedAt = new Date('2026-04-17T10:00:00Z');
    const responseAt = new Date('2026-04-17T11:45:00Z'); // 105 min after receipt, SLA 60 → excess 45
    expect(
      computeSlaExcessMinutes({
        receivedAt,
        responseAt,
        slaBreachedAt: null,
        slaMinutes: 60,
        now,
      })
    ).toBe(45);
  });

  it('falls back to slaBreachedAt when no response yet', () => {
    const receivedAt = new Date('2026-04-17T08:00:00Z');
    const slaBreachedAt = new Date('2026-04-17T09:00:00Z'); // 60 min, SLA 30 → excess 30
    expect(
      computeSlaExcessMinutes({
        receivedAt,
        responseAt: null,
        slaBreachedAt,
        slaMinutes: 30,
        now,
      })
    ).toBe(30);
  });

  it('uses now when both responseAt and slaBreachedAt are absent', () => {
    const receivedAt = new Date('2026-04-17T09:00:00Z'); // 180 min ago, SLA 60 → excess 120
    expect(
      computeSlaExcessMinutes({
        receivedAt,
        responseAt: null,
        slaBreachedAt: null,
        slaMinutes: 60,
        now,
      })
    ).toBe(120);
  });

  // gh-290 follow-up: legacy rows created before migration
  // 20260417000000_add_sla_breached_at have slaBreachedAt = null even when
  // they are clearly breached (responseAt = null AND now > receivedAt + SLA).
  // The formula must still return positive excess by falling through to
  // `now` when both responseAt and slaBreachedAt are absent. Without this
  // guarantee, the /violations page would render "+0м" for old open
  // breaches (Dahgoth's symptom).
  it('legacy unanswered row (slaBreachedAt=null, responseAt=null, old receivedAt) returns positive excess', () => {
    // Received 2 days before `now`, SLA 60 min → excess = 2*24*60 - 60 = 2820 min.
    const receivedAt = new Date('2026-04-15T12:00:00Z');
    expect(
      computeSlaExcessMinutes({
        receivedAt,
        responseAt: null,
        slaBreachedAt: null,
        slaMinutes: 60,
        now,
      })
    ).toBe(2 * 24 * 60 - 60); // 2820 minutes
  });

  // Mirror case for legacy answered row: responseAt is present but
  // slaBreachedAt was never written (pre-migration). Excess must be
  // (responseAt - receivedAt) - slaMinutes, NOT 0.
  it('legacy answered row (slaBreachedAt=null, responseAt present) returns excess from responseAt', () => {
    const receivedAt = new Date('2026-04-17T08:00:00Z');
    const responseAt = new Date('2026-04-17T11:30:00Z'); // 210 min after receipt, SLA 60 → excess 150
    expect(
      computeSlaExcessMinutes({
        receivedAt,
        responseAt,
        slaBreachedAt: null,
        slaMinutes: 60,
        now,
      })
    ).toBe(150);
  });

  it('clamps to 0 when elapsed is within SLA threshold', () => {
    const receivedAt = new Date('2026-04-17T11:55:00Z'); // 5 min ago, SLA 60 → 0
    expect(
      computeSlaExcessMinutes({
        receivedAt,
        responseAt: null,
        slaBreachedAt: null,
        slaMinutes: 60,
        now,
      })
    ).toBe(0);
  });

  it('accepts ISO strings for any timestamp input', () => {
    expect(
      computeSlaExcessMinutes({
        receivedAt: '2026-04-17T10:00:00.000Z',
        responseAt: '2026-04-17T11:45:00.000Z',
        slaMinutes: 60,
        now,
      })
    ).toBe(45);
  });
});

describe('isSlaExcessSevere', () => {
  it('false for null excess', () => {
    expect(isSlaExcessSevere(null, 60)).toBe(false);
  });

  it('flags severe at 2x the SLA threshold', () => {
    expect(isSlaExcessSevere(119, 60)).toBe(false);
    expect(isSlaExcessSevere(120, 60)).toBe(true);
    expect(isSlaExcessSevere(500, 60)).toBe(true);
  });

  it('uses a 1h floor when slaMinutes ≤ 0 (defensive, should not happen in prod)', () => {
    expect(isSlaExcessSevere(59, 0)).toBe(false);
    expect(isSlaExcessSevere(60, 0)).toBe(true);
  });
});
