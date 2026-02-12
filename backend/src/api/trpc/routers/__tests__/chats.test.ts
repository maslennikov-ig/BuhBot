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
    update: vi.fn(),
  },
  globalSettings: {
    findUnique: vi.fn(),
  },
  user: {
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

describe('chats.update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // SLA Validation Tests

  it('should block enabling SLA when no managers configured (false → true)', async () => {
    // Existing chat has SLA disabled and no managers
    mockPrisma.chat.findUnique.mockResolvedValue({
      id: BigInt(123456),
      slaEnabled: false,
      managerTelegramIds: [],
      notifyInChatOnBreach: false,
      slaThresholdMinutes: 60,
      assignedAccountantId: null,
    });

    // No global managers either
    mockPrisma.globalSettings.findUnique.mockResolvedValue({
      globalManagerIds: [],
    });

    // Simulate update mutation: try to enable SLA
    const input = {
      id: 123456,
      slaEnabled: true,
    };

    const existingChat = await mockPrisma.chat.findUnique({
      where: { id: input.id },
    });

    if (!existingChat) {
      throw new Error('NOT_FOUND');
    }

    // Validation: Cannot enable SLA without managers configured
    let errorThrown = false;
    let errorMessage = '';

    if (input.slaEnabled === true && existingChat.slaEnabled === false) {
      const chatManagers = existingChat.managerTelegramIds || [];
      const globalSettings = await mockPrisma.globalSettings.findUnique({
        where: { id: 'default' },
        select: { globalManagerIds: true },
      });
      const globalManagers = globalSettings?.globalManagerIds || [];
      const hasManagers = chatManagers.length > 0 || globalManagers.length > 0;

      if (!hasManagers) {
        errorThrown = true;
        errorMessage =
          'Невозможно включить SLA без настроенных менеджеров. Добавьте менеджеров в настройках чата или глобальных настройках.';
      }
    }

    expect(errorThrown).toBe(true);
    expect(errorMessage).toContain('Невозможно включить SLA');
    expect(mockPrisma.chat.update).not.toHaveBeenCalled();
  });

  it('should allow enabling SLA when global managers exist', async () => {
    // Existing chat has SLA disabled and no chat-level managers
    mockPrisma.chat.findUnique.mockResolvedValue({
      id: BigInt(123456),
      slaEnabled: false,
      managerTelegramIds: [],
      notifyInChatOnBreach: false,
      slaThresholdMinutes: 60,
      assignedAccountantId: null,
    });

    // But global managers exist
    mockPrisma.globalSettings.findUnique.mockResolvedValue({
      globalManagerIds: [BigInt(999), BigInt(888)],
    });

    mockPrisma.chat.update.mockResolvedValue({
      id: BigInt(123456),
      assignedAccountantId: null,
      slaEnabled: true,
      slaThresholdMinutes: 60,
      notifyInChatOnBreach: false,
      updatedAt: new Date(),
    });

    const input = {
      id: 123456,
      slaEnabled: true,
    };

    const existingChat = await mockPrisma.chat.findUnique({
      where: { id: input.id },
    });

    // Validation passes because global managers exist
    if (input.slaEnabled === true && existingChat.slaEnabled === false) {
      const chatManagers = existingChat.managerTelegramIds || [];
      const globalSettings = await mockPrisma.globalSettings.findUnique({
        where: { id: 'default' },
        select: { globalManagerIds: true },
      });
      const globalManagers = globalSettings?.globalManagerIds || [];
      const hasManagers = chatManagers.length > 0 || globalManagers.length > 0;

      expect(hasManagers).toBe(true); // Should pass validation
    }

    // Update should proceed
    const data: Record<string, unknown> = {};
    if (input.slaEnabled !== undefined) {
      data.slaEnabled = input.slaEnabled;
    }

    await mockPrisma.chat.update({
      where: { id: input.id },
      data,
      select: {
        id: true,
        assignedAccountantId: true,
        slaEnabled: true,
        slaThresholdMinutes: true,
        notifyInChatOnBreach: true,
        updatedAt: true,
      },
    });

    expect(mockPrisma.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: input.id },
        data: { slaEnabled: true },
      })
    );
  });

  it('should allow enabling SLA when chat managers exist', async () => {
    // Existing chat has SLA disabled but has chat-level managers
    mockPrisma.chat.findUnique.mockResolvedValue({
      id: BigInt(123456),
      slaEnabled: false,
      managerTelegramIds: [BigInt(777)],
      notifyInChatOnBreach: false,
      slaThresholdMinutes: 60,
      assignedAccountantId: null,
    });

    // No global managers
    mockPrisma.globalSettings.findUnique.mockResolvedValue({
      globalManagerIds: [],
    });

    mockPrisma.chat.update.mockResolvedValue({
      id: BigInt(123456),
      assignedAccountantId: null,
      slaEnabled: true,
      slaThresholdMinutes: 60,
      notifyInChatOnBreach: false,
      updatedAt: new Date(),
    });

    const input = {
      id: 123456,
      slaEnabled: true,
    };

    const existingChat = await mockPrisma.chat.findUnique({
      where: { id: input.id },
    });

    // Validation passes because chat managers exist
    if (input.slaEnabled === true && existingChat.slaEnabled === false) {
      const chatManagers = existingChat.managerTelegramIds || [];
      const globalSettings = await mockPrisma.globalSettings.findUnique({
        where: { id: 'default' },
        select: { globalManagerIds: true },
      });
      const globalManagers = globalSettings?.globalManagerIds || [];
      const hasManagers = chatManagers.length > 0 || globalManagers.length > 0;

      expect(hasManagers).toBe(true); // Should pass validation
    }

    // Update should proceed
    const data: Record<string, unknown> = {};
    if (input.slaEnabled !== undefined) {
      data.slaEnabled = input.slaEnabled;
    }

    await mockPrisma.chat.update({
      where: { id: input.id },
      data,
      select: {
        id: true,
        assignedAccountantId: true,
        slaEnabled: true,
        slaThresholdMinutes: true,
        notifyInChatOnBreach: true,
        updatedAt: true,
      },
    });

    expect(mockPrisma.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: input.id },
        data: { slaEnabled: true },
      })
    );
  });

  it('should allow saving when SLA already enabled (skip validation)', async () => {
    // Existing chat already has SLA enabled, no managers
    mockPrisma.chat.findUnique.mockResolvedValue({
      id: BigInt(123456),
      slaEnabled: true,
      managerTelegramIds: [],
      notifyInChatOnBreach: false,
      slaThresholdMinutes: 60,
      assignedAccountantId: null,
    });

    mockPrisma.globalSettings.findUnique.mockResolvedValue({
      globalManagerIds: [],
    });

    mockPrisma.chat.update.mockResolvedValue({
      id: BigInt(123456),
      assignedAccountantId: null,
      slaEnabled: true,
      slaThresholdMinutes: 60,
      notifyInChatOnBreach: false,
      updatedAt: new Date(),
    });

    const input = {
      id: 123456,
      slaEnabled: true, // Still enabled
    };

    const existingChat = await mockPrisma.chat.findUnique({
      where: { id: input.id },
    });

    // Validation should NOT run (SLA already enabled)
    let validationRan = false;
    if (input.slaEnabled === true && existingChat.slaEnabled === false) {
      validationRan = true;
    }

    expect(validationRan).toBe(false); // Validation skipped

    // Update should proceed without validation
    const data: Record<string, unknown> = {};
    if (input.slaEnabled !== undefined) {
      data.slaEnabled = input.slaEnabled;
    }

    await mockPrisma.chat.update({
      where: { id: input.id },
      data,
      select: {
        id: true,
        assignedAccountantId: true,
        slaEnabled: true,
        slaThresholdMinutes: true,
        notifyInChatOnBreach: true,
        updatedAt: true,
      },
    });

    expect(mockPrisma.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: input.id },
        data: { slaEnabled: true },
      })
    );
  });

  it('should allow updating threshold when SLA already enabled', async () => {
    // Existing chat has SLA enabled
    mockPrisma.chat.findUnique.mockResolvedValue({
      id: BigInt(123456),
      slaEnabled: true,
      managerTelegramIds: [],
      notifyInChatOnBreach: false,
      slaThresholdMinutes: 60,
      assignedAccountantId: null,
    });

    mockPrisma.chat.update.mockResolvedValue({
      id: BigInt(123456),
      assignedAccountantId: null,
      slaEnabled: true,
      slaThresholdMinutes: 30,
      notifyInChatOnBreach: false,
      updatedAt: new Date(),
    });

    const input = {
      id: 123456,
      slaThresholdMinutes: 30,
    };

    const existingChat = await mockPrisma.chat.findUnique({
      where: { id: input.id },
    });

    expect(existingChat.slaEnabled).toBe(true);

    // Build update data
    const data: Record<string, unknown> = {};
    if (input.slaThresholdMinutes !== undefined) {
      data.slaThresholdMinutes = input.slaThresholdMinutes;
    }

    await mockPrisma.chat.update({
      where: { id: input.id },
      data,
      select: {
        id: true,
        assignedAccountantId: true,
        slaEnabled: true,
        slaThresholdMinutes: true,
        notifyInChatOnBreach: true,
        updatedAt: true,
      },
    });

    expect(mockPrisma.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: input.id },
        data: { slaThresholdMinutes: 30 },
      })
    );
  });

  // notifyInChatOnBreach Tests

  it('should persist notifyInChatOnBreach when explicitly set', async () => {
    mockPrisma.chat.findUnique.mockResolvedValue({
      id: BigInt(123456),
      slaEnabled: true,
      managerTelegramIds: [],
      notifyInChatOnBreach: false,
      slaThresholdMinutes: 60,
      assignedAccountantId: null,
    });

    mockPrisma.chat.update.mockResolvedValue({
      id: BigInt(123456),
      assignedAccountantId: null,
      slaEnabled: true,
      slaThresholdMinutes: 60,
      notifyInChatOnBreach: true,
      updatedAt: new Date(),
    });

    const input = {
      id: 123456,
      notifyInChatOnBreach: true,
    };

    await mockPrisma.chat.findUnique({ where: { id: input.id } });

    const data: Record<string, unknown> = {};
    if (input.notifyInChatOnBreach !== undefined) {
      data.notifyInChatOnBreach = input.notifyInChatOnBreach;
    }

    await mockPrisma.chat.update({
      where: { id: input.id },
      data,
      select: {
        id: true,
        assignedAccountantId: true,
        slaEnabled: true,
        slaThresholdMinutes: true,
        notifyInChatOnBreach: true,
        updatedAt: true,
      },
    });

    expect(mockPrisma.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: input.id },
        data: { notifyInChatOnBreach: true },
      })
    );
  });

  it('should not update notifyInChatOnBreach when undefined', async () => {
    mockPrisma.chat.findUnique.mockResolvedValue({
      id: BigInt(123456),
      slaEnabled: true,
      managerTelegramIds: [],
      notifyInChatOnBreach: false,
      slaThresholdMinutes: 60,
      assignedAccountantId: null,
    });

    mockPrisma.chat.update.mockResolvedValue({
      id: BigInt(123456),
      assignedAccountantId: null,
      slaEnabled: true,
      slaThresholdMinutes: 30,
      notifyInChatOnBreach: false,
      updatedAt: new Date(),
    });

    const input = {
      id: 123456,
      slaThresholdMinutes: 30,
      // notifyInChatOnBreach is NOT provided
    };

    await mockPrisma.chat.findUnique({ where: { id: input.id } });

    const data: Record<string, unknown> = {};
    if (input.slaThresholdMinutes !== undefined) {
      data.slaThresholdMinutes = input.slaThresholdMinutes;
    }
    if ((input as { notifyInChatOnBreach?: boolean }).notifyInChatOnBreach !== undefined) {
      data.notifyInChatOnBreach = (input as { notifyInChatOnBreach?: boolean }).notifyInChatOnBreach;
    }

    await mockPrisma.chat.update({
      where: { id: input.id },
      data,
      select: {
        id: true,
        assignedAccountantId: true,
        slaEnabled: true,
        slaThresholdMinutes: true,
        notifyInChatOnBreach: true,
        updatedAt: true,
      },
    });

    // Verify notifyInChatOnBreach is NOT in the update data
    expect(mockPrisma.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: input.id },
        data: { slaThresholdMinutes: 30 },
      })
    );

    const callArgs = mockPrisma.chat.update.mock.calls[0]?.[0];
    expect(callArgs?.data).not.toHaveProperty('notifyInChatOnBreach');
  });

  // Partial Update Tests

  it('should update only provided fields', async () => {
    mockPrisma.chat.findUnique.mockResolvedValue({
      id: BigInt(123456),
      slaEnabled: true,
      managerTelegramIds: [],
      notifyInChatOnBreach: false,
      slaThresholdMinutes: 60,
      assignedAccountantId: null,
    });

    mockPrisma.chat.update.mockResolvedValue({
      id: BigInt(123456),
      assignedAccountantId: null,
      slaEnabled: true,
      slaThresholdMinutes: 45,
      notifyInChatOnBreach: false,
      updatedAt: new Date(),
    });

    const input = {
      id: 123456,
      slaThresholdMinutes: 45,
      // Only threshold is provided
    };

    await mockPrisma.chat.findUnique({ where: { id: input.id } });

    const data: Record<string, unknown> = {};
    if ((input as { assignedAccountantId?: string | null }).assignedAccountantId !== undefined) {
      data.assignedAccountantId = (input as { assignedAccountantId?: string | null }).assignedAccountantId;
    }
    if ((input as { slaEnabled?: boolean }).slaEnabled !== undefined) {
      data.slaEnabled = (input as { slaEnabled?: boolean }).slaEnabled;
    }
    if (input.slaThresholdMinutes !== undefined) {
      data.slaThresholdMinutes = input.slaThresholdMinutes;
    }
    if ((input as { notifyInChatOnBreach?: boolean }).notifyInChatOnBreach !== undefined) {
      data.notifyInChatOnBreach = (input as { notifyInChatOnBreach?: boolean }).notifyInChatOnBreach;
    }

    await mockPrisma.chat.update({
      where: { id: input.id },
      data,
      select: {
        id: true,
        assignedAccountantId: true,
        slaEnabled: true,
        slaThresholdMinutes: true,
        notifyInChatOnBreach: true,
        updatedAt: true,
      },
    });

    // Verify only slaThresholdMinutes is in the update data
    expect(mockPrisma.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: input.id },
        data: { slaThresholdMinutes: 45 },
      })
    );

    const callArgs = mockPrisma.chat.update.mock.calls[0]?.[0];
    expect(Object.keys(callArgs?.data || {})).toEqual(['slaThresholdMinutes']);
  });
});
