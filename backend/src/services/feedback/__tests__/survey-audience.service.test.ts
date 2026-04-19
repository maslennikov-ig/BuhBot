/**
 * survey.service — gh-313 audience selector unit tests.
 *
 * Focus: `createCampaign({ audience })` persistence + validation, and
 * `getActiveClients(start, end, { audience })` filtering behavior per mode.
 *
 * Prisma is mocked with `vi.hoisted` — no real DB involvement. `segment.service`
 * is also mocked to isolate audience expansion from segment persistence.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  feedbackSurvey: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  chat: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  globalSettings: {
    findUnique: vi.fn(),
  },
  chatSegment: {
    findMany: vi.fn(),
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

const mockGetChatsInSegments = vi.hoisted(() => vi.fn());
vi.mock('../segment.service.js', () => ({
  getChatsInSegments: mockGetChatsInSegments,
}));

// Import after mocks.
import { createCampaign, getActiveClients } from '../survey.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  // Default: no overlap, settings row with 90-day max + 7-day validity.
  mockPrisma.feedbackSurvey.findFirst.mockResolvedValue(null);
  mockPrisma.globalSettings.findUnique.mockResolvedValue({
    surveyMaxRangeDays: 90,
    surveyValidityDays: 7,
    surveyCooldownHours: 24,
  });
});

// ---------------------------------------------------------------------------
// createCampaign — audience variants
// ---------------------------------------------------------------------------

describe('createCampaign → audience', () => {
  const startDate = new Date('2026-04-20T00:00:00.000Z');
  const endDate = new Date('2026-04-30T00:00:00.000Z');

  it('defaults to { type: "all" } and persists the right columns', async () => {
    mockPrisma.feedbackSurvey.create.mockResolvedValue({
      id: 's1',
      audienceType: 'all',
      audienceChatIds: [],
      audienceSegmentIds: [],
      scheduledAt: startDate,
      expiresAt: endDate,
    });

    await createCampaign({ startDate, endDate });

    const args = mockPrisma.feedbackSurvey.create.mock.calls[0]![0]!;
    expect(args.data.audienceType).toBe('all');
    expect(args.data.audienceChatIds).toEqual([]);
    expect(args.data.audienceSegmentIds).toEqual([]);
  });

  it('persists specific_chats audience with the given chatIds', async () => {
    mockPrisma.feedbackSurvey.create.mockResolvedValue({
      id: 's2',
      audienceType: 'specific_chats',
      audienceChatIds: [10n, 20n],
      audienceSegmentIds: [],
    });

    await createCampaign({
      startDate,
      endDate,
      audience: { type: 'specific_chats', chatIds: [10n, 20n] },
    });

    const args = mockPrisma.feedbackSurvey.create.mock.calls[0]![0]!;
    expect(args.data.audienceType).toBe('specific_chats');
    expect(args.data.audienceChatIds).toEqual([10n, 20n]);
    expect(args.data.audienceSegmentIds).toEqual([]);
  });

  it('rejects specific_chats with empty chatIds (AUDIENCE_INVALID, no DB write)', async () => {
    await expect(
      createCampaign({
        startDate,
        endDate,
        audience: { type: 'specific_chats', chatIds: [] },
      })
    ).rejects.toMatchObject({ name: 'AUDIENCE_INVALID' });
    expect(mockPrisma.feedbackSurvey.create).not.toHaveBeenCalled();
  });

  it('persists segments audience after validating UUIDs exist', async () => {
    mockPrisma.chatSegment.findMany.mockResolvedValue([{ id: 'seg-1' }, { id: 'seg-2' }]);
    mockPrisma.feedbackSurvey.create.mockResolvedValue({
      id: 's3',
      audienceType: 'segments',
      audienceChatIds: [],
      audienceSegmentIds: ['seg-1', 'seg-2'],
    });

    await createCampaign({
      startDate,
      endDate,
      audience: { type: 'segments', segmentIds: ['seg-1', 'seg-2'] },
    });

    const createArgs = mockPrisma.feedbackSurvey.create.mock.calls[0]![0]!;
    expect(createArgs.data.audienceType).toBe('segments');
    expect(createArgs.data.audienceSegmentIds).toEqual(['seg-1', 'seg-2']);
    expect(createArgs.data.audienceChatIds).toEqual([]);
  });

  it('rejects segments referencing unknown UUIDs (AUDIENCE_INVALID, no DB write)', async () => {
    // Only seg-1 is known; seg-missing is not.
    mockPrisma.chatSegment.findMany.mockResolvedValue([{ id: 'seg-1' }]);

    await expect(
      createCampaign({
        startDate,
        endDate,
        audience: { type: 'segments', segmentIds: ['seg-1', 'seg-missing'] },
      })
    ).rejects.toMatchObject({
      name: 'AUDIENCE_INVALID',
      message: expect.stringMatching(/seg-missing/),
    });
    expect(mockPrisma.feedbackSurvey.create).not.toHaveBeenCalled();
  });

  it('rejects segments with empty segmentIds (AUDIENCE_INVALID)', async () => {
    await expect(
      createCampaign({
        startDate,
        endDate,
        audience: { type: 'segments', segmentIds: [] },
      })
    ).rejects.toMatchObject({ name: 'AUDIENCE_INVALID' });
    expect(mockPrisma.feedbackSurvey.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getActiveClients — audience-aware filtering
// ---------------------------------------------------------------------------

describe('getActiveClients → audience', () => {
  const startDate = new Date('2026-04-01T00:00:00.000Z');
  const endDate = new Date('2026-04-30T00:00:00.000Z');

  it('specific_chats returns only matching chats (ignores receivedAt filter)', async () => {
    mockPrisma.chat.findMany.mockResolvedValue([
      { id: 10n, title: 'A' },
      { id: 20n, title: 'B' },
    ]);

    const rows = await getActiveClients(startDate, endDate, {
      audience: { type: 'specific_chats', chatIds: [10n, 20n] },
    });

    const args = mockPrisma.chat.findMany.mock.calls[0]![0]!;
    expect(args.where.id.in).toEqual([10n, 20n]);
    expect(args.where.deletedAt).toBeNull();
    // Crucially no `clientRequests.some` filter — targeted mode surveys quiet chats too.
    expect(args.where.clientRequests).toBeUndefined();

    expect(rows).toEqual([
      { chatId: 10n, title: 'A' },
      { chatId: 20n, title: 'B' },
    ]);
  });

  it('specific_chats with empty list short-circuits to [] (no DB hit)', async () => {
    const rows = await getActiveClients(startDate, endDate, {
      audience: { type: 'specific_chats', chatIds: [] },
    });

    expect(rows).toEqual([]);
    expect(mockPrisma.chat.findMany).not.toHaveBeenCalled();
  });

  it('segments expands via getChatsInSegments then fetches chats', async () => {
    mockGetChatsInSegments.mockResolvedValue([10n, 20n, 30n]);
    mockPrisma.chat.findMany.mockResolvedValue([
      { id: 10n, title: 'A' },
      { id: 20n, title: 'B' },
      { id: 30n, title: 'C' },
    ]);

    const rows = await getActiveClients(startDate, endDate, {
      audience: { type: 'segments', segmentIds: ['seg-1'] },
    });

    expect(mockGetChatsInSegments).toHaveBeenCalledWith(['seg-1']);
    const args = mockPrisma.chat.findMany.mock.calls[0]![0]!;
    expect(args.where.id.in).toEqual([10n, 20n, 30n]);

    expect(rows).toHaveLength(3);
  });

  it('segments with zero resolved chats short-circuits to []', async () => {
    mockGetChatsInSegments.mockResolvedValue([]);

    const rows = await getActiveClients(startDate, endDate, {
      audience: { type: 'segments', segmentIds: ['seg-empty'] },
    });

    expect(rows).toEqual([]);
    expect(mockPrisma.chat.findMany).not.toHaveBeenCalled();
  });

  it('audience "all" falls back to the legacy receivedAt-in-range filter', async () => {
    mockPrisma.chat.findMany.mockResolvedValue([{ id: 10n, title: 'A' }]);

    await getActiveClients(startDate, endDate, { audience: { type: 'all' } });

    const args = mockPrisma.chat.findMany.mock.calls[0]![0]!;
    expect(args.where.clientRequests.some.receivedAt.gte).toEqual(startDate);
    expect(args.where.clientRequests.some.receivedAt.lte).toEqual(endDate);
  });

  it('no options passed → legacy behavior (unchanged)', async () => {
    mockPrisma.chat.findMany.mockResolvedValue([{ id: 10n, title: 'A' }]);

    await getActiveClients(startDate, endDate);

    const args = mockPrisma.chat.findMany.mock.calls[0]![0]!;
    expect(args.where.clientRequests.some.receivedAt.gte).toEqual(startDate);
  });
});
