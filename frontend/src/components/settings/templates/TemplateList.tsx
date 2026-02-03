'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Search, Edit2, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type TemplateItem = RouterOutputs['templates']['list'][number];

interface TemplateListProps {
  onEdit: (template: TemplateItem) => void;
  onCreate: () => void;
}

const CATEGORIES = {
  greeting: 'Приветствие',
  status: 'Статус',
  document_request: 'Запрос документов',
  reminder: 'Напоминание',
  closing: 'Завершение',
};

export function TemplateList({ onEdit, onCreate }: TemplateListProps) {
  const [search, setSearch] = React.useState('');
  const utils = trpc.useContext();

  const [deleteConfirm, setDeleteConfirm] = React.useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });

  const { data: currentUser } = trpc.auth.me.useQuery();
  const { data: templates, isLoading } = trpc.templates.list.useQuery({ sortBy: 'usage_count' });
  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      toast.success('Шаблон удален');
    },
  });

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    await deleteMutation.mutateAsync({ id: deleteConfirm.id });
    setDeleteConfirm({ open: false, id: null });
  };

  const filteredItems = React.useMemo(() => {
    if (!templates) return [];
    if (!search) return templates;
    const lowerSearch = search.toLowerCase();
    return templates.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerSearch) ||
        item.content.toLowerCase().includes(lowerSearch)
    );
  }, [templates, search]);

  if (isLoading) {
    return (
      <GlassCard variant="default" padding="md" className="flex flex-col gap-4">
        <div className="buh-shimmer h-9 w-64 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="buh-shimmer h-40 w-full rounded-lg" />
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="default" padding="md" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--buh-foreground-subtle)]" />
          <input
            type="text"
            placeholder="Поиск по шаблонам..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] pl-9 pr-4 text-sm focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]"
          />
        </div>
        <Button onClick={onCreate} className="buh-btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Добавить шаблон
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-12 text-center">
            <p className="text-sm font-medium text-[var(--buh-foreground)]">
              Нет шаблонов сообщений
            </p>
            <p className="mt-1 text-sm text-[var(--buh-foreground-subtle)]">
              Создайте шаблон для быстрых ответов
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col justify-between rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-subtle)] p-4 buh-hover-lift hover:border-[var(--buh-primary)]"
            >
              <div>
                <div className="mb-2 flex items-start justify-between">
                  <span className="rounded-full bg-[var(--buh-surface)] px-2 py-0.5 text-xs font-medium text-[var(--buh-foreground-muted)] border border-[var(--buh-border)]">
                    {CATEGORIES[item.category as keyof typeof CATEGORIES] || item.category}
                  </span>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onEdit(item)}
                      aria-label="Редактировать шаблон"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    {currentUser?.role === 'admin' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-[var(--buh-error)] hover:text-[var(--buh-error)] hover:bg-[var(--buh-error-muted)]"
                        onClick={() => setDeleteConfirm({ open: true, id: item.id })}
                        aria-label="Удалить шаблон"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <h3 className="mb-1 font-semibold text-[var(--buh-foreground)]">{item.title}</h3>
                <p className="text-sm text-[var(--buh-foreground-muted)] line-clamp-3 whitespace-pre-wrap">
                  {item.content}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-[var(--buh-foreground-subtle)]">
                <span>Использовано: {item.usageCount}</span>
              </div>
            </div>
          ))
        )}
      </div>
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Удалить шаблон?"
        description="Это действие нельзя отменить. Шаблон будет удален."
        confirmText="Удалить"
      />
    </GlassCard>
  );
}
