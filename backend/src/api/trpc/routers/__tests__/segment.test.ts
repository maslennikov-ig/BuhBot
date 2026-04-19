/**
 * Segment Router — ownership + getById tests (gh-313 code review).
 *
 * Covers:
 *   - H1: managerProcedure `update` and `delete` refuse non-owners with FORBIDDEN
 *         unless the caller is an admin.
 *   - M2: `getById` fetches segment + members in a single round-trip (no separate
 *         `getSegmentChats` call).
 *
 * We mock Prisma at the module boundary so the router can be invoked as a pure
 * function via `createCaller`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  chatSegment: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  chat: {
    findUnique: vi.fn(),
  },
  chatSegmentMember: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('../../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import AFTER mocks are set up.
import { segmentRouter } from '../segment.js';

type Role = 'admin' | 'manager' | 'observer' | 'accountant';

function makeCaller(user: { id: string; role: Role }) {
  return segmentRouter.createCaller({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocked Prisma surface
    prisma: mockPrisma as any,
    user: {
      id: user.id,
      email: `${user.id}@test.local`,
      fullName: 'Test User',
      role: user.role,
      isActive: true,
    },
    session: { accessToken: 'test', expiresAt: Math.floor(Date.now() / 1000) + 3600 },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// H1: Ownership enforcement on update
// ---------------------------------------------------------------------------

describe('segment.update ownership', () => {
  const SEG_ID = '00000000-0000-0000-0000-000000000001';

  it('forbids a manager from updating a segment they do not own', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue({ createdById: 'other-manager-uuid' });

    const caller = makeCaller({ id: 'me-manager-uuid', role: 'manager' });

    await expect(caller.update({ id: SEG_ID, name: 'renamed' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    // Must short-circuit before the service-layer update hits Prisma.
    expect(mockPrisma.chatSegment.update).not.toHaveBeenCalled();
  });

  it('allows a manager to update a segment they own', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue({ createdById: 'me-manager-uuid' });
    // updateSegment pre-check: segment exists (second findUnique call).
    mockPrisma.chatSegment.findUnique.mockResolvedValueOnce({ createdById: 'me-manager-uuid' });
    mockPrisma.chatSegment.findUnique.mockResolvedValueOnce({ id: SEG_ID });
    mockPrisma.chatSegment.update.mockResolvedValue({ id: SEG_ID, name: 'renamed' });

    const caller = makeCaller({ id: 'me-manager-uuid', role: 'manager' });

    await caller.update({ id: SEG_ID, name: 'renamed' });

    expect(mockPrisma.chatSegment.update).toHaveBeenCalledWith({
      where: { id: SEG_ID },
      data: { name: 'renamed' },
    });
  });

  it('allows admin to update any segment, even one owned by someone else', async () => {
    // Router ownership check + service-layer existence pre-check.
    mockPrisma.chatSegment.findUnique
      .mockResolvedValueOnce({ createdById: 'some-other-manager' })
      .mockResolvedValueOnce({ id: SEG_ID });
    mockPrisma.chatSegment.update.mockResolvedValue({ id: SEG_ID, name: 'renamed' });

    const caller = makeCaller({ id: 'admin-uuid', role: 'admin' });

    await caller.update({ id: SEG_ID, name: 'renamed' });

    expect(mockPrisma.chatSegment.update).toHaveBeenCalled();
  });

  it('returns NOT_FOUND (not FORBIDDEN) when the segment does not exist', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue(null);

    const caller = makeCaller({ id: 'me-manager-uuid', role: 'manager' });

    await expect(caller.update({ id: SEG_ID, name: 'renamed' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// H1: Ownership enforcement on delete
// ---------------------------------------------------------------------------

describe('segment.delete ownership', () => {
  const SEG_ID = '00000000-0000-0000-0000-000000000002';

  it('forbids a manager from deleting a segment they do not own', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue({ createdById: 'other-manager-uuid' });

    const caller = makeCaller({ id: 'me-manager-uuid', role: 'manager' });

    await expect(caller.delete({ id: SEG_ID })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockPrisma.chatSegment.delete).not.toHaveBeenCalled();
  });

  it('allows a manager to delete a segment they own', async () => {
    mockPrisma.chatSegment.findUnique
      .mockResolvedValueOnce({ createdById: 'me-manager-uuid' })
      .mockResolvedValueOnce({ id: SEG_ID });
    mockPrisma.chatSegment.delete.mockResolvedValue({});

    const caller = makeCaller({ id: 'me-manager-uuid', role: 'manager' });

    await caller.delete({ id: SEG_ID });

    expect(mockPrisma.chatSegment.delete).toHaveBeenCalledWith({ where: { id: SEG_ID } });
  });

  it('allows admin to delete any segment', async () => {
    mockPrisma.chatSegment.findUnique
      .mockResolvedValueOnce({ createdById: 'some-other-manager' })
      .mockResolvedValueOnce({ id: SEG_ID });
    mockPrisma.chatSegment.delete.mockResolvedValue({});

    const caller = makeCaller({ id: 'admin-uuid', role: 'admin' });

    await caller.delete({ id: SEG_ID });

    expect(mockPrisma.chatSegment.delete).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// M2: getById fetches in a single round-trip (no separate getSegmentChats call)
// ---------------------------------------------------------------------------

describe('segment.getById — single round-trip', () => {
  const SEG_ID = '00000000-0000-0000-0000-000000000003';

  it('returns segment + members without calling chatSegmentMember.findMany separately', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue({
      id: SEG_ID,
      name: 'VIP',
      description: null,
      createdAt: new Date('2026-04-01'),
      updatedAt: new Date('2026-04-02'),
      createdById: 'owner-uuid',
      createdBy: { id: 'owner-uuid', fullName: 'Owner' },
      members: [
        {
          addedAt: new Date('2026-04-03'),
          chat: { id: 100n, title: 'Acme Corp' },
        },
        {
          addedAt: new Date('2026-04-02'),
          chat: { id: 200n, title: null },
        },
      ],
    });

    const caller = makeCaller({ id: 'any-manager-uuid', role: 'manager' });
    const result = await caller.getById({ id: SEG_ID });

    // M2: derived memberCount matches members.length without a _count query.
    expect(result.memberCount).toBe(2);
    expect(result.members).toEqual([
      { chatId: '100', title: 'Acme Corp', addedAt: new Date('2026-04-03') },
      { chatId: '200', title: null, addedAt: new Date('2026-04-02') },
    ]);

    // The service-layer getSegmentChats helper would hit chatSegmentMember.findMany —
    // we assert we did NOT take that path.
    expect(mockPrisma.chatSegmentMember.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.chatSegment.findUnique).toHaveBeenCalledTimes(1);
  });
});
