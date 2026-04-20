/**
 * survey.service — gh-292 (custom ranges + cooldown) unit tests.
 *
 * Focus: `createCampaign`, `canSendSurveyToChat`, `getSurveyCooldownHours`,
 *        `getSurveyMaxRangeDays`, `quarterToRange`.
 *
 * Prisma is mocked (vi.hoisted) at the module level. No real DB involvement.
 * Pattern mirrors the existing alert.service and sla-timer.worker tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  feedbackSurvey: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  chat: {
    findUnique: vi.fn(),
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

// Import AFTER the mocks are in place.
import {
  createCampaign,
  canSendSurveyToChat,
  getSurveyCooldownHours,
  getSurveyMaxRangeDays,
  quarterToRange,
} from '../survey.service.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Freeze the wall clock at a stable ISO UTC instant for each test. */
function freezeClock(iso: string): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

/** Build a minimal created-survey row that the Prisma mock can echo back. */
function buildCreatedSurvey(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    id: 'survey-uuid',
    quarter: null,
    startDate: new Date('2026-05-01T00:00:00.000Z'),
    endDate: new Date('2026-05-10T00:00:00.000Z'),
    scheduledAt: new Date('2026-05-01T00:00:00.000Z'),
    sentAt: null,
    expiresAt: new Date('2026-05-08T00:00:00.000Z'),
    closedAt: null,
    closedBy: null,
    status: 'scheduled',
    totalClients: 0,
    deliveredCount: 0,
    responseCount: 0,
    averageRating: null,
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// quarterToRange — pure helper, no Prisma involvement.
// ---------------------------------------------------------------------------

describe('quarterToRange', () => {
  it('maps 2026-Q1 to Jan 1..Mar 31 inclusive', () => {
    const { startDate, endDate } = quarterToRange('2026-Q1');
    expect(startDate.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    // Day 0 of the next quarter (month 3 = April, day 0 = March 31).
    expect(endDate.toISOString()).toBe('2026-03-31T23:59:59.999Z');
  });

  it('maps 2026-Q4 to Oct 1..Dec 31 inclusive', () => {
    const { startDate, endDate } = quarterToRange('2026-Q4');
    expect(startDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(endDate.toISOString()).toBe('2026-12-31T23:59:59.999Z');
  });

  it('rejects malformed quarter strings', () => {
    expect(() => quarterToRange('2026-Q5')).toThrow(/Invalid quarter format/);
    expect(() => quarterToRange('2026Q1')).toThrow(/Invalid quarter format/);
    expect(() => quarterToRange('not-a-quarter')).toThrow(/Invalid quarter format/);
  });
});

// ---------------------------------------------------------------------------
// createCampaign — gh-292 happy path & validation
// ---------------------------------------------------------------------------

describe('createCampaign', () => {
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

  it('creates a survey for a valid 10-day range (happy path)', async () => {
    freezeClock('2026-04-18T10:00:00.000Z');

    const startDate = new Date('2026-04-20T00:00:00.000Z');
    const endDate = new Date('2026-04-30T00:00:00.000Z');

    mockPrisma.feedbackSurvey.create.mockResolvedValue(buildCreatedSurvey({ startDate, endDate }));

    const survey = await createCampaign({ startDate, endDate });

    expect(mockPrisma.feedbackSurvey.create).toHaveBeenCalledTimes(1);
    const createArgs = mockPrisma.feedbackSurvey.create.mock.calls[0]![0]!;
    expect(createArgs.data.quarter).toBeNull();
    expect(createArgs.data.startDate).toBe(startDate);
    expect(createArgs.data.endDate).toBe(endDate);
    expect(createArgs.data.status).toBe('scheduled');
    // scheduledAt defaults to startDate when scheduledFor is omitted.
    expect(createArgs.data.scheduledAt).toEqual(startDate);
    // expiresAt = scheduledAt + validityDays (7 default).
    const expectedExpires = new Date(startDate.getTime() + 7 * 86_400_000);
    expect(createArgs.data.expiresAt).toEqual(expectedExpires);

    expect(survey.responseRate).toBe(0);
  });

  it('rejects endDate <= startDate with RANGE_INVALID', async () => {
    freezeClock('2026-04-18T10:00:00.000Z');

    const startDate = new Date('2026-05-01T00:00:00.000Z');
    const endDate = new Date('2026-05-01T00:00:00.000Z'); // equal → invalid

    await expect(createCampaign({ startDate, endDate })).rejects.toMatchObject({
      name: 'RANGE_INVALID',
    });
    expect(mockPrisma.feedbackSurvey.create).not.toHaveBeenCalled();
  });

  it('rejects range > surveyMaxRangeDays with RANGE_INVALID', async () => {
    freezeClock('2026-04-18T10:00:00.000Z');

    mockPrisma.globalSettings.findUnique.mockResolvedValue({
      surveyMaxRangeDays: 30, // tight cap for this test
      surveyValidityDays: 7,
      surveyCooldownHours: 24,
    });

    const startDate = new Date('2026-05-01T00:00:00.000Z');
    // 60 days — exceeds the 30-day cap.
    const endDate = new Date('2026-06-30T00:00:00.000Z');

    await expect(createCampaign({ startDate, endDate })).rejects.toMatchObject({
      name: 'RANGE_INVALID',
      message: expect.stringMatching(/exceeds maximum 30d/),
    });
    expect(mockPrisma.feedbackSurvey.create).not.toHaveBeenCalled();
  });

  it('allows Q2 (91d) with bypassMaxRangeCheck=true (buh-i4xx)', async () => {
    // Q2 2026: Apr 1 00:00:00 UTC .. Jun 30 23:59:59.999 UTC = ~91d.
    // With the default 90d cap the regular path would throw RANGE_INVALID.
    freezeClock('2026-04-18T10:00:00.000Z');

    const { startDate, endDate } = quarterToRange('2026-Q2');
    mockPrisma.feedbackSurvey.create.mockResolvedValue(
      buildCreatedSurvey({ startDate, endDate, quarter: '2026-Q2' })
    );

    const survey = await createCampaign({
      startDate,
      endDate,
      quarter: '2026-Q2',
      bypassMaxRangeCheck: true,
    });

    expect(survey.quarter).toBe('2026-Q2');
    expect(mockPrisma.feedbackSurvey.create).toHaveBeenCalledTimes(1);
    // Max-range settings should NOT have been fetched — guard was skipped.
    expect(mockPrisma.globalSettings.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ surveyMaxRangeDays: true }) })
    );
  });

  it('still rejects a ~91d custom range WITHOUT bypass (buh-i4xx guard intact)', async () => {
    // Regression: the bypass is opt-in only. Admin-typed custom ranges over
    // the cap must still be rejected so the abuse guard stays effective.
    freezeClock('2026-04-18T10:00:00.000Z');

    const startDate = new Date('2026-04-01T00:00:00.000Z');
    const endDate = new Date('2026-06-30T23:59:59.999Z'); // ~91d

    await expect(createCampaign({ startDate, endDate })).rejects.toMatchObject({
      name: 'RANGE_INVALID',
      message: expect.stringMatching(/exceeds maximum 90d/),
    });
    expect(mockPrisma.feedbackSurvey.create).not.toHaveBeenCalled();
  });

  it('allows historical ranges when they satisfy ordering and max-range rules', async () => {
    freezeClock('2026-04-18T10:00:00.000Z');

    const startDate = new Date('2026-03-01T00:00:00.000Z');
    const endDate = new Date('2026-03-15T00:00:00.000Z');

    mockPrisma.feedbackSurvey.create.mockResolvedValue({
      id: 'survey-past-range',
      quarter: null,
      startDate,
      endDate,
      scheduledAt: startDate,
      expiresAt: new Date(startDate.getTime() + 7 * 86_400_000),
      status: 'scheduled',
      createdAt: new Date('2026-04-18T10:00:00.000Z'),
      updatedAt: new Date('2026-04-18T10:00:00.000Z'),
    });

    const survey = await createCampaign({ startDate, endDate });

    expect(mockPrisma.feedbackSurvey.create).toHaveBeenCalledTimes(1);
    expect(survey.id).toBe('survey-past-range');
  });

  it('rejects overlap with a scheduled/sending/active campaign and attaches conflictingSurveyId', async () => {
    freezeClock('2026-04-18T10:00:00.000Z');

    mockPrisma.feedbackSurvey.findFirst.mockResolvedValue({
      id: 'existing-survey-uuid',
      quarter: '2026-Q2',
      startDate: new Date('2026-04-15T00:00:00.000Z'),
      endDate: new Date('2026-05-05T00:00:00.000Z'),
    });

    const startDate = new Date('2026-04-25T00:00:00.000Z');
    const endDate = new Date('2026-05-10T00:00:00.000Z');

    await expect(createCampaign({ startDate, endDate })).rejects.toMatchObject({
      name: 'OVERLAP',
      conflictingSurveyId: 'existing-survey-uuid',
    });
    expect(mockPrisma.feedbackSurvey.create).not.toHaveBeenCalled();

    // Verify the overlap query used the correct semantics:
    //   startDate <= new.endDate AND endDate >= new.startDate
    const findArgs = mockPrisma.feedbackSurvey.findFirst.mock.calls[0]![0]!;
    expect(findArgs.where.status.in).toEqual(['scheduled', 'sending', 'active']);
    expect(findArgs.where.startDate.lte).toEqual(endDate);
    expect(findArgs.where.endDate.gte).toEqual(startDate);
  });

  it('handles Europe/Moscow DST boundary (2026-10-25) without off-by-one', async () => {
    // In 2026 Europe/Moscow stays on UTC+3 year-round (no DST since 2014), but
    // many western hosts do observe DST. This test guards against surprises
    // when the range crosses the boundary date Oct 25 on hosts that change.
    freezeClock('2026-10-01T10:00:00.000Z');

    const startDate = new Date('2026-10-20T00:00:00.000Z');
    const endDate = new Date('2026-10-30T00:00:00.000Z');

    mockPrisma.feedbackSurvey.create.mockResolvedValue(buildCreatedSurvey({ startDate, endDate }));

    const survey = await createCampaign({ startDate, endDate });

    const createArgs = mockPrisma.feedbackSurvey.create.mock.calls[0]![0]!;
    // Range span is exactly 10 days regardless of DST: endDate - startDate in ms.
    const rangeMs =
      (createArgs.data.endDate as Date).getTime() - (createArgs.data.startDate as Date).getTime();
    expect(rangeMs).toBe(10 * 86_400_000);
    expect(survey.endDate).toEqual(endDate);
  });
});

// ---------------------------------------------------------------------------
// canSendSurveyToChat — cooldown semantics
// ---------------------------------------------------------------------------

describe('canSendSurveyToChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('returns allowed=true when lastSurveySentAt is null', async () => {
    mockPrisma.chat.findUnique.mockResolvedValue({ lastSurveySentAt: null });

    const res = await canSendSurveyToChat(BigInt('-100123'), 24);

    expect(res.allowed).toBe(true);
    expect(res.lastSurveySentAt).toBeNull();
    expect(res.nextEligibleAt).toBeUndefined();
  });

  it('returns allowed=true when the chat does not exist', async () => {
    mockPrisma.chat.findUnique.mockResolvedValue(null);

    const res = await canSendSurveyToChat(BigInt('-100123'), 24);

    expect(res.allowed).toBe(true);
  });

  it('returns allowed=false with nextEligibleAt when within cooldown window', async () => {
    freezeClock('2026-04-18T12:00:00.000Z');

    const lastSent = new Date('2026-04-18T06:00:00.000Z'); // 6h ago
    mockPrisma.chat.findUnique.mockResolvedValue({ lastSurveySentAt: lastSent });

    const res = await canSendSurveyToChat(BigInt('-100123'), 24);

    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('cooldown');
    // 6h ago + 24h cooldown = 18h from now.
    expect(res.nextEligibleAt?.toISOString()).toBe('2026-04-19T06:00:00.000Z');
    expect(res.lastSurveySentAt).toEqual(lastSent);
  });

  it('returns allowed=true when the cooldown has expired', async () => {
    freezeClock('2026-04-20T00:00:00.000Z');

    // 48h ago, 24h cooldown → expired.
    const lastSent = new Date('2026-04-18T00:00:00.000Z');
    mockPrisma.chat.findUnique.mockResolvedValue({ lastSurveySentAt: lastSent });

    const res = await canSendSurveyToChat(BigInt('-100123'), 24);

    expect(res.allowed).toBe(true);
    expect(res.reason).toBeUndefined();
    expect(res.lastSurveySentAt).toEqual(lastSent);
  });
});

// ---------------------------------------------------------------------------
// getSurveyCooldownHours / getSurveyMaxRangeDays — defaults
// ---------------------------------------------------------------------------

describe('getSurveyCooldownHours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 24 when the GlobalSettings row is missing', async () => {
    mockPrisma.globalSettings.findUnique.mockResolvedValue(null);
    await expect(getSurveyCooldownHours()).resolves.toBe(24);
  });

  it('returns the configured value when present', async () => {
    mockPrisma.globalSettings.findUnique.mockResolvedValue({ surveyCooldownHours: 48 });
    await expect(getSurveyCooldownHours()).resolves.toBe(48);
  });
});

describe('getSurveyMaxRangeDays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 90 when the GlobalSettings row is missing', async () => {
    mockPrisma.globalSettings.findUnique.mockResolvedValue(null);
    await expect(getSurveyMaxRangeDays()).resolves.toBe(90);
  });

  it('returns the configured value when present', async () => {
    mockPrisma.globalSettings.findUnique.mockResolvedValue({ surveyMaxRangeDays: 120 });
    await expect(getSurveyMaxRangeDays()).resolves.toBe(120);
  });
});
