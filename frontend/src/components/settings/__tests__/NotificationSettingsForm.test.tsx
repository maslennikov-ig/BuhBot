import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationSettingsForm } from '../NotificationSettingsForm';
import { trpc } from '@/lib/trpc';

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: vi.fn(),
    settings: {
      getGlobalSettings: {
        useQuery: vi.fn(),
      },
      updateGlobalSettings: {
        useMutation: vi.fn(),
      },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function setupTrpc(settings: { leadNotificationIds: string[]; fileConfirmationEnabled: boolean }) {
  const mutate = vi.fn();
  const invalidate = vi.fn();

  vi.mocked(trpc.useUtils).mockReturnValue({
    settings: {
      getGlobalSettings: { invalidate },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial tRPC mock
  } as any);

  vi.mocked(trpc.settings.getGlobalSettings.useQuery).mockReturnValue({
    data: settings,
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial query mock
  } as any);

  vi.mocked(trpc.settings.updateGlobalSettings.useMutation).mockReturnValue({
    mutate,
    isPending: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial mutation mock
  } as any);

  return { mutate, invalidate };
}

describe('NotificationSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders file confirmation switch from global settings', () => {
    setupTrpc({ leadNotificationIds: [], fileConfirmationEnabled: false });

    render(<NotificationSettingsForm />);

    const toggle = screen.getByRole('switch', {
      name: 'Подтверждать получение файлов в клиентских чатах',
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('submits disabled file confirmation setting', async () => {
    const { mutate } = setupTrpc({
      leadNotificationIds: ['123'],
      fileConfirmationEnabled: true,
    });
    const user = userEvent.setup();

    render(<NotificationSettingsForm />);

    await user.click(
      screen.getByRole('switch', {
        name: 'Подтверждать получение файлов в клиентских чатах',
      })
    );
    await user.click(screen.getByRole('button', { name: /Сохранить/i }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        leadNotificationIds: ['123'],
        fileConfirmationEnabled: false,
      });
    });
  });
});
