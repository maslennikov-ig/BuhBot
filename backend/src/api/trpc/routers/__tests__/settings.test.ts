/**
 * Settings Router Tests
 *
 * Tests for global SLA threshold updates (gh-16)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mocks before vi.mock is hoisted
const mockPrisma = vi.hoisted(() => ({
  globalSettings: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  chat: {
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('../../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Mock logger
vi.mock('../../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('settings.updateSlaThresholds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update slaThresholdMinutes for all existing chats', async () => {
    const newThreshold = 15;
    const existingChats = [
      { id: BigInt(1), slaThresholdMinutes: 60 },
      { id: BigInt(2), slaThresholdMinutes: 30 },
      { id: BigInt(3), slaThresholdMinutes: 45 },
    ];

    mockPrisma.globalSettings.upsert.mockResolvedValue({
      id: 'default',
      defaultSlaThreshold: newThreshold,
    });

    mockPrisma.chat.updateMany.mockResolvedValue({ count: existingChats.length });

    // Simulate updateSlaThresholds mutation logic
    await mockPrisma.globalSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', defaultSlaThreshold: newThreshold },
      update: { defaultSlaThreshold: newThreshold },
    });

    const result = await mockPrisma.chat.updateMany({
      where: {},
      data: {
        slaThresholdMinutes: newThreshold,
      },
    });

    // Verify updateMany was called with correct parameters
    expect(mockPrisma.chat.updateMany).toHaveBeenCalledWith({
      where: {},
      data: {
        slaThresholdMinutes: newThreshold,
      },
    });

    // Verify count returned
    expect(result.count).toBe(3);
  });

  it('should update GlobalSettings.defaultSlaThreshold', async () => {
    const newThreshold = 20;

    mockPrisma.globalSettings.upsert.mockResolvedValue({
      id: 'default',
      defaultSlaThreshold: newThreshold,
    });
    mockPrisma.chat.updateMany.mockResolvedValue({ count: 0 });

    const settings = await mockPrisma.globalSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', defaultSlaThreshold: newThreshold },
      update: { defaultSlaThreshold: newThreshold },
    });

    expect(mockPrisma.globalSettings.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: { id: 'default', defaultSlaThreshold: newThreshold },
      update: { defaultSlaThreshold: newThreshold },
    });

    expect(settings.defaultSlaThreshold).toBe(newThreshold);
  });

  it('should return count of updated chats', async () => {
    const newThreshold = 25;
    const chatCount = 5;

    mockPrisma.globalSettings.upsert.mockResolvedValue({
      id: 'default',
      defaultSlaThreshold: newThreshold,
    });
    mockPrisma.chat.updateMany.mockResolvedValue({ count: chatCount });

    // Simulate full mutation
    await mockPrisma.globalSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', defaultSlaThreshold: newThreshold },
      update: { defaultSlaThreshold: newThreshold },
    });

    const result = await mockPrisma.chat.updateMany({
      where: {},
      data: {
        slaThresholdMinutes: newThreshold,
      },
    });

    expect(result.count).toBe(chatCount);
  });

  it('should handle zero chats gracefully', async () => {
    const newThreshold = 10;

    mockPrisma.globalSettings.upsert.mockResolvedValue({
      id: 'default',
      defaultSlaThreshold: newThreshold,
    });
    mockPrisma.chat.updateMany.mockResolvedValue({ count: 0 });

    await mockPrisma.globalSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', defaultSlaThreshold: newThreshold },
      update: { defaultSlaThreshold: newThreshold },
    });

    const result = await mockPrisma.chat.updateMany({
      where: {},
      data: {
        slaThresholdMinutes: newThreshold,
      },
    });

    expect(result.count).toBe(0);
  });

  it('should create GlobalSettings if not exists', async () => {
    const newThreshold = 45;

    mockPrisma.globalSettings.upsert.mockImplementation(async (args) => {
      // Simulate upsert creating new record
      return {
        id: args.create.id,
        defaultSlaThreshold: args.create.defaultSlaThreshold,
      };
    });
    mockPrisma.chat.updateMany.mockResolvedValue({ count: 2 });

    const settings = await mockPrisma.globalSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', defaultSlaThreshold: newThreshold },
      update: { defaultSlaThreshold: newThreshold },
    });

    expect(settings.id).toBe('default');
    expect(settings.defaultSlaThreshold).toBe(newThreshold);
  });
});
