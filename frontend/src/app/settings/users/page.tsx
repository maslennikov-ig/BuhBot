'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { UserList } from '@/components/settings/users/UserList';
import { UserRoleDialog } from '@/components/settings/users/UserRoleDialog';
import { UserCreateDialog } from '@/components/settings/users/UserCreateDialog';
import { UserDeleteDialog } from '@/components/settings/users/UserDeleteDialog';
import { HelpButton } from '@/components/ui/HelpButton';
import { trpc } from '@/lib/trpc';

import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type UserItem = RouterOutputs['auth']['listUsers'][number];

export default function UsersPage() {
  const [editingUser, setEditingUser] = React.useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = React.useState<UserItem | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = React.useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const { data: currentUser } = trpc.auth.me.useQuery();
  const isAdmin = currentUser?.role === 'admin';

  const handleEditRole = (user: UserItem) => {
    setEditingUser(user);
    setIsRoleDialogOpen(true);
  };

  const handleDeleteUser = (user: UserItem) => {
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleAddUser = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCloseRoleDialog = () => {
    setIsRoleDialogOpen(false);
    setEditingUser(null);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingUser(null);
  };

  return (
    <AdminLayout>
      <PageHeader
        title="Пользователи"
        description="Управление доступом и ролями сотрудников."
        actions={<HelpButton section="settings.users" />}
        breadcrumbs={[
          { label: 'Настройки', href: '/settings' },
          { label: 'Пользователи' },
        ]}
      />

      <UserList
        onEditRole={handleEditRole}
        onDeleteUser={handleDeleteUser}
        onAddUser={handleAddUser}
        isAdmin={isAdmin}
      />

      <UserRoleDialog
        user={editingUser}
        open={isRoleDialogOpen}
        onClose={handleCloseRoleDialog}
        onSuccess={handleCloseRoleDialog}
      />

      <UserCreateDialog
        open={isCreateDialogOpen}
        onClose={handleCloseCreateDialog}
        onSuccess={handleCloseCreateDialog}
      />

      <UserDeleteDialog
        user={deletingUser}
        open={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onSuccess={handleCloseDeleteDialog}
      />
    </AdminLayout>
  );
}
