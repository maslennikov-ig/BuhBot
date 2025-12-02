'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { FaqList } from '@/components/settings/faq/FaqList';
import { FaqForm } from '@/components/settings/faq/FaqForm';
import { HelpButton } from '@/components/ui/HelpButton';

import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type FaqItem = RouterOutputs['faq']['list'][number];

export default function FaqPage() {
  const [mode, setMode] = React.useState<'list' | 'create' | 'edit'>('list');
  const [editingItem, setEditingItem] = React.useState<FaqItem | null>(null);

  const handleEdit = (item: FaqItem) => {
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
        title="База знаний (FAQ)"
        description="Управление ответами на часто задаваемые вопросы."
        actions={<HelpButton section="settings.faq" />}
        breadcrumbs={[
          { label: 'Настройки', href: '/settings' },
          { label: 'FAQ' },
        ]}
      />

      {mode === 'list' && (
        <FaqList onEdit={handleEdit} onCreate={handleCreate} />
      )}

      {(mode === 'create' || mode === 'edit') && (
        <FaqForm
          initialData={editingItem}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      )}
    </AdminLayout>
  );
}
