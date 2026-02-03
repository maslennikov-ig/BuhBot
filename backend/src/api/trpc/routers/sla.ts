/**
 * SLA Router - SLA Monitoring Operations
 *
 * tRPC router for SLA timer management and message classification.
 * Used by Admin Panel and Telegram Bot for SLA monitoring.
 *
 * Procedures:
 * Mutations:
 * - createRequest: Create new client request from Telegram message
 * - classifyMessage: Classify message text (REQUEST/SPAM/GRATITUDE/CLARIFICATION)
 * - startTimer: Start SLA timer for a request
 * - stopTimer: Stop SLA timer when accountant responds
 *
 * Queries:
 * - getRequests: List requests with filters and pagination
 * - getRequestById: Get single request details
 * - getActiveTimers: Get list of active SLA timers
 *
 * @module api/trpc/routers/sla
 */

import { router, authedProcedure, managerProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, ClientRequest, Chat, User } from '@prisma/client';
import { classifyMessage as classifyMessageService } from '../../../services/classifier/index.js';
import { startSlaTimer, stopSlaTimer, getSlaStatus } from '../../../services/sla/timer.service.js';
import {
  calculateWorkingMinutes,
  DEFAULT_WORKING_SCHEDULE,
} from '../../../services/sla/working-hours.service.js';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

/**
 * Request status schema (matches Prisma RequestStatus enum)
 */
const RequestStatusSchema = z.enum(['pending', 'in_progress', 'answered', 'escalated']);

/**
 * Message classification schema (matches Prisma MessageClassification enum)
 */
const MessageClassificationSchema = z.enum(['REQUEST', 'SPAM', 'GRATITUDE', 'CLARIFICATION']);

/**
 * Classification source schema (matches classifier model types)
 */
const ClassificationSourceSchema = z.enum(['openrouter', 'keyword-fallback']);

/**
 * Create request input schema
 */
const CreateRequestInput = z.object({
  chatId: z.string(),
  messageId: z.string(),
  messageText: z.string().max(10000),
  clientUsername: z.string().optional(),
  receivedAt: z.coerce.date().optional(),
});

/**
 * Classify message input schema
 */
const ClassifyMessageInput = z.object({
  messageText: z.string().max(10000),
  forceModel: z.enum(['openrouter', 'keyword-fallback']).optional(),
});

/**
 * Start SLA timer input schema
 */
const StartSlaTimerInput = z.object({
  requestId: z.string().uuid(),
});

/**
 * Stop SLA timer input schema
 */
const StopSlaTimerInput = z.object({
  requestId: z.string().uuid(),
  respondedBy: z.string().uuid(),
  responseMessageId: z.string().optional(),
});

/**
 * Get requests input schema with filters
 */
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

/**
 * Get request by ID input schema
 */
const GetRequestByIdInput = z.object({
  requestId: z.string().uuid(),
});

/**
 * Get active timers input schema
 */
const GetActiveTimersInput = z.object({
  chatId: z.string().optional(),
});

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

/**
 * Classification result output schema
 */
const ClassificationResultOutput = z.object({
  classification: MessageClassificationSchema,
  confidence: z.number().min(0).max(1),
  model: ClassificationSourceSchema,
  reasoning: z.string().optional(),
});

/**
 * Request output schema
 */
const RequestOutput = z.object({
  id: z.string().uuid(),
  chatId: z.string(),
  messageId: z.string(),
  messageText: z.string(),
  clientUsername: z.string().nullable(),
  receivedAt: z.date(),
  status: RequestStatusSchema,

  // Classification
  classification: MessageClassificationSchema,
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

/**
 * Request list output schema
 */
const RequestListOutput = z.object({
  items: z.array(RequestOutput),
  total: z.number(),
  hasMore: z.boolean(),
});

/**
 * SLA timer result output schema
 */
const SlaTimerResultOutput = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['started', 'stopped', 'already_stopped', 'not_found']),
  workingMinutes: z.number().optional(),
  breached: z.boolean().optional(),
});

/**
 * Active timer info output schema
 */
const ActiveTimerOutput = z.object({
  requestId: z.string().uuid(),
  chatId: z.string(),
  startedAt: z.date(),
  elapsedMinutes: z.number(),
  thresholdMinutes: z.number(),
  breachAt: z.date(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert Prisma ClientRequest to RequestOutput format
 */
function formatRequestOutput(
  request: ClientRequest,
  chat: Chat | null,
  assignedUser: User | null
): z.infer<typeof RequestOutput> {
  return {
    id: request.id,
    chatId: String(request.chatId),
    messageId: String(request.messageId),
    messageText: request.messageText,
    clientUsername: request.clientUsername,
    receivedAt: request.receivedAt,
    status: request.status,
    classification: request.classification,
    classificationScore: request.classificationScore,
    classificationModel: request.classificationModel,
    slaTimerStartedAt: request.slaTimerStartedAt,
    slaWorkingMinutes: request.slaWorkingMinutes,
    slaBreached: request.slaBreached,
    responseAt: request.responseAt,
    responseTimeMinutes: request.responseTimeMinutes,
    respondedBy: request.respondedBy,
    assignedTo: request.assignedTo,
    assignedAccountantName: assignedUser?.fullName ?? null,
    chatTitle: chat?.title ?? null,
  };
}

// ============================================================================
// ROUTER DEFINITION
// ============================================================================

/**
 * SLA router for SLA monitoring operations
 */
export const slaRouter = router({
  // ==========================================================================
  // MUTATIONS
  // ==========================================================================

  /**
   * Create a new client request from Telegram message
   *
   * Workflow:
   * 1. Get chat configuration
   * 2. Classify message using AI/keyword classifier
   * 3. Create ClientRequest record with classification
   * 4. Return formatted output
   *
   * @param chatId - Telegram chat ID (as string for BigInt)
   * @param messageId - Telegram message ID (as string for BigInt)
   * @param messageText - Message text content
   * @param clientUsername - Optional client Telegram username
   * @param receivedAt - Optional message receive timestamp
   * @returns Created request with classification
   * @authorization Managers only (called by bot service)
   */
  createRequest: managerProcedure
    .input(CreateRequestInput)
    .output(RequestOutput)
    .mutation(async ({ ctx, input }) => {
      // 1. Get chat config (or create if not exists)
      let chat = await ctx.prisma.chat.findUnique({
        where: { id: BigInt(input.chatId) },
      });

      if (!chat) {
        // Fetch default SLA threshold from GlobalSettings
        const globalSettings = await ctx.prisma.globalSettings.findUnique({
          where: { id: 'default' },
          select: { defaultSlaThreshold: true },
        });

        // Create chat with defaults if not exists
        chat = await ctx.prisma.chat.create({
          data: {
            id: BigInt(input.chatId),
            chatType: 'group', // Default to group
            slaEnabled: true,
            slaThresholdMinutes: globalSettings?.defaultSlaThreshold ?? 60,
            monitoringEnabled: true,
          },
        });
      }

      // 2. Classify message using classifier service
      const classificationResult = await classifyMessageService(ctx.prisma, input.messageText);

      // 3. Create ClientRequest with classification
      const receivedAt = input.receivedAt ?? new Date();

      // Build create data, filtering undefined values
      const createData: Prisma.ClientRequestUncheckedCreateInput = {
        chatId: BigInt(input.chatId),
        messageId: BigInt(input.messageId),
        messageText: input.messageText,
        receivedAt,
        classification: classificationResult.classification,
        classificationScore: classificationResult.confidence,
        classificationModel: classificationResult.model,
        status: 'pending',
        slaBreached: false,
      };

      // Add optional fields only if defined
      if (input.clientUsername !== undefined) {
        createData.clientUsername = input.clientUsername;
      }

      // If chat has assigned accountant, assign request to them
      if (chat.assignedAccountantId) {
        createData.assignedTo = chat.assignedAccountantId;
      }

      const request = await ctx.prisma.clientRequest.create({
        data: createData,
        include: {
          chat: true,
          assignedUser: true,
        },
      });

      // 4. Return formatted output
      return formatRequestOutput(request, request.chat, request.assignedUser);
    }),

  /**
   * Classify a message using AI or keyword-based classifier
   *
   * @param messageText - Message text to classify
   * @param forceModel - Optional: force specific classification model
   * @returns Classification result with category, confidence, model
   * @authorization All authenticated users
   */
  classifyMessage: authedProcedure
    .input(ClassifyMessageInput)
    .output(ClassificationResultOutput)
    .mutation(async ({ ctx, input }) => {
      // Use classifier service
      // Note: forceModel is not currently supported by classifier service
      // It uses cascade logic: cache -> AI -> keyword fallback
      const result = await classifyMessageService(ctx.prisma, input.messageText);

      return {
        classification: result.classification,
        confidence: result.confidence,
        model: result.model === 'cache' ? 'openrouter' : result.model,
        reasoning: result.reasoning,
      };
    }),

  /**
   * Start SLA timer for a client request
   *
   * @param requestId - UUID of the ClientRequest
   * @returns Timer status (started, not_found)
   * @authorization Managers only
   */
  startTimer: managerProcedure
    .input(StartSlaTimerInput)
    .output(SlaTimerResultOutput)
    .mutation(async ({ ctx, input }) => {
      // 1. Get request from DB
      const request = await ctx.prisma.clientRequest.findUnique({
        where: { id: input.requestId },
        include: { chat: true },
      });

      if (!request) {
        return {
          requestId: input.requestId,
          status: 'not_found' as const,
        };
      }

      // 2. Get chat threshold
      const thresholdMinutes = request.chat?.slaThresholdMinutes ?? 60;

      // 3. Call startSlaTimer service
      await startSlaTimer(input.requestId, String(request.chatId), thresholdMinutes);

      // 4. Return result
      return {
        requestId: input.requestId,
        status: 'started' as const,
        workingMinutes: 0,
        breached: false,
      };
    }),

  /**
   * Stop SLA timer when accountant responds
   *
   * @param requestId - UUID of the ClientRequest
   * @param respondedBy - UUID of the responding user
   * @param responseMessageId - Optional Telegram message ID of response
   * @returns Timer status with elapsed time
   * @authorization Managers only
   */
  stopTimer: managerProcedure
    .input(StopSlaTimerInput)
    .output(SlaTimerResultOutput)
    .mutation(async ({ ctx, input }) => {
      // 1. Get request from DB
      const request = await ctx.prisma.clientRequest.findUnique({
        where: { id: input.requestId },
        include: { chat: true },
      });

      if (!request) {
        return {
          requestId: input.requestId,
          status: 'not_found' as const,
        };
      }

      // Check if already stopped
      if (request.status === 'answered') {
        return {
          requestId: input.requestId,
          status: 'already_stopped' as const,
          workingMinutes: request.slaWorkingMinutes ?? undefined,
          breached: request.slaBreached,
        };
      }

      // 2. Build update data
      const updateData: Prisma.ClientRequestUpdateInput = {
        respondedBy: input.respondedBy,
        responseAt: new Date(),
        status: 'answered',
      };

      if (input.responseMessageId !== undefined) {
        updateData.responseMessageId = BigInt(input.responseMessageId);
      }

      // Update request with response info before stopping timer
      await ctx.prisma.clientRequest.update({
        where: { id: input.requestId },
        data: updateData,
      });

      // 3. Stop timer using service
      await stopSlaTimer(input.requestId);

      // 4. Get updated status
      const status = await getSlaStatus(input.requestId);

      return {
        requestId: input.requestId,
        status: 'stopped' as const,
        workingMinutes: status?.elapsedWorkingMinutes ?? 0,
        breached: status?.breached ?? false,
      };
    }),

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  /**
   * Get list of requests with filters and pagination
   *
   * @param chatId - Filter by chat ID
   * @param accountantId - Filter by assigned accountant
   * @param status - Filter by request status
   * @param slaBreached - Filter by SLA breach status
   * @param dateFrom - Filter from date
   * @param dateTo - Filter to date
   * @param limit - Page size (default: 50)
   * @param offset - Pagination offset
   * @returns Paginated list of requests
   * @authorization All authenticated users
   */
  getRequests: authedProcedure
    .input(GetRequestsInput)
    .output(RequestListOutput)
    .query(async ({ ctx, input }) => {
      // Build where clause
      const where: Prisma.ClientRequestWhereInput = {};

      if (input.chatId !== undefined) {
        where.chatId = BigInt(input.chatId);
      }
      if (input.accountantId !== undefined) {
        where.assignedTo = input.accountantId;
      }
      if (input.status !== undefined) {
        where.status = input.status;
      }
      if (input.slaBreached !== undefined) {
        where.slaBreached = input.slaBreached;
      }
      if (input.dateFrom || input.dateTo) {
        where.receivedAt = {};
        if (input.dateFrom) {
          where.receivedAt.gte = input.dateFrom;
        }
        if (input.dateTo) {
          where.receivedAt.lte = input.dateTo;
        }
      }

      // Fetch requests with relations
      const [requests, total] = await Promise.all([
        ctx.prisma.clientRequest.findMany({
          where,
          include: {
            chat: true,
            assignedUser: true,
          },
          orderBy: { receivedAt: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.clientRequest.count({ where }),
      ]);

      // Format output
      const items = requests.map((req) => formatRequestOutput(req, req.chat, req.assignedUser));

      return {
        items,
        total,
        hasMore: input.offset + requests.length < total,
      };
    }),

  /**
   * Get single request by ID with full details
   *
   * @param requestId - UUID of the request
   * @returns Request details or throws NOT_FOUND
   * @authorization All authenticated users
   */
  getRequestById: authedProcedure
    .input(GetRequestByIdInput)
    .output(RequestOutput)
    .query(async ({ ctx, input }) => {
      const request = await ctx.prisma.clientRequest.findUnique({
        where: { id: input.requestId },
        include: {
          chat: true,
          assignedUser: true,
        },
      });

      if (!request) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Request with ID ${input.requestId} not found`,
        });
      }

      return formatRequestOutput(request, request.chat, request.assignedUser);
    }),

  /**
   * Get list of active SLA timers
   *
   * Returns requests with pending status and active SLA timers.
   *
   * @param chatId - Optional filter by chat ID
   * @returns List of active timers with elapsed time and breach info
   * @authorization All authenticated users
   */
  getActiveTimers: authedProcedure
    .input(GetActiveTimersInput)
    .output(z.array(ActiveTimerOutput))
    .query(async ({ ctx, input }) => {
      // Build where clause for active timers
      const where: Prisma.ClientRequestWhereInput = {
        status: { in: ['pending', 'in_progress'] },
        slaTimerStartedAt: { not: null },
        classification: 'REQUEST', // Only track REQUEST type
      };

      if (input.chatId !== undefined) {
        where.chatId = BigInt(input.chatId);
      }

      // Fetch active requests
      const requests = await ctx.prisma.clientRequest.findMany({
        where,
        include: {
          chat: true,
        },
        orderBy: { slaTimerStartedAt: 'asc' },
      });

      // Calculate timer info for each request
      const now = new Date();
      const timers = requests.map((req) => {
        const startedAt = req.slaTimerStartedAt!;
        const thresholdMinutes = req.chat?.slaThresholdMinutes ?? 60;

        // Calculate elapsed working minutes
        const elapsedMinutes = calculateWorkingMinutes(
          req.receivedAt,
          now,
          DEFAULT_WORKING_SCHEDULE
        );

        // Calculate breach time
        const remainingMinutes = Math.max(0, thresholdMinutes - elapsedMinutes);
        const breachAt = new Date(now.getTime() + remainingMinutes * 60 * 1000);

        return {
          requestId: req.id,
          chatId: String(req.chatId),
          startedAt,
          elapsedMinutes,
          thresholdMinutes,
          breachAt,
        };
      });

      return timers;
    }),
});
