/**
 * Alert Router Contract
 *
 * tRPC router для управления SLA алертами менеджеров.
 * Используется Admin Panel и Bot для отправки/управления алертами.
 *
 * @module contracts/alert.router
 */

import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const GetAlertsInput = z.object({
  requestId: z.string().uuid().optional(),
  managerId: z.string().optional(),
  alertType: z.enum(['warning', 'breach']).optional(),
  deliveryStatus: z.enum(['pending', 'sent', 'delivered', 'failed']).optional(),
  resolved: z.boolean().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export const GetAlertByIdInput = z.object({
  alertId: z.string().uuid(),
});

export const CreateAlertInput = z.object({
  requestId: z.string().uuid(),
  alertType: z.enum(['warning', 'breach']),
  managerTelegramId: z.string(),
});

export const ResolveAlertInput = z.object({
  alertId: z.string().uuid(),
  action: z.enum(['mark_resolved', 'accountant_responded', 'auto_expired']),
  resolvedBy: z.string().uuid().optional(),
  resolutionNotes: z.string().max(500).optional(),
});

export const NotifyAccountantInput = z.object({
  alertId: z.string().uuid(),
  message: z.string().max(500).optional(),
});

export const UpdateDeliveryStatusInput = z.object({
  alertId: z.string().uuid(),
  status: z.enum(['sent', 'delivered', 'failed']),
  telegramMessageId: z.string().optional(),
});

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

export const AlertOutput = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),

  // Alert info
  alertType: z.enum(['warning', 'breach']),
  minutesElapsed: z.number(),
  escalationLevel: z.number(),
  nextEscalationAt: z.date().nullable(),

  // Delivery
  managerTelegramId: z.string(),
  telegramMessageId: z.string().nullable(),
  deliveryStatus: z.enum(['pending', 'sent', 'delivered', 'failed']),
  deliveredAt: z.date().nullable(),
  alertSentAt: z.date(),

  // Resolution
  acknowledgedAt: z.date().nullable(),
  acknowledgedBy: z.string().uuid().nullable(),
  acknowledgedByName: z.string().nullable(),
  resolvedAction: z.enum(['mark_resolved', 'accountant_responded', 'auto_expired']).nullable(),
  resolutionNotes: z.string().nullable(),

  // Related data
  request: z
    .object({
      chatId: z.string(),
      chatTitle: z.string().nullable(),
      clientUsername: z.string().nullable(),
      messagePreview: z.string(),
      accountantName: z.string().nullable(),
    })
    .optional(),
});

export const AlertListOutput = z.object({
  items: z.array(AlertOutput),
  total: z.number(),
  hasMore: z.boolean(),
});

export const AlertStatsOutput = z.object({
  today: z.object({
    total: z.number(),
    warnings: z.number(),
    breaches: z.number(),
    resolved: z.number(),
    pending: z.number(),
  }),
  week: z.object({
    total: z.number(),
    warnings: z.number(),
    breaches: z.number(),
    avgResolutionMinutes: z.number().nullable(),
  }),
  month: z.object({
    total: z.number(),
    breaches: z.number(),
    topOffenders: z.array(
      z.object({
        accountantId: z.string().uuid(),
        accountantName: z.string(),
        breachCount: z.number(),
      })
    ),
  }),
});

// ============================================================================
// ROUTER DEFINITION (tRPC Contract)
// ============================================================================

/**
 * Alert Router Procedures:
 *
 * Mutations:
 * - createAlert: Создать новый SLA алерт
 * - resolveAlert: Закрыть алерт (менеджер или автоматически)
 * - notifyAccountant: Отправить уведомление бухгалтеру
 * - updateDeliveryStatus: Обновить статус доставки (callback от бота)
 *
 * Queries:
 * - getAlerts: Получить список алертов с фильтрами
 * - getAlertById: Получить детали алерта
 * - getActiveAlerts: Получить активные (неразрешённые) алерты
 * - getAlertStats: Получить статистику алертов
 */

export const alertRouterContract = {
  // Mutations
  createAlert: {
    input: CreateAlertInput,
    output: AlertOutput,
    description: 'Создать новый SLA алерт для менеджера',
  },

  resolveAlert: {
    input: ResolveAlertInput,
    output: AlertOutput,
    description: 'Закрыть алерт (mark resolved, accountant responded, auto expired)',
  },

  notifyAccountant: {
    input: NotifyAccountantInput,
    output: z.object({
      success: z.boolean(),
      accountantNotified: z.string(),
    }),
    description: 'Отправить уведомление бухгалтеру о просроченном запросе',
  },

  updateDeliveryStatus: {
    input: UpdateDeliveryStatusInput,
    output: AlertOutput,
    description: 'Обновить статус доставки Telegram сообщения',
  },

  // Queries
  getAlerts: {
    input: GetAlertsInput,
    output: AlertListOutput,
    description: 'Получить список алертов с фильтрами и пагинацией',
  },

  getAlertById: {
    input: GetAlertByIdInput,
    output: AlertOutput,
    description: 'Получить детали алерта по ID',
  },

  getActiveAlerts: {
    input: z.object({
      managerId: z.string().optional(),
    }),
    output: z.array(AlertOutput),
    description: 'Получить все активные (неразрешённые) алерты',
  },

  getAlertStats: {
    input: z.object({
      managerId: z.string().optional(),
    }),
    output: AlertStatsOutput,
    description: 'Получить статистику алертов (today/week/month)',
  },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type GetAlertsInput = z.infer<typeof GetAlertsInput>;
export type AlertOutput = z.infer<typeof AlertOutput>;
export type AlertListOutput = z.infer<typeof AlertListOutput>;
export type AlertStatsOutput = z.infer<typeof AlertStatsOutput>;
