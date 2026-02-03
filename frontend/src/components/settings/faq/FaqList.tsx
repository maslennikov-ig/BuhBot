'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Search, Edit2, Trash2, Plus, MessageSquare, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type FaqItem = RouterOutputs['faq']['list'][number];

interface FaqListProps {
  onEdit: (faq: FaqItem) => void;
  onCreate: () => void;
}

export function FaqList({ onEdit, onCreate }: FaqListProps) {
  const [search, setSearch] = React.useState('');
  const utils = trpc.useContext();

  const [deleteConfirm, setDeleteConfirm] = React.useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });

  const { data: currentUser } = trpc.auth.me.useQuery();
  const { data: faqItems, isLoading } = trpc.faq.list.useQuery({ sortBy: 'usage_count' });
  const deleteMutation = trpc.faq.delete.useMutation({
    onSuccess: () => {
      utils.faq.list.invalidate();
      toast.success('Вопрос удален');
    },
  });

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    await deleteMutation.mutateAsync({ id: deleteConfirm.id });
    setDeleteConfirm({ open: false, id: null });
  };

  const filteredItems = React.useMemo(() => {
    if (!faqItems) return [];
    if (!search) return faqItems;
    const lowerSearch = search.toLowerCase();
    return faqItems.filter(
      (item) =>
        item.question.toLowerCase().includes(lowerSearch) ||
        item.answer.toLowerCase().includes(lowerSearch) ||
        item.keywords.some((k) => k.toLowerCase().includes(lowerSearch))
    );
  }, [faqItems, search]);

  if (isLoading) {
    return (
      <GlassCard variant="default" padding="md" className="flex flex-col gap-4">
        <div className="buh-shimmer h-9 w-64 rounded-lg" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="buh-shimmer h-4 w-32 rounded" />
              <div className="buh-shimmer h-4 w-48 rounded" />
              <div className="buh-shimmer h-4 w-24 rounded" />
            </div>
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      variant="default"
      padding="md"
      className="group relative flex flex-col gap-4 overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
          <MessageSquare className="h-5 w-5 text-[var(--buh-primary)]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--buh-foreground)]">База знаний</h3>
          <p className="text-xs text-[var(--buh-foreground-subtle)]">Управление FAQ ботом</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--buh-foreground-subtle)]" />
          <input
            type="text"
            placeholder="Поиск по вопросам..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] pl-9 pr-4 text-sm focus:border-[var(--buh-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent-glow)]"
          />
        </div>
        <Button onClick={onCreate} className="buh-btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Добавить вопрос
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--buh-border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--buh-surface-subtle)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Вопрос
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Ответ
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Ключевые слова
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Использований
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--buh-border)] bg-[var(--buh-surface)]">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)]">
                      <HelpCircle className="h-8 w-8 text-[var(--buh-foreground-subtle)]" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-[var(--buh-foreground)]">
                      Нет вопросов в базе знаний
                    </p>
                    <p className="mt-1 text-sm text-[var(--buh-foreground-subtle)]">
                      Создайте первый вопрос для автоответов бота
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => (
                <tr
                  key={item.id}
                  className="hover:bg-[var(--buh-surface-elevated)] transition-colors buh-animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <td className="px-4 py-3 font-medium text-[var(--buh-foreground)]">
                    {item.question}
                  </td>
                  <td
                    className="px-4 py-3 text-[var(--buh-foreground-muted)] max-w-xs truncate"
                    title={item.answer}
                  >
                    {item.answer}
                  </td>
                  <td className="px-4 py-3 text-[var(--buh-foreground-muted)]">
                    <div className="flex flex-wrap gap-1">
                      {item.keywords.slice(0, 3).map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-[var(--buh-surface-subtle)] px-2 py-0.5 text-xs border border-[var(--buh-border)]"
                        >
                          {k}
                        </span>
                      ))}
                      {item.keywords.length > 3 && (
                        <span className="text-xs text-[var(--buh-foreground-subtle)]">
                          +{item.keywords.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--buh-foreground-muted)]">
                    {item.usageCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(item)}
                        aria-label="Редактировать вопрос"
                      >
                        <Edit2 className="h-4 w-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-primary)]" />
                      </Button>
                      {currentUser?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm({ open: true, id: item.id })}
                          aria-label="Удалить вопрос"
                        >
                          <Trash2 className="h-4 w-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-error)]" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Удалить вопрос?"
        description="Это действие нельзя отменить. Вопрос будет удален из базы знаний."
        confirmText="Удалить"
      />
    </GlassCard>
  );
}
