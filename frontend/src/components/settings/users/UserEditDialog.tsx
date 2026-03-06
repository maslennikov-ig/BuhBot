'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/layout/GlassCard';
import { X, Pencil, UserCog, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { inferRouterOutputs, inferRouterInputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type RouterInputs = inferRouterInputs<AppRouter>;
type UserItem = RouterOutputs['auth']['listUsers'][number];
type UserRole = RouterInputs['auth']['updateUserRole']['role'];

import { ROLES } from './constants';

interface UserEditDialogProps {
  user: UserItem | null;
  open: boolean;
  onClose: () => void;
}

export function UserEditDialog({ user, open, onClose }: UserEditDialogProps) {
  const [fullName, setFullName] = React.useState('');
  const [selectedRole, setSelectedRole] = React.useState<UserRole>('observer');
  const [error, setError] = React.useState<string | null>(null);
  const utils = trpc.useContext();

  React.useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setSelectedRole(user.role);
      setError(null);
    }
  }, [user]);

  const isDirty = user ? fullName !== user.fullName || selectedRole !== user.role : false;

  // Mutations
  const updateUserMutation = trpc.auth.updateUser.useMutation({
    onError: (err) => setError(err.message),
  });

  const deactivateMutation = trpc.auth.deactivateUser.useMutation({
    onError: (err) => setError(err.message),
  });

  const reactivateMutation = trpc.auth.reactivateUser.useMutation({
    onError: (err) => setError(err.message),
  });

  // Manager assignments for accountant role
  const { data: assignedManagers, isLoading: managersLoading } =
    trpc.userManager.listByAccountant.useQuery(
      { accountantId: user?.id ?? '' },
      { enabled: open && !!user && user.role === 'accountant' }
    );

  // Subordinate accountants for manager/admin role
  const { data: subordinateAccountants, isLoading: subordinatesLoading } =
    trpc.userManager.listByManager.useQuery(
      { managerId: user?.id ?? '' },
      { enabled: open && !!user && ['manager', 'admin'].includes(user.role) }
    );

  const isPending =
    updateUserMutation.isPending || deactivateMutation.isPending || reactivateMutation.isPending;

  const handleSave = async () => {
    if (!user || !isDirty) return;
    setError(null);

    const updateData: { userId: string; fullName?: string; role?: UserRole } = {
      userId: user.id,
    };
    if (fullName !== user.fullName) updateData.fullName = fullName;
    if (selectedRole !== user.role) updateData.role = selectedRole;

    try {
      await updateUserMutation.mutateAsync(updateData);
      utils.auth.listUsers.invalidate();
      toast.success('Пользователь обновлён');
      onClose();
    } catch {
      // Handled by mutation onError → setError
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    setError(null);

    const mutation = user.isActive ? deactivateMutation : reactivateMutation;
    const message = user.isActive ? 'Пользователь деактивирован' : 'Пользователь активирован';

    try {
      await mutation.mutateAsync({ userId: user.id });
      utils.auth.listUsers.invalidate();
      toast.success(message);
      onClose();
    } catch {
      // Handled by mutation onError → setError
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <GlassCard
        variant="elevated"
        padding="lg"
        className="w-full max-w-lg relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--buh-primary-muted)]">
            <Pencil className="h-6 w-6 text-[var(--buh-primary)]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">
              Редактирование пользователя
            </h2>
            <p className="text-sm text-[var(--buh-foreground-muted)]">{user.email}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--buh-error-muted)] text-[var(--buh-error)] text-sm">
            {error}
          </div>
        )}

        {/* Profile fields */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-[var(--buh-foreground)] mb-1">
              Полное имя
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] px-3 text-sm focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]"
            />
          </div>
        </div>

        {/* Role selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--buh-foreground)] mb-2">
            Роль
          </label>
          <div className="space-y-2">
            {ROLES.map((role) => (
              <div
                key={role.value}
                onClick={() => setSelectedRole(role.value)}
                className={`cursor-pointer rounded-lg border p-3 transition-all ${
                  selectedRole === role.value
                    ? 'border-[var(--buh-primary)] bg-[var(--buh-primary-muted)]'
                    : 'border-[var(--buh-border)] hover:bg-[var(--buh-surface-elevated)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`font-medium text-sm ${selectedRole === role.value ? 'text-[var(--buh-primary)]' : 'text-[var(--buh-foreground)]'}`}
                  >
                    {role.label}
                  </span>
                  {selectedRole === role.value && (
                    <div className="h-2 w-2 rounded-full bg-[var(--buh-primary)]" />
                  )}
                </div>
                <p className="text-xs text-[var(--buh-foreground-muted)]">{role.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Manager assignments (for accountant role) */}
        {user.role === 'accountant' && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <UserCog className="h-4 w-4 text-[var(--buh-foreground-muted)]" />
              <label className="text-sm font-medium text-[var(--buh-foreground)]">
                Назначенные менеджеры
              </label>
            </div>
            {managersLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-[var(--buh-foreground-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка...
              </div>
            ) : assignedManagers && assignedManagers.length > 0 ? (
              <div className="space-y-1">
                {assignedManagers.map((manager) => (
                  <div
                    key={manager.id}
                    className="flex items-center gap-2 rounded-lg border border-[var(--buh-border)] px-3 py-2 text-sm"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--buh-primary-muted)]">
                      <UserCog className="h-3.5 w-3.5 text-[var(--buh-primary)]" />
                    </div>
                    <span className="text-[var(--buh-foreground)]">{manager.fullName}</span>
                    <span className="text-xs text-[var(--buh-foreground-muted)]">
                      {manager.email}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--buh-foreground-muted)] italic">
                Нет назначенных менеджеров
              </p>
            )}
          </div>
        )}

        {/* Subordinate accountants (for manager/admin role) */}
        {['manager', 'admin'].includes(user.role) && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-[var(--buh-foreground-muted)]" />
              <label className="text-sm font-medium text-[var(--buh-foreground)]">
                Подчинённые бухгалтеры
              </label>
            </div>
            {subordinatesLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-[var(--buh-foreground-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка...
              </div>
            ) : subordinateAccountants && subordinateAccountants.length > 0 ? (
              <div className="space-y-1">
                {subordinateAccountants.map((accountant) => (
                  <div
                    key={accountant.id}
                    className="flex items-center gap-2 rounded-lg border border-[var(--buh-border)] px-3 py-2 text-sm"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--buh-success)]/10">
                      <Users className="h-3.5 w-3.5 text-[var(--buh-success)]" />
                    </div>
                    <span className="text-[var(--buh-foreground)]">{accountant.fullName}</span>
                    <span className="text-xs text-[var(--buh-foreground-muted)]">
                      {accountant.email}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--buh-foreground-muted)] italic">
                Нет подчинённых бухгалтеров
              </p>
            )}
          </div>
        )}

        {/* Status toggle */}
        <div className="mb-6 p-3 rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-subtle)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--buh-foreground)]">Статус аккаунта</p>
              <p className="text-xs text-[var(--buh-foreground-muted)]">
                {user.isActive ? 'Пользователь активен' : 'Пользователь деактивирован'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleActive}
              disabled={isPending || isDirty}
              title={isDirty ? 'Сначала сохраните или отмените изменения' : undefined}
              className={
                user.isActive
                  ? 'text-[var(--buh-error)] hover:text-[var(--buh-error)] hover:bg-[var(--buh-error-muted)]'
                  : 'text-[var(--buh-success)] hover:text-[var(--buh-success)] hover:bg-[var(--buh-success)]/10'
              }
            >
              {user.isActive ? 'Деактивировать' : 'Активировать'}
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>
            Отмена
          </Button>
          <Button className="buh-btn-primary" onClick={handleSave} disabled={isPending || !isDirty}>
            {isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
