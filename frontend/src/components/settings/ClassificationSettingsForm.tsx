'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Brain, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const formSchema = z.object({
  aiConfidenceThreshold: z.number().min(0).max(1),
  messagePreviewLength: z.number().min(100).max(1000),
  openrouterApiKey: z.string().min(0),
  openrouterModel: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

export function ClassificationSettingsForm() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.settings.getGlobalSettings.useQuery();
  const [showApiKey, setShowApiKey] = React.useState(false);
  const updateSettings = trpc.settings.updateGlobalSettings.useMutation({
    onSuccess: () => {
      toast.success('Настройки AI классификации обновлены');
      utils.settings.getGlobalSettings.invalidate();
    },
    onError: (err) => {
      toast.error(`Ошибка: ${err.message}`);
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      aiConfidenceThreshold: 0.7,
      messagePreviewLength: 200,
      openrouterApiKey: '',
      openrouterModel: 'meta-llama/llama-3.1-8b-instruct:free',
    },
  });

  const thresholdValue = form.watch('aiConfidenceThreshold');

  // Update form when data loads
  React.useEffect(() => {
    if (settings) {
      form.reset({
        aiConfidenceThreshold: settings.aiConfidenceThreshold,
        messagePreviewLength: settings.messagePreviewLength,
        openrouterApiKey: settings.openrouterApiKey || '',
        openrouterModel: settings.openrouterModel,
      });
    }
  }, [settings, form]);

  const onSubmit = (data: FormValues) => {
    updateSettings.mutate({
      aiConfidenceThreshold: data.aiConfidenceThreshold,
      messagePreviewLength: data.messagePreviewLength,
      openrouterApiKey: data.openrouterApiKey || undefined,
      openrouterModel: data.openrouterModel,
    });
  };

  if (isLoading) {
    return (
      <Card className="buh-card">
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-[var(--buh-primary)]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="buh-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--buh-accent-glow)] flex items-center justify-center text-[var(--buh-accent)]">
            <Brain size={20} />
          </div>
          <div>
            <CardTitle>AI Классификация</CardTitle>
            <CardDescription>
              Настройки автоматической классификации сообщений с помощью AI
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="aiConfidenceThreshold">
              Порог уверенности классификации: {Math.round(thresholdValue * 100)}%
            </Label>
            <input
              id="aiConfidenceThreshold"
              type="range"
              min="0"
              max="1"
              step="0.05"
              {...form.register('aiConfidenceThreshold', { valueAsNumber: true })}
              className="w-full h-2 bg-[var(--buh-surface-elevated)] rounded-lg appearance-none cursor-pointer accent-[var(--buh-primary)]"
            />
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Минимальная уверенность AI для автоматической классификации сообщений. При уверенности
              ниже этого порога сообщение останется неклассифицированным.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="messagePreviewLength">Длина превью сообщения (символов)</Label>
            <Input
              id="messagePreviewLength"
              type="number"
              min={100}
              max={1000}
              step={50}
              {...form.register('messagePreviewLength', { valueAsNumber: true })}
              className="bg-[var(--buh-surface-elevated)]"
            />
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Максимальная длина текста сообщения, отправляемого в AI для классификации. Большие
              значения увеличивают точность, но стоят дороже.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="openrouterApiKey">OpenRouter API Key</Label>
            <div className="relative">
              <Input
                id="openrouterApiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder="sk-or-v1-..."
                {...form.register('openrouterApiKey')}
                className="bg-[var(--buh-surface-elevated)] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]"
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              API ключ для сервиса OpenRouter. Получить можно на{' '}
              <a
                href="https://openrouter.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--buh-primary)] hover:underline"
              >
                openrouter.ai
              </a>
              .
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="openrouterModel">Модель OpenRouter</Label>
            <Input
              id="openrouterModel"
              type="text"
              placeholder="meta-llama/llama-3.1-8b-instruct:free"
              {...form.register('openrouterModel')}
              className="bg-[var(--buh-surface-elevated)]"
            />
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              ID модели для классификации. Рекомендуется использовать быстрые и недорогие модели.
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className="bg-[var(--buh-primary)] hover:bg-[var(--buh-primary-hover)] text-white"
            >
              {updateSettings.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Сохранить
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
