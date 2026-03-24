import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  slaAlert: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  clientRequest: {
    findUnique: vi.fn(),
  },
  chat: {
    findFirst: vi.fn(),
  },
  globalSettings: {
    findUnique: vi.fn(),
  },
}));

vi.mock('../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../queues/setup.js', () => ({
  queueAlert: vi.fn(),
  scheduleEscalation: vi.fn(),
}));

vi.mock('../../notification/app-notification.service.js', () => ({
  appNotificationService: {
    createForUser: vi.fn(),
  },
}));

vi.mock('../../../config/config.service.js', () => ({
  getRecipientsByLevel: vi.fn(),
}));

import { createAlert } from '../alert.service.js';

describe('alert.service createAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Prisma.sql-style query object for enum idempotency lookup', async () => {
    const existingAlert = {
      id: '11111111-1111-1111-1111-111111111111',
      requestId: '22222222-2222-2222-2222-222222222222',
      alertType: 'breach',
      minutesElapsed: 60,
      escalationLevel: 1,
      deliveryStatus: 'pending',
    };

    mockPrisma.$queryRaw.mockResolvedValue([{ id: existingAlert.id }]);
    mockPrisma.slaAlert.findUnique.mockResolvedValue(existingAlert);

    const result = await createAlert({
      requestId: existingAlert.requestId,
      alertType: 'breach',
      minutesElapsed: 60,
      escalationLevel: 1,
    });

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw.mock.calls[0]).toHaveLength(1);
    expect(result).toBe(existingAlert);
  });
});
