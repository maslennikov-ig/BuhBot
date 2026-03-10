/**
 * Shared constants for user management components
 */

export const ROLES = [
  {
    value: 'admin' as const,
    label: 'Администратор',
    description: 'Полный доступ ко всем функциям системы.',
  },
  {
    value: 'manager' as const,
    label: 'Менеджер',
    description: 'Управление клиентами, задачами и базой знаний.',
  },
  {
    value: 'accountant' as const,
    label: 'Бухгалтер',
    description: 'Ответственный за чаты с клиентами. Получает SLA-уведомления.',
  },
  {
    value: 'observer' as const,
    label: 'Наблюдатель',
    description: 'Только просмотр статистики и отчетов.',
  },
];

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  accountant: 'Бухгалтер',
  observer: 'Наблюдатель',
};

export const ROLE_COLORS: Record<string, string> = {
  admin: 'text-[var(--buh-error)] bg-[var(--buh-error-muted)]',
  manager: 'text-[var(--buh-primary)] bg-[var(--buh-primary-muted)]',
  accountant: 'text-[var(--buh-success)] bg-[var(--buh-success-muted)]',
  observer: 'text-[var(--buh-foreground-muted)] bg-[var(--buh-surface-subtle)]',
};
