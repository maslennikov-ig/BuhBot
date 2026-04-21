import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeedbackDetailsContent } from '../feedback-details-content';
import { trpc } from '@/lib/trpc';

vi.mock('@/lib/trpc', () => ({
  trpc: {
    feedback: {
      getById: {
        useQuery: vi.fn(),
      },
    },
  },
}));

vi.mock('@/components/layout/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/GlassCard', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('FeedbackDetailsContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders not-found state for NOT_FOUND errors', () => {
    vi.mocked(trpc.feedback.getById.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { data: { code: 'NOT_FOUND' } },
    } as never);

    render(<FeedbackDetailsContent feedbackId="94977518-9b17-42a7-b9cb-f59f20eb2014" />);

    expect(screen.getByText('Отзыв не найден')).toBeInTheDocument();
  });

  it('renders access-denied state for FORBIDDEN errors', () => {
    vi.mocked(trpc.feedback.getById.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { data: { code: 'FORBIDDEN' } },
    } as never);

    render(<FeedbackDetailsContent feedbackId="94977518-9b17-42a7-b9cb-f59f20eb2014" />);

    expect(screen.getByText('Недостаточно прав для просмотра этого отзыва')).toBeInTheDocument();
  });

  it('renders generic error state for non-classified errors', () => {
    vi.mocked(trpc.feedback.getById.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { data: { code: 'INTERNAL_SERVER_ERROR' } },
    } as never);

    render(<FeedbackDetailsContent feedbackId="94977518-9b17-42a7-b9cb-f59f20eb2014" />);

    expect(
      screen.getByText('Не удалось загрузить детали отзыва. Попробуйте обновить страницу.')
    ).toBeInTheDocument();
  });
});
