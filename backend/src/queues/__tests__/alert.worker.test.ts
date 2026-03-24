import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { AlertJobData } from '../setup.js';

const mockPrisma = vi.hoisted(() => ({
  clientRequest: {
    findUnique: vi.fn(),
  },
  slaAlert: {
    findUnique: vi.fn(),
  },
  globalSettings: {
    findUnique: vi.fn(),
  },
}));

const mockBot = vi.hoisted(() => ({
  telegram: {
    sendMessage: vi.fn(),
  },
}));

const mockBuildAlertKeyboard = vi.hoisted(() => vi.fn());
const mockUpdateDeliveryStatus = vi.hoisted(() => vi.fn());
const mockScheduleNextEscalation = vi.hoisted(() => vi.fn());
const mockSendLowRatingAlert = vi.hoisted(() => vi.fn());

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../bot/bot.js', () => ({
  bot: mockBot,
}));

vi.mock('../setup.js', () => ({
  registerWorker: vi.fn(),
}));

vi.mock('../../services/alerts/format.service.js', () => ({
  formatAlertMessage: vi.fn(() => 'Breach message'),
  formatWarningMessage: vi.fn(() => 'Warning message'),
}));

vi.mock('../../bot/keyboards/alert.keyboard.js', () => ({
  buildAlertKeyboard: mockBuildAlertKeyboard,
}));

vi.mock('../../services/alerts/alert.service.js', () => ({
  updateDeliveryStatus: mockUpdateDeliveryStatus,
}));

vi.mock('../../services/alerts/escalation.service.js', () => ({
  scheduleNextEscalation: mockScheduleNextEscalation,
}));

vi.mock('../../services/feedback/alert.service.js', () => ({
  sendLowRatingAlert: mockSendLowRatingAlert,
}));

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../config/queue.config.js', () => ({
  queueConfig: {
    alertConcurrency: 3,
    alertRateLimitMax: 30,
    alertRateLimitDuration: 1000,
  },
}));

vi.mock('../../lib/redis.js', () => ({
  redis: {},
}));

let capturedHandler: ((job: Job<AlertJobData>) => Promise<void>) | null = null;

const MockWorkerClass = vi.hoisted(() => {
  return class MockWorker {
    on = () => {};

    constructor(_name: string, handler: unknown) {
      (globalThis as Record<string, unknown>).__capturedAlertHandler = handler;
    }
  };
});

vi.mock('bullmq', () => ({
  Worker: MockWorkerClass,
  Job: class {},
}));

await import('../alert.worker.js');
capturedHandler = (globalThis as Record<string, unknown>)
  .__capturedAlertHandler as typeof capturedHandler;

function createMockJob(data: AlertJobData): Job<AlertJobData> {
  return {
    id: 'alert-job-id',
    name: 'send-alert',
    data,
  } as unknown as Job<AlertJobData>;
}

describe('alert.worker recipient-specific keyboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildAlertKeyboard.mockReturnValue({ reply_markup: { inline_keyboard: [] } });
    mockBot.telegram.sendMessage.mockResolvedValue({ message_id: 123 });
    mockUpdateDeliveryStatus.mockResolvedValue(undefined);
    mockPrisma.globalSettings.findUnique.mockResolvedValue({
      id: 'default',
      messagePreviewLength: 500,
      globalManagerIds: ['mgr_global'],
    });
    mockPrisma.slaAlert.findUnique.mockResolvedValue({ deliveryStatus: 'pending' });
  });

  it('hides notify button for accountant-only recipients', async () => {
    mockPrisma.clientRequest.findUnique.mockResolvedValue({
      id: 'request-uuid',
      chatId: BigInt(-1001234567890),
      status: 'escalated',
      clientUsername: 'client',
      messageText: 'Нужна помощь',
      chat: {
        title: 'Test chat',
        chatType: 'supergroup',
        inviteLink: null,
        slaThresholdMinutes: 60,
        managerTelegramIds: ['mgr_111'],
        accountantTelegramIds: [BigInt(222)],
      },
      slaAlerts: [
        {
          id: 'alert-uuid',
          minutesElapsed: 60,
        },
      ],
    });

    const job = createMockJob({
      requestId: 'request-uuid',
      alertType: 'breach',
      managerIds: ['222'],
      escalationLevel: 1,
    });

    await capturedHandler!(job);

    expect(mockBuildAlertKeyboard).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: 'alert-uuid',
      }),
      expect.objectContaining({
        showNotifyButton: false,
      })
    );
  });

  it('keeps notify button for manager recipients', async () => {
    mockPrisma.clientRequest.findUnique.mockResolvedValue({
      id: 'request-uuid',
      chatId: BigInt(-1001234567890),
      status: 'escalated',
      clientUsername: 'client',
      messageText: 'Нужна помощь',
      chat: {
        title: 'Test chat',
        chatType: 'supergroup',
        inviteLink: null,
        slaThresholdMinutes: 60,
        managerTelegramIds: ['mgr_111'],
        accountantTelegramIds: [BigInt(222)],
      },
      slaAlerts: [
        {
          id: 'alert-uuid',
          minutesElapsed: 60,
        },
      ],
    });

    const job = createMockJob({
      requestId: 'request-uuid',
      alertType: 'breach',
      managerIds: ['mgr_111'],
      escalationLevel: 1,
    });

    await capturedHandler!(job);

    expect(mockBuildAlertKeyboard).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: 'alert-uuid',
      }),
      expect.objectContaining({
        showNotifyButton: true,
      })
    );
  });
});
