/**
 * SLA Router Contract
 *
 * tRPC router для операций SLA мониторинга.
 * Используется Admin Panel и Bot для управления SLA таймерами и алертами.
 *
 * @module contracts/sla.router
 */

import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const CreateRequestInput = z.object({
  chatId: z.string(),
  messageId: z.string(),
  messageText: z.string().max(10000),
  clientUsername: z.string().optional(),
  receivedAt: z.date().optional(),
});

export const ClassifyMessageInput = z.object({
  messageText: z.string().max(10000),
  forceModel: z.enum(['openrouter', 'keyword-fallback']).optional(),
});

export const StartSlaTimerInput = z.object({
  requestId: z.string().uuid(),
});

export const StopSlaTimerInput = z.object({
  requestId: z.string().uuid(),
  respondedBy: z.string().uuid(),
  responseMessageId: z.string().optional(),
});

export const GetRequestsInput = z.object({
  chatId: z.string().optional(),
  accountantId: z.string().uuid().optional(),
  status: z.enum(['pending', 'in_progress', 'answered', 'escalated']).optional(),
  slaBreached: z.boolean().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export const GetRequestByIdInput = z.object({
  requestId: z.string().uuid(),
});

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

export const ClassificationResult = z.object({
  classification: z.enum(['REQUEST', 'SPAM', 'GRATITUDE', 'CLARIFICATION']),
  confidence: z.number().min(0).max(1),
  model: z.enum(['openrouter', 'keyword-fallback']),
  reasoning: z.string().optional(),
});

export const RequestOutput = z.object({
  id: z.string().uuid(),
  chatId: z.string(),
  messageId: z.string(),
  messageText: z.string(),
  clientUsername: z.string().nullable(),
  receivedAt: z.date(),
  status: z.enum(['pending', 'in_progress', 'answered', 'escalated']),

  // Classification
  classification: z.enum(['REQUEST', 'SPAM', 'GRATITUDE', 'CLARIFICATION']),
  classificationScore: z.number().nullable(),
  classificationModel: z.string().nullable(),

  // SLA
  slaTimerStartedAt: z.date().nullable(),
  slaWorkingMinutes: z.number().nullable(),
  slaBreached: z.boolean(),

  // Response
  responseAt: z.date().nullable(),
  responseTimeMinutes: z.number().nullable(),
  respondedBy: z.string().uuid().nullable(),

  // Assigned
  assignedTo: z.string().uuid().nullable(),
  assignedAccountantName: z.string().nullable(),

  // Chat info
  chatTitle: z.string().nullable(),
});

export const RequestListOutput = z.object({
  items: z.array(RequestOutput),
  total: z.number(),
  hasMore: z.boolean(),
});

export const SlaTimerResult = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['started', 'stopped', 'already_stopped', 'not_found']),
  workingMinutes: z.number().optional(),
  breached: z.boolean().optional(),
});

// ============================================================================
// ROUTER DEFINITION (tRPC Contract)
// ============================================================================

/**
 * SLA Router Procedures:
 *
 * Mutations:
 * - createRequest: Создать новый запрос клиента (вызывается ботом)
 * - classifyMessage: Классифицировать сообщение (AI или fallback)
 * - startTimer: Запустить SLA таймер для запроса
 * - stopTimer: Остановить SLA таймер (бухгалтер ответил)
 *
 * Queries:
 * - getRequests: Получить список запросов с фильтрами
 * - getRequestById: Получить запрос по ID
 * - getActiveTimers: Получить активные SLA таймеры
 */

export const slaRouterContract = {
  // Mutations
  createRequest: {
    input: CreateRequestInput,
    output: RequestOutput,
    description: 'Создать новый запрос клиента из Telegram сообщения',
  },

  classifyMessage: {
    input: ClassifyMessageInput,
    output: ClassificationResult,
    description: 'Классифицировать сообщение (REQUEST/SPAM/GRATITUDE/CLARIFICATION)',
  },

  startTimer: {
    input: StartSlaTimerInput,
    output: SlaTimerResult,
    description: 'Запустить SLA таймер для запроса',
  },

  stopTimer: {
    input: StopSlaTimerInput,
    output: SlaTimerResult,
    description: 'Остановить SLA таймер (при ответе бухгалтера)',
  },

  // Queries
  getRequests: {
    input: GetRequestsInput,
    output: RequestListOutput,
    description: 'Получить список запросов с фильтрами и пагинацией',
  },

  getRequestById: {
    input: GetRequestByIdInput,
    output: RequestOutput,
    description: 'Получить детали запроса по ID',
  },

  getActiveTimers: {
    input: z.object({
      chatId: z.string().optional(),
    }),
    output: z.array(
      z.object({
        requestId: z.string().uuid(),
        chatId: z.string(),
        startedAt: z.date(),
        elapsedMinutes: z.number(),
        thresholdMinutes: z.number(),
        breachAt: z.date(),
      })
    ),
    description: 'Получить список активных SLA таймеров',
  },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateRequestInput = z.infer<typeof CreateRequestInput>;
export type ClassifyMessageInput = z.infer<typeof ClassifyMessageInput>;
export type ClassificationResult = z.infer<typeof ClassificationResult>;
export type RequestOutput = z.infer<typeof RequestOutput>;
export type RequestListOutput = z.infer<typeof RequestListOutput>;
export type SlaTimerResult = z.infer<typeof SlaTimerResult>;
