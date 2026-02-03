'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { TemplateList } from '@/components/settings/templates/TemplateList';
import { TemplateForm } from '@/components/settings/templates/TemplateForm';
import { HelpButton } from '@/components/ui/HelpButton';

import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type TemplateItem = RouterOutputs['templates']['list'][number];

export default function TemplatesPage() {
  const [mode, setMode] = React.useState<'list' | 'create' | 'edit'>('list');
  const [editingItem, setEditingItem] = React.useState<TemplateItem | null>(null);

  const handleEdit = (item: TemplateItem) => {
    setEditingItem(item);
    setMode('edit');
  };

  const handleCreate = () => {
    setEditingItem(null);
    setMode('create');
  };

  const handleSuccess = () => {
    setMode('list');
    setEditingItem(null);
  };

  const handleCancel = () => {
    setMode('list');
    setEditingItem(null);
  };

  return (
    <AdminLayout>
      <PageHeader
        title="Шаблоны сообщений"
        description="Управление готовыми ответами и уведомлениями."
        actions={<HelpButton section="settings.templates" />}
        breadcrumbs={[{ label: 'Настройки', href: '/settings' }, { label: 'Шаблоны' }]}
      />

      {mode === 'list' && <TemplateList onEdit={handleEdit} onCreate={handleCreate} />}

      {(mode === 'create' || mode === 'edit') && (
        <TemplateForm initialData={editingItem} onSuccess={handleSuccess} onCancel={handleCancel} />
      )}
    </AdminLayout>
  );
}
