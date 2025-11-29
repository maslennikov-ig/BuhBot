'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/layout/GlassCard';
import { X } from 'lucide-react';

import { inferRouterOutputs, inferRouterInputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type RouterInputs = inferRouterInputs<AppRouter>;
type UserItem = RouterOutputs['auth']['listUsers'][number];
type UserRole = RouterInputs['auth']['updateUserRole']['role'];

interface UserRoleDialogProps {
  user: UserItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Администратор', description: 'Полный доступ ко всем функциям системы.' },
  { value: 'manager', label: 'Менеджер', description: 'Управление клиентами, задачами и базой знаний.' },
  { value: 'observer', label: 'Наблюдатель', description: 'Только просмотр статистики и отчетов.' },
];

export function UserRoleDialog({ user, open, onClose, onSuccess }: UserRoleDialogProps) {
  const [selectedRole, setSelectedRole] = React.useState<UserRole>(user?.role || 'observer');
  const utils = trpc.useContext();

  React.useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);

  const updateRoleMutation = trpc.auth.updateUserRole.useMutation({
    onSuccess: () => {
      utils.auth.listUsers.invalidate();
      onSuccess();
      onClose();
    },
  });

  const handleSave = async () => {
    if (!user) return;
    await updateRoleMutation.mutateAsync({
      userId: user.id,
      role: selectedRole,
    });
  };

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <GlassCard variant="elevated" padding="lg" className="w-full max-w-md relative animate-in fade-in zoom-in duration-200">
        <button 
            onClick={onClose}
            className="absolute right-4 top-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]"
        >
            <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold mb-2 text-[var(--buh-foreground)]">Изменение роли</h2>
        <p className="text-sm text-[var(--buh-foreground-muted)] mb-6">
            Выберите новую роль для пользователя <strong>{user.fullName}</strong>.
        </p>

        <div className="space-y-3 mb-6">
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
                        <span className={`font-medium ${selectedRole === role.value ? 'text-[var(--buh-primary)]' : 'text-[var(--buh-foreground)]'}`}>
                            {role.label}
                        </span>
                        {selectedRole === role.value && (
                            <div className="h-2 w-2 rounded-full bg-[var(--buh-primary)]" />
                        )}
                    </div>
                    <p className="text-xs text-[var(--buh-foreground-muted)]">
                        {role.description}
                    </p>
                </div>
            ))}
        </div>

        <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>Отмена</Button>
            <Button 
                className="buh-btn-primary" 
                onClick={handleSave}
                disabled={updateRoleMutation.isPending}
            >
                {updateRoleMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
        </div>
      </GlassCard>
    </div>
  );
}
