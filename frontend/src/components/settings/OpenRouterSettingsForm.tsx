'use client';

/**
 * OpenRouter Settings Form
 *
 * Allows administrators to configure OpenRouter API settings
 * for AI message classification. Includes API key and model selection.
 *
 * @module components/settings/OpenRouterSettingsForm
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Cpu, Eye, EyeOff, Check } from 'lucide-react';
import { toast } from 'sonner';

const formSchema = z.object({
  openrouterApiKey: z.string().optional(),
  openrouterModel: z.string().min(1, 'Model is required'),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Popular OpenRouter models for message classification
 */
const POPULAR_MODELS = [
  { value: 'openai/gpt-oss-120b', label: 'GPT OSS 120B (recommended)' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
  { value: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5' },
];

export function OpenRouterSettingsForm() {
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [keyChanged, setKeyChanged] = React.useState(false);

  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.settings.getGlobalSettings.useQuery();
  const updateSettings = trpc.settings.updateGlobalSettings.useMutation({
    onSuccess: () => {
      toast.success('Настройки OpenRouter обновлены');
      utils.settings.getGlobalSettings.invalidate();
      setKeyChanged(false);
    },
    onError: (err) => {
      toast.error(`Ошибка: ${err.message}`);
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      openrouterApiKey: '',
      openrouterModel: 'openai/gpt-oss-120b',
    },
  });

  // Update form when data loads
  React.useEffect(() => {
    if (settings) {
      form.reset({
        openrouterApiKey: '', // Don't show masked key
        openrouterModel: settings.openrouterModel,
      });
    }
  }, [settings, form]);

  const onSubmit = (data: FormValues) => {
    const updateData: { openrouterApiKey?: string; openrouterModel?: string } = {
      openrouterModel: data.openrouterModel,
    };

    // Only update API key if user entered a new one
    if (data.openrouterApiKey && data.openrouterApiKey.trim()) {
      updateData.openrouterApiKey = data.openrouterApiKey.trim();
    }

    updateSettings.mutate(updateData);
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

  const hasExistingKey = settings?.openrouterApiKey !== null;

  return (
    <Card className="buh-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--buh-accent-glow)] flex items-center justify-center text-[var(--buh-accent)]">
            <Cpu size={20} />
          </div>
          <div>
            <CardTitle>OpenRouter API</CardTitle>
            <CardDescription>
              Настройки AI-классификации сообщений
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="openrouterApiKey">API ключ</Label>
            <div className="relative">
              <Input
                id="openrouterApiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder={hasExistingKey ? 'Ключ настроен (введите новый для замены)' : 'sk-or-...'}
                {...form.register('openrouterApiKey', {
                  onChange: () => setKeyChanged(true),
                })}
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
            {hasExistingKey && settings && (
              <div className="flex items-center gap-2 text-sm text-[var(--buh-success)]">
                <Check size={14} />
                <span>Ключ настроен: {settings.openrouterApiKey}</span>
              </div>
            )}
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Получите ключ на{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--buh-accent)] hover:underline"
              >
                openrouter.ai/keys
              </a>
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="openrouterModel">Модель</Label>
            <select
              id="openrouterModel"
              {...form.register('openrouterModel')}
              className="w-full h-10 px-3 rounded-md border border-[var(--buh-border)] bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-accent)]"
            >
              {POPULAR_MODELS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              Модель используется для классификации входящих сообщений
            </p>
          </div>

          {/* Info */}
          <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4 text-sm">
            <h4 className="font-medium text-[var(--buh-foreground)] mb-2">
              Как это работает
            </h4>
            <ul className="list-disc list-inside space-y-1 text-[var(--buh-foreground-muted)]">
              <li>AI анализирует сообщения клиентов</li>
              <li>Запросы (REQUEST) запускают SLA-таймер</li>
              <li>Спам и благодарности игнорируются</li>
              <li>Результаты кэшируются на 24 часа</li>
            </ul>
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
