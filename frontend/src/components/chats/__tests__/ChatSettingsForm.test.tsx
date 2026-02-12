/**
 * ChatSettingsForm Component Tests
 *
 * Tests for chat settings form with SLA configuration, accountant assignment,
 * tRPC mutations, and form state management.
 *
 * @module components/chats/__tests__/ChatSettingsForm.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatSettingsForm } from '../ChatSettingsForm';
import { trpc } from '@/lib/trpc';

// ============================================
// MOCKS
// ============================================

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: vi.fn(),
    chats: {
      update: {
        useMutation: vi.fn(),
      },
    },
  },
}));

vi.mock('@/components/chats/AccountantSelect', () => ({
  AccountantSelect: ({ value, onChange, placeholder }: any) => (
    <select
      data-testid="accountant-select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label={placeholder}
    >
      <option value="">Не выбрано</option>
      <option value="550e8400-e29b-41d4-a716-446655440000">Иванов И.И.</option>
      <option value="550e8400-e29b-41d4-a716-446655440001">Петров П.П.</option>
    </select>
  ),
}));

vi.mock('@/components/chats/AccountantUsernamesInput', () => ({
  AccountantUsernamesInput: ({ value, onChange }: any) => (
    <input
      data-testid="accountant-usernames-input"
      value={(value ?? []).join(', ')}
      onChange={(e) => onChange(e.target.value.split(', ').filter(Boolean))}
      placeholder="Enter usernames"
    />
  ),
}));

vi.mock('@/components/layout/GlassCard', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

// ============================================
// TEST HELPERS
// ============================================

type MockMutationOptions = {
  isPending?: boolean;
};

function createMockMutation(options: MockMutationOptions = {}) {
  const mockMutate = vi.fn();
  const mockUtils = {
    chats: {
      getById: { invalidate: vi.fn() },
      list: { invalidate: vi.fn() },
    },
  };

  let storedCallbacks: { onSuccess?: (data: any) => void; onError?: (error: any) => void } = {};

  vi.mocked(trpc.useUtils).mockReturnValue(mockUtils as any);
  vi.mocked(trpc.chats.update.useMutation).mockImplementation((callbacks: any) => {
    storedCallbacks = callbacks || {};
    return {
      mutate: mockMutate,
      isPending: options.isPending ?? false,
    } as any;
  });

  return {
    mockMutate,
    mockUtils,
    triggerSuccess: async (data: any) => {
      await act(async () => {
        storedCallbacks.onSuccess?.(data);
      });
    },
    triggerError: async (error: any) => {
      await act(async () => {
        storedCallbacks.onError?.(error);
      });
    },
  };
}

const DEFAULT_INITIAL_DATA = {
  slaEnabled: false,
  slaThresholdMinutes: 60,
  assignedAccountantId: null,
  accountantUsernames: [] as string[],
  notifyInChatOnBreach: false,
};

// ============================================
// TEST SUITE
// ============================================

describe('ChatSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // 1. RENDERING TESTS
  // ============================================

  describe('Rendering', () => {
    it('should render form with all fields', () => {
      createMockMutation();

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={DEFAULT_INITIAL_DATA}
        />
      );

      expect(screen.getByText('Настройки чата')).toBeInTheDocument();
      expect(screen.getByText('SLA и назначение ответственного')).toBeInTheDocument();
      expect(screen.getByText('Мониторинг SLA')).toBeInTheDocument();
      expect(screen.getByText('Уведомления в чат')).toBeInTheDocument();
      expect(screen.getByText('Порог SLA (минуты)')).toBeInTheDocument();
      expect(screen.getByText('Ответственный бухгалтер')).toBeInTheDocument();
      expect(screen.getByText('Бухгалтеры (@username)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Сохранить/i })).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      createMockMutation();

      const { container } = render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          className="custom-test-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-test-class');
    });

    it('should show warning when SLA enabled but no managers configured', () => {
      createMockMutation();

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={[]}
          initialData={{ ...DEFAULT_INITIAL_DATA, slaEnabled: true }}
        />
      );

      expect(screen.getByText('Менеджеры для уведомлений не настроены')).toBeInTheDocument();
      expect(screen.getByText(/SLA уведомления не будут доставлены/i)).toBeInTheDocument();
    });

    it('should NOT show warning when SLA disabled even if no managers', () => {
      createMockMutation();

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={[]}
          initialData={DEFAULT_INITIAL_DATA}
        />
      );

      expect(
        screen.queryByText('Менеджеры для уведомлений не настроены')
      ).not.toBeInTheDocument();
    });

    it('should NOT show warning when SLA enabled and managers configured', () => {
      createMockMutation();

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345', '67890']}
          initialData={{ ...DEFAULT_INITIAL_DATA, slaEnabled: true }}
        />
      );

      expect(
        screen.queryByText('Менеджеры для уведомлений не настроены')
      ).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 2. DEFAULT VALUES TESTS
  // ============================================

  describe('Default values', () => {
    it('should use default values when no initialData provided', () => {
      createMockMutation();

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      const slaToggle = screen.getByRole('switch', { name: /Мониторинг SLA/i });
      expect(slaToggle).toHaveAttribute('aria-checked', 'false');

      const notifyToggle = screen.getByRole('switch', { name: /Уведомления в чат/i });
      expect(notifyToggle).toHaveAttribute('aria-checked', 'false');

      const thresholdInput = screen.getByRole('spinbutton', { name: /Порог SLA/i });
      expect(thresholdInput).toHaveValue(60);
    });

    it('should use initialData when provided', () => {
      createMockMutation();

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={{
            slaEnabled: true,
            slaThresholdMinutes: 120,
            assignedAccountantId: '550e8400-e29b-41d4-a716-446655440000',
            accountantUsernames: ['user1', 'user2'],
            notifyInChatOnBreach: true,
          }}
        />
      );

      const slaToggle = screen.getByRole('switch', { name: /Мониторинг SLA/i });
      expect(slaToggle).toHaveAttribute('aria-checked', 'true');

      const notifyToggle = screen.getByRole('switch', { name: /Уведомления в чат/i });
      expect(notifyToggle).toHaveAttribute('aria-checked', 'true');

      const thresholdInput = screen.getByRole('spinbutton', { name: /Порог SLA/i });
      expect(thresholdInput).toHaveValue(120);
    });

    it('should fallback notifyInChatOnBreach to false when not provided in initialData', () => {
      createMockMutation();

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={DEFAULT_INITIAL_DATA}
        />
      );

      const notifyToggle = screen.getByRole('switch', { name: /Уведомления в чат/i });
      expect(notifyToggle).toHaveAttribute('aria-checked', 'false');
    });
  });

  // ============================================
  // 3. FORM SUBMISSION TESTS
  // ============================================

  describe('Form submission', () => {
    it('should include all fields in mutation payload', async () => {
      const { mockMutate } = createMockMutation();
      const user = userEvent.setup({ delay: null });

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={{
            slaEnabled: true,
            slaThresholdMinutes: 90,
            assignedAccountantId: '550e8400-e29b-41d4-a716-446655440000',
            accountantUsernames: ['user1'],
            notifyInChatOnBreach: true,
          }}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Сохранить/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          id: 123,
          slaEnabled: true,
          slaThresholdMinutes: 90,
          assignedAccountantId: '550e8400-e29b-41d4-a716-446655440000',
          accountantUsernames: ['user1'],
          notifyInChatOnBreach: true,
        });
      });
    });

    it('should include notifyInChatOnBreach in mutation payload', async () => {
      const { mockMutate } = createMockMutation();
      const user = userEvent.setup({ delay: null });

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={{
            slaEnabled: true,
            slaThresholdMinutes: 60,
            assignedAccountantId: null,
            accountantUsernames: [],
            notifyInChatOnBreach: true,
          }}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Сохранить/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            notifyInChatOnBreach: true,
          })
        );
      });
    });

    it('should default notifyInChatOnBreach to false in mutation when not set', async () => {
      const { mockMutate } = createMockMutation();
      const user = userEvent.setup({ delay: null });

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={DEFAULT_INITIAL_DATA}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Сохранить/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            notifyInChatOnBreach: false,
          })
        );
      });
    });

    it('should disable submit button while mutation is pending', () => {
      createMockMutation({ isPending: true });

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      const submitButton = screen.getByRole('button', { name: /Сохранение/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when mutation is not pending', () => {
      createMockMutation({ isPending: false });

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      const submitButton = screen.getByRole('button', { name: /Сохранить/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  // ============================================
  // 4. MUTATION CALLBACK TESTS (no form submission needed)
  // ============================================

  describe('Success message display', () => {
    it('should display success message after mutation success', async () => {
      const { triggerSuccess } = createMockMutation();

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      await triggerSuccess({ warnings: [] });

      expect(screen.getByText('Настройки успешно сохранены')).toBeInTheDocument();
    });

    it('should clear success message after 3 seconds', async () => {
      vi.useFakeTimers();
      const { triggerSuccess } = createMockMutation();

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      await triggerSuccess({ warnings: [] });
      expect(screen.getByText('Настройки успешно сохранены')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.queryByText('Настройки успешно сохранены')).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    it('should call onSuccess callback when provided', async () => {
      const onSuccess = vi.fn();
      const { triggerSuccess } = createMockMutation();

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          onSuccess={onSuccess}
        />
      );

      await triggerSuccess({ warnings: [] });

      expect(onSuccess).toHaveBeenCalled();
    });

    it('should invalidate queries after successful mutation', async () => {
      const { triggerSuccess, mockUtils } = createMockMutation();

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      await triggerSuccess({ warnings: [] });

      expect(mockUtils.chats.getById.invalidate).toHaveBeenCalledWith({ id: 123 });
      expect(mockUtils.chats.list.invalidate).toHaveBeenCalled();
    });
  });

  // ============================================
  // 5. WARNING MESSAGE TESTS
  // ============================================

  describe('Warning message display', () => {
    it('should display warnings when mutation returns warnings array', async () => {
      const { triggerSuccess } = createMockMutation();

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      await triggerSuccess({
        warnings: ['Предупреждение 1', 'Предупреждение 2'],
      });

      expect(screen.getByText('Предупреждение 1')).toBeInTheDocument();
      expect(screen.getByText('Предупреждение 2')).toBeInTheDocument();
    });

    it('should NOT display warnings when warnings array is empty', async () => {
      const { triggerSuccess } = createMockMutation();

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      await triggerSuccess({ warnings: [] });

      expect(screen.getByText('Настройки успешно сохранены')).toBeInTheDocument();
      // No warning divs with buh-warning border should exist
      expect(screen.queryByText('Предупреждение 1')).not.toBeInTheDocument();
    });

    it('should clear warnings after 10 seconds', async () => {
      vi.useFakeTimers();
      const { triggerSuccess } = createMockMutation();

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      await triggerSuccess({ warnings: ['Test warning'] });
      expect(screen.getByText('Test warning')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      expect(screen.queryByText('Test warning')).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    it('should handle warnings with undefined', async () => {
      const { triggerSuccess } = createMockMutation();

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      await triggerSuccess({ warnings: undefined });

      expect(screen.getByText('Настройки успешно сохранены')).toBeInTheDocument();
      expect(screen.queryByText('Предупреждение 1')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 6. ERROR MESSAGE TESTS
  // ============================================

  describe('Error message display', () => {
    it('should display error message after mutation error', async () => {
      const { triggerError } = createMockMutation();

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      await triggerError({ message: 'Ошибка сервера' });

      expect(screen.getByText('Ошибка: Ошибка сервера')).toBeInTheDocument();
    });

    it('should clear error message after 5 seconds', async () => {
      vi.useFakeTimers();
      const { triggerError } = createMockMutation();

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      await triggerError({ message: 'Network error' });
      expect(screen.getByText('Ошибка: Network error')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.queryByText('Ошибка: Network error')).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    it('should clear success message when error occurs', async () => {
      const { triggerSuccess, triggerError } = createMockMutation();

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      await triggerSuccess({ warnings: [] });
      expect(screen.getByText('Настройки успешно сохранены')).toBeInTheDocument();

      await triggerError({ message: 'Error occurred' });

      expect(screen.getByText('Ошибка: Error occurred')).toBeInTheDocument();
      expect(screen.queryByText('Настройки успешно сохранены')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 7. FORM INTERACTION TESTS
  // ============================================

  describe('Form interactions', () => {
    it('should toggle SLA enabled field', async () => {
      createMockMutation();
      const user = userEvent.setup({ delay: null });

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      const slaToggle = screen.getByRole('switch', { name: /Мониторинг SLA/i });
      expect(slaToggle).toHaveAttribute('aria-checked', 'false');

      await user.click(slaToggle);
      await waitFor(() => {
        expect(slaToggle).toHaveAttribute('aria-checked', 'true');
      });

      await user.click(slaToggle);
      await waitFor(() => {
        expect(slaToggle).toHaveAttribute('aria-checked', 'false');
      });
    });

    it('should toggle notifyInChatOnBreach field', async () => {
      createMockMutation();
      const user = userEvent.setup({ delay: null });

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={{ ...DEFAULT_INITIAL_DATA, slaEnabled: true }}
        />
      );

      const notifyToggle = screen.getByRole('switch', { name: /Уведомления в чат/i });
      expect(notifyToggle).toHaveAttribute('aria-checked', 'false');

      await user.click(notifyToggle);
      await waitFor(() => {
        expect(notifyToggle).toHaveAttribute('aria-checked', 'true');
      });

      await user.click(notifyToggle);
      await waitFor(() => {
        expect(notifyToggle).toHaveAttribute('aria-checked', 'false');
      });
    });

    it('should disable notifyInChatOnBreach toggle when SLA disabled', () => {
      createMockMutation();

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={DEFAULT_INITIAL_DATA}
        />
      );

      const notifyToggle = screen.getByRole('switch', { name: /Уведомления в чат/i });
      expect(notifyToggle).toBeDisabled();
    });

    it('should disable SLA threshold input when SLA disabled', () => {
      createMockMutation();

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={DEFAULT_INITIAL_DATA}
        />
      );

      const thresholdInput = screen.getByRole('spinbutton', { name: /Порог SLA/i });
      expect(thresholdInput).toBeDisabled();
    });

    it('should enable SLA threshold input when SLA enabled', () => {
      createMockMutation();

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={{ ...DEFAULT_INITIAL_DATA, slaEnabled: true }}
        />
      );

      const thresholdInput = screen.getByRole('spinbutton', { name: /Порог SLA/i });
      expect(thresholdInput).not.toBeDisabled();
    });

    it('should update SLA threshold value', async () => {
      createMockMutation();
      const user = userEvent.setup({ delay: null });

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={{ ...DEFAULT_INITIAL_DATA, slaEnabled: true }}
        />
      );

      const thresholdInput = screen.getByRole('spinbutton', { name: /Порог SLA/i });

      await user.clear(thresholdInput);
      await user.type(thresholdInput, '120');

      await waitFor(() => {
        expect(thresholdInput).toHaveValue(120);
      });
    });
  });

  // ============================================
  // 8. EDGE CASES AND INTEGRATION TESTS
  // ============================================

  describe('Edge cases and integration', () => {
    it('should reset form when initialData changes', async () => {
      createMockMutation();

      const { rerender } = render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={DEFAULT_INITIAL_DATA}
        />
      );

      const thresholdInput = screen.getByRole('spinbutton', { name: /Порог SLA/i });
      expect(thresholdInput).toHaveValue(60);

      rerender(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={{
            slaEnabled: true,
            slaThresholdMinutes: 120,
            assignedAccountantId: null,
            accountantUsernames: [],
            notifyInChatOnBreach: true,
          }}
        />
      );

      await waitFor(() => {
        expect(thresholdInput).toHaveValue(120);
      });
    });

    it('should handle accountant selection and submit', async () => {
      const { mockMutate } = createMockMutation();
      const user = userEvent.setup({ delay: null });

      render(<ChatSettingsForm chatId={123} managerTelegramIds={['12345']} />);

      const accountantSelect = screen.getByTestId('accountant-select');
      await user.selectOptions(accountantSelect, '550e8400-e29b-41d4-a716-446655440000');

      const submitButton = screen.getByRole('button', { name: /Сохранить/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            assignedAccountantId: '550e8400-e29b-41d4-a716-446655440000',
          })
        );
      });
    });

    it('should handle empty accountant usernames array', async () => {
      const { mockMutate } = createMockMutation();
      const user = userEvent.setup({ delay: null });

      render(
        <ChatSettingsForm
          chatId={123}
          managerTelegramIds={['12345']}
          initialData={{
            ...DEFAULT_INITIAL_DATA,
            accountantUsernames: undefined,
          }}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Сохранить/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            accountantUsernames: [],
          })
        );
      });
    });

    it('should preserve all form values during submission', async () => {
      const { mockMutate } = createMockMutation();
      const user = userEvent.setup({ delay: null });

      render(
        <ChatSettingsForm
          chatId={456}
          managerTelegramIds={['12345']}
          initialData={{
            slaEnabled: true,
            slaThresholdMinutes: 90,
            assignedAccountantId: '550e8400-e29b-41d4-a716-446655440001',
            accountantUsernames: ['user1', 'user2', 'user3'],
            notifyInChatOnBreach: true,
          }}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Сохранить/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          id: 456,
          slaEnabled: true,
          slaThresholdMinutes: 90,
          assignedAccountantId: '550e8400-e29b-41d4-a716-446655440001',
          accountantUsernames: ['user1', 'user2', 'user3'],
          notifyInChatOnBreach: true,
        });
      });
    });
  });
});
