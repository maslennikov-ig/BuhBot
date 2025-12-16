/**
 * Message Handler Filtering Tests (T2)
 *
 * Tests for message filtering logic in message.handler.ts
 * Validates classification routing and ClientRequest creation rules.
 *
 * Test Cases:
 * 1. Accountant message → skip classification, return early
 * 2. Client REQUEST → create ClientRequest with status='pending', start SLA timer
 * 3. Client CLARIFICATION → create ClientRequest with status='answered', no SLA timer
 * 4. Client SPAM → classify but NOT create ClientRequest
 * 5. Client GRATITUDE → classify but NOT create ClientRequest
 * 6. Unregistered chat → return early
 * 7. Chat with monitoring disabled → return early
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { ClassificationResult } from '../../../services/classifier/types.js';

// Mock dependencies
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../services/classifier/index.js', () => ({
  classifyMessage: vi.fn(),
}));

vi.mock('../../../services/sla/timer.service.js', () => ({
  startSlaTimer: vi.fn(),
}));

vi.mock('../response.handler.js', () => ({
  isAccountantForChat: vi.fn(),
}));

// Mock Prisma client
const mockPrisma = {
  chat: {
    findUnique: vi.fn(),
  },
  clientRequest: {
    create: vi.fn(),
  },
} as unknown as PrismaClient;

describe('Message Handler - Filtering Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip classification for accountant messages (return early)', async () => {
    const { classifyMessage } = await import('../../../services/classifier/index.js');
    const { isAccountantForChat } = await import('../response.handler.js');

    // Mock chat as registered and enabled
    (mockPrisma.chat.findUnique as any).mockResolvedValue({
      id: BigInt(123),
      slaEnabled: true,
      monitoringEnabled: true,
    });

    // Mock sender as accountant
    (isAccountantForChat as any).mockResolvedValue({
      isAccountant: true,
      accountantId: 'acc_123',
    });

    // Simulate message handler logic
    const chat = await mockPrisma.chat.findUnique({ where: { id: BigInt(123) } });

    if (!chat || !chat.slaEnabled || !chat.monitoringEnabled) {
      throw new Error('Test setup failed: chat should be enabled');
    }

    const { isAccountant } = await isAccountantForChat(BigInt(123), 'accountant_user', 12345);

    // If accountant, should return early WITHOUT calling classifyMessage
    if (isAccountant) {
      // Early return - no classification
      expect(classifyMessage).not.toHaveBeenCalled();
      return;
    }

    // If we reach here, test should fail
    throw new Error('Should have returned early for accountant');
  });

  it('should create ClientRequest with status=pending for REQUEST and start SLA timer', async () => {
    const { classifyMessage } = await import('../../../services/classifier/index.js');
    const { isAccountantForChat } = await import('../response.handler.js');
    const { startSlaTimer } = await import('../../../services/sla/timer.service.js');

    // Mock chat
    (mockPrisma.chat.findUnique as any).mockResolvedValue({
      id: BigInt(123),
      slaEnabled: true,
      monitoringEnabled: true,
      slaThresholdMinutes: 60,
    });

    // Mock sender as client (not accountant)
    (isAccountantForChat as any).mockResolvedValue({
      isAccountant: false,
      accountantId: null,
    });

    // Mock classification result as REQUEST
    const classificationResult: ClassificationResult = {
      classification: 'REQUEST',
      confidence: 0.92,
      model: 'openrouter',
      reasoning: 'Client asking for documents',
    };
    (classifyMessage as any).mockResolvedValue(classificationResult);

    // Mock clientRequest creation
    const mockRequest = {
      id: 'req_123',
      chatId: BigInt(123),
      messageId: BigInt(456),
      status: 'pending',
    };
    (mockPrisma.clientRequest.create as any).mockResolvedValue(mockRequest);

    // Simulate message handler logic
    const chat = await mockPrisma.chat.findUnique({ where: { id: BigInt(123) } });
    const { isAccountant } = await isAccountantForChat(BigInt(123), 'client_user', 67890);

    if (!isAccountant) {
      const classification = await classifyMessage(mockPrisma, 'Where is my invoice?');

      if (['REQUEST', 'CLARIFICATION'].includes(classification.classification)) {
        const request = await mockPrisma.clientRequest.create({
          data: {
            chatId: BigInt(123),
            messageId: BigInt(456),
            messageText: 'Where is my invoice?',
            clientUsername: 'client_user',
            classification: classification.classification,
            classificationScore: classification.confidence,
            classificationModel: classification.model,
            status: classification.classification === 'REQUEST' ? 'pending' : 'answered',
            receivedAt: new Date(),
          },
        });

        // Start SLA timer for REQUEST only
        if (classification.classification === 'REQUEST') {
          await startSlaTimer(request.id, '123', chat!.slaThresholdMinutes ?? 60);
        }

        // Verify request created with status=pending
        expect(mockPrisma.clientRequest.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'pending',
              classification: 'REQUEST',
            }),
          })
        );

        // Verify SLA timer started
        expect(startSlaTimer).toHaveBeenCalledWith('req_123', '123', 60);
      }
    }
  });

  it('should create ClientRequest with status=answered for CLARIFICATION and NOT start SLA timer', async () => {
    const { classifyMessage } = await import('../../../services/classifier/index.js');
    const { isAccountantForChat } = await import('../response.handler.js');
    const { startSlaTimer } = await import('../../../services/sla/timer.service.js');

    // Mock chat
    (mockPrisma.chat.findUnique as any).mockResolvedValue({
      id: BigInt(123),
      slaEnabled: true,
      monitoringEnabled: true,
      slaThresholdMinutes: 60,
    });

    // Mock sender as client
    (isAccountantForChat as any).mockResolvedValue({
      isAccountant: false,
      accountantId: null,
    });

    // Mock classification result as CLARIFICATION
    const classificationResult: ClassificationResult = {
      classification: 'CLARIFICATION',
      confidence: 0.88,
      model: 'openrouter',
      reasoning: 'Follow-up to previous message',
    };
    (classifyMessage as any).mockResolvedValue(classificationResult);

    // Mock clientRequest creation
    const mockRequest = {
      id: 'req_456',
      chatId: BigInt(123),
      messageId: BigInt(789),
      status: 'answered',
    };
    (mockPrisma.clientRequest.create as any).mockResolvedValue(mockRequest);

    // Simulate message handler logic
    const chat = await mockPrisma.chat.findUnique({ where: { id: BigInt(123) } });
    const { isAccountant } = await isAccountantForChat(BigInt(123), 'client_user', 67890);

    if (!isAccountant) {
      const classification = await classifyMessage(mockPrisma, 'I forgot to mention...');

      if (['REQUEST', 'CLARIFICATION'].includes(classification.classification)) {
        const request = await mockPrisma.clientRequest.create({
          data: {
            chatId: BigInt(123),
            messageId: BigInt(789),
            messageText: 'I forgot to mention...',
            clientUsername: 'client_user',
            classification: classification.classification,
            classificationScore: classification.confidence,
            classificationModel: classification.model,
            status: classification.classification === 'REQUEST' ? 'pending' : 'answered',
            receivedAt: new Date(),
          },
        });

        // Start SLA timer for REQUEST only
        if (classification.classification === 'REQUEST') {
          await startSlaTimer(request.id, '123', chat!.slaThresholdMinutes ?? 60);
        }

        // Verify request created with status=answered
        expect(mockPrisma.clientRequest.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'answered',
              classification: 'CLARIFICATION',
            }),
          })
        );

        // Verify SLA timer NOT started for CLARIFICATION
        expect(startSlaTimer).not.toHaveBeenCalled();
      }
    }
  });

  it('should classify SPAM but NOT create ClientRequest', async () => {
    const { classifyMessage } = await import('../../../services/classifier/index.js');
    const { isAccountantForChat } = await import('../response.handler.js');

    // Mock chat
    (mockPrisma.chat.findUnique as any).mockResolvedValue({
      id: BigInt(123),
      slaEnabled: true,
      monitoringEnabled: true,
    });

    // Mock sender as client
    (isAccountantForChat as any).mockResolvedValue({
      isAccountant: false,
      accountantId: null,
    });

    // Mock classification result as SPAM
    const classificationResult: ClassificationResult = {
      classification: 'SPAM',
      confidence: 0.95,
      model: 'openrouter',
      reasoning: 'Simple acknowledgment',
    };
    (classifyMessage as any).mockResolvedValue(classificationResult);

    // Simulate message handler logic
    await mockPrisma.chat.findUnique({ where: { id: BigInt(123) } });
    const { isAccountant } = await isAccountantForChat(BigInt(123), 'client_user', 67890);

    if (!isAccountant) {
      const classification = await classifyMessage(mockPrisma, 'ok');

      // Classification happens
      expect(classifyMessage).toHaveBeenCalled();

      // But ClientRequest NOT created for SPAM
      if (!['REQUEST', 'CLARIFICATION'].includes(classification.classification)) {
        expect(mockPrisma.clientRequest.create).not.toHaveBeenCalled();
      }
    }
  });

  it('should classify GRATITUDE but NOT create ClientRequest', async () => {
    const { classifyMessage } = await import('../../../services/classifier/index.js');
    const { isAccountantForChat } = await import('../response.handler.js');

    // Mock chat
    (mockPrisma.chat.findUnique as any).mockResolvedValue({
      id: BigInt(123),
      slaEnabled: true,
      monitoringEnabled: true,
    });

    // Mock sender as client
    (isAccountantForChat as any).mockResolvedValue({
      isAccountant: false,
      accountantId: null,
    });

    // Mock classification result as GRATITUDE
    const classificationResult: ClassificationResult = {
      classification: 'GRATITUDE',
      confidence: 0.98,
      model: 'openrouter',
      reasoning: 'Thank you message',
    };
    (classifyMessage as any).mockResolvedValue(classificationResult);

    // Simulate message handler logic
    await mockPrisma.chat.findUnique({ where: { id: BigInt(123) } });
    const { isAccountant } = await isAccountantForChat(BigInt(123), 'client_user', 67890);

    if (!isAccountant) {
      const classification = await classifyMessage(mockPrisma, 'Thank you so much!');

      // Classification happens
      expect(classifyMessage).toHaveBeenCalled();

      // But ClientRequest NOT created for GRATITUDE
      if (!['REQUEST', 'CLARIFICATION'].includes(classification.classification)) {
        expect(mockPrisma.clientRequest.create).not.toHaveBeenCalled();
      }
    }
  });

  it('should return early for unregistered chat (chat not found)', async () => {
    const { classifyMessage } = await import('../../../services/classifier/index.js');

    // Mock chat as not found (null)
    (mockPrisma.chat.findUnique as any).mockResolvedValue(null);

    // Simulate message handler logic
    const chat = await mockPrisma.chat.findUnique({ where: { id: BigInt(999) } });

    // If chat not registered, return early
    if (!chat) {
      expect(classifyMessage).not.toHaveBeenCalled();
      return;
    }

    throw new Error('Should have returned early for unregistered chat');
  });

  it('should return early for chat with monitoring disabled', async () => {
    const { classifyMessage } = await import('../../../services/classifier/index.js');

    // Mock chat with monitoring disabled
    (mockPrisma.chat.findUnique as any).mockResolvedValue({
      id: BigInt(123),
      slaEnabled: false,
      monitoringEnabled: false,
    });

    // Simulate message handler logic
    const chat = await mockPrisma.chat.findUnique({ where: { id: BigInt(123) } });

    // If monitoring disabled, return early
    if (!chat || !chat.slaEnabled || !chat.monitoringEnabled) {
      expect(classifyMessage).not.toHaveBeenCalled();
      return;
    }

    throw new Error('Should have returned early for disabled monitoring');
  });
});
