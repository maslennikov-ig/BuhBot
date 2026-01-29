/**
 * SLA Timer Service Tests
 *
 * Tests for working hours schedule resolution in timer.service.ts
 *
 * Key tests:
 * 1. Chat with is24x7Mode enabled should use 24/7 schedule
 * 2. Chat with custom WorkingSchedule records should use those
 * 3. Chat with no custom schedule should use GlobalSettings
 * 4. GlobalSettings with full hours (00:00-23:59, 7 days) should be treated as 24/7
 * 5. Missing GlobalSettings should fallback to hardcoded defaults
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to define mock before the vi.mock call is hoisted
const mockPrisma = vi.hoisted(() => ({
  chat: {
    findUnique: vi.fn(),
  },
  workingSchedule: {
    findMany: vi.fn(),
  },
  globalSettings: {
    findUnique: vi.fn(),
  },
  clientRequest: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock queue functions
vi.mock('../../../queues/setup.js', () => ({
  scheduleSlaCheck: vi.fn().mockResolvedValue(undefined),
  cancelSlaCheck: vi.fn().mockResolvedValue(true),
  slaTimerQueue: {
    getJob: vi.fn(),
  },
  queueAlert: vi.fn(),
}));

// Import after mocks are set up
import { startSlaTimer } from '../timer.service.js';
import { scheduleSlaCheck } from '../../../queues/setup.js';

describe('SLA Timer Service - Schedule Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Set a fixed time for consistent tests: Wed Jan 29, 2025 10:00:00 Moscow time
    // This is 07:00:00 UTC
    vi.setSystemTime(new Date('2025-01-29T07:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startSlaTimer', () => {
    const mockRequest = {
      id: 'test-request-id',
      chatId: BigInt(-1001234567890),
      receivedAt: new Date('2025-01-29T07:00:00.000Z'),
    };

    it('should use 24/7 mode when chat has is24x7Mode enabled', async () => {
      // Setup: Chat with is24x7Mode = true
      mockPrisma.chat.findUnique.mockResolvedValue({
        is24x7Mode: true,
      });
      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.clientRequest.update.mockResolvedValue({});

      await startSlaTimer('test-request-id', '-1001234567890', 60);

      // Should schedule with delay = threshold * 60 * 1000 (60 minutes = 3,600,000ms)
      // In 24/7 mode, delay is simply threshold in milliseconds
      expect(scheduleSlaCheck).toHaveBeenCalledWith(
        'test-request-id',
        '-1001234567890',
        60,
        expect.any(Number)
      );

      const actualDelay = (scheduleSlaCheck as ReturnType<typeof vi.fn>).mock.calls[0][3];
      // In 24/7 mode, delay should be exactly 60 minutes (3,600,000ms)
      expect(actualDelay).toBe(60 * 60 * 1000);
    });

    it('should use GlobalSettings when chat has no custom schedule', async () => {
      // Setup: Chat without custom schedule, global settings = full day coverage
      mockPrisma.chat.findUnique.mockResolvedValue({
        is24x7Mode: false,
      });
      mockPrisma.workingSchedule.findMany.mockResolvedValue([]);
      mockPrisma.globalSettings.findUnique.mockResolvedValue({
        defaultTimezone: 'Europe/Moscow',
        defaultWorkingDays: [1, 2, 3, 4, 5, 6, 7], // All days (Sun=7)
        defaultStartTime: '00:00',
        defaultEndTime: '23:59',
      });
      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.clientRequest.update.mockResolvedValue({});

      await startSlaTimer('test-request-id', '-1001234567890', 60);

      expect(scheduleSlaCheck).toHaveBeenCalled();

      const actualDelay = (scheduleSlaCheck as ReturnType<typeof vi.fn>).mock.calls[0][3];
      // With 00:00-23:59 and all days, should be treated as 24/7
      // Delay should be exactly 60 minutes (3,600,000ms)
      expect(actualDelay).toBe(60 * 60 * 1000);
    });

    it('should use GlobalSettings working hours when partial day', async () => {
      // Setup: Chat without custom schedule, global settings = business hours only
      mockPrisma.chat.findUnique.mockResolvedValue({
        is24x7Mode: false,
      });
      mockPrisma.workingSchedule.findMany.mockResolvedValue([]);
      mockPrisma.globalSettings.findUnique.mockResolvedValue({
        defaultTimezone: 'Europe/Moscow',
        defaultWorkingDays: [1, 2, 3, 4, 5], // Mon-Fri only
        defaultStartTime: '09:00',
        defaultEndTime: '18:00',
      });

      // Request received at 10:00 Moscow (within working hours)
      const requestDuringWorkingHours = {
        id: 'test-request-id',
        chatId: BigInt(-1001234567890),
        receivedAt: new Date('2025-01-29T07:00:00.000Z'), // 10:00 Moscow
      };
      mockPrisma.clientRequest.findUnique.mockResolvedValue(requestDuringWorkingHours);
      mockPrisma.clientRequest.update.mockResolvedValue({});

      await startSlaTimer('test-request-id', '-1001234567890', 60);

      expect(scheduleSlaCheck).toHaveBeenCalled();

      const actualDelay = (scheduleSlaCheck as ReturnType<typeof vi.fn>).mock.calls[0][3];
      // Currently 10:00 Moscow, working hours 09:00-18:00
      // 60 min threshold means breach at 11:00 Moscow
      // Delay should be 60 minutes (3,600,000ms)
      expect(actualDelay).toBe(60 * 60 * 1000);
    });

    it('should calculate delay to next working day when outside working hours', async () => {
      // Setup: Request received outside working hours
      vi.setSystemTime(new Date('2025-01-29T03:00:00.000Z')); // 06:00 Moscow (before 09:00)

      mockPrisma.chat.findUnique.mockResolvedValue({
        is24x7Mode: false,
      });
      mockPrisma.workingSchedule.findMany.mockResolvedValue([]);
      mockPrisma.globalSettings.findUnique.mockResolvedValue({
        defaultTimezone: 'Europe/Moscow',
        defaultWorkingDays: [1, 2, 3, 4, 5], // Mon-Fri only
        defaultStartTime: '09:00',
        defaultEndTime: '18:00',
      });

      const requestOutsideWorkingHours = {
        id: 'test-request-id',
        chatId: BigInt(-1001234567890),
        receivedAt: new Date('2025-01-29T03:00:00.000Z'), // 06:00 Moscow
      };
      mockPrisma.clientRequest.findUnique.mockResolvedValue(requestOutsideWorkingHours);
      mockPrisma.clientRequest.update.mockResolvedValue({});

      await startSlaTimer('test-request-id', '-1001234567890', 60);

      expect(scheduleSlaCheck).toHaveBeenCalled();

      const actualDelay = (scheduleSlaCheck as ReturnType<typeof vi.fn>).mock.calls[0][3];
      // Received at 06:00 Moscow, working hours start at 09:00
      // SLA starts counting from 09:00, breach at 10:00
      // Current time is 06:00, so delay = 4 hours (09:00 - 06:00 + 60 min threshold)
      // = 3 hours to 09:00 + 60 min = 4 hours = 14,400,000ms
      expect(actualDelay).toBe(4 * 60 * 60 * 1000);
    });

    it('should fallback to hardcoded defaults when GlobalSettings not found', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        is24x7Mode: false,
      });
      mockPrisma.workingSchedule.findMany.mockResolvedValue([]);
      mockPrisma.globalSettings.findUnique.mockResolvedValue(null);
      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.clientRequest.update.mockResolvedValue({});

      await startSlaTimer('test-request-id', '-1001234567890', 60);

      // Should still work with hardcoded defaults (Mon-Fri 09:00-18:00)
      expect(scheduleSlaCheck).toHaveBeenCalled();
    });

    it('should use chat-specific WorkingSchedule when available', async () => {
      mockPrisma.chat.findUnique.mockResolvedValue({
        is24x7Mode: false,
      });
      mockPrisma.workingSchedule.findMany.mockResolvedValue([
        {
          dayOfWeek: 1, // Monday
          startTime: new Date('1970-01-01T08:00:00.000Z'),
          endTime: new Date('1970-01-01T20:00:00.000Z'),
          timezone: 'Europe/Moscow',
          isActive: true,
        },
        {
          dayOfWeek: 2, // Tuesday
          startTime: new Date('1970-01-01T08:00:00.000Z'),
          endTime: new Date('1970-01-01T20:00:00.000Z'),
          timezone: 'Europe/Moscow',
          isActive: true,
        },
        {
          dayOfWeek: 3, // Wednesday
          startTime: new Date('1970-01-01T08:00:00.000Z'),
          endTime: new Date('1970-01-01T20:00:00.000Z'),
          timezone: 'Europe/Moscow',
          isActive: true,
        },
      ]);
      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.clientRequest.update.mockResolvedValue({});

      await startSlaTimer('test-request-id', '-1001234567890', 60);

      // Should NOT call globalSettings since chat has custom schedule
      expect(mockPrisma.globalSettings.findUnique).not.toHaveBeenCalled();
      expect(scheduleSlaCheck).toHaveBeenCalled();
    });
  });
});
