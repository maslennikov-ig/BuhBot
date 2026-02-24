'use client';

/**
 * InvitationModal Component
 *
 * Modal for creating chat invitations with three methods:
 * 1. Deep Link (Private chats) - Generate link like t.me/bot?start=TOKEN
 * 2. Connect Code (Group chats) - Generate /connect TOKEN command
 * 3. Manual (Legacy) - Enter chat ID manually
 *
 * @module components/chats/InvitationModal
 */

import * as React from 'react';
import { X, Link2, Users, Hash, Copy, Check, Loader2 } from 'lucide-react';

import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AccountantSelect } from './AccountantSelect';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

type InvitationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type ChatType = 'private' | 'group' | 'supergroup';

// ============================================
// CONSTANTS
// ============================================

const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  private: 'Личный',
  group: 'Группа',
  supergroup: 'Супергруппа',
};

// ============================================
// INVITATION MODAL COMPONENT
// ============================================

export function InvitationModal({ isOpen, onClose, onSuccess }: InvitationModalProps) {
  // Shared options state
  const [accountantId, setAccountantId] = React.useState<string | null>(null);
  const [initialTitle, setInitialTitle] = React.useState('');

  // Generated invitation state
  const [generatedLink, setGeneratedLink] = React.useState('');
  const [generatedGroupLink, setGeneratedGroupLink] = React.useState('');
  const [generatedCommand, setGeneratedCommand] = React.useState('');
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedGroupLink, setCopiedGroupLink] = React.useState(false);
  const [copiedCommand, setCopiedCommand] = React.useState(false);

  // Manual registration state (Tab 3 - Legacy)
  const [telegramChatId, setTelegramChatId] = React.useState('');
  const [chatType, setChatType] = React.useState<ChatType>('private');
  const [manualTitle, setManualTitle] = React.useState('');
  const [manualAccountantUsername, setManualAccountantUsername] = React.useState('');

  // tRPC mutations
  const createInvitation = trpc.chats.createInvitation.useMutation({
    onSuccess: (data) => {
      setGeneratedLink(data.deepLink);
      setGeneratedGroupLink(data.groupLink);
      setGeneratedCommand(data.connectCommand);
      toast.success('Ссылка готова! Отправьте её клиенту для подключения чата');
    },
    onError: (error) => {
      console.error('Error creating invitation:', error);
      toast.error('Ошибка создания приглашения');
    },
  });

  const registerChat = trpc.chats.registerChat.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
      resetForm();
      toast.success('Чат добавлен');
    },
    onError: (error) => {
      console.error('Error registering chat:', error);
      toast.error('Ошибка добавления чата');
    },
  });

  // Reset form state
  const resetForm = () => {
    setAccountantId(null);
    setInitialTitle('');
    setGeneratedLink('');
    setGeneratedGroupLink('');
    setGeneratedCommand('');
    setCopiedLink(false);
    setCopiedGroupLink(false);
    setCopiedCommand(false);
    setTelegramChatId('');
    setChatType('private');
    setManualTitle('');
    setManualAccountantUsername('');
  };

  // Handle close with reset
  const handleClose = () => {
    onClose();
    resetForm();
  };

  // Generate invitation
  const handleGenerateInvitation = () => {
    createInvitation.mutate({
      initialTitle: initialTitle || undefined,
      assignedAccountantId: accountantId || undefined,
    });
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, type: 'link' | 'command') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCommand(true);
        setTimeout(() => setCopiedCommand(false), 2000);
      }
      toast.success('Скопировано в буфер обмена');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Ошибка копирования');
    }
  };

  // Manual registration
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerChat.mutate({
      telegramChatId,
      chatType,
      title: manualTitle || undefined,
      accountantUsername: manualAccountantUsername || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg buh-animate-fade-in-up">
        <GlassCard variant="elevated" padding="lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[var(--buh-foreground)]">Подключить чат</h2>
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="link">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="link" className="flex-1 flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Ссылка
              </TabsTrigger>
              <TabsTrigger value="code" className="flex-1 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Код
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1 flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Вручную
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Deep Link (Private Chat) */}
            <TabsContent value="link">
              <div className="space-y-4">
                {/* Description */}
                <p className="text-sm text-[var(--buh-foreground-muted)]">
                  Отправьте эту ссылку клиенту для подключения личного чата
                </p>

                {/* Accountant Select */}
                <div className="space-y-2">
                  <Label className="text-[var(--buh-foreground)]">
                    Ответственный бухгалтер (опционально)
                  </Label>
                  <AccountantSelect value={accountantId} onChange={setAccountantId} />
                </div>

                {/* Initial Title */}
                <div className="space-y-2">
                  <Label className="text-[var(--buh-foreground)]">
                    Начальное название (опционально)
                  </Label>
                  <Input
                    value={initialTitle}
                    onChange={(e) => setInitialTitle(e.target.value)}
                    placeholder="Чат с клиентом"
                    className="bg-[var(--buh-surface)] border-[var(--buh-border)]"
                  />
                </div>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerateInvitation}
                  disabled={createInvitation.isPending}
                  className={cn(
                    'w-full',
                    'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]',
                    'hover:shadow-lg hover:shadow-[var(--buh-accent-glow)]'
                  )}
                >
                  {createInvitation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Генерация...
                    </>
                  ) : (
                    'Сгенерировать ссылку'
                  )}
                </Button>

                {/* Generated Link */}
                {generatedLink && (
                  <div className="space-y-2 buh-animate-fade-in-up">
                    <Label className="text-[var(--buh-foreground)]">Ссылка для клиента</Label>
                    <div className="flex gap-2">
                      <Input
                        value={generatedLink}
                        readOnly
                        className="bg-[var(--buh-surface-elevated)] border-[var(--buh-border)] font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(generatedLink, 'link')}
                        className="shrink-0"
                      >
                        {copiedLink ? (
                          <Check className="h-4 w-4 text-[var(--buh-success)]" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-[var(--buh-foreground-subtle)] mt-2">
                      Чат появится в системе после того, как клиент нажмёт на ссылку и напишет боту.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab 2: Connect Code (Group Chat) */}
            <TabsContent value="code">
              <div className="space-y-4">
                {/* Description */}
                <p className="text-sm text-[var(--buh-foreground-muted)]">
                  Ссылка добавит бота в группу с правами на чтение сообщений
                </p>

                {/* Accountant Select */}
                <div className="space-y-2">
                  <Label className="text-[var(--buh-foreground)]">
                    Ответственный бухгалтер (опционально)
                  </Label>
                  <AccountantSelect value={accountantId} onChange={setAccountantId} />
                </div>

                {/* Initial Title */}
                <div className="space-y-2">
                  <Label className="text-[var(--buh-foreground)]">
                    Начальное название (опционально)
                  </Label>
                  <Input
                    value={initialTitle}
                    onChange={(e) => setInitialTitle(e.target.value)}
                    placeholder="Группа с клиентом"
                    className="bg-[var(--buh-surface)] border-[var(--buh-border)]"
                  />
                </div>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerateInvitation}
                  disabled={createInvitation.isPending}
                  className={cn(
                    'w-full',
                    'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]',
                    'hover:shadow-lg hover:shadow-[var(--buh-accent-glow)]'
                  )}
                >
                  {createInvitation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Генерация...
                    </>
                  ) : (
                    'Сгенерировать ссылку для группы'
                  )}
                </Button>

                {/* Generated Group Link (primary) */}
                {generatedGroupLink && (
                  <div className="space-y-2 buh-animate-fade-in-up">
                    <Label className="text-[var(--buh-foreground)]">
                      Ссылка для добавления в группу
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={generatedGroupLink}
                        readOnly
                        className="bg-[var(--buh-surface-elevated)] border-[var(--buh-border)] font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          copyToClipboard(generatedGroupLink, 'link');
                          setCopiedGroupLink(true);
                          setTimeout(() => setCopiedGroupLink(false), 2000);
                        }}
                        className="shrink-0"
                      >
                        {copiedGroupLink ? (
                          <Check className="h-4 w-4 text-[var(--buh-success)]" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-[var(--buh-foreground-subtle)] mt-2">
                      Клиент перейдёт по ссылке, выберет группу, и бот будет добавлен с правами
                      администратора для чтения сообщений.
                    </p>
                  </div>
                )}

                {/* Generated Command (fallback) */}
                {generatedCommand && (
                  <div className="space-y-2 buh-animate-fade-in-up">
                    <Label className="text-[var(--buh-foreground-muted)] text-xs">
                      Альтернатива: код для ручного подключения
                    </Label>
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center px-4 py-3 rounded-lg bg-[var(--buh-surface-elevated)] border border-[var(--buh-border)]">
                        <code className="text-lg font-mono font-semibold text-[var(--buh-accent)]">
                          {generatedCommand}
                        </code>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(generatedCommand, 'command')}
                        className="shrink-0"
                      >
                        {copiedCommand ? (
                          <Check className="h-4 w-4 text-[var(--buh-success)]" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-[var(--buh-foreground-subtle)] mt-2">
                      Если бот уже в группе: отправьте этот код в чат. После этого назначьте бота
                      администратором.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab 3: Manual Registration (Legacy) */}
            <TabsContent value="manual">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                {/* Description */}
                <p className="text-sm text-[var(--buh-foreground-muted)]">
                  Введите ID чата вручную (устаревший метод)
                </p>

                {/* Telegram Chat ID */}
                <div className="space-y-2">
                  <Label className="text-[var(--buh-foreground)]">Telegram Chat ID *</Label>
                  <Input
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="-1001234567890"
                    required
                    className="bg-[var(--buh-surface)] border-[var(--buh-border)]"
                  />
                </div>

                {/* Chat Type */}
                <div className="space-y-2">
                  <Label className="text-[var(--buh-foreground)]">Тип чата</Label>
                  <div className="flex gap-2">
                    {(['private', 'group', 'supergroup'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setChatType(type)}
                        className={cn(
                          'flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-all',
                          chatType === type
                            ? 'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] text-white border-transparent'
                            : 'bg-[var(--buh-surface)] border-[var(--buh-border)] text-[var(--buh-foreground-muted)] hover:border-[var(--buh-accent)]'
                        )}
                      >
                        {CHAT_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label className="text-[var(--buh-foreground)]">Название (опционально)</Label>
                  <Input
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="Чат с клиентом"
                    className="bg-[var(--buh-surface)] border-[var(--buh-border)]"
                  />
                </div>

                {/* Accountant Username */}
                <div className="space-y-2">
                  <Label className="text-[var(--buh-foreground)]">
                    Username бухгалтера (опционально)
                  </Label>
                  <Input
                    value={manualAccountantUsername}
                    onChange={(e) => setManualAccountantUsername(e.target.value)}
                    placeholder="@username"
                    className="bg-[var(--buh-surface)] border-[var(--buh-border)]"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    disabled={registerChat.isPending || !telegramChatId}
                    className={cn(
                      'flex-1',
                      'bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)]',
                      'hover:shadow-lg hover:shadow-[var(--buh-accent-glow)]'
                    )}
                  >
                    {registerChat.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Добавление...
                      </>
                    ) : (
                      'Добавить'
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </GlassCard>
      </div>
    </div>
  );
}
