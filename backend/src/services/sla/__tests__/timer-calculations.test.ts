/**
 * SLA Timer Calculations — Integration Tests
 *
 * Tests the REAL delay calculation logic inside startSlaTimer by letting
 * calculateDelayUntilBreach and calculateWorkingMinutes run without mocks.
 * Only I/O layers (Prisma, BullMQ queues, config service) are mocked.
 *
 * Timezone reference: Moscow = UTC+3
 *   Monday    2025-01-27
 *   Friday    2025-01-31
 *   Saturday  2025-02-01
 *   Sunday    2025-02-02
 *   Monday    2025-02-03
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// I/O Mocks (defined with vi.hoisted so they are available when vi.mock runs)
// ---------------------------------------------------------------------------

const mockScheduleSlaCheck = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockScheduleSlaWarning = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetGlobalSettings = vi.hoisted(
  () => vi.fn().mockResolvedValue({ slaWarningPercent: 0 }) // disable warning to simplify
);

const mockPrisma = vi.hoisted(() => ({
  chat: {
    findFirst: vi.fn(),
  },
  workingSchedule: {
    findMany: vi.fn(),
  },
  globalSettings: {
    findUnique: vi.fn(),
  },
  clientRequest: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));

vi.mock('../../../queues/setup.js', () => ({
  scheduleSlaCheck: mockScheduleSlaCheck,
  scheduleSlaWarning: mockScheduleSlaWarning,
  cancelSlaCheck: vi.fn().mockResolvedValue(true),
  cancelSlaWarning: vi.fn().mockResolvedValue(true),
  slaTimerQueue: { getJob: vi.fn() },
  queueAlert: vi.fn(),
}));

vi.mock('../../../config/config.service.js', () => ({
  getGlobalSettings: mockGetGlobalSettings,
  getSlaWarningPercent: vi.fn().mockResolvedValue(0),
}));

vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks — working-hours.service is NOT mocked (real logic runs)
// ---------------------------------------------------------------------------
import { startSlaTimer } from '../timer.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tolerance window for delay assertions: ±5 seconds in ms */
const TOLERANCE_MS = 5_000;

function expectDelayClose(actual: number, expected: number, label: string): void {
  const diff = Math.abs(actual - expected);
  expect(
    diff,
    `${label}: delay ${actual}ms differs from expected ${expected}ms by ${diff}ms`
  ).toBeLessThanOrEqual(TOLERANCE_MS);
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('SLA Timer — real delay calculations (working-hours not mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Scenario 1: 24/7 mode — request received 5 minutes ago
  // -------------------------------------------------------------------------
  describe('Scenario 1: 24/7 mode', () => {
    it('should fire in ~55 min when received 5 min ago with 60 min threshold', async () => {
      // Wednesday 2025-01-29 10:00:00 Moscow = 07:00:00 UTC
      const now = new Date('2025-01-29T07:00:00.000Z');
      vi.setSystemTime(now);

      const receivedAt = new Date(now.getTime() - 5 * 60 * 1000); // 5 min ago

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: true });
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        chatId: BigInt(-1001234567890),
        receivedAt,
      });

      await startSlaTimer('req-1', '-1001234567890', 60);

      expect(mockScheduleSlaCheck).toHaveBeenCalledOnce();
      const delayMs: number = mockScheduleSlaCheck.mock.calls[0][3];

      // In 24/7 mode: breach = receivedAt + 60 min. Elapsed = 5 min. Remaining = 55 min.
      const expected = 55 * 60 * 1000; // 3_300_000 ms
      expectDelayClose(delayMs, expected, 'Scenario 1');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Business hours — request received exactly at 10:00 Moscow Mon
  // -------------------------------------------------------------------------
  describe('Scenario 2: Business hours, request received now at 10:00 Moscow Monday', () => {
    it('should fire in ~60 min when received now during working hours', async () => {
      // Monday 2025-01-27 10:00:00 Moscow = 07:00:00 UTC
      const now = new Date('2025-01-27T07:00:00.000Z');
      vi.setSystemTime(now);

      const receivedAt = now; // received right now

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: false });
      mockPrisma.workingSchedule.findMany.mockResolvedValue([]);
      mockPrisma.globalSettings.findUnique.mockResolvedValue({
        defaultTimezone: 'Europe/Moscow',
        defaultWorkingDays: [1, 2, 3, 4, 5], // Mon-Fri
        defaultStartTime: '09:00',
        defaultEndTime: '18:00',
      });
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-2',
        chatId: BigInt(-1001234567890),
        receivedAt,
      });

      await startSlaTimer('req-2', '-1001234567890', 60);

      expect(mockScheduleSlaCheck).toHaveBeenCalledOnce();
      const delayMs: number = mockScheduleSlaCheck.mock.calls[0][3];

      // Received at 10:00, working hours 09:00-18:00, threshold 60 min → breach 11:00
      // Delay from "now" (10:00) to 11:00 = 60 min
      const expected = 60 * 60 * 1000; // 3_600_000 ms
      expectDelayClose(delayMs, expected, 'Scenario 2');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Near end of working day (Friday 17:30 Moscow, threshold 60 min)
  // -------------------------------------------------------------------------
  describe('Scenario 3: Near end of Friday — breach wraps to Monday morning', () => {
    it('should fire Monday 09:30 Moscow when received Friday 17:30 Moscow (60 min threshold)', async () => {
      // Friday 2025-01-31 17:30:00 Moscow = 14:30:00 UTC
      const now = new Date('2025-01-31T14:30:00.000Z');
      vi.setSystemTime(now);

      const receivedAt = now; // received right now

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: false });
      mockPrisma.workingSchedule.findMany.mockResolvedValue([]);
      mockPrisma.globalSettings.findUnique.mockResolvedValue({
        defaultTimezone: 'Europe/Moscow',
        defaultWorkingDays: [1, 2, 3, 4, 5],
        defaultStartTime: '09:00',
        defaultEndTime: '18:00',
      });
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-3',
        chatId: BigInt(-1001234567890),
        receivedAt,
      });

      await startSlaTimer('req-3', '-1001234567890', 60);

      expect(mockScheduleSlaCheck).toHaveBeenCalledOnce();
      const delayMs: number = mockScheduleSlaCheck.mock.calls[0][3];

      // At 17:30 Moscow, 30 working minutes remain until 18:00.
      // 60 min threshold: 30 min consumed today (17:30→18:00), 30 min on Monday (09:00→09:30).
      // Breach time = Monday 2025-02-03 09:30:00 Moscow = 06:30:00 UTC
      const breachTime = new Date('2025-02-03T06:30:00.000Z');
      const expected = breachTime.getTime() - now.getTime();

      expectDelayClose(delayMs, expected, 'Scenario 3');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Outside working hours (Friday 20:00 Moscow, threshold 60 min)
  // -------------------------------------------------------------------------
  describe('Scenario 4: Outside working hours — breach is Monday 10:00 Moscow', () => {
    it('should fire Monday 10:00 Moscow when received Friday 20:00 Moscow (60 min threshold)', async () => {
      // Friday 2025-01-31 20:00:00 Moscow = 17:00:00 UTC
      const now = new Date('2025-01-31T17:00:00.000Z');
      vi.setSystemTime(now);

      const receivedAt = now;

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: false });
      mockPrisma.workingSchedule.findMany.mockResolvedValue([]);
      mockPrisma.globalSettings.findUnique.mockResolvedValue({
        defaultTimezone: 'Europe/Moscow',
        defaultWorkingDays: [1, 2, 3, 4, 5],
        defaultStartTime: '09:00',
        defaultEndTime: '18:00',
      });
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-4',
        chatId: BigInt(-1001234567890),
        receivedAt,
      });

      await startSlaTimer('req-4', '-1001234567890', 60);

      expect(mockScheduleSlaCheck).toHaveBeenCalledOnce();
      const delayMs: number = mockScheduleSlaCheck.mock.calls[0][3];

      // Received at 20:00 Moscow (outside hours). Next working time = Monday 09:00 Moscow.
      // 60 working minutes from 09:00 → breach at 10:00 Monday.
      // Breach time = Monday 2025-02-03 10:00:00 Moscow = 07:00:00 UTC
      const breachTime = new Date('2025-02-03T07:00:00.000Z');
      const expected = breachTime.getTime() - now.getTime();

      expectDelayClose(delayMs, expected, 'Scenario 4');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Custom chat schedule (Sat-Sun 10:00-16:00)
  // -------------------------------------------------------------------------
  describe('Scenario 5: Custom chat schedule (Sat-Sun only, 10:00-16:00 Moscow)', () => {
    it('should use custom schedule and fire at correct time on Saturday', async () => {
      // Saturday 2025-02-01 10:30:00 Moscow = 07:30:00 UTC (during custom hours)
      const now = new Date('2025-02-01T07:30:00.000Z');
      vi.setSystemTime(now);

      const receivedAt = now; // received right now

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: false });

      // Chat has custom Sat+Sun schedule, 10:00-16:00 Moscow
      // WorkingSchedule stores TIME columns as Dates; UTC hours represent the local time
      // because the service uses startTime.getUTCHours() to format "HH:mm"
      mockPrisma.workingSchedule.findMany.mockResolvedValue([
        {
          dayOfWeek: 6, // Saturday (ISO: 6)
          startTime: new Date('1970-01-01T10:00:00.000Z'), // 10:00 UTC → "10:00"
          endTime: new Date('1970-01-01T16:00:00.000Z'), // 16:00 UTC → "16:00"
          timezone: 'Europe/Moscow',
          isActive: true,
        },
        {
          dayOfWeek: 0, // Sunday (stored as 0 in workingDays)
          startTime: new Date('1970-01-01T10:00:00.000Z'),
          endTime: new Date('1970-01-01T16:00:00.000Z'),
          timezone: 'Europe/Moscow',
          isActive: true,
        },
      ]);

      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-5',
        chatId: BigInt(-1001234567890),
        receivedAt,
      });

      await startSlaTimer('req-5', '-1001234567890', 60);

      // globalSettings should NOT be consulted since custom schedules exist
      expect(mockPrisma.globalSettings.findUnique).not.toHaveBeenCalled();

      expect(mockScheduleSlaCheck).toHaveBeenCalledOnce();
      const delayMs: number = mockScheduleSlaCheck.mock.calls[0][3];

      // Custom schedule: Sat 10:00-16:00 Moscow. Received at 10:30 Moscow.
      // 60 min threshold → breach at 11:30 Saturday Moscow = 08:30 UTC
      const breachTime = new Date('2025-02-01T08:30:00.000Z');
      const expected = breachTime.getTime() - now.getTime();

      expectDelayClose(delayMs, expected, 'Scenario 5');
    });

    it('should fire on next working day (Sunday) when custom Sat schedule runs out', async () => {
      // Saturday 2025-02-01 15:30:00 Moscow = 12:30:00 UTC (only 30 min left)
      const now = new Date('2025-02-01T12:30:00.000Z');
      vi.setSystemTime(now);

      const receivedAt = now;

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: false });
      mockPrisma.workingSchedule.findMany.mockResolvedValue([
        {
          dayOfWeek: 6,
          startTime: new Date('1970-01-01T10:00:00.000Z'),
          endTime: new Date('1970-01-01T16:00:00.000Z'),
          timezone: 'Europe/Moscow',
          isActive: true,
        },
        {
          dayOfWeek: 0,
          startTime: new Date('1970-01-01T10:00:00.000Z'),
          endTime: new Date('1970-01-01T16:00:00.000Z'),
          timezone: 'Europe/Moscow',
          isActive: true,
        },
      ]);
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-5b',
        chatId: BigInt(-1001234567890),
        receivedAt,
      });

      await startSlaTimer('req-5b', '-1001234567890', 60);

      expect(mockScheduleSlaCheck).toHaveBeenCalledOnce();
      const delayMs: number = mockScheduleSlaCheck.mock.calls[0][3];

      // 30 min on Saturday (15:30→16:00), 30 min on Sunday (10:00→10:30)
      // Breach = Sunday 2025-02-02 10:30:00 Moscow = 07:30:00 UTC
      const breachTime = new Date('2025-02-02T07:30:00.000Z');
      const expected = breachTime.getTime() - now.getTime();

      expectDelayClose(delayMs, expected, 'Scenario 5b');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Already breached (received 2 hours ago, threshold 60 min)
  // -------------------------------------------------------------------------
  describe('Scenario 6: Already breached — delay should be 0', () => {
    it('should produce delay=0 when SLA already exceeded (24/7 mode)', async () => {
      // Wednesday 10:00 Moscow = 07:00 UTC
      const now = new Date('2025-01-29T07:00:00.000Z');
      vi.setSystemTime(now);

      // Received 2 hours ago — well past 60 min threshold
      const receivedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: true });
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-6',
        chatId: BigInt(-1001234567890),
        receivedAt,
      });

      await startSlaTimer('req-6', '-1001234567890', 60);

      expect(mockScheduleSlaCheck).toHaveBeenCalledOnce();
      const delayMs: number = mockScheduleSlaCheck.mock.calls[0][3];

      // Already breached → calculateDelayUntilBreach returns Math.max(0, negative) = 0
      expect(delayMs).toBe(0);
    });

    it('should produce delay=0 when already breached during working hours', async () => {
      // Monday 12:00 Moscow = 09:00 UTC — well into working day
      const now = new Date('2025-01-27T09:00:00.000Z');
      vi.setSystemTime(now);

      // Received 90 min ago = 10:30 Moscow
      const receivedAt = new Date(now.getTime() - 90 * 60 * 1000);

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: false });
      mockPrisma.workingSchedule.findMany.mockResolvedValue([]);
      mockPrisma.globalSettings.findUnique.mockResolvedValue({
        defaultTimezone: 'Europe/Moscow',
        defaultWorkingDays: [1, 2, 3, 4, 5],
        defaultStartTime: '09:00',
        defaultEndTime: '18:00',
      });
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-6b',
        chatId: BigInt(-1001234567890),
        receivedAt,
      });

      await startSlaTimer('req-6b', '-1001234567890', 60);

      expect(mockScheduleSlaCheck).toHaveBeenCalledOnce();
      const delayMs: number = mockScheduleSlaCheck.mock.calls[0][3];

      // 90 working minutes elapsed, threshold 60 → already breached → delay = 0
      expect(delayMs).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario: GlobalSettings full 24/7 coverage (00:00-23:59, 7 days)
  // -------------------------------------------------------------------------
  describe('GlobalSettings 24/7 detection (00:00-23:59, all 7 days)', () => {
    it('should treat 00:00-23:59 all-days GlobalSettings as 24/7 and fire in ~60 min', async () => {
      const now = new Date('2025-01-29T07:00:00.000Z');
      vi.setSystemTime(now);

      const receivedAt = now;

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: false });
      mockPrisma.workingSchedule.findMany.mockResolvedValue([]);
      mockPrisma.globalSettings.findUnique.mockResolvedValue({
        defaultTimezone: 'Europe/Moscow',
        defaultWorkingDays: [1, 2, 3, 4, 5, 6, 7], // all 7 days
        defaultStartTime: '00:00',
        defaultEndTime: '23:59',
      });
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-gs24',
        chatId: BigInt(-1001234567890),
        receivedAt,
      });

      await startSlaTimer('req-gs24', '-1001234567890', 60);

      expect(mockScheduleSlaCheck).toHaveBeenCalledOnce();
      const delayMs: number = mockScheduleSlaCheck.mock.calls[0][3];

      // is24x7 detected → breach = receivedAt + 60 min → delay = 60 min
      const expected = 60 * 60 * 1000;
      expectDelayClose(delayMs, expected, 'GlobalSettings 24/7');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario: Missing GlobalSettings — falls back to hardcoded defaults
  // -------------------------------------------------------------------------
  describe('Fallback to hardcoded defaults when GlobalSettings not found', () => {
    it('should still schedule SLA check with default Mon-Fri 09:00-18:00 schedule', async () => {
      // Monday 10:00 Moscow = 07:00 UTC
      const now = new Date('2025-01-27T07:00:00.000Z');
      vi.setSystemTime(now);

      const receivedAt = now;

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: false });
      mockPrisma.workingSchedule.findMany.mockResolvedValue([]);
      mockPrisma.globalSettings.findUnique.mockResolvedValue(null); // no GlobalSettings row
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-fallback',
        chatId: BigInt(-1001234567890),
        receivedAt,
      });

      await startSlaTimer('req-fallback', '-1001234567890', 60);

      expect(mockScheduleSlaCheck).toHaveBeenCalledOnce();
      const delayMs: number = mockScheduleSlaCheck.mock.calls[0][3];

      // Hardcoded defaults: Europe/Moscow, Mon-Fri, 09:00-18:00
      // Monday 10:00 → breach at 11:00 → delay = 60 min
      const expected = 60 * 60 * 1000;
      expectDelayClose(delayMs, expected, 'Fallback defaults');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario: Request not found — should return early without scheduling
  // -------------------------------------------------------------------------
  describe('Edge case: request not found in DB', () => {
    it('should not schedule any job when request does not exist', async () => {
      const now = new Date('2025-01-29T07:00:00.000Z');
      vi.setSystemTime(now);

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: true });
      mockPrisma.clientRequest.findUnique.mockResolvedValue(null); // not found

      await startSlaTimer('req-missing', '-1001234567890', 60);

      expect(mockScheduleSlaCheck).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario: Prisma update is called with correct shape
  // -------------------------------------------------------------------------
  describe('Prisma update side-effect', () => {
    it('should update request with slaTimerStartedAt and status=pending', async () => {
      const now = new Date('2025-01-29T07:00:00.000Z');
      vi.setSystemTime(now);

      const receivedAt = now;

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: true });
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-update',
        chatId: BigInt(-1001234567890),
        receivedAt,
      });

      await startSlaTimer('req-update', '-1001234567890', 60);

      expect(mockPrisma.clientRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-update' },
        data: {
          slaTimerStartedAt: expect.any(Date),
          status: 'pending',
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Scenario: scheduleSlaCheck receives correct positional arguments
  // -------------------------------------------------------------------------
  describe('scheduleSlaCheck call arguments', () => {
    it('should pass requestId, chatId, thresholdMinutes, and delayMs in correct order', async () => {
      const now = new Date('2025-01-29T07:00:00.000Z');
      vi.setSystemTime(now);

      mockPrisma.chat.findFirst.mockResolvedValue({ is24x7Mode: true });
      mockPrisma.clientRequest.findUnique.mockResolvedValue({
        id: 'req-args',
        chatId: BigInt(-1001234567890),
        receivedAt: now,
      });

      await startSlaTimer('req-args', '-1001234567890', 90);

      expect(mockScheduleSlaCheck).toHaveBeenCalledOnce();
      const [reqId, chatId, threshold, delay] = mockScheduleSlaCheck.mock.calls[0];

      expect(reqId).toBe('req-args');
      expect(chatId).toBe('-1001234567890');
      expect(threshold).toBe(90);
      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThanOrEqual(0);
    });
  });
});
