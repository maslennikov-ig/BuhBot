'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GlassCard } from '@/components/layout/GlassCard';

const formSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(100, 'Максимум 100 символов'),
  content: z.string().min(1, 'Содержание обязательно').max(2000, 'Максимум 2000 символов'),
  category: z.enum(['greeting', 'status', 'document_request', 'reminder', 'closing']),
});

import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type TemplateItem = RouterOutputs['templates']['list'][number];

interface TemplateFormProps {
  initialData?: TemplateItem | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const VARIABLES = [
  { label: 'Имя клиента', value: '{{clientName}}' },
  { label: 'Дата', value: '{{date}}' },
  { label: 'Список документов', value: '{{documents}}' },
];

const CATEGORIES = [
  { value: 'greeting', label: 'Приветствие' },
  { value: 'status', label: 'Статус' },
  { value: 'document_request', label: 'Запрос документов' },
  { value: 'reminder', label: 'Напоминание' },
  { value: 'closing', label: 'Завершение' },
];

export function TemplateForm({ initialData, onSuccess, onCancel }: TemplateFormProps) {
  const utils = trpc.useContext();
  const isEdit = !!initialData;
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || '',
      content: initialData?.content || '',
      category: initialData?.category || 'greeting',
    },
  });

  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      onSuccess();
    },
  });

  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      onSuccess();
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isEdit) {
      await updateMutation.mutateAsync({
        id: initialData.id,
        ...values,
      });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = form.getValues('content');
    
    const newContent = currentContent.substring(0, start) + variable + currentContent.substring(end);
    
    form.setValue('content', newContent, { shouldValidate: true });
    
    // Restore focus and cursor position (after inserted text)
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  return (
    <GlassCard variant="elevated" padding="lg" className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-6 text-[var(--buh-foreground)]">
        {isEdit ? 'Редактирование шаблона' : 'Новый шаблон'}
      </h2>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Название</FormLabel>
                <FormControl>
                  <Input placeholder="Например: Запрос акта сверки" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Категория</FormLabel>
                <FormControl>
                  <select
                    className="flex h-10 w-full rounded-md border border-[var(--buh-border)] bg-[var(--buh-surface)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--buh-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    {...field}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Содержание</FormLabel>
                <div className="mb-2 flex flex-wrap gap-2">
                    {VARIABLES.map((v) => (
                        <button
                            key={v.value}
                            type="button"
                            onClick={() => insertVariable(v.value)}
                            className="inline-flex items-center rounded-full bg-[var(--buh-primary-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--buh-primary)] hover:bg-[var(--buh-primary)] hover:text-white transition-colors"
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
                <FormControl>
                  <Textarea 
                    placeholder="Текст сообщения..."
                    rows={8}
                    {...field}
                    ref={(e) => {
                        field.ref(e);
                        textareaRef.current = e;
                    }}
                  />
                </FormControl>
                 <FormDescription>
                  Используйте переменные для персонализации.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Отмена
            </Button>
            <Button type="submit" className="buh-btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {isEdit ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </Form>
    </GlassCard>
  );
}
