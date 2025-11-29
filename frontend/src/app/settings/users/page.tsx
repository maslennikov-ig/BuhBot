'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { UserList } from '@/components/settings/users/UserList';
import { UserRoleDialog } from '@/components/settings/users/UserRoleDialog';

import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type UserItem = RouterOutputs['auth']['listUsers'][number];

export default function UsersPage() {
  const [editingUser, setEditingUser] = React.useState<UserItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const handleEditRole = (user: UserItem) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
  };

  return (
    <AdminLayout>
      <PageHeader
        title="Пользователи"
        description="Управление доступом и ролями сотрудников."
        breadcrumbs={[
          { label: 'Настройки', href: '/settings' },
          { label: 'Пользователи' },
        ]}
      />

      <UserList onEditRole={handleEditRole} />

      <UserRoleDialog
        user={editingUser}
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onSuccess={handleCloseDialog}
      />
    </AdminLayout>
  );
}
