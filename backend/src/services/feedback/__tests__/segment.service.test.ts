/**
 * segment.service — gh-313 unit tests.
 *
 * Covers CRUD + membership + audience expansion. Prisma is mocked with
 * `vi.hoisted` so tests never touch a real DB. Pattern follows the existing
 * survey-ranges.service.test.ts.
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

// Import AFTER mocks are set up.
import {
  createSegment,
  updateSegment,
  deleteSegment,
  listSegments,
  addChatToSegment,
  removeChatFromSegment,
  getSegmentChats,
  getChatsInSegments,
} from '../segment.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createSegment
// ---------------------------------------------------------------------------

describe('createSegment', () => {
  it('creates a segment with trimmed name + owner', async () => {
    mockPrisma.chatSegment.create.mockResolvedValue({
      id: 'seg-uuid',
      name: 'VIP clients',
      description: null,
      createdById: 'user-uuid',
    });

    const segment = await createSegment({
      name: '  VIP clients  ',
      createdById: 'user-uuid',
    });

    expect(segment.id).toBe('seg-uuid');
    expect(mockPrisma.chatSegment.create).toHaveBeenCalledWith({
      data: {
        name: 'VIP clients',
        description: null,
        createdById: 'user-uuid',
      },
    });
  });

  it('rejects empty names with NAME_INVALID (no DB call)', async () => {
    await expect(createSegment({ name: '   ', createdById: 'u' })).rejects.toMatchObject({
      name: 'NAME_INVALID',
    });
    expect(mockPrisma.chatSegment.create).not.toHaveBeenCalled();
  });

  it('translates Prisma P2002 into NAME_TAKEN', async () => {
    mockPrisma.chatSegment.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    );

    await expect(createSegment({ name: 'dup', createdById: 'u' })).rejects.toMatchObject({
      name: 'NAME_TAKEN',
    });
  });
});

// ---------------------------------------------------------------------------
// updateSegment
// ---------------------------------------------------------------------------

describe('updateSegment', () => {
  it('throws UPDATE_EMPTY when no fields provided', async () => {
    await expect(updateSegment({ segmentId: 's1' })).rejects.toMatchObject({
      name: 'UPDATE_EMPTY',
    });
    expect(mockPrisma.chatSegment.update).not.toHaveBeenCalled();
  });

  it('throws SEGMENT_NOT_FOUND when segment missing', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue(null);

    await expect(updateSegment({ segmentId: 's1', name: 'x' })).rejects.toMatchObject({
      name: 'SEGMENT_NOT_FOUND',
    });
  });

  it('updates name + description (trimmed)', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue({ id: 's1' });
    mockPrisma.chatSegment.update.mockResolvedValue({
      id: 's1',
      name: 'new',
      description: 'desc',
    });

    await updateSegment({ segmentId: 's1', name: '  new  ', description: 'desc' });

    expect(mockPrisma.chatSegment.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { name: 'new', description: 'desc' },
    });
  });

  it('translates P2002 into NAME_TAKEN on update', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue({ id: 's1' });
    mockPrisma.chatSegment.update.mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002' })
    );

    await expect(updateSegment({ segmentId: 's1', name: 'dup' })).rejects.toMatchObject({
      name: 'NAME_TAKEN',
    });
  });
});

// ---------------------------------------------------------------------------
// deleteSegment
// ---------------------------------------------------------------------------

describe('deleteSegment', () => {
  it('throws SEGMENT_NOT_FOUND when segment missing', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue(null);

    await expect(deleteSegment('s1')).rejects.toMatchObject({ name: 'SEGMENT_NOT_FOUND' });
    expect(mockPrisma.chatSegment.delete).not.toHaveBeenCalled();
  });

  it('deletes the segment when it exists', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue({ id: 's1' });
    mockPrisma.chatSegment.delete.mockResolvedValue({});

    await deleteSegment('s1');

    expect(mockPrisma.chatSegment.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });
});

// ---------------------------------------------------------------------------
// listSegments
// ---------------------------------------------------------------------------

describe('listSegments', () => {
  it('returns segments with memberCount projected from _count', async () => {
    mockPrisma.chatSegment.findMany.mockResolvedValue([
      {
        id: 's1',
        name: 'A',
        description: null,
        createdAt: new Date('2026-04-01'),
        updatedAt: new Date('2026-04-01'),
        createdById: 'u1',
        _count: { members: 3 },
      },
    ]);

    const rows = await listSegments();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 's1', memberCount: 3 });
    expect(mockPrisma.chatSegment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        include: { _count: { select: { members: true } } },
      })
    );
  });

  it('scopes by owner when ownedById provided', async () => {
    mockPrisma.chatSegment.findMany.mockResolvedValue([]);
    await listSegments('owner-uuid');
    const args = mockPrisma.chatSegment.findMany.mock.calls[0]![0]!;
    expect(args.where).toEqual({ createdById: 'owner-uuid' });
  });
});

// ---------------------------------------------------------------------------
// addChatToSegment
// ---------------------------------------------------------------------------

describe('addChatToSegment', () => {
  it('requires the segment to exist', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue(null);
    mockPrisma.chat.findUnique.mockResolvedValue({ id: 123n });

    await expect(addChatToSegment('s1', 123n, 'u1')).rejects.toMatchObject({
      name: 'SEGMENT_NOT_FOUND',
    });
    expect(mockPrisma.chatSegmentMember.create).not.toHaveBeenCalled();
  });

  it('requires the chat to exist', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue({ id: 's1' });
    mockPrisma.chat.findUnique.mockResolvedValue(null);

    await expect(addChatToSegment('s1', 999n, 'u1')).rejects.toMatchObject({
      name: 'CHAT_NOT_FOUND',
    });
  });

  it('creates membership on happy path', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue({ id: 's1' });
    mockPrisma.chat.findUnique.mockResolvedValue({ id: 123n });
    mockPrisma.chatSegmentMember.create.mockResolvedValue({});

    await addChatToSegment('s1', 123n, 'u1');

    expect(mockPrisma.chatSegmentMember.create).toHaveBeenCalledWith({
      data: { segmentId: 's1', chatId: 123n, addedById: 'u1' },
    });
  });

  it('is idempotent on duplicate membership (swallows P2002)', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue({ id: 's1' });
    mockPrisma.chat.findUnique.mockResolvedValue({ id: 123n });
    mockPrisma.chatSegmentMember.create.mockRejectedValue(
      Object.assign(new Error('dup'), { code: 'P2002' })
    );

    await expect(addChatToSegment('s1', 123n, 'u1')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// removeChatFromSegment
// ---------------------------------------------------------------------------

describe('removeChatFromSegment', () => {
  it('calls deleteMany with both keys (idempotent)', async () => {
    mockPrisma.chatSegmentMember.deleteMany.mockResolvedValue({ count: 0 });

    await removeChatFromSegment('s1', 123n);

    expect(mockPrisma.chatSegmentMember.deleteMany).toHaveBeenCalledWith({
      where: { segmentId: 's1', chatId: 123n },
    });
  });
});

// ---------------------------------------------------------------------------
// getSegmentChats
// ---------------------------------------------------------------------------

describe('getSegmentChats', () => {
  it('throws SEGMENT_NOT_FOUND when the segment is missing', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue(null);

    await expect(getSegmentChats('s1')).rejects.toMatchObject({ name: 'SEGMENT_NOT_FOUND' });
  });

  it('returns chats projected from the membership rows', async () => {
    mockPrisma.chatSegment.findUnique.mockResolvedValue({ id: 's1' });
    mockPrisma.chatSegmentMember.findMany.mockResolvedValue([
      {
        chatId: 100n,
        addedAt: new Date('2026-04-02'),
        chat: { id: 100n, title: 'Acme' },
      },
      {
        chatId: 200n,
        addedAt: new Date('2026-04-01'),
        chat: { id: 200n, title: null },
      },
    ]);

    const rows = await getSegmentChats('s1');
    expect(rows).toEqual([
      { chatId: 100n, title: 'Acme', addedAt: new Date('2026-04-02') },
      { chatId: 200n, title: null, addedAt: new Date('2026-04-01') },
    ]);
  });
});

// ---------------------------------------------------------------------------
// getChatsInSegments (audience expansion)
// ---------------------------------------------------------------------------

describe('getChatsInSegments', () => {
  it('returns [] for an empty segmentIds array (no DB hit)', async () => {
    const out = await getChatsInSegments([]);
    expect(out).toEqual([]);
    expect(mockPrisma.chatSegmentMember.findMany).not.toHaveBeenCalled();
  });

  it('deduplicates chatIds across overlapping segments', async () => {
    mockPrisma.chatSegmentMember.findMany.mockResolvedValue([
      { chatId: 10n },
      { chatId: 20n },
      { chatId: 10n }, // duplicate — chat 10 is in both seg1 and seg2
    ]);

    const out = await getChatsInSegments(['seg1', 'seg2']);

    expect(out).toHaveLength(2);
    expect(out).toContain(10n);
    expect(out).toContain(20n);
  });
});
