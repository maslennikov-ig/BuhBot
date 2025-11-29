'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Search, Edit2, Trash2, Plus } from 'lucide-react';

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

  const { data: faqItems, isLoading } = trpc.faq.list.useQuery({ sortBy: 'usage_count' });
  const deleteMutation = trpc.faq.delete.useMutation({
    onSuccess: () => {
      utils.faq.list.invalidate();
    },
  });

  const handleDelete = async (id: string) => {
    if (confirm('Вы уверены, что хотите удалить этот вопрос?')) {
      await deleteMutation.mutateAsync({ id });
    }
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
    return <div className="buh-shimmer h-64 w-full rounded-xl" />;
  }

  return (
    <GlassCard variant="default" padding="md" className="flex flex-col gap-4">
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
              <th className="px-4 py-3 font-semibold text-[var(--buh-foreground-muted)]">Вопрос</th>
              <th className="px-4 py-3 font-semibold text-[var(--buh-foreground-muted)]">Ответ</th>
              <th className="px-4 py-3 font-semibold text-[var(--buh-foreground-muted)]">Ключевые слова</th>
              <th className="px-4 py-3 font-semibold text-[var(--buh-foreground-muted)] text-right">Использований</th>
              <th className="px-4 py-3 font-semibold text-[var(--buh-foreground-muted)] text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--buh-border)] bg-[var(--buh-surface)]">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--buh-foreground-muted)]">
                  Нет данных
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--buh-surface-elevated)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--buh-foreground)]">{item.question}</td>
                  <td className="px-4 py-3 text-[var(--buh-foreground-muted)] max-w-xs truncate" title={item.answer}>
                    {item.answer}
                  </td>
                  <td className="px-4 py-3 text-[var(--buh-foreground-muted)]">
                    <div className="flex flex-wrap gap-1">
                      {item.keywords.slice(0, 3).map((k) => (
                        <span key={k} className="rounded-full bg-[var(--buh-surface-subtle)] px-2 py-0.5 text-xs border border-[var(--buh-border)]">
                          {k}
                        </span>
                      ))}
                      {item.keywords.length > 3 && (
                        <span className="text-xs text-[var(--buh-foreground-subtle)]">+{item.keywords.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--buh-foreground-muted)]">{item.usageCount}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                        <Edit2 className="h-4 w-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-primary)]" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-error)]" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
