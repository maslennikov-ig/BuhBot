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
  question: z.string().min(1, 'Вопрос обязателен').max(200, 'Максимум 200 символов'),
  answer: z.string().min(1, 'Ответ обязателен').max(2000, 'Максимум 2000 символов'),
  keywords: z.string().min(1, 'Укажите хотя бы одно ключевое слово'),
});

import { inferRouterOutputs } from '@trpc/server';
import { AppRouter } from '@/types/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type FaqItem = RouterOutputs['faq']['list'][number];

interface FaqFormProps {
  initialData?: FaqItem | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function FaqForm({ initialData, onSuccess, onCancel }: FaqFormProps) {
  const utils = trpc.useContext();
  const isEdit = !!initialData;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: initialData?.question || '',
      answer: initialData?.answer || '',
      keywords: initialData?.keywords?.join(', ') || '',
    },
  });

  const createMutation = trpc.faq.create.useMutation({
    onSuccess: () => {
      utils.faq.list.invalidate();
      onSuccess();
    },
  });

  const updateMutation = trpc.faq.update.useMutation({
    onSuccess: () => {
      utils.faq.list.invalidate();
      onSuccess();
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const keywordsArray = values.keywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k);

    if (isEdit) {
      await updateMutation.mutateAsync({
        id: initialData.id,
        question: values.question,
        answer: values.answer,
        keywords: keywordsArray,
      });
    } else {
      await createMutation.mutateAsync({
        question: values.question,
        answer: values.answer,
        keywords: keywordsArray,
      });
    }
  };

  return (
    <GlassCard variant="elevated" padding="lg" className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-6 text-[var(--buh-foreground)]">
        {isEdit ? 'Редактирование вопроса' : 'Новый вопрос'}
      </h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="question"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Вопрос</FormLabel>
                <FormControl>
                  <Input placeholder="Как изменить пароль?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="answer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ответ</FormLabel>
                <FormControl>
                  <Textarea placeholder="Для изменения пароля..." rows={5} {...field} />
                </FormControl>
                <FormDescription>Текст ответа бота.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="keywords"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ключевые слова</FormLabel>
                <FormControl>
                  <Input placeholder="пароль, сброс, доступ" {...field} />
                </FormControl>
                <FormDescription>Разделяйте ключевые слова запятыми.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Отмена
            </Button>
            <Button
              type="submit"
              className="buh-btn-primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {isEdit ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </Form>
    </GlassCard>
  );
}
