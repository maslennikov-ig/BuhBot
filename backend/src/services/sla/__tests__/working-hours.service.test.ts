/**
 * Working Hours Service Tests
 *
 * Comprehensive real-logic tests for working-hours.service.ts.
 * No mocking of functions under test — only the logger is mocked
 * to prevent console noise during the test run.
 *
 * Date constants (all UTC, Moscow = UTC+3):
 *   Mon 2025-01-06, Tue 2025-01-07, Fri 2025-01-10,
 *   Sat 2025-01-11, Sun 2025-01-12, Mon 2025-01-13
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger before importing the service so the hoisted mock is in place
vi.mock('../../../utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  isWorkingTime,
  getNextWorkingTime,
  calculateWorkingMinutes,
  calculateDelayUntilBreach,
  DEFAULT_WORKING_SCHEDULE,
  type WorkingSchedule,
} from '../working-hours.service.js';

// ---------------------------------------------------------------------------
// Shared schedule helpers
// ---------------------------------------------------------------------------

/** Standard Mon-Fri 09:00-18:00 Moscow schedule (mirrors DEFAULT_WORKING_SCHEDULE) */
const MOSCOW_SCHEDULE: WorkingSchedule = {
  timezone: 'Europe/Moscow',
  workingDays: [1, 2, 3, 4, 5], // 1=Mon … 5=Fri
  startTime: '09:00',
  endTime: '18:00',
  holidays: [],
  is24x7: false,
};

/** 24/7 schedule variant */
const SCHEDULE_24x7: WorkingSchedule = {
  ...MOSCOW_SCHEDULE,
  is24x7: true,
};

/**
 * Build a Date from an ISO-8601 UTC string.
 * Helper to keep test bodies concise and avoid repeated `new Date(...)`.
 */
function utc(isoUtc: string): Date {
  return new Date(isoUtc);
}

// ---------------------------------------------------------------------------
// isWorkingTime
// ---------------------------------------------------------------------------

describe('isWorkingTime', () => {
  it('1. Monday 10:00 Moscow (07:00 UTC) → true', () => {
    // Mon 2025-01-06, 10:00 Moscow = 07:00 UTC
    const date = utc('2025-01-06T07:00:00.000Z');
    expect(isWorkingTime(date, MOSCOW_SCHEDULE)).toBe(true);
  });

  it('2. Monday 08:59 Moscow (05:59 UTC) → false (before working hours start)', () => {
    // Mon 2025-01-06, 08:59 Moscow = 05:59 UTC
    const date = utc('2025-01-06T05:59:00.000Z');
    expect(isWorkingTime(date, MOSCOW_SCHEDULE)).toBe(false);
  });

  it('3. Monday 18:00 Moscow (15:00 UTC) → false (end boundary is exclusive)', () => {
    // Mon 2025-01-06, 18:00 Moscow = 15:00 UTC
    const date = utc('2025-01-06T15:00:00.000Z');
    expect(isWorkingTime(date, MOSCOW_SCHEDULE)).toBe(false);
  });

  it('4. Monday 17:59 Moscow (14:59 UTC) → true (one minute before end)', () => {
    // Mon 2025-01-06, 17:59 Moscow = 14:59 UTC
    const date = utc('2025-01-06T14:59:00.000Z');
    expect(isWorkingTime(date, MOSCOW_SCHEDULE)).toBe(true);
  });

  it('5. Saturday 12:00 Moscow (09:00 UTC) → false (weekend)', () => {
    // Sat 2025-01-11, 12:00 Moscow = 09:00 UTC
    const date = utc('2025-01-11T09:00:00.000Z');
    expect(isWorkingTime(date, MOSCOW_SCHEDULE)).toBe(false);
  });

  it('6. Sunday 12:00 Moscow (09:00 UTC) → false (weekend)', () => {
    // Sun 2025-01-12, 12:00 Moscow = 09:00 UTC
    const date = utc('2025-01-12T09:00:00.000Z');
    expect(isWorkingTime(date, MOSCOW_SCHEDULE)).toBe(false);
  });

  it('7. 24/7 mode → always true regardless of day/time', () => {
    // Saturday midnight — would be false under a normal schedule
    const saturday = utc('2025-01-11T00:00:00.000Z');
    expect(isWorkingTime(saturday, SCHEDULE_24x7)).toBe(true);

    // Sunday 03:00
    const sundayNight = utc('2025-01-12T03:00:00.000Z');
    expect(isWorkingTime(sundayNight, SCHEDULE_24x7)).toBe(true);
  });

  it('8. Holiday date → false even if weekday and within hours', () => {
    // Mon 2025-01-06 declared as holiday
    const holidayDate = utc('2025-01-06T00:00:00.000Z'); // any time on that day
    const scheduleWithHoliday: WorkingSchedule = {
      ...MOSCOW_SCHEDULE,
      holidays: [holidayDate],
    };

    // 10:00 Moscow on that Monday
    const mondayTen = utc('2025-01-06T07:00:00.000Z');
    expect(isWorkingTime(mondayTen, scheduleWithHoliday)).toBe(false);
  });

  it('9. UTC 06:00 on Monday = 09:00 Moscow → true (timezone conversion)', () => {
    // Moscow is UTC+3; 06:00 UTC = 09:00 Moscow = exact start of working day
    // Start boundary is inclusive (>= workStart)
    const date = utc('2025-01-06T06:00:00.000Z');
    expect(isWorkingTime(date, MOSCOW_SCHEDULE)).toBe(true);
  });

  it('9b. UTC 05:59 on Monday = 08:59 Moscow → false (1 minute before start)', () => {
    const date = utc('2025-01-06T05:59:00.000Z');
    expect(isWorkingTime(date, MOSCOW_SCHEDULE)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getNextWorkingTime
// ---------------------------------------------------------------------------

describe('getNextWorkingTime', () => {
  it('1. Friday 17:55 Moscow → same time returned (still within working hours)', () => {
    // Fri 2025-01-10, 17:55 Moscow = 14:55 UTC
    const fri1755 = utc('2025-01-10T14:55:00.000Z');
    const result = getNextWorkingTime(fri1755, MOSCOW_SCHEDULE);
    expect(result.getTime()).toBe(fri1755.getTime());
  });

  it('2. Friday 18:05 Moscow → next Monday 09:00 Moscow', () => {
    // Fri 2025-01-10, 18:05 Moscow = 15:05 UTC
    const fri1805 = utc('2025-01-10T15:05:00.000Z');
    const result = getNextWorkingTime(fri1805, MOSCOW_SCHEDULE);

    // Expected: Mon 2025-01-13, 09:00 Moscow = 06:00 UTC
    const mon0900 = utc('2025-01-13T06:00:00.000Z');
    expect(result.getTime()).toBe(mon0900.getTime());
  });

  it('3. Saturday 12:00 Moscow → next Monday 09:00 Moscow', () => {
    // Sat 2025-01-11, 12:00 Moscow = 09:00 UTC
    const sat1200 = utc('2025-01-11T09:00:00.000Z');
    const result = getNextWorkingTime(sat1200, MOSCOW_SCHEDULE);

    const mon0900 = utc('2025-01-13T06:00:00.000Z');
    expect(result.getTime()).toBe(mon0900.getTime());
  });

  it('4. Sunday 23:59 Moscow → next Monday 09:00 Moscow', () => {
    // Sun 2025-01-12, 23:59 Moscow = 20:59 UTC
    const sun2359 = utc('2025-01-12T20:59:00.000Z');
    const result = getNextWorkingTime(sun2359, MOSCOW_SCHEDULE);

    const mon0900 = utc('2025-01-13T06:00:00.000Z');
    expect(result.getTime()).toBe(mon0900.getTime());
  });

  it('5. Monday 07:00 Moscow (04:00 UTC) → same Monday 09:00 Moscow (before work start)', () => {
    // Mon 2025-01-06, 07:00 Moscow = 04:00 UTC
    const mon0700 = utc('2025-01-06T04:00:00.000Z');
    const result = getNextWorkingTime(mon0700, MOSCOW_SCHEDULE);

    // Expected: same day 09:00 Moscow = 06:00 UTC
    const mon0900 = utc('2025-01-06T06:00:00.000Z');
    expect(result.getTime()).toBe(mon0900.getTime());
  });

  it('6. Holiday Monday → next Tuesday 09:00 Moscow', () => {
    // Mon 2025-01-06 is a holiday
    const holiday = utc('2025-01-06T00:00:00.000Z');
    const scheduleWithHoliday: WorkingSchedule = {
      ...MOSCOW_SCHEDULE,
      holidays: [holiday],
    };

    // Requesting next working time from Monday 10:00 Moscow (07:00 UTC)
    const mon1000 = utc('2025-01-06T07:00:00.000Z');
    const result = getNextWorkingTime(mon1000, scheduleWithHoliday);

    // Expected: Tue 2025-01-07, 09:00 Moscow = 06:00 UTC
    const tue0900 = utc('2025-01-07T06:00:00.000Z');
    expect(result.getTime()).toBe(tue0900.getTime());
  });

  it('7. 24/7 mode → returns the same time unchanged', () => {
    const saturday = utc('2025-01-11T03:30:00.000Z');
    const result = getNextWorkingTime(saturday, SCHEDULE_24x7);
    expect(result.getTime()).toBe(saturday.getTime());
  });

  it('8. Multiple consecutive holidays → skips all, returns first available 09:00', () => {
    // Mon 2025-01-06 and Tue 2025-01-07 are both holidays
    const scheduleWithHolidays: WorkingSchedule = {
      ...MOSCOW_SCHEDULE,
      holidays: [
        utc('2025-01-06T00:00:00.000Z'), // Monday
        utc('2025-01-07T00:00:00.000Z'), // Tuesday
      ],
    };

    // From Monday 10:00 Moscow (07:00 UTC)
    const mon1000 = utc('2025-01-06T07:00:00.000Z');
    const result = getNextWorkingTime(mon1000, scheduleWithHolidays);

    // Expected: Wed 2025-01-08, 09:00 Moscow = 06:00 UTC
    const wed0900 = utc('2025-01-08T06:00:00.000Z');
    expect(result.getTime()).toBe(wed0900.getTime());
  });
});

// ---------------------------------------------------------------------------
// calculateWorkingMinutes
// ---------------------------------------------------------------------------

describe('calculateWorkingMinutes', () => {
  it('1. Same day: Mon 10:00 → Mon 11:00 = 60 min', () => {
    const start = utc('2025-01-06T07:00:00.000Z'); // 10:00 Moscow
    const end = utc('2025-01-06T08:00:00.000Z'); // 11:00 Moscow
    expect(calculateWorkingMinutes(start, end, MOSCOW_SCHEDULE)).toBe(60);
  });

  it('2. Cross-day: Mon 17:00 → Tue 10:00 = 120 min (60 Mon + 60 Tue)', () => {
    const start = utc('2025-01-06T14:00:00.000Z'); // Mon 17:00 Moscow
    const end = utc('2025-01-07T07:00:00.000Z'); // Tue 10:00 Moscow
    expect(calculateWorkingMinutes(start, end, MOSCOW_SCHEDULE)).toBe(120);
  });

  it('3. Fri 17:55 → Mon 09:05 = 10 min (5 Fri + 5 Mon)', () => {
    const start = utc('2025-01-10T14:55:00.000Z'); // Fri 17:55 Moscow
    const end = utc('2025-01-13T06:05:00.000Z'); // Mon 09:05 Moscow
    expect(calculateWorkingMinutes(start, end, MOSCOW_SCHEDULE)).toBe(10);
  });

  it('4. Start before work: Mon 07:00 → Mon 10:00 = 60 min (only 09:00-10:00 counts)', () => {
    const start = utc('2025-01-06T04:00:00.000Z'); // Mon 07:00 Moscow
    const end = utc('2025-01-06T07:00:00.000Z'); // Mon 10:00 Moscow
    // Only 09:00-10:00 is within working hours = 60 min
    expect(calculateWorkingMinutes(start, end, MOSCOW_SCHEDULE)).toBe(60);
  });

  it('5. End after work: Mon 10:00 → Mon 19:00 = 480 min (10:00-18:00 = 8h)', () => {
    const start = utc('2025-01-06T07:00:00.000Z'); // Mon 10:00 Moscow
    const end = utc('2025-01-06T16:00:00.000Z'); // Mon 19:00 Moscow
    // Only 10:00-18:00 counts = 480 min
    expect(calculateWorkingMinutes(start, end, MOSCOW_SCHEDULE)).toBe(480);
  });

  it('6. Entire weekend: Fri 18:00 → Mon 09:00 = 0 min', () => {
    const start = utc('2025-01-10T15:00:00.000Z'); // Fri 18:00 Moscow (exclusive end)
    const end = utc('2025-01-13T06:00:00.000Z'); // Mon 09:00 Moscow
    expect(calculateWorkingMinutes(start, end, MOSCOW_SCHEDULE)).toBe(0);
  });

  it('7. With holiday: Mon(holiday) 10:00 → Tue 10:00 = 60 min (Mon skipped)', () => {
    const holiday = utc('2025-01-06T00:00:00.000Z'); // Monday
    const scheduleWithHoliday: WorkingSchedule = {
      ...MOSCOW_SCHEDULE,
      holidays: [holiday],
    };

    const start = utc('2025-01-06T07:00:00.000Z'); // Mon 10:00 Moscow
    const end = utc('2025-01-07T07:00:00.000Z'); // Tue 10:00 Moscow
    // Monday is a holiday, so 0 Mon + 60 Tue = 60 min
    expect(calculateWorkingMinutes(start, end, scheduleWithHoliday)).toBe(60);
  });

  it('8. end < start → 0 (edge case guard)', () => {
    const start = utc('2025-01-06T10:00:00.000Z');
    const end = utc('2025-01-06T08:00:00.000Z'); // before start
    expect(calculateWorkingMinutes(start, end, MOSCOW_SCHEDULE)).toBe(0);
  });

  it('9. 24/7 mode: working minutes = simple minute diff', () => {
    const start = utc('2025-01-11T22:00:00.000Z'); // Saturday night
    const end = utc('2025-01-12T01:00:00.000Z'); // Sunday early morning
    // 3 hours = 180 min, no schedule restriction in 24/7 mode
    expect(calculateWorkingMinutes(start, end, SCHEDULE_24x7)).toBe(180);
  });

  it('10. Full work week: Mon 09:00 → Fri 18:00 = 2700 min (5 days × 9h × 60)', () => {
    const start = utc('2025-01-06T06:00:00.000Z'); // Mon 09:00 Moscow
    const end = utc('2025-01-10T15:00:00.000Z'); // Fri 18:00 Moscow
    // 5 days × 540 min/day = 2700 min
    expect(calculateWorkingMinutes(start, end, MOSCOW_SCHEDULE)).toBe(2700);
  });

  it('11. start === end → 0 min', () => {
    const point = utc('2025-01-06T07:00:00.000Z');
    expect(calculateWorkingMinutes(point, point, MOSCOW_SCHEDULE)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateDelayUntilBreach
// ---------------------------------------------------------------------------

describe('calculateDelayUntilBreach', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. 24/7 mode, 60 min threshold → delay ≈ 60 min in ms', () => {
    // "Now" = Mon 10:00 Moscow
    const now = utc('2025-01-06T07:00:00.000Z');
    vi.setSystemTime(now);

    // Request received at the same instant ("now")
    const receivedAt = now;
    const delay = calculateDelayUntilBreach(receivedAt, 60, SCHEDULE_24x7);

    // In 24/7 mode: breach = receivedAt + 60 min; delay = breach - now = 60 min
    expect(delay).toBe(60 * 60 * 1000);
  });

  it('2. During working hours, 60 min threshold → delay ≈ 60 min in ms', () => {
    // "Now" = Mon 10:00 Moscow (07:00 UTC)
    const now = utc('2025-01-06T07:00:00.000Z');
    vi.setSystemTime(now);

    const receivedAt = now; // received exactly now
    const delay = calculateDelayUntilBreach(receivedAt, 60, MOSCOW_SCHEDULE);

    // Working time: Mon 10:00 + 60 working min = Mon 11:00
    // delay = Mon 11:00 - Mon 10:00 = 60 min
    expect(delay).toBe(60 * 60 * 1000);
  });

  it('3. At Fri 17:55 with 10 min threshold → breach fires Mon 09:05 Moscow', () => {
    // "Now" = Fri 17:55 Moscow (14:55 UTC)
    const now = utc('2025-01-10T14:55:00.000Z');
    vi.setSystemTime(now);

    const receivedAt = now;
    const delay = calculateDelayUntilBreach(receivedAt, 10, MOSCOW_SCHEDULE);

    // 5 working min remain on Friday (17:55 → 18:00), then 5 min on Monday (09:00 → 09:05)
    // Breach at Mon 2025-01-13 09:05 Moscow = 06:05 UTC
    const expectedBreach = utc('2025-01-13T06:05:00.000Z');
    const expectedDelay = expectedBreach.getTime() - now.getTime();
    expect(delay).toBe(expectedDelay);
  });

  it('4. Already breached → delay = 0', () => {
    // "Now" is well after the breach would have occurred
    // Request received 2 hours ago during working hours; threshold = 30 min
    const receivedAt = utc('2025-01-06T07:00:00.000Z'); // Mon 10:00 Moscow
    // "Now" = Mon 12:00 Moscow (09:00 UTC) — 2 h later; breach was at 10:30
    const now = utc('2025-01-06T09:00:00.000Z');
    vi.setSystemTime(now);

    const delay = calculateDelayUntilBreach(receivedAt, 30, MOSCOW_SCHEDULE);
    expect(delay).toBe(0);
  });

  it('5. Received outside working hours → delay accounts for gap to next working start', () => {
    // Request received on Friday 18:05 Moscow (15:05 UTC)
    const receivedAt = utc('2025-01-10T15:05:00.000Z');
    // "Now" is the same moment (just received)
    vi.setSystemTime(receivedAt);

    // 60 min threshold: first working minute starts Mon 09:00 → breach Mon 10:00
    const delay = calculateDelayUntilBreach(receivedAt, 60, MOSCOW_SCHEDULE);

    // Breach time = Mon 2025-01-13 10:00 Moscow = 07:00 UTC
    const expectedBreach = utc('2025-01-13T07:00:00.000Z');
    const expectedDelay = expectedBreach.getTime() - receivedAt.getTime();
    expect(delay).toBe(expectedDelay);
  });

  it('6. 24/7 mode: already breached → delay = 0', () => {
    const receivedAt = utc('2025-01-06T07:00:00.000Z');
    // Now is 2 hours after, threshold is 30 min
    vi.setSystemTime(utc('2025-01-06T09:00:00.000Z'));

    const delay = calculateDelayUntilBreach(receivedAt, 30, SCHEDULE_24x7);
    expect(delay).toBe(0);
  });

  it('7. With holiday: Friday 17:50 + 20 min threshold → skips holiday Monday, breaches Tue 09:10', () => {
    // Mon 2025-01-13 is a holiday
    const holiday = utc('2025-01-13T00:00:00.000Z');
    const scheduleWithHoliday: WorkingSchedule = {
      ...MOSCOW_SCHEDULE,
      holidays: [holiday],
    };

    // "Now" = Fri 2025-01-10, 17:50 Moscow (14:50 UTC)
    const now = utc('2025-01-10T14:50:00.000Z');
    vi.setSystemTime(now);

    // Request received at the same instant; 20 min threshold
    // 10 min left on Friday (17:50 → 18:00), then Monday is holiday,
    // remaining 10 min on Tuesday 09:00 → 09:10
    const receivedAt = now;
    const delay = calculateDelayUntilBreach(receivedAt, 20, scheduleWithHoliday);

    // Breach at Tue 2025-01-14, 09:10 Moscow = 06:10 UTC
    const expectedBreach = utc('2025-01-14T06:10:00.000Z');
    const expectedDelay = expectedBreach.getTime() - now.getTime();
    expect(delay).toBe(expectedDelay);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_WORKING_SCHEDULE export sanity
// ---------------------------------------------------------------------------

describe('DEFAULT_WORKING_SCHEDULE', () => {
  it('has expected shape and values', () => {
    expect(DEFAULT_WORKING_SCHEDULE.timezone).toBe('Europe/Moscow');
    expect(DEFAULT_WORKING_SCHEDULE.workingDays).toEqual([1, 2, 3, 4, 5]);
    expect(DEFAULT_WORKING_SCHEDULE.startTime).toBe('09:00');
    expect(DEFAULT_WORKING_SCHEDULE.endTime).toBe('18:00');
    expect(DEFAULT_WORKING_SCHEDULE.holidays).toEqual([]);
    expect(DEFAULT_WORKING_SCHEDULE.is24x7).toBe(false);
  });

  it('isWorkingTime uses DEFAULT_WORKING_SCHEDULE when no schedule arg provided', () => {
    // Mon 10:00 Moscow = 07:00 UTC — should be true with default schedule
    const date = utc('2025-01-06T07:00:00.000Z');
    expect(isWorkingTime(date)).toBe(true);
  });
});
