/**
 * Config Service Tests - getRecipientsByLevel
 *
 * Tests SLA breach recipient resolution logic:
 * - Level 1: managers + accountants
 * - Level 2+: managers + accountants
 * - Fallback: still notify whichever audience is configured
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  globalSettings: {
    findUnique: vi.fn(),
  },
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getRecipientsByLevel, invalidateSettingsCache } from '../config.service.js';

describe('getRecipientsByLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the in-memory settings cache to ensure fresh mock data per test
    invalidateSettingsCache();
    // Default: global managers with ID '999'
    mockPrisma.globalSettings.findUnique.mockResolvedValue({
      defaultTimezone: 'Europe/Moscow',
      defaultWorkingDays: [1, 2, 3, 4, 5],
      defaultStartTime: '09:00',
      defaultEndTime: '18:00',
      defaultSlaThreshold: 60,
      maxEscalations: 5,
      escalationIntervalMin: 30,
      slaWarningPercent: 80,
      globalManagerIds: ['999'],
      messagePreviewLength: 500,
      openrouterApiKey: null,
      openrouterModel: 'test',
      aiConfidenceThreshold: 0.7,
    });
  });

  describe('level 1 (initial alert)', () => {
    it('should return managers and accountants when both are configured', async () => {
      const result = await getRecipientsByLevel(['mgr_111'], [BigInt(222), BigInt(333)], 1);

      expect(result.tier).toBe('both');
      expect(result.recipients).toEqual(['mgr_111', '222', '333']);
    });

    it('should return chat managers when no accountants are configured', async () => {
      const result = await getRecipientsByLevel(['mgr_111', 'mgr_222'], [], 1);

      expect(result.tier).toBe('manager');
      expect(result.recipients).toEqual(['mgr_111', 'mgr_222']);
    });

    it('should return only accountants when managers are missing', async () => {
      mockPrisma.globalSettings.findUnique.mockResolvedValue({
        defaultTimezone: 'Europe/Moscow',
        defaultWorkingDays: [1, 2, 3, 4, 5],
        defaultStartTime: '09:00',
        defaultEndTime: '18:00',
        defaultSlaThreshold: 60,
        maxEscalations: 5,
        escalationIntervalMin: 30,
        slaWarningPercent: 80,
        globalManagerIds: [],
        messagePreviewLength: 500,
        openrouterApiKey: null,
        openrouterModel: 'test',
        aiConfidenceThreshold: 0.7,
      });

      const result = await getRecipientsByLevel([], [BigInt(222), BigInt(333)], 1);

      expect(result.tier).toBe('accountant');
      expect(result.recipients).toEqual(['222', '333']);
    });

    it('should fallback to global managers when no chat managers or accountants', async () => {
      const result = await getRecipientsByLevel([], [], 1);

      expect(result.tier).toBe('manager');
      expect(result.recipients).toEqual(['999']);
    });

    it('should return empty when no recipients at all', async () => {
      mockPrisma.globalSettings.findUnique.mockResolvedValue({
        defaultTimezone: 'Europe/Moscow',
        defaultWorkingDays: [1, 2, 3, 4, 5],
        defaultStartTime: '09:00',
        defaultEndTime: '18:00',
        defaultSlaThreshold: 60,
        maxEscalations: 5,
        escalationIntervalMin: 30,
        slaWarningPercent: 80,
        globalManagerIds: [],
        messagePreviewLength: 500,
        openrouterApiKey: null,
        openrouterModel: 'test',
        aiConfidenceThreshold: 0.7,
      });

      const result = await getRecipientsByLevel(null, null, 1);

      expect(result.tier).toBe('fallback');
      expect(result.recipients).toEqual([]);
    });

    it('should handle null/undefined inputs gracefully', async () => {
      const result = await getRecipientsByLevel(null, undefined, 1);

      expect(result.tier).toBe('manager');
      expect(result.recipients).toEqual(['999']);
    });
  });

  describe('level 2+ (escalation)', () => {
    it('should return managers and accountants at level 2', async () => {
      const result = await getRecipientsByLevel(['mgr_111'], [BigInt(222)], 2);

      expect(result.tier).toBe('both');
      expect(result.recipients).toEqual(['mgr_111', '222']);
    });

    it('should de-duplicate overlapping manager and accountant IDs', async () => {
      const result = await getRecipientsByLevel(['111'], [BigInt(111), BigInt(222)], 2);

      expect(result.tier).toBe('both');
      expect(result.recipients).toEqual(['111', '222']);
    });

    it('should return accountants when no managers are configured anywhere', async () => {
      mockPrisma.globalSettings.findUnique.mockResolvedValue({
        defaultTimezone: 'Europe/Moscow',
        defaultWorkingDays: [1, 2, 3, 4, 5],
        defaultStartTime: '09:00',
        defaultEndTime: '18:00',
        defaultSlaThreshold: 60,
        maxEscalations: 5,
        escalationIntervalMin: 30,
        slaWarningPercent: 80,
        globalManagerIds: [],
        messagePreviewLength: 500,
        openrouterApiKey: null,
        openrouterModel: 'test',
        aiConfidenceThreshold: 0.7,
      });

      const result = await getRecipientsByLevel([], [BigInt(222)], 2);

      expect(result.tier).toBe('accountant');
      expect(result.recipients).toEqual(['222']);
    });

    it('should include global managers with accountants at level 2+', async () => {
      const result = await getRecipientsByLevel(null, [BigInt(222)], 3);

      expect(result.tier).toBe('both');
      expect(result.recipients).toEqual(['999', '222']);
    });
  });

  describe('default escalation level', () => {
    it('should default to level 1 when not specified', async () => {
      const result = await getRecipientsByLevel(['mgr_111'], [BigInt(222)]);

      // Level 1 default: notify both audiences
      expect(result.tier).toBe('both');
      expect(result.recipients).toEqual(['mgr_111', '222']);
    });
  });
});
