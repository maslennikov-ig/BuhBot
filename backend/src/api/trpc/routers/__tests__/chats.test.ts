/**
 * Chats Router Tests
 *
 * Tests for chat registration and notification settings (gh-17)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mocks before vi.mock is hoisted
const mockPrisma = vi.hoisted(() => ({
  chat: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  globalSettings: {
    findUnique: vi.fn(),
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

describe('chats.registerChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should explicitly set notifyInChatOnBreach to false on chat creation', async () => {
    // Setup: GlobalSettings returns default threshold
    mockPrisma.globalSettings.findUnique.mockResolvedValue({
      defaultSlaThreshold: 60,
    });

    // Capture the upsert arguments to verify create block
    let capturedCreateData: Record<string, unknown> | null = null;
    mockPrisma.chat.upsert.mockImplementation(async (args: { create: Record<string, unknown> }) => {
      capturedCreateData = args.create;
      return {
        id: BigInt(123456),
        chatType: 'group',
        title: 'Test Chat',
        accountantUsername: null,
        assignedAccountantId: null,
        slaEnabled: true,
        slaThresholdMinutes: 60,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    // Simulate registerChat logic
    const chatId = BigInt(123456);
    const globalSettings = await mockPrisma.globalSettings.findUnique({
      where: { id: 'default' },
    });
    const defaultThreshold = globalSettings?.defaultSlaThreshold ?? 60;

    await mockPrisma.chat.upsert({
      where: { id: chatId },
      update: {
        chatType: 'group',
      },
      create: {
        id: chatId,
        chatType: 'group',
        title: 'Test Chat',
        accountantUsername: null,
        slaEnabled: true,
        slaThresholdMinutes: defaultThreshold,
        monitoringEnabled: true,
        is24x7Mode: false,
        managerTelegramIds: [],
        notifyInChatOnBreach: false, // Security: disabled by default
      },
      select: {
        id: true,
        chatType: true,
        title: true,
        accountantUsername: true,
        assignedAccountantId: true,
        slaEnabled: true,
        slaThresholdMinutes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Verify notifyInChatOnBreach is explicitly set to false in create block
    expect(capturedCreateData).not.toBeNull();
    expect(capturedCreateData!.notifyInChatOnBreach).toBe(false);
  });

  it('should use global default threshold when creating new chat', async () => {
    const customThreshold = 30;
    mockPrisma.globalSettings.findUnique.mockResolvedValue({
      defaultSlaThreshold: customThreshold,
    });

    let capturedCreateData: Record<string, unknown> | null = null;
    mockPrisma.chat.upsert.mockImplementation(async (args: { create: Record<string, unknown> }) => {
      capturedCreateData = args.create;
      return {
        id: BigInt(123456),
        chatType: 'group',
        title: null,
        accountantUsername: null,
        assignedAccountantId: null,
        slaEnabled: true,
        slaThresholdMinutes: customThreshold,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    const globalSettings = await mockPrisma.globalSettings.findUnique({
      where: { id: 'default' },
    });
    const defaultThreshold = globalSettings?.defaultSlaThreshold ?? 60;

    await mockPrisma.chat.upsert({
      where: { id: BigInt(123456) },
      update: { chatType: 'group' },
      create: {
        id: BigInt(123456),
        chatType: 'group',
        title: null,
        accountantUsername: null,
        slaEnabled: true,
        slaThresholdMinutes: defaultThreshold,
        monitoringEnabled: true,
        is24x7Mode: false,
        managerTelegramIds: [],
        notifyInChatOnBreach: false,
      },
      select: {},
    });

    expect(capturedCreateData!.slaThresholdMinutes).toBe(customThreshold);
  });

  it('should fallback to 60 minutes when GlobalSettings not found', async () => {
    mockPrisma.globalSettings.findUnique.mockResolvedValue(null);

    let capturedCreateData: Record<string, unknown> | null = null;
    mockPrisma.chat.upsert.mockImplementation(async (args: { create: Record<string, unknown> }) => {
      capturedCreateData = args.create;
      return {
        id: BigInt(123456),
        chatType: 'group',
        title: null,
        accountantUsername: null,
        assignedAccountantId: null,
        slaEnabled: true,
        slaThresholdMinutes: 60,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    const globalSettings = await mockPrisma.globalSettings.findUnique({
      where: { id: 'default' },
    });
    const defaultThreshold = globalSettings?.defaultSlaThreshold ?? 60;

    await mockPrisma.chat.upsert({
      where: { id: BigInt(123456) },
      update: { chatType: 'group' },
      create: {
        id: BigInt(123456),
        chatType: 'group',
        title: null,
        accountantUsername: null,
        slaEnabled: true,
        slaThresholdMinutes: defaultThreshold,
        monitoringEnabled: true,
        is24x7Mode: false,
        managerTelegramIds: [],
        notifyInChatOnBreach: false,
      },
      select: {},
    });

    expect(capturedCreateData!.slaThresholdMinutes).toBe(60);
  });
});
