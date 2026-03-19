/**
 * Schema Contract Tests
 *
 * Pure Zod schema validation tests — no Prisma, no tRPC context, no mocks.
 * Each schema is recreated here to mirror the router definitions exactly.
 * When a router schema changes, the corresponding schema here MUST be updated.
 *
 * Routers covered:
 *   - sla.ts         (input + output schemas)
 *   - chats.ts       (input + output schemas)
 *   - settings.ts    (input + output schemas)
 *   - alert.ts       (input + output schemas)
 *   - alerts.ts      (input + output schemas)
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/** Remove a key from an object (used to test missing required fields) */
function omitKey<T extends Record<string, unknown>>(obj: T, key: string): Partial<T> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

// ============================================================================
// SCHEMA MIRRORS — mirrored from router files (not exported by the routers)
// ============================================================================

// --- sla.ts -----------------------------------------------------------------

const RequestStatusSchema = z.enum([
  'pending',
  'in_progress',
  'waiting_client',
  'transferred',
  'answered',
  'escalated',
  'closed',
]);

const MessageClassificationSchema = z.enum(['REQUEST', 'SPAM', 'GRATITUDE', 'CLARIFICATION']);

const ClassificationSourceSchema = z.enum(['openrouter', 'keyword-fallback']);

const CreateRequestInput = z.object({
  chatId: z.string(),
  messageId: z.string(),
  messageText: z.string().max(10000),
  clientUsername: z.string().optional(),
  receivedAt: z.coerce.date().optional(),
});

const ClassifyMessageInput = z.object({
  messageText: z.string().max(10000),
  forceModel: z.enum(['openrouter', 'keyword-fallback']).optional(),
});

const StartSlaTimerInput = z.object({
  requestId: z.string().uuid(),
});

const StopSlaTimerInput = z.object({
  requestId: z.string().uuid(),
  respondedBy: z.string().uuid(),
  responseMessageId: z.string().optional(),
});

const GetRequestsInput = z.object({
  chatId: z.string().optional(),
  accountantId: z.string().uuid().optional(),
  status: RequestStatusSchema.optional(),
  slaBreached: z.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const GetRequestByIdInput = z.object({
  requestId: z.string().uuid(),
});

const GetActiveTimersInput = z.object({
  chatId: z.string().optional(),
});

const ClassificationResultOutput = z.object({
  classification: MessageClassificationSchema,
  confidence: z.number().min(0).max(1),
  model: ClassificationSourceSchema,
  reasoning: z.string().optional(),
});

const RequestOutput = z.object({
  id: z.string().uuid(),
  chatId: z.string(),
  messageId: z.string(),
  messageText: z.string(),
  clientUsername: z.string().nullable(),
  receivedAt: z.date(),
  status: RequestStatusSchema,
  classification: MessageClassificationSchema,
  classificationScore: z.number().nullable(),
  classificationModel: z.string().nullable(),
  slaTimerStartedAt: z.date().nullable(),
  slaWorkingMinutes: z.number().nullable(),
  slaBreached: z.boolean(),
  responseAt: z.date().nullable(),
  responseTimeMinutes: z.number().nullable(),
  respondedBy: z.string().uuid().nullable(),
  assignedTo: z.string().uuid().nullable(),
  assignedAccountantName: z.string().nullable(),
  chatTitle: z.string().nullable(),
});

const RequestListOutput = z.object({
  items: z.array(RequestOutput),
  total: z.number(),
  hasMore: z.boolean(),
});

const SlaTimerResultOutput = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['started', 'stopped', 'already_stopped', 'not_found']),
  workingMinutes: z.number().optional(),
  breached: z.boolean().optional(),
});

const ActiveTimerOutput = z.object({
  requestId: z.string().uuid(),
  chatId: z.string(),
  startedAt: z.date(),
  elapsedMinutes: z.number(),
  thresholdMinutes: z.number(),
  breachAt: z.date(),
});

// --- chats.ts ---------------------------------------------------------------

const ChatTypeSchema = z.enum(['private', 'group', 'supergroup']);

const ChatsListInput = z.object({
  assignedTo: z.string().uuid().optional(),
  slaEnabled: z.boolean().optional(),
  includeDisabled: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

const ChatUpdateInput = z.object({
  id: z.number(),
  assignedAccountantId: z.string().uuid().nullable().optional(),
  slaEnabled: z.boolean().optional(),
  slaThresholdMinutes: z.number().int().min(1).max(480).optional(),
  clientTier: z.enum(['basic', 'standard', 'vip', 'premium']).optional(),
  accountantUsernames: z
    .array(
      z
        .string()
        .transform((val) => (val.startsWith('@') ? val.slice(1) : val))
        .transform((val) => val.toLowerCase())
        .refine((val) => /^[a-z0-9][a-z0-9_]{3,30}[a-z0-9]$/.test(val), {
          message: 'Invalid username format',
        })
    )
    .max(20)
    .default([]),
  managerTelegramIds: z
    .array(z.string().regex(/^\d+$/, 'Telegram ID must be a number'))
    .max(20)
    .optional(),
});

const UpdateWorkingScheduleInput = z.object({
  chatId: z.string(),
  schedules: z.array(
    z.object({
      dayOfWeek: z.number().min(1).max(7),
      startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      isActive: z.boolean(),
    })
  ),
  timezone: z.string().optional(),
});

const RegisterChatInput = z.object({
  telegramChatId: z.string(),
  chatType: ChatTypeSchema,
  title: z.string().optional(),
  accountantUsername: z.string().optional(),
});

const CreateInvitationInput = z.object({
  initialTitle: z.string().optional(),
  assignedAccountantId: z.string().uuid().optional(),
  expiresInHours: z.number().int().min(1).max(720).default(72),
});

const ListInvitationsInput = z.object({
  includeUsed: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

const RevokeInvitationInput = z.object({
  id: z.string().uuid(),
});

// --- settings.ts ------------------------------------------------------------

const UpdateGlobalSettingsInput = z.object({
  defaultTimezone: z.string().optional(),
  defaultWorkingDays: z.array(z.number().min(1).max(7)).optional(),
  defaultStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format. Use HH:MM')
    .optional(),
  defaultEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format. Use HH:MM')
    .optional(),
  defaultSlaThreshold: z.number().min(1).max(480).optional(),
  maxEscalations: z.number().min(1).max(10).optional(),
  escalationIntervalMin: z.number().min(5).max(120).optional(),
  slaWarningPercent: z.number().min(0).max(99).optional(),
  globalManagerIds: z.array(z.string()).optional(),
  leadNotificationIds: z.array(z.string()).optional(),
  aiConfidenceThreshold: z.number().min(0).max(1).optional(),
  messagePreviewLength: z.number().min(100).max(1000).optional(),
  openrouterApiKey: z.string().min(1).optional(),
  openrouterModel: z.string().min(1).optional(),
  dataRetentionYears: z.number().min(1).max(10).optional(),
  internalChatId: z
    .string()
    .regex(/^-?\d+$/, 'Telegram Chat ID must be a number')
    .nullable()
    .optional(),
});

const AddGlobalHolidayInput = z.object({
  date: z.coerce.date(),
  name: z.string().min(1, 'Holiday name is required').max(100),
  year: z.number().min(2024).max(2030),
});

const RemoveGlobalHolidayInput = z.object({
  date: z.coerce.date(),
});

const BulkAddHolidaysInput = z.object({
  year: z.number().min(2024).max(2030),
  holidays: z.array(
    z.object({
      date: z.coerce.date(),
      name: z.string().max(100),
    })
  ),
});

const SeedRussianHolidaysInput = z.object({
  year: z.number().min(2024).max(2030),
});

const GetGlobalHolidaysInput = z.object({
  year: z.number().optional(),
});

const UpdateWorkingScheduleSettingsInput = z.object({
  days: z.array(z.number().min(1).max(7)),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  timezone: z.string(),
});

const UpdateSlaThresholdsInput = z.object({
  slaThreshold: z.number().min(1).max(480),
});

const GlobalSettingsOutput = z.object({
  defaultTimezone: z.string(),
  defaultWorkingDays: z.array(z.number()),
  defaultWorkingDaysDisplay: z.array(z.string()),
  defaultStartTime: z.string(),
  defaultEndTime: z.string(),
  defaultSlaThreshold: z.number(),
  maxEscalations: z.number(),
  escalationIntervalMin: z.number(),
  slaWarningPercent: z.number(),
  globalManagerIds: z.array(z.string()),
  globalManagerCount: z.number(),
  leadNotificationIds: z.array(z.string()),
  aiConfidenceThreshold: z.number(),
  messagePreviewLength: z.number(),
  openrouterApiKey: z.string().nullable(),
  openrouterModel: z.string(),
  dataRetentionYears: z.number(),
  internalChatId: z.string().nullable(),
  updatedAt: z.date(),
});

const GlobalHolidayOutput = z.object({
  id: z.string().uuid(),
  date: z.date(),
  name: z.string(),
  year: z.number(),
  createdAt: z.date(),
});

// --- alert.ts ---------------------------------------------------------------

const AlertTypeSchema = z.enum(['warning', 'breach']);
const AlertDeliveryStatusSchema = z.enum(['pending', 'sent', 'delivered', 'failed']);
const AlertActionSchema = z.enum(['mark_resolved', 'accountant_responded', 'auto_expired']);

const GetAlertsInput = z.object({
  requestId: z.string().uuid().optional(),
  managerId: z.string().optional(),
  alertType: AlertTypeSchema.optional(),
  deliveryStatus: AlertDeliveryStatusSchema.optional(),
  resolved: z.boolean().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const CreateAlertInput = z.object({
  requestId: z.string().uuid(),
  alertType: AlertTypeSchema,
  minutesElapsed: z.number().int().min(0),
  escalationLevel: z.number().int().min(1).max(5).default(1),
});

const ResolveAlertInput = z.object({
  alertId: z.string().uuid(),
  action: AlertActionSchema,
  resolvedBy: z.string().uuid().optional(),
  resolutionNotes: z.string().max(500).optional(),
});

const NotifyAccountantInput = z.object({
  alertId: z.string().uuid(),
  message: z.string().max(500).optional(),
});

const UpdateDeliveryStatusInput = z.object({
  alertId: z.string().uuid(),
  status: z.enum(['sent', 'delivered', 'failed']),
  telegramMessageId: z.string().optional(),
});

const AlertOutput = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  alertType: AlertTypeSchema,
  minutesElapsed: z.number(),
  escalationLevel: z.number(),
  nextEscalationAt: z.date().nullable(),
  managerTelegramId: z.string().nullable(),
  telegramMessageId: z.string().nullable(),
  deliveryStatus: AlertDeliveryStatusSchema,
  deliveredAt: z.date().nullable(),
  alertSentAt: z.date(),
  acknowledgedAt: z.date().nullable(),
  acknowledgedBy: z.string().uuid().nullable(),
  acknowledgedByName: z.string().nullable(),
  resolvedAction: AlertActionSchema.nullable(),
  resolutionNotes: z.string().nullable(),
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

const AlertStatsOutput = z.object({
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

// --- alerts.ts --------------------------------------------------------------

const ListUnacknowledgedInput = z.object({
  limit: z.number().int().min(1).max(50).default(20),
});

const AcknowledgeInput = z.object({
  id: z.string().uuid(),
  resolutionNotes: z.string().optional(),
});

const UnacknowledgedAlertOutput = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  alertType: AlertTypeSchema,
  minutesElapsed: z.number().int(),
  alertSentAt: z.date(),
  chatId: z.number(),
  messageText: z.string(),
  clientUsername: z.string().nullable(),
});

const AcknowledgeOutput = z.object({
  success: z.boolean(),
  alert: z.object({
    id: z.string().uuid(),
    acknowledgedAt: z.date(),
    acknowledgedBy: z.string().uuid(),
    resolutionNotes: z.string().nullable(),
  }),
});

// ============================================================================
// HELPERS
// ============================================================================

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// ============================================================================
// TESTS: sla.ts schemas
// ============================================================================

describe('SLA router schemas', () => {
  // --- RequestStatusSchema ---------------------------------------------------
  describe('RequestStatusSchema', () => {
    it('accepts all valid status values', () => {
      const validStatuses = [
        'pending',
        'in_progress',
        'waiting_client',
        'transferred',
        'answered',
        'escalated',
        'closed',
      ];
      for (const status of validStatuses) {
        expect(RequestStatusSchema.safeParse(status).success).toBe(true);
      }
    });

    it('rejects unknown status values', () => {
      expect(RequestStatusSchema.safeParse('open').success).toBe(false);
      expect(RequestStatusSchema.safeParse('done').success).toBe(false);
      expect(RequestStatusSchema.safeParse('').success).toBe(false);
    });
  });

  // --- MessageClassificationSchema ------------------------------------------
  describe('MessageClassificationSchema', () => {
    it('accepts all valid classification values', () => {
      for (const val of ['REQUEST', 'SPAM', 'GRATITUDE', 'CLARIFICATION']) {
        expect(MessageClassificationSchema.safeParse(val).success).toBe(true);
      }
    });

    it('rejects lowercase classification values', () => {
      expect(MessageClassificationSchema.safeParse('request').success).toBe(false);
      expect(MessageClassificationSchema.safeParse('spam').success).toBe(false);
    });

    it('rejects unknown classification values', () => {
      expect(MessageClassificationSchema.safeParse('UNKNOWN').success).toBe(false);
    });
  });

  // --- ClassificationSourceSchema -------------------------------------------
  describe('ClassificationSourceSchema', () => {
    it('accepts openrouter and keyword-fallback', () => {
      expect(ClassificationSourceSchema.safeParse('openrouter').success).toBe(true);
      expect(ClassificationSourceSchema.safeParse('keyword-fallback').success).toBe(true);
    });

    it('rejects other model names', () => {
      expect(ClassificationSourceSchema.safeParse('cache').success).toBe(false);
      expect(ClassificationSourceSchema.safeParse('error-fallback').success).toBe(false);
      expect(ClassificationSourceSchema.safeParse('gpt-4').success).toBe(false);
    });
  });

  // --- CreateRequestInput ---------------------------------------------------
  describe('CreateRequestInput', () => {
    const validInput = {
      chatId: '-1001234567890',
      messageId: '42',
      messageText: 'Hello, I need help with my taxes.',
    };

    it('accepts minimal valid input', () => {
      const result = CreateRequestInput.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('accepts full valid input with optional fields', () => {
      const result = CreateRequestInput.safeParse({
        ...validInput,
        clientUsername: 'johndoe',
        receivedAt: new Date().toISOString(),
      });
      expect(result.success).toBe(true);
    });

    it('coerces receivedAt string to Date', () => {
      const result = CreateRequestInput.safeParse({
        ...validInput,
        receivedAt: '2025-01-15T10:30:00.000Z',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.receivedAt).toBeInstanceOf(Date);
      }
    });

    it('rejects missing chatId', () => {
      const rest = omitKey(validInput, 'chatId');
      expect(CreateRequestInput.safeParse(rest).success).toBe(false);
    });

    it('rejects missing messageId', () => {
      const rest = omitKey(validInput, 'messageId');
      expect(CreateRequestInput.safeParse(rest).success).toBe(false);
    });

    it('rejects missing messageText', () => {
      const rest = omitKey(validInput, 'messageText');
      expect(CreateRequestInput.safeParse(rest).success).toBe(false);
    });

    it('rejects messageText longer than 10000 characters', () => {
      const result = CreateRequestInput.safeParse({
        ...validInput,
        messageText: 'x'.repeat(10001),
      });
      expect(result.success).toBe(false);
    });

    it('accepts messageText of exactly 10000 characters', () => {
      const result = CreateRequestInput.safeParse({
        ...validInput,
        messageText: 'x'.repeat(10000),
      });
      expect(result.success).toBe(true);
    });
  });

  // --- ClassifyMessageInput -------------------------------------------------
  describe('ClassifyMessageInput', () => {
    it('accepts valid text without forceModel', () => {
      expect(ClassifyMessageInput.safeParse({ messageText: 'Test message' }).success).toBe(true);
    });

    it('accepts valid text with forceModel openrouter', () => {
      const result = ClassifyMessageInput.safeParse({
        messageText: 'Test',
        forceModel: 'openrouter',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid text with forceModel keyword-fallback', () => {
      const result = ClassifyMessageInput.safeParse({
        messageText: 'Test',
        forceModel: 'keyword-fallback',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid forceModel value', () => {
      const result = ClassifyMessageInput.safeParse({
        messageText: 'Test',
        forceModel: 'gpt-4',
      });
      expect(result.success).toBe(false);
    });

    it('rejects messageText longer than 10000 characters', () => {
      expect(ClassifyMessageInput.safeParse({ messageText: 'x'.repeat(10001) }).success).toBe(
        false
      );
    });

    it('rejects missing messageText', () => {
      expect(ClassifyMessageInput.safeParse({}).success).toBe(false);
    });
  });

  // --- StartSlaTimerInput ---------------------------------------------------
  describe('StartSlaTimerInput', () => {
    it('accepts valid UUID', () => {
      expect(StartSlaTimerInput.safeParse({ requestId: VALID_UUID }).success).toBe(true);
    });

    it('rejects non-UUID string', () => {
      expect(StartSlaTimerInput.safeParse({ requestId: 'not-a-uuid' }).success).toBe(false);
    });

    it('rejects empty string', () => {
      expect(StartSlaTimerInput.safeParse({ requestId: '' }).success).toBe(false);
    });

    it('rejects missing requestId', () => {
      expect(StartSlaTimerInput.safeParse({}).success).toBe(false);
    });
  });

  // --- StopSlaTimerInput ----------------------------------------------------
  describe('StopSlaTimerInput', () => {
    const validInput = {
      requestId: VALID_UUID,
      respondedBy: VALID_UUID_2,
    };

    it('accepts minimal valid input', () => {
      expect(StopSlaTimerInput.safeParse(validInput).success).toBe(true);
    });

    it('accepts input with optional responseMessageId', () => {
      expect(
        StopSlaTimerInput.safeParse({ ...validInput, responseMessageId: '12345' }).success
      ).toBe(true);
    });

    it('rejects non-UUID requestId', () => {
      expect(StopSlaTimerInput.safeParse({ ...validInput, requestId: 'bad' }).success).toBe(false);
    });

    it('rejects non-UUID respondedBy', () => {
      expect(StopSlaTimerInput.safeParse({ ...validInput, respondedBy: 'bad' }).success).toBe(
        false
      );
    });

    it('rejects missing respondedBy', () => {
      const rest = omitKey(validInput, 'respondedBy');
      expect(StopSlaTimerInput.safeParse(rest).success).toBe(false);
    });
  });

  // --- GetRequestsInput -----------------------------------------------------
  describe('GetRequestsInput', () => {
    it('accepts empty object and applies defaults', () => {
      const result = GetRequestsInput.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('accepts full valid input', () => {
      const result = GetRequestsInput.safeParse({
        chatId: '-1001234567890',
        accountantId: VALID_UUID,
        status: 'pending',
        slaBreached: true,
        dateFrom: new Date().toISOString(),
        dateTo: new Date().toISOString(),
        limit: 25,
        offset: 50,
      });
      expect(result.success).toBe(true);
    });

    it('rejects limit below 1', () => {
      expect(GetRequestsInput.safeParse({ limit: 0 }).success).toBe(false);
    });

    it('rejects limit above 100', () => {
      expect(GetRequestsInput.safeParse({ limit: 101 }).success).toBe(false);
    });

    it('rejects negative offset', () => {
      expect(GetRequestsInput.safeParse({ offset: -1 }).success).toBe(false);
    });

    it('rejects invalid status enum', () => {
      expect(GetRequestsInput.safeParse({ status: 'open' }).success).toBe(false);
    });

    it('rejects non-UUID accountantId', () => {
      expect(GetRequestsInput.safeParse({ accountantId: 'not-uuid' }).success).toBe(false);
    });

    it('coerces dateFrom string to Date', () => {
      const result = GetRequestsInput.safeParse({ dateFrom: '2025-01-01T00:00:00.000Z' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateFrom).toBeInstanceOf(Date);
      }
    });
  });

  // --- GetRequestByIdInput --------------------------------------------------
  describe('GetRequestByIdInput', () => {
    it('accepts valid UUID', () => {
      expect(GetRequestByIdInput.safeParse({ requestId: VALID_UUID }).success).toBe(true);
    });

    it('rejects non-UUID', () => {
      expect(GetRequestByIdInput.safeParse({ requestId: '12345' }).success).toBe(false);
    });
  });

  // --- GetActiveTimersInput -------------------------------------------------
  describe('GetActiveTimersInput', () => {
    it('accepts empty object', () => {
      expect(GetActiveTimersInput.safeParse({}).success).toBe(true);
    });

    it('accepts optional chatId string', () => {
      expect(GetActiveTimersInput.safeParse({ chatId: '-1001234567890' }).success).toBe(true);
    });
  });

  // --- ClassificationResultOutput ------------------------------------------
  describe('ClassificationResultOutput', () => {
    const validOutput = {
      classification: 'REQUEST',
      confidence: 0.95,
      model: 'openrouter',
    };

    it('accepts valid output', () => {
      expect(ClassificationResultOutput.safeParse(validOutput).success).toBe(true);
    });

    it('accepts output with optional reasoning', () => {
      const result = ClassificationResultOutput.safeParse({
        ...validOutput,
        reasoning: 'The message is a clear service request.',
      });
      expect(result.success).toBe(true);
    });

    it('rejects confidence above 1.0', () => {
      expect(
        ClassificationResultOutput.safeParse({ ...validOutput, confidence: 1.1 }).success
      ).toBe(false);
    });

    it('rejects confidence below 0', () => {
      expect(
        ClassificationResultOutput.safeParse({ ...validOutput, confidence: -0.1 }).success
      ).toBe(false);
    });

    it('accepts confidence at boundary values 0 and 1', () => {
      expect(ClassificationResultOutput.safeParse({ ...validOutput, confidence: 0 }).success).toBe(
        true
      );
      expect(ClassificationResultOutput.safeParse({ ...validOutput, confidence: 1 }).success).toBe(
        true
      );
    });

    it('rejects invalid classification', () => {
      expect(
        ClassificationResultOutput.safeParse({ ...validOutput, classification: 'UNKNOWN' }).success
      ).toBe(false);
    });

    it('rejects invalid model', () => {
      expect(ClassificationResultOutput.safeParse({ ...validOutput, model: 'cache' }).success).toBe(
        false
      );
    });
  });

  // --- RequestOutput --------------------------------------------------------
  describe('RequestOutput', () => {
    const validOutput: z.infer<typeof RequestOutput> = {
      id: VALID_UUID,
      chatId: '-1001234567890',
      messageId: '42',
      messageText: 'Need tax help',
      clientUsername: null,
      receivedAt: new Date(),
      status: 'pending',
      classification: 'REQUEST',
      classificationScore: 0.92,
      classificationModel: 'openrouter',
      slaTimerStartedAt: null,
      slaWorkingMinutes: null,
      slaBreached: false,
      responseAt: null,
      responseTimeMinutes: null,
      respondedBy: null,
      assignedTo: null,
      assignedAccountantName: null,
      chatTitle: null,
    };

    it('accepts valid output', () => {
      expect(RequestOutput.safeParse(validOutput).success).toBe(true);
    });

    it('accepts output with all nullable fields populated', () => {
      const result = RequestOutput.safeParse({
        ...validOutput,
        clientUsername: 'johndoe',
        slaTimerStartedAt: new Date(),
        slaWorkingMinutes: 45,
        slaBreached: true,
        responseAt: new Date(),
        responseTimeMinutes: 45,
        respondedBy: VALID_UUID_2,
        assignedTo: VALID_UUID_2,
        assignedAccountantName: 'Jane Smith',
        chatTitle: 'Client Chat',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid id (non-UUID)', () => {
      expect(RequestOutput.safeParse({ ...validOutput, id: 'not-uuid' }).success).toBe(false);
    });

    it('rejects invalid status enum', () => {
      expect(RequestOutput.safeParse({ ...validOutput, status: 'open' as never }).success).toBe(
        false
      );
    });

    it('rejects invalid classification enum', () => {
      expect(
        RequestOutput.safeParse({ ...validOutput, classification: 'UNKNOWN' as never }).success
      ).toBe(false);
    });

    it('rejects respondedBy that is not UUID when present', () => {
      expect(RequestOutput.safeParse({ ...validOutput, respondedBy: 'not-uuid' }).success).toBe(
        false
      );
    });
  });

  // --- RequestListOutput ----------------------------------------------------
  describe('RequestListOutput', () => {
    it('accepts valid paginated output', () => {
      const result = RequestListOutput.safeParse({
        items: [],
        total: 0,
        hasMore: false,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing total', () => {
      expect(RequestListOutput.safeParse({ items: [], hasMore: false }).success).toBe(false);
    });

    it('rejects missing hasMore', () => {
      expect(RequestListOutput.safeParse({ items: [], total: 0 }).success).toBe(false);
    });
  });

  // --- SlaTimerResultOutput -------------------------------------------------
  describe('SlaTimerResultOutput', () => {
    it('accepts started status', () => {
      const result = SlaTimerResultOutput.safeParse({
        requestId: VALID_UUID,
        status: 'started',
        workingMinutes: 0,
        breached: false,
      });
      expect(result.success).toBe(true);
    });

    it('accepts not_found status without optional fields', () => {
      const result = SlaTimerResultOutput.safeParse({
        requestId: VALID_UUID,
        status: 'not_found',
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid status enum values', () => {
      for (const status of ['started', 'stopped', 'already_stopped', 'not_found']) {
        expect(SlaTimerResultOutput.safeParse({ requestId: VALID_UUID, status }).success).toBe(
          true
        );
      }
    });

    it('rejects invalid status value', () => {
      expect(
        SlaTimerResultOutput.safeParse({ requestId: VALID_UUID, status: 'running' }).success
      ).toBe(false);
    });

    it('rejects non-UUID requestId', () => {
      expect(SlaTimerResultOutput.safeParse({ requestId: 'bad', status: 'started' }).success).toBe(
        false
      );
    });
  });

  // --- ActiveTimerOutput ----------------------------------------------------
  describe('ActiveTimerOutput', () => {
    const validOutput = {
      requestId: VALID_UUID,
      chatId: '-1001234567890',
      startedAt: new Date(),
      elapsedMinutes: 30,
      thresholdMinutes: 60,
      breachAt: new Date(),
    };

    it('accepts valid timer output', () => {
      expect(ActiveTimerOutput.safeParse(validOutput).success).toBe(true);
    });

    it('rejects non-UUID requestId', () => {
      expect(ActiveTimerOutput.safeParse({ ...validOutput, requestId: 'bad' }).success).toBe(false);
    });

    it('rejects missing startedAt', () => {
      const rest = omitKey(validOutput, 'startedAt');
      expect(ActiveTimerOutput.safeParse(rest).success).toBe(false);
    });
  });
});

// ============================================================================
// TESTS: chats.ts schemas
// ============================================================================

describe('Chats router schemas', () => {
  // --- ChatTypeSchema -------------------------------------------------------
  describe('ChatTypeSchema', () => {
    it('accepts private, group, supergroup', () => {
      for (const type of ['private', 'group', 'supergroup']) {
        expect(ChatTypeSchema.safeParse(type).success).toBe(true);
      }
    });

    it('rejects unknown chat types', () => {
      expect(ChatTypeSchema.safeParse('channel').success).toBe(false);
      expect(ChatTypeSchema.safeParse('').success).toBe(false);
    });
  });

  // --- ChatsListInput -------------------------------------------------------
  describe('ChatsListInput (chats.list)', () => {
    it('accepts empty object and applies defaults', () => {
      const result = ChatsListInput.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
        expect(result.data.includeDisabled).toBe(false);
      }
    });

    it('accepts valid assignedTo UUID filter', () => {
      expect(ChatsListInput.safeParse({ assignedTo: VALID_UUID }).success).toBe(true);
    });

    it('rejects non-UUID assignedTo', () => {
      expect(ChatsListInput.safeParse({ assignedTo: 'not-uuid' }).success).toBe(false);
    });

    it('rejects limit below 1', () => {
      expect(ChatsListInput.safeParse({ limit: 0 }).success).toBe(false);
    });

    it('rejects limit above 100', () => {
      expect(ChatsListInput.safeParse({ limit: 101 }).success).toBe(false);
    });

    it('rejects non-integer limit', () => {
      expect(ChatsListInput.safeParse({ limit: 1.5 }).success).toBe(false);
    });

    it('rejects negative offset', () => {
      expect(ChatsListInput.safeParse({ offset: -1 }).success).toBe(false);
    });
  });

  // --- ChatUpdateInput ------------------------------------------------------
  describe('ChatUpdateInput (chats.update)', () => {
    it('accepts minimal input with only id', () => {
      const result = ChatUpdateInput.safeParse({ id: 12345 });
      expect(result.success).toBe(true);
    });

    it('rejects id that is not a number', () => {
      expect(ChatUpdateInput.safeParse({ id: '12345' }).success).toBe(false);
    });

    it('accepts valid slaThresholdMinutes within range', () => {
      expect(ChatUpdateInput.safeParse({ id: 1, slaThresholdMinutes: 60 }).success).toBe(true);
      expect(ChatUpdateInput.safeParse({ id: 1, slaThresholdMinutes: 1 }).success).toBe(true);
      expect(ChatUpdateInput.safeParse({ id: 1, slaThresholdMinutes: 480 }).success).toBe(true);
    });

    it('rejects slaThresholdMinutes below 1', () => {
      expect(ChatUpdateInput.safeParse({ id: 1, slaThresholdMinutes: 0 }).success).toBe(false);
    });

    it('rejects slaThresholdMinutes above 480', () => {
      expect(ChatUpdateInput.safeParse({ id: 1, slaThresholdMinutes: 481 }).success).toBe(false);
    });

    it('rejects non-integer slaThresholdMinutes', () => {
      expect(ChatUpdateInput.safeParse({ id: 1, slaThresholdMinutes: 1.5 }).success).toBe(false);
    });

    it('accepts valid clientTier enum values', () => {
      for (const tier of ['basic', 'standard', 'vip', 'premium']) {
        expect(ChatUpdateInput.safeParse({ id: 1, clientTier: tier }).success).toBe(true);
      }
    });

    it('rejects invalid clientTier', () => {
      expect(ChatUpdateInput.safeParse({ id: 1, clientTier: 'gold' }).success).toBe(false);
    });

    it('strips leading @ from accountantUsernames', () => {
      const result = ChatUpdateInput.safeParse({
        id: 1,
        accountantUsernames: ['@johndoe1'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accountantUsernames[0]).toBe('johndoe1');
      }
    });

    it('lowercases accountantUsernames', () => {
      const result = ChatUpdateInput.safeParse({
        id: 1,
        accountantUsernames: ['JohnDoe1'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accountantUsernames[0]).toBe('johndoe1');
      }
    });

    it('rejects accountantUsername with invalid format (too short)', () => {
      // Valid usernames: 5-32 chars, alphanumeric + underscore, not starting/ending with _
      // 'ab' is only 2 chars — fails the regex
      const result = ChatUpdateInput.safeParse({
        id: 1,
        accountantUsernames: ['ab'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects accountantUsernames array larger than 20', () => {
      const tooMany = Array.from({ length: 21 }, (_, i) => `user${i}abc1`);
      expect(ChatUpdateInput.safeParse({ id: 1, accountantUsernames: tooMany }).success).toBe(
        false
      );
    });

    it('rejects managerTelegramIds with non-numeric strings', () => {
      expect(
        ChatUpdateInput.safeParse({ id: 1, managerTelegramIds: ['not-a-number'] }).success
      ).toBe(false);
    });

    it('accepts managerTelegramIds with numeric strings', () => {
      expect(
        ChatUpdateInput.safeParse({ id: 1, managerTelegramIds: ['12345', '67890'] }).success
      ).toBe(true);
    });

    it('rejects managerTelegramIds array larger than 20', () => {
      const tooMany = Array.from({ length: 21 }, (_, i) => String(i + 1));
      expect(ChatUpdateInput.safeParse({ id: 1, managerTelegramIds: tooMany }).success).toBe(false);
    });

    it('accepts assignedAccountantId as null', () => {
      expect(ChatUpdateInput.safeParse({ id: 1, assignedAccountantId: null }).success).toBe(true);
    });

    it('rejects assignedAccountantId as non-UUID string', () => {
      expect(ChatUpdateInput.safeParse({ id: 1, assignedAccountantId: 'not-uuid' }).success).toBe(
        false
      );
    });
  });

  // --- UpdateWorkingScheduleInput -------------------------------------------
  describe('UpdateWorkingScheduleInput (chats.updateWorkingSchedule)', () => {
    const validSchedule = {
      chatId: '-1001234567890',
      schedules: [
        {
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '18:00',
          isActive: true,
        },
      ],
    };

    it('accepts valid schedule', () => {
      expect(UpdateWorkingScheduleInput.safeParse(validSchedule).success).toBe(true);
    });

    it('accepts schedule with optional timezone', () => {
      expect(
        UpdateWorkingScheduleInput.safeParse({
          ...validSchedule,
          timezone: 'Europe/Moscow',
        }).success
      ).toBe(true);
    });

    it('accepts dayOfWeek at boundaries 1 and 7', () => {
      for (const dayOfWeek of [1, 7]) {
        expect(
          UpdateWorkingScheduleInput.safeParse({
            ...validSchedule,
            schedules: [{ ...validSchedule.schedules[0], dayOfWeek }],
          }).success
        ).toBe(true);
      }
    });

    it('rejects dayOfWeek below 1', () => {
      expect(
        UpdateWorkingScheduleInput.safeParse({
          ...validSchedule,
          schedules: [{ ...validSchedule.schedules[0], dayOfWeek: 0 }],
        }).success
      ).toBe(false);
    });

    it('rejects dayOfWeek above 7', () => {
      expect(
        UpdateWorkingScheduleInput.safeParse({
          ...validSchedule,
          schedules: [{ ...validSchedule.schedules[0], dayOfWeek: 8 }],
        }).success
      ).toBe(false);
    });

    it('rejects invalid startTime format', () => {
      expect(
        UpdateWorkingScheduleInput.safeParse({
          ...validSchedule,
          schedules: [{ ...validSchedule.schedules[0], startTime: '9:00' }],
        }).success
      ).toBe(false);
    });

    it('rejects invalid endTime format', () => {
      expect(
        UpdateWorkingScheduleInput.safeParse({
          ...validSchedule,
          schedules: [{ ...validSchedule.schedules[0], endTime: '25:00' }],
        }).success
      ).toBe(false);
    });

    it('accepts boundary time values 00:00 and 23:59', () => {
      expect(
        UpdateWorkingScheduleInput.safeParse({
          ...validSchedule,
          schedules: [{ dayOfWeek: 1, startTime: '00:00', endTime: '23:59', isActive: true }],
        }).success
      ).toBe(true);
    });
  });

  // --- RegisterChatInput ----------------------------------------------------
  describe('RegisterChatInput (chats.registerChat)', () => {
    it('accepts minimal valid input', () => {
      expect(
        RegisterChatInput.safeParse({
          telegramChatId: '-1001234567890',
          chatType: 'group',
        }).success
      ).toBe(true);
    });

    it('accepts input with optional title and accountantUsername', () => {
      expect(
        RegisterChatInput.safeParse({
          telegramChatId: '-1001234567890',
          chatType: 'supergroup',
          title: 'My Group',
          accountantUsername: 'accountant123',
        }).success
      ).toBe(true);
    });

    it('rejects invalid chatType', () => {
      expect(
        RegisterChatInput.safeParse({
          telegramChatId: '-1001234567890',
          chatType: 'channel',
        }).success
      ).toBe(false);
    });

    it('rejects missing telegramChatId', () => {
      expect(RegisterChatInput.safeParse({ chatType: 'group' }).success).toBe(false);
    });
  });

  // --- CreateInvitationInput ------------------------------------------------
  describe('CreateInvitationInput (chats.createInvitation)', () => {
    it('accepts empty object and applies defaults', () => {
      const result = CreateInvitationInput.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expiresInHours).toBe(72);
      }
    });

    it('accepts full valid input', () => {
      expect(
        CreateInvitationInput.safeParse({
          initialTitle: 'Client Onboarding',
          assignedAccountantId: VALID_UUID,
          expiresInHours: 24,
        }).success
      ).toBe(true);
    });

    it('rejects expiresInHours below 1', () => {
      expect(CreateInvitationInput.safeParse({ expiresInHours: 0 }).success).toBe(false);
    });

    it('rejects expiresInHours above 720', () => {
      expect(CreateInvitationInput.safeParse({ expiresInHours: 721 }).success).toBe(false);
    });

    it('rejects non-integer expiresInHours', () => {
      expect(CreateInvitationInput.safeParse({ expiresInHours: 1.5 }).success).toBe(false);
    });

    it('rejects non-UUID assignedAccountantId', () => {
      expect(CreateInvitationInput.safeParse({ assignedAccountantId: 'not-uuid' }).success).toBe(
        false
      );
    });
  });

  // --- ListInvitationsInput -------------------------------------------------
  describe('ListInvitationsInput (chats.listInvitations)', () => {
    it('accepts empty object and applies defaults', () => {
      const result = ListInvitationsInput.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeUsed).toBe(false);
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('rejects limit above 100', () => {
      expect(ListInvitationsInput.safeParse({ limit: 101 }).success).toBe(false);
    });
  });

  // --- RevokeInvitationInput ------------------------------------------------
  describe('RevokeInvitationInput (chats.revokeInvitation)', () => {
    it('accepts valid UUID', () => {
      expect(RevokeInvitationInput.safeParse({ id: VALID_UUID }).success).toBe(true);
    });

    it('rejects non-UUID id', () => {
      expect(RevokeInvitationInput.safeParse({ id: '12345' }).success).toBe(false);
    });

    it('rejects missing id', () => {
      expect(RevokeInvitationInput.safeParse({}).success).toBe(false);
    });
  });
});

// ============================================================================
// TESTS: settings.ts schemas
// ============================================================================

describe('Settings router schemas', () => {
  // --- UpdateGlobalSettingsInput --------------------------------------------
  describe('UpdateGlobalSettingsInput', () => {
    it('accepts empty object (all fields optional)', () => {
      expect(UpdateGlobalSettingsInput.safeParse({}).success).toBe(true);
    });

    it('accepts valid defaultStartTime in HH:MM format', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ defaultStartTime: '09:00' }).success).toBe(true);
      expect(UpdateGlobalSettingsInput.safeParse({ defaultStartTime: '23:59' }).success).toBe(true);
    });

    it('rejects defaultStartTime with invalid format', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ defaultStartTime: '9:00' }).success).toBe(false);
      expect(UpdateGlobalSettingsInput.safeParse({ defaultStartTime: '24:00' }).success).toBe(
        false
      );
      expect(UpdateGlobalSettingsInput.safeParse({ defaultStartTime: '09:60' }).success).toBe(
        false
      );
    });

    it('accepts defaultEndTime in HH:MM format', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ defaultEndTime: '18:00' }).success).toBe(true);
    });

    it('rejects defaultSlaThreshold below 1', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ defaultSlaThreshold: 0 }).success).toBe(false);
    });

    it('rejects defaultSlaThreshold above 480', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ defaultSlaThreshold: 481 }).success).toBe(false);
    });

    it('accepts defaultSlaThreshold at boundaries 1 and 480', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ defaultSlaThreshold: 1 }).success).toBe(true);
      expect(UpdateGlobalSettingsInput.safeParse({ defaultSlaThreshold: 480 }).success).toBe(true);
    });

    it('rejects maxEscalations below 1', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ maxEscalations: 0 }).success).toBe(false);
    });

    it('rejects maxEscalations above 10', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ maxEscalations: 11 }).success).toBe(false);
    });

    it('rejects escalationIntervalMin below 5', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ escalationIntervalMin: 4 }).success).toBe(false);
    });

    it('rejects escalationIntervalMin above 120', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ escalationIntervalMin: 121 }).success).toBe(
        false
      );
    });

    it('rejects slaWarningPercent below 0', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ slaWarningPercent: -1 }).success).toBe(false);
    });

    it('rejects slaWarningPercent above 99', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ slaWarningPercent: 100 }).success).toBe(false);
    });

    it('accepts slaWarningPercent at boundaries 0 and 99', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ slaWarningPercent: 0 }).success).toBe(true);
      expect(UpdateGlobalSettingsInput.safeParse({ slaWarningPercent: 99 }).success).toBe(true);
    });

    it('rejects aiConfidenceThreshold above 1', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ aiConfidenceThreshold: 1.1 }).success).toBe(
        false
      );
    });

    it('rejects aiConfidenceThreshold below 0', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ aiConfidenceThreshold: -0.1 }).success).toBe(
        false
      );
    });

    it('accepts aiConfidenceThreshold at boundaries 0 and 1', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ aiConfidenceThreshold: 0 }).success).toBe(true);
      expect(UpdateGlobalSettingsInput.safeParse({ aiConfidenceThreshold: 1 }).success).toBe(true);
    });

    it('rejects messagePreviewLength below 100', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ messagePreviewLength: 99 }).success).toBe(false);
    });

    it('rejects messagePreviewLength above 1000', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ messagePreviewLength: 1001 }).success).toBe(
        false
      );
    });

    it('rejects dataRetentionYears below 1', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ dataRetentionYears: 0 }).success).toBe(false);
    });

    it('rejects dataRetentionYears above 10', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ dataRetentionYears: 11 }).success).toBe(false);
    });

    it('accepts valid internalChatId as numeric string', () => {
      expect(
        UpdateGlobalSettingsInput.safeParse({ internalChatId: '-1001234567890' }).success
      ).toBe(true);
      expect(UpdateGlobalSettingsInput.safeParse({ internalChatId: '123456789' }).success).toBe(
        true
      );
    });

    it('accepts internalChatId as null', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ internalChatId: null }).success).toBe(true);
    });

    it('rejects internalChatId with non-numeric characters', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ internalChatId: 'abc' }).success).toBe(false);
      expect(UpdateGlobalSettingsInput.safeParse({ internalChatId: '-abc123' }).success).toBe(
        false
      );
    });

    it('rejects openrouterApiKey as empty string', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ openrouterApiKey: '' }).success).toBe(false);
    });

    it('accepts defaultWorkingDays with valid day numbers', () => {
      expect(
        UpdateGlobalSettingsInput.safeParse({ defaultWorkingDays: [1, 2, 3, 4, 5] }).success
      ).toBe(true);
    });

    it('rejects defaultWorkingDays with day number below 1', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ defaultWorkingDays: [0, 1, 2] }).success).toBe(
        false
      );
    });

    it('rejects defaultWorkingDays with day number above 7', () => {
      expect(UpdateGlobalSettingsInput.safeParse({ defaultWorkingDays: [1, 8] }).success).toBe(
        false
      );
    });
  });

  // --- AddGlobalHolidayInput ------------------------------------------------
  describe('AddGlobalHolidayInput', () => {
    const validInput = {
      date: '2025-01-01',
      name: 'New Year',
      year: 2025,
    };

    it('accepts valid input', () => {
      expect(AddGlobalHolidayInput.safeParse(validInput).success).toBe(true);
    });

    it('coerces date string to Date', () => {
      const result = AddGlobalHolidayInput.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
      }
    });

    it('rejects empty name', () => {
      expect(AddGlobalHolidayInput.safeParse({ ...validInput, name: '' }).success).toBe(false);
    });

    it('rejects name longer than 100 characters', () => {
      expect(
        AddGlobalHolidayInput.safeParse({ ...validInput, name: 'x'.repeat(101) }).success
      ).toBe(false);
    });

    it('rejects year below 2024', () => {
      expect(AddGlobalHolidayInput.safeParse({ ...validInput, year: 2023 }).success).toBe(false);
    });

    it('rejects year above 2030', () => {
      expect(AddGlobalHolidayInput.safeParse({ ...validInput, year: 2031 }).success).toBe(false);
    });

    it('accepts year at boundaries 2024 and 2030', () => {
      expect(AddGlobalHolidayInput.safeParse({ ...validInput, year: 2024 }).success).toBe(true);
      expect(AddGlobalHolidayInput.safeParse({ ...validInput, year: 2030 }).success).toBe(true);
    });

    it('rejects missing date', () => {
      const rest = omitKey(validInput, 'date');
      expect(AddGlobalHolidayInput.safeParse(rest).success).toBe(false);
    });
  });

  // --- RemoveGlobalHolidayInput ---------------------------------------------
  describe('RemoveGlobalHolidayInput', () => {
    it('accepts valid date string', () => {
      const result = RemoveGlobalHolidayInput.safeParse({ date: '2025-01-01' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
      }
    });

    it('rejects missing date', () => {
      expect(RemoveGlobalHolidayInput.safeParse({}).success).toBe(false);
    });

    it('rejects invalid date string', () => {
      expect(RemoveGlobalHolidayInput.safeParse({ date: 'not-a-date' }).success).toBe(false);
    });
  });

  // --- BulkAddHolidaysInput -------------------------------------------------
  describe('BulkAddHolidaysInput', () => {
    const validInput = {
      year: 2025,
      holidays: [
        { date: '2025-01-01', name: 'New Year' },
        { date: '2025-05-09', name: 'Victory Day' },
      ],
    };

    it('accepts valid bulk input', () => {
      expect(BulkAddHolidaysInput.safeParse(validInput).success).toBe(true);
    });

    it('accepts empty holidays array', () => {
      expect(BulkAddHolidaysInput.safeParse({ year: 2025, holidays: [] }).success).toBe(true);
    });

    it('rejects year out of range', () => {
      expect(BulkAddHolidaysInput.safeParse({ year: 2023, holidays: [] }).success).toBe(false);
    });

    it('rejects holiday name longer than 100 characters', () => {
      expect(
        BulkAddHolidaysInput.safeParse({
          year: 2025,
          holidays: [{ date: '2025-01-01', name: 'x'.repeat(101) }],
        }).success
      ).toBe(false);
    });

    it('rejects missing year', () => {
      expect(BulkAddHolidaysInput.safeParse({ holidays: [] }).success).toBe(false);
    });
  });

  // --- SeedRussianHolidaysInput ---------------------------------------------
  describe('SeedRussianHolidaysInput', () => {
    it('accepts valid year', () => {
      expect(SeedRussianHolidaysInput.safeParse({ year: 2025 }).success).toBe(true);
    });

    it('rejects year below 2024', () => {
      expect(SeedRussianHolidaysInput.safeParse({ year: 2023 }).success).toBe(false);
    });

    it('rejects year above 2030', () => {
      expect(SeedRussianHolidaysInput.safeParse({ year: 2031 }).success).toBe(false);
    });

    it('rejects missing year', () => {
      expect(SeedRussianHolidaysInput.safeParse({}).success).toBe(false);
    });
  });

  // --- GetGlobalHolidaysInput -----------------------------------------------
  describe('GetGlobalHolidaysInput', () => {
    it('accepts empty object (year optional)', () => {
      expect(GetGlobalHolidaysInput.safeParse({}).success).toBe(true);
    });

    it('accepts year as number', () => {
      expect(GetGlobalHolidaysInput.safeParse({ year: 2025 }).success).toBe(true);
    });

    it('rejects year as string', () => {
      expect(GetGlobalHolidaysInput.safeParse({ year: '2025' }).success).toBe(false);
    });
  });

  // --- UpdateWorkingScheduleSettingsInput -----------------------------------
  describe('UpdateWorkingScheduleSettingsInput (settings.updateWorkingSchedule)', () => {
    const validInput = {
      days: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '18:00',
      timezone: 'Europe/Moscow',
    };

    it('accepts valid input', () => {
      expect(UpdateWorkingScheduleSettingsInput.safeParse(validInput).success).toBe(true);
    });

    it('rejects invalid startTime format', () => {
      expect(
        UpdateWorkingScheduleSettingsInput.safeParse({ ...validInput, startTime: '9:00' }).success
      ).toBe(false);
    });

    it('rejects invalid endTime format', () => {
      expect(
        UpdateWorkingScheduleSettingsInput.safeParse({ ...validInput, endTime: '8am' }).success
      ).toBe(false);
    });

    it('rejects day number outside 1-7', () => {
      expect(
        UpdateWorkingScheduleSettingsInput.safeParse({ ...validInput, days: [0, 1, 2] }).success
      ).toBe(false);
    });

    it('rejects missing timezone', () => {
      const rest = omitKey(validInput, 'timezone');
      expect(UpdateWorkingScheduleSettingsInput.safeParse(rest).success).toBe(false);
    });
  });

  // --- UpdateSlaThresholdsInput ---------------------------------------------
  describe('UpdateSlaThresholdsInput (settings.updateSlaThresholds)', () => {
    it('accepts valid threshold', () => {
      expect(UpdateSlaThresholdsInput.safeParse({ slaThreshold: 60 }).success).toBe(true);
    });

    it('rejects threshold below 1', () => {
      expect(UpdateSlaThresholdsInput.safeParse({ slaThreshold: 0 }).success).toBe(false);
    });

    it('rejects threshold above 480', () => {
      expect(UpdateSlaThresholdsInput.safeParse({ slaThreshold: 481 }).success).toBe(false);
    });

    it('accepts boundary values 1 and 480', () => {
      expect(UpdateSlaThresholdsInput.safeParse({ slaThreshold: 1 }).success).toBe(true);
      expect(UpdateSlaThresholdsInput.safeParse({ slaThreshold: 480 }).success).toBe(true);
    });

    it('rejects missing slaThreshold', () => {
      expect(UpdateSlaThresholdsInput.safeParse({}).success).toBe(false);
    });
  });

  // --- GlobalSettingsOutput -------------------------------------------------
  describe('GlobalSettingsOutput', () => {
    const validOutput: z.infer<typeof GlobalSettingsOutput> = {
      defaultTimezone: 'Europe/Moscow',
      defaultWorkingDays: [1, 2, 3, 4, 5],
      defaultWorkingDaysDisplay: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'],
      defaultStartTime: '09:00',
      defaultEndTime: '18:00',
      defaultSlaThreshold: 60,
      maxEscalations: 3,
      escalationIntervalMin: 30,
      slaWarningPercent: 80,
      globalManagerIds: [],
      globalManagerCount: 0,
      leadNotificationIds: [],
      aiConfidenceThreshold: 0.7,
      messagePreviewLength: 200,
      openrouterApiKey: null,
      openrouterModel: 'openai/gpt-4o',
      dataRetentionYears: 3,
      internalChatId: null,
      updatedAt: new Date(),
    };

    it('accepts valid settings output', () => {
      expect(GlobalSettingsOutput.safeParse(validOutput).success).toBe(true);
    });

    it('accepts masked openrouterApiKey string', () => {
      const result = GlobalSettingsOutput.safeParse({
        ...validOutput,
        openrouterApiKey: '***abcd1234',
      });
      expect(result.success).toBe(true);
    });

    it('accepts internalChatId as string', () => {
      const result = GlobalSettingsOutput.safeParse({
        ...validOutput,
        internalChatId: '-1001234567890',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing required field defaultTimezone', () => {
      const rest = omitKey(validOutput, 'defaultTimezone');
      expect(GlobalSettingsOutput.safeParse(rest).success).toBe(false);
    });

    it('rejects missing updatedAt', () => {
      const rest = omitKey(validOutput, 'updatedAt');
      expect(GlobalSettingsOutput.safeParse(rest).success).toBe(false);
    });
  });

  // --- GlobalHolidayOutput --------------------------------------------------
  describe('GlobalHolidayOutput', () => {
    const validOutput = {
      id: VALID_UUID,
      date: new Date(),
      name: 'New Year',
      year: 2025,
      createdAt: new Date(),
    };

    it('accepts valid holiday output', () => {
      expect(GlobalHolidayOutput.safeParse(validOutput).success).toBe(true);
    });

    it('rejects non-UUID id', () => {
      expect(GlobalHolidayOutput.safeParse({ ...validOutput, id: '12345' }).success).toBe(false);
    });

    it('rejects missing name', () => {
      const rest = omitKey(validOutput, 'name');
      expect(GlobalHolidayOutput.safeParse(rest).success).toBe(false);
    });
  });
});

// ============================================================================
// TESTS: alert.ts schemas
// ============================================================================

describe('Alert router schemas (alert.ts)', () => {
  // --- AlertTypeSchema ------------------------------------------------------
  describe('AlertTypeSchema', () => {
    it('accepts warning and breach', () => {
      expect(AlertTypeSchema.safeParse('warning').success).toBe(true);
      expect(AlertTypeSchema.safeParse('breach').success).toBe(true);
    });

    it('rejects other values', () => {
      expect(AlertTypeSchema.safeParse('critical').success).toBe(false);
      expect(AlertTypeSchema.safeParse('info').success).toBe(false);
    });
  });

  // --- AlertDeliveryStatusSchema --------------------------------------------
  describe('AlertDeliveryStatusSchema', () => {
    it('accepts all valid delivery statuses', () => {
      for (const status of ['pending', 'sent', 'delivered', 'failed']) {
        expect(AlertDeliveryStatusSchema.safeParse(status).success).toBe(true);
      }
    });

    it('rejects unknown status', () => {
      expect(AlertDeliveryStatusSchema.safeParse('queued').success).toBe(false);
    });
  });

  // --- AlertActionSchema ----------------------------------------------------
  describe('AlertActionSchema', () => {
    it('accepts all valid action values', () => {
      for (const action of ['mark_resolved', 'accountant_responded', 'auto_expired']) {
        expect(AlertActionSchema.safeParse(action).success).toBe(true);
      }
    });

    it('rejects unknown action', () => {
      expect(AlertActionSchema.safeParse('dismissed').success).toBe(false);
    });
  });

  // --- GetAlertsInput -------------------------------------------------------
  describe('GetAlertsInput', () => {
    it('accepts empty object and applies defaults', () => {
      const result = GetAlertsInput.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('accepts valid requestId UUID filter', () => {
      expect(GetAlertsInput.safeParse({ requestId: VALID_UUID }).success).toBe(true);
    });

    it('rejects non-UUID requestId', () => {
      expect(GetAlertsInput.safeParse({ requestId: 'not-uuid' }).success).toBe(false);
    });

    it('accepts valid alertType filter', () => {
      expect(GetAlertsInput.safeParse({ alertType: 'breach' }).success).toBe(true);
    });

    it('rejects invalid alertType', () => {
      expect(GetAlertsInput.safeParse({ alertType: 'critical' }).success).toBe(false);
    });

    it('accepts valid deliveryStatus filter', () => {
      expect(GetAlertsInput.safeParse({ deliveryStatus: 'sent' }).success).toBe(true);
    });

    it('rejects limit above 100', () => {
      expect(GetAlertsInput.safeParse({ limit: 101 }).success).toBe(false);
    });

    it('rejects limit below 1', () => {
      expect(GetAlertsInput.safeParse({ limit: 0 }).success).toBe(false);
    });

    it('rejects negative offset', () => {
      expect(GetAlertsInput.safeParse({ offset: -1 }).success).toBe(false);
    });
  });

  // --- CreateAlertInput -----------------------------------------------------
  describe('CreateAlertInput', () => {
    const validInput = {
      requestId: VALID_UUID,
      alertType: 'warning',
      minutesElapsed: 45,
    };

    it('accepts minimal valid input and applies default escalationLevel', () => {
      const result = CreateAlertInput.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.escalationLevel).toBe(1);
      }
    });

    it('accepts full valid input', () => {
      expect(CreateAlertInput.safeParse({ ...validInput, escalationLevel: 3 }).success).toBe(true);
    });

    it('rejects non-UUID requestId', () => {
      expect(CreateAlertInput.safeParse({ ...validInput, requestId: 'bad' }).success).toBe(false);
    });

    it('rejects invalid alertType', () => {
      expect(CreateAlertInput.safeParse({ ...validInput, alertType: 'info' }).success).toBe(false);
    });

    it('rejects negative minutesElapsed', () => {
      expect(CreateAlertInput.safeParse({ ...validInput, minutesElapsed: -1 }).success).toBe(false);
    });

    it('accepts minutesElapsed of 0', () => {
      expect(CreateAlertInput.safeParse({ ...validInput, minutesElapsed: 0 }).success).toBe(true);
    });

    it('rejects escalationLevel below 1', () => {
      expect(CreateAlertInput.safeParse({ ...validInput, escalationLevel: 0 }).success).toBe(false);
    });

    it('rejects escalationLevel above 5', () => {
      expect(CreateAlertInput.safeParse({ ...validInput, escalationLevel: 6 }).success).toBe(false);
    });

    it('accepts escalationLevel at boundaries 1 and 5', () => {
      expect(CreateAlertInput.safeParse({ ...validInput, escalationLevel: 1 }).success).toBe(true);
      expect(CreateAlertInput.safeParse({ ...validInput, escalationLevel: 5 }).success).toBe(true);
    });

    it('rejects non-integer minutesElapsed', () => {
      expect(CreateAlertInput.safeParse({ ...validInput, minutesElapsed: 1.5 }).success).toBe(
        false
      );
    });
  });

  // --- ResolveAlertInput ----------------------------------------------------
  describe('ResolveAlertInput', () => {
    const validInput = {
      alertId: VALID_UUID,
      action: 'mark_resolved',
    };

    it('accepts minimal valid input', () => {
      expect(ResolveAlertInput.safeParse(validInput).success).toBe(true);
    });

    it('accepts input with optional fields', () => {
      expect(
        ResolveAlertInput.safeParse({
          ...validInput,
          resolvedBy: VALID_UUID_2,
          resolutionNotes: 'Resolved by accountant',
        }).success
      ).toBe(true);
    });

    it('rejects non-UUID alertId', () => {
      expect(ResolveAlertInput.safeParse({ ...validInput, alertId: 'bad' }).success).toBe(false);
    });

    it('rejects invalid action', () => {
      expect(ResolveAlertInput.safeParse({ ...validInput, action: 'dismissed' }).success).toBe(
        false
      );
    });

    it('rejects non-UUID resolvedBy', () => {
      expect(ResolveAlertInput.safeParse({ ...validInput, resolvedBy: 'not-uuid' }).success).toBe(
        false
      );
    });

    it('rejects resolutionNotes longer than 500 characters', () => {
      expect(
        ResolveAlertInput.safeParse({ ...validInput, resolutionNotes: 'x'.repeat(501) }).success
      ).toBe(false);
    });

    it('accepts resolutionNotes of exactly 500 characters', () => {
      expect(
        ResolveAlertInput.safeParse({ ...validInput, resolutionNotes: 'x'.repeat(500) }).success
      ).toBe(true);
    });
  });

  // --- NotifyAccountantInput ------------------------------------------------
  describe('NotifyAccountantInput', () => {
    it('accepts valid alertId', () => {
      expect(NotifyAccountantInput.safeParse({ alertId: VALID_UUID }).success).toBe(true);
    });

    it('accepts optional message', () => {
      expect(
        NotifyAccountantInput.safeParse({ alertId: VALID_UUID, message: 'Please respond!' }).success
      ).toBe(true);
    });

    it('rejects message longer than 500 characters', () => {
      expect(
        NotifyAccountantInput.safeParse({ alertId: VALID_UUID, message: 'x'.repeat(501) }).success
      ).toBe(false);
    });

    it('rejects non-UUID alertId', () => {
      expect(NotifyAccountantInput.safeParse({ alertId: 'bad' }).success).toBe(false);
    });
  });

  // --- UpdateDeliveryStatusInput --------------------------------------------
  describe('UpdateDeliveryStatusInput', () => {
    const validInput = {
      alertId: VALID_UUID,
      status: 'sent',
    };

    it('accepts valid input', () => {
      expect(UpdateDeliveryStatusInput.safeParse(validInput).success).toBe(true);
    });

    it('accepts all valid delivery status values', () => {
      for (const status of ['sent', 'delivered', 'failed']) {
        expect(UpdateDeliveryStatusInput.safeParse({ ...validInput, status }).success).toBe(true);
      }
    });

    it('rejects pending as a delivery status (not allowed here)', () => {
      // UpdateDeliveryStatusInput only allows sent/delivered/failed, not pending
      expect(
        UpdateDeliveryStatusInput.safeParse({ ...validInput, status: 'pending' }).success
      ).toBe(false);
    });

    it('rejects non-UUID alertId', () => {
      expect(UpdateDeliveryStatusInput.safeParse({ ...validInput, alertId: 'bad' }).success).toBe(
        false
      );
    });

    it('accepts optional telegramMessageId', () => {
      expect(
        UpdateDeliveryStatusInput.safeParse({
          ...validInput,
          telegramMessageId: '12345678',
        }).success
      ).toBe(true);
    });
  });

  // --- AlertOutput ----------------------------------------------------------
  describe('AlertOutput', () => {
    const validOutput: z.infer<typeof AlertOutput> = {
      id: VALID_UUID,
      requestId: VALID_UUID_2,
      alertType: 'breach',
      minutesElapsed: 75,
      escalationLevel: 1,
      nextEscalationAt: null,
      managerTelegramId: null,
      telegramMessageId: null,
      deliveryStatus: 'sent',
      deliveredAt: null,
      alertSentAt: new Date(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      acknowledgedByName: null,
      resolvedAction: null,
      resolutionNotes: null,
    };

    it('accepts minimal valid output without request', () => {
      expect(AlertOutput.safeParse(validOutput).success).toBe(true);
    });

    it('accepts output with full request object', () => {
      const result = AlertOutput.safeParse({
        ...validOutput,
        request: {
          chatId: '-1001234567890',
          chatTitle: 'Client Chat',
          clientUsername: 'johndoe',
          messagePreview: 'I need help with my taxes.',
          accountantName: 'Jane Smith',
        },
      });
      expect(result.success).toBe(true);
    });

    it('accepts output with nullable request fields', () => {
      const result = AlertOutput.safeParse({
        ...validOutput,
        request: {
          chatId: '-1001234567890',
          chatTitle: null,
          clientUsername: null,
          messagePreview: 'Message',
          accountantName: null,
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID id', () => {
      expect(AlertOutput.safeParse({ ...validOutput, id: 'bad' }).success).toBe(false);
    });

    it('rejects invalid alertType', () => {
      expect(
        AlertOutput.safeParse({ ...validOutput, alertType: 'critical' as never }).success
      ).toBe(false);
    });

    it('rejects invalid deliveryStatus', () => {
      expect(
        AlertOutput.safeParse({ ...validOutput, deliveryStatus: 'unknown' as never }).success
      ).toBe(false);
    });

    it('rejects invalid resolvedAction when present', () => {
      expect(
        AlertOutput.safeParse({ ...validOutput, resolvedAction: 'dismissed' as never }).success
      ).toBe(false);
    });

    it('accepts all valid resolvedAction values', () => {
      for (const action of ['mark_resolved', 'accountant_responded', 'auto_expired']) {
        expect(AlertOutput.safeParse({ ...validOutput, resolvedAction: action }).success).toBe(
          true
        );
      }
    });
  });

  // --- AlertStatsOutput -----------------------------------------------------
  describe('AlertStatsOutput', () => {
    const validOutput: z.infer<typeof AlertStatsOutput> = {
      today: { total: 5, warnings: 3, breaches: 2, resolved: 4, pending: 1 },
      week: { total: 30, warnings: 20, breaches: 10, avgResolutionMinutes: 45 },
      month: {
        total: 120,
        breaches: 40,
        topOffenders: [{ accountantId: VALID_UUID, accountantName: 'Jane Smith', breachCount: 5 }],
      },
    };

    it('accepts valid stats output', () => {
      expect(AlertStatsOutput.safeParse(validOutput).success).toBe(true);
    });

    it('accepts null avgResolutionMinutes (no resolved alerts)', () => {
      const result = AlertStatsOutput.safeParse({
        ...validOutput,
        week: { ...validOutput.week, avgResolutionMinutes: null },
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty topOffenders array', () => {
      const result = AlertStatsOutput.safeParse({
        ...validOutput,
        month: { ...validOutput.month, topOffenders: [] },
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID accountantId in topOffenders', () => {
      const result = AlertStatsOutput.safeParse({
        ...validOutput,
        month: {
          ...validOutput.month,
          topOffenders: [{ accountantId: 'not-uuid', accountantName: 'Jane', breachCount: 2 }],
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing today block', () => {
      const rest = omitKey(validOutput, 'today');
      expect(AlertStatsOutput.safeParse(rest).success).toBe(false);
    });

    it('rejects missing week block', () => {
      const rest = omitKey(validOutput, 'week');
      expect(AlertStatsOutput.safeParse(rest).success).toBe(false);
    });

    it('rejects missing month block', () => {
      const rest = omitKey(validOutput, 'month');
      expect(AlertStatsOutput.safeParse(rest).success).toBe(false);
    });
  });
});

// ============================================================================
// TESTS: alerts.ts schemas
// ============================================================================

describe('Alerts router schemas (alerts.ts)', () => {
  // --- ListUnacknowledgedInput ----------------------------------------------
  describe('ListUnacknowledgedInput', () => {
    it('accepts empty object and applies default limit', () => {
      const result = ListUnacknowledgedInput.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it('accepts limit within range', () => {
      expect(ListUnacknowledgedInput.safeParse({ limit: 50 }).success).toBe(true);
      expect(ListUnacknowledgedInput.safeParse({ limit: 1 }).success).toBe(true);
    });

    it('rejects limit above 50', () => {
      expect(ListUnacknowledgedInput.safeParse({ limit: 51 }).success).toBe(false);
    });

    it('rejects limit below 1', () => {
      expect(ListUnacknowledgedInput.safeParse({ limit: 0 }).success).toBe(false);
    });

    it('rejects non-integer limit', () => {
      expect(ListUnacknowledgedInput.safeParse({ limit: 1.5 }).success).toBe(false);
    });
  });

  // --- AcknowledgeInput -----------------------------------------------------
  describe('AcknowledgeInput', () => {
    it('accepts valid UUID id', () => {
      expect(AcknowledgeInput.safeParse({ id: VALID_UUID }).success).toBe(true);
    });

    it('accepts optional resolutionNotes', () => {
      expect(
        AcknowledgeInput.safeParse({ id: VALID_UUID, resolutionNotes: 'Handled' }).success
      ).toBe(true);
    });

    it('rejects non-UUID id', () => {
      expect(AcknowledgeInput.safeParse({ id: 'bad' }).success).toBe(false);
    });

    it('rejects missing id', () => {
      expect(AcknowledgeInput.safeParse({}).success).toBe(false);
    });
  });

  // --- UnacknowledgedAlertOutput --------------------------------------------
  describe('UnacknowledgedAlertOutput', () => {
    const validOutput = {
      id: VALID_UUID,
      requestId: VALID_UUID_2,
      alertType: 'warning',
      minutesElapsed: 30,
      alertSentAt: new Date(),
      chatId: 12345,
      messageText: 'I need help with my taxes',
      clientUsername: null,
    };

    it('accepts valid output', () => {
      expect(UnacknowledgedAlertOutput.safeParse(validOutput).success).toBe(true);
    });

    it('accepts output with clientUsername', () => {
      expect(
        UnacknowledgedAlertOutput.safeParse({ ...validOutput, clientUsername: 'johndoe' }).success
      ).toBe(true);
    });

    it('rejects chatId as string (must be number)', () => {
      expect(
        UnacknowledgedAlertOutput.safeParse({ ...validOutput, chatId: '-1001234567890' }).success
      ).toBe(false);
    });

    it('rejects non-UUID id', () => {
      expect(UnacknowledgedAlertOutput.safeParse({ ...validOutput, id: 'bad' }).success).toBe(
        false
      );
    });

    it('rejects invalid alertType', () => {
      expect(
        UnacknowledgedAlertOutput.safeParse({ ...validOutput, alertType: 'critical' }).success
      ).toBe(false);
    });

    it('rejects non-integer minutesElapsed', () => {
      expect(
        UnacknowledgedAlertOutput.safeParse({ ...validOutput, minutesElapsed: 1.5 }).success
      ).toBe(false);
    });
  });

  // --- AcknowledgeOutput ----------------------------------------------------
  describe('AcknowledgeOutput', () => {
    const validOutput = {
      success: true,
      alert: {
        id: VALID_UUID,
        acknowledgedAt: new Date(),
        acknowledgedBy: VALID_UUID_2,
        resolutionNotes: null,
      },
    };

    it('accepts valid output', () => {
      expect(AcknowledgeOutput.safeParse(validOutput).success).toBe(true);
    });

    it('accepts output with resolutionNotes', () => {
      const result = AcknowledgeOutput.safeParse({
        ...validOutput,
        alert: { ...validOutput.alert, resolutionNotes: 'Issue resolved' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID alert.id', () => {
      const result = AcknowledgeOutput.safeParse({
        ...validOutput,
        alert: { ...validOutput.alert, id: 'bad' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-UUID alert.acknowledgedBy', () => {
      const result = AcknowledgeOutput.safeParse({
        ...validOutput,
        alert: { ...validOutput.alert, acknowledgedBy: 'bad' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing success field', () => {
      const rest = omitKey(validOutput, 'success');
      expect(AcknowledgeOutput.safeParse(rest).success).toBe(false);
    });
  });
});
