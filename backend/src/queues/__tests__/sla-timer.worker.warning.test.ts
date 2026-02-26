/**
 * SLA Timer Worker Tests - Warning Path
 *
 * Tests for warning job processing (pre-breach notifications).
 * Captures the actual processSlaTimer handler from the Worker mock
 * and tests it with mock Job objects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { SlaTimerJobData } from '../setup.js';

// ============================================
// MOCKS (hoisted)
// ============================================

const mockPrisma = vi.hoisted(() => ({
  clientRequest: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  slaAlert: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  globalSettings: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const mockBot = vi.hoisted(() => ({
  telegram: {
    sendMessage: vi.fn(),
  },
}));

const mockQueueAlert = vi.hoisted(() => vi.fn());
const mockGetManagerIds = vi.hoisted(() => vi.fn());
const mockGetRecipientsByLevel = vi.hoisted(() => vi.fn());

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../bot/bot.js', () => ({
  bot: mockBot,
}));

vi.mock('../setup.js', () => ({
  QUEUE_NAMES: { SLA_TIMERS: 'sla-timers' },
  registerWorker: vi.fn(),
  queueAlert: mockQueueAlert,
}));

vi.mock('../../config/config.service.js', () => ({
  getManagerIds: mockGetManagerIds,
  getRecipientsByLevel: mockGetRecipientsByLevel,
}));

vi.mock('../../lib/redis.js', () => ({
  redis: {},
}));

vi.mock('../../config/queue.config.js', () => ({
  queueConfig: {
    slaConcurrency: 5,
    slaRateLimitMax: 10,
    slaRateLimitDuration: 1000,
  },
}));

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../services/alerts/format.service.js', () => ({
  formatBreachChatNotification: vi.fn(() => 'Breach notification'),
}));

// Capture the handler passed to Worker constructor
let capturedHandler: ((job: Job<SlaTimerJobData>) => Promise<void>) | null = null;

const MockWorkerClass = vi.hoisted(() => {
  // Must use a real class (not arrow fn) because it's called with `new`
  return class MockWorker {
    on = () => {};
    constructor(_name: string, handler: unknown, _opts?: unknown) {
      // Store handler in a closure-accessible variable via side-effect
      (globalThis as Record<string, unknown>).__capturedSlaHandler = handler;
    }
  };
});

vi.mock('bullmq', () => ({
  Worker: MockWorkerClass,
  Job: class {},
}));

// Trigger module evaluation to capture the handler
await import('../sla-timer.worker.js');
capturedHandler = (globalThis as Record<string, unknown>)
  .__capturedSlaHandler as typeof capturedHandler;

// ============================================
// HELPERS
// ============================================

function createMockJob(data: SlaTimerJobData): Job<SlaTimerJobData> {
  return {
    id: 'test-job-id',
    name: 'sla-check',
    data,
  } as unknown as Job<SlaTimerJobData>;
}

const CHAT_ID = '-1001234567890';
const REQUEST_ID = 'test-request-uuid';
const THRESHOLD = 60;

function createMockRequest(overrides = {}) {
  return {
    id: REQUEST_ID,
    chatId: BigInt(CHAT_ID),
    status: 'pending',
    slaBreached: false,
    clientUsername: 'test_client',
    messageText: 'Когда будет готов отчёт?',
    receivedAt: new Date(Date.now() - 48 * 60 * 1000), // 48 min ago
    chat: {
      id: BigInt(CHAT_ID),
      title: 'Тест Бухгалтерия',
      slaThresholdMinutes: THRESHOLD,
      notifyInChatOnBreach: false,
      managerTelegramIds: ['mgr_111'],
      accountantTelegramIds: [BigInt(222), BigInt(333)],
    },
    ...overrides,
  };
}

// ============================================
// TESTS
// ============================================

describe('SLA Timer Worker - Warning Path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetManagerIds.mockResolvedValue(['mgr_111']);
    mockGetRecipientsByLevel.mockResolvedValue({
      recipients: ['222', '333'],
      tier: 'accountant',
    });
  });

  it('should have captured the handler', () => {
    expect(capturedHandler).not.toBeNull();
  });

  describe('warning job for pending request', () => {
    it('should create SlaAlert with alertType=warning and escalationLevel=0', async () => {
      const mockRequest = createMockRequest();
      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.slaAlert.findFirst.mockResolvedValue(null); // No existing warning
      mockPrisma.slaAlert.create.mockResolvedValue({
        id: 'alert-uuid',
        requestId: REQUEST_ID,
        alertType: 'warning',
        minutesElapsed: 48,
        deliveryStatus: 'pending',
        escalationLevel: 0,
      });
      mockQueueAlert.mockResolvedValue(undefined);

      const job = createMockJob({
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        threshold: THRESHOLD,
        type: 'warning',
      });

      await capturedHandler!(job);

      // Verify SlaAlert created with warning type
      expect(mockPrisma.slaAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requestId: REQUEST_ID,
          alertType: 'warning',
          escalationLevel: 0,
          deliveryStatus: 'pending',
        }),
      });

      // Verify request was NOT marked as breached
      expect(mockPrisma.clientRequest.update).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should queue alert to accountants (primary recipients)', async () => {
      const mockRequest = createMockRequest();
      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.slaAlert.findFirst.mockResolvedValue(null);
      mockPrisma.slaAlert.create.mockResolvedValue({
        id: 'alert-uuid',
        alertType: 'warning',
      });
      mockQueueAlert.mockResolvedValue(undefined);

      const job = createMockJob({
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        threshold: THRESHOLD,
        type: 'warning',
      });

      await capturedHandler!(job);

      expect(mockQueueAlert).toHaveBeenCalledWith({
        requestId: REQUEST_ID,
        alertType: 'warning',
        managerIds: ['222', '333'], // accountant IDs
        escalationLevel: 0,
      });
    });

    it('should fallback to managers when no accountants', async () => {
      const mockRequest = createMockRequest({
        chat: {
          id: BigInt(CHAT_ID),
          title: 'Test',
          slaThresholdMinutes: THRESHOLD,
          notifyInChatOnBreach: false,
          managerTelegramIds: ['mgr_111'],
          accountantTelegramIds: [], // No accountants
        },
      });
      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.slaAlert.findFirst.mockResolvedValue(null);
      mockPrisma.slaAlert.create.mockResolvedValue({
        id: 'alert-uuid',
        alertType: 'warning',
      });
      mockQueueAlert.mockResolvedValue(undefined);

      const job = createMockJob({
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        threshold: THRESHOLD,
        type: 'warning',
      });

      await capturedHandler!(job);

      // Should have called getManagerIds for fallback
      expect(mockGetManagerIds).toHaveBeenCalledWith(['mgr_111']);
      expect(mockQueueAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          managerIds: ['mgr_111'],
        })
      );
    });
  });

  describe('warning job skips', () => {
    it('should skip when request is answered', async () => {
      mockPrisma.clientRequest.findUnique.mockResolvedValue(
        createMockRequest({ status: 'answered' })
      );

      const job = createMockJob({
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        threshold: THRESHOLD,
        type: 'warning',
      });

      await capturedHandler!(job);

      expect(mockPrisma.slaAlert.create).not.toHaveBeenCalled();
      expect(mockQueueAlert).not.toHaveBeenCalled();
    });

    it('should skip when request is closed', async () => {
      mockPrisma.clientRequest.findUnique.mockResolvedValue(
        createMockRequest({ status: 'closed' })
      );

      const job = createMockJob({
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        threshold: THRESHOLD,
        type: 'warning',
      });

      await capturedHandler!(job);

      expect(mockPrisma.slaAlert.create).not.toHaveBeenCalled();
    });

    it('should skip when request is escalated (no longer pending)', async () => {
      mockPrisma.clientRequest.findUnique.mockResolvedValue(
        createMockRequest({ status: 'escalated' })
      );

      const job = createMockJob({
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        threshold: THRESHOLD,
        type: 'warning',
      });

      await capturedHandler!(job);

      expect(mockPrisma.slaAlert.create).not.toHaveBeenCalled();
    });

    it('should skip when request not found', async () => {
      mockPrisma.clientRequest.findUnique.mockResolvedValue(null);

      const job = createMockJob({
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        threshold: THRESHOLD,
        type: 'warning',
      });

      await capturedHandler!(job);

      expect(mockPrisma.slaAlert.create).not.toHaveBeenCalled();
    });
  });

  describe('idempotency guard (CR-002)', () => {
    it('should skip when warning alert already exists', async () => {
      mockPrisma.clientRequest.findUnique.mockResolvedValue(createMockRequest());
      mockPrisma.slaAlert.findFirst.mockResolvedValue({
        id: 'existing-alert-uuid',
        alertType: 'warning',
        escalationLevel: 0,
      });

      const job = createMockJob({
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        threshold: THRESHOLD,
        type: 'warning',
      });

      await capturedHandler!(job);

      // Should check for existing warning
      expect(mockPrisma.slaAlert.findFirst).toHaveBeenCalledWith({
        where: {
          requestId: REQUEST_ID,
          alertType: 'warning',
          escalationLevel: 0,
          resolvedAction: null,
        },
      });

      // Should NOT create duplicate
      expect(mockPrisma.slaAlert.create).not.toHaveBeenCalled();
      expect(mockQueueAlert).not.toHaveBeenCalled();
    });
  });

  describe('breach job (default path)', () => {
    it('should use transaction for breach jobs', async () => {
      const mockRequest = createMockRequest();
      mockPrisma.clientRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.$transaction.mockResolvedValue({
        id: 'breach-alert-uuid',
        requestId: REQUEST_ID,
        alertType: 'breach',
      });
      mockQueueAlert.mockResolvedValue(undefined);

      const job = createMockJob({
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        threshold: THRESHOLD,
        // type not set = defaults to 'breach'
      });

      await capturedHandler!(job);

      // Breach path uses $transaction
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // Warning path should NOT have been triggered
      expect(mockPrisma.slaAlert.findFirst).not.toHaveBeenCalled();
    });
  });
});
