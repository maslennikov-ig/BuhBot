'use client';

/**
 * ChatDetailsContent - Client Component
 *
 * Interactive content for the chat details page.
 * Shows chat info and settings form.
 *
 * @module components/chats/ChatDetailsContent
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Users,
  User,
  Calendar,
  Clock,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Trash2,
  RotateCcw,
} from 'lucide-react';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { ChatSettingsForm } from '@/components/chats/ChatSettingsForm';
import { ChatMessageThread } from '@/components/chats/ChatMessageThread';
import { ChatTabs } from '@/components/chats/ChatTabs';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

type ChatDetailsContentProps = {
  chatId: number;
};

type ChatType = 'private' | 'group' | 'supergroup';
type Tab = 'messages' | 'settings' | 'schedule';

const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  private: 'Личный чат',
  group: 'Группа',
  supergroup: 'Супергруппа',
};

const CHAT_TYPE_ICONS: Record<ChatType, React.ElementType> = {
  private: User,
  group: Users,
  supergroup: Users,
};

// ============================================
// CHAT INFO CARD
// ============================================

type ChatInfoCardProps = {
  chat: {
    id: number;
    chatType: ChatType;
    title: string | null;
    accountantUsername: string | null;
    assignedAccountantId: string | null;
    slaEnabled: boolean;
    slaThresholdMinutes: number;
    createdAt: string;
    updatedAt?: string;
  };
};

function ChatInfoCard({ chat }: ChatInfoCardProps) {
  const TypeIcon = CHAT_TYPE_ICONS[chat.chatType] || MessageSquare;
  const createdDate = new Date(chat.createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <GlassCard variant="default" padding="lg" className="buh-hover-lift">
      {/* Header with icon */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)] shadow-lg">
          <MessageSquare className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">
            {chat.title || `Чат #${chat.id}`}
          </h2>
          <p className="text-sm text-[var(--buh-foreground-muted)]">ID: {chat.id}</p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Chat Type */}
        <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4">
          <div className="flex items-center gap-2 text-[var(--buh-foreground-muted)] mb-1">
            <TypeIcon className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Тип чата</span>
          </div>
          <p className="font-medium text-[var(--buh-foreground)]">
            {CHAT_TYPE_LABELS[chat.chatType]}
          </p>
        </div>

        {/* Accountant */}
        <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4">
          <div className="flex items-center gap-2 text-[var(--buh-foreground-muted)] mb-1">
            <User className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Бухгалтер</span>
          </div>
          <p className="font-medium text-[var(--buh-foreground)]">
            {chat.accountantUsername ? (
              `@${chat.accountantUsername}`
            ) : chat.assignedAccountantId ? (
              <span className="text-[var(--buh-foreground-muted)]">
                ID: {chat.assignedAccountantId}
              </span>
            ) : (
              <span className="text-[var(--buh-foreground-subtle)] italic">Не назначен</span>
            )}
          </p>
        </div>

        {/* SLA Threshold */}
        <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4">
          <div className="flex items-center gap-2 text-[var(--buh-foreground-muted)] mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Порог SLA</span>
          </div>
          <p className="font-medium text-[var(--buh-foreground)]">
            {chat.slaThresholdMinutes} минут
            {chat.slaEnabled ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--buh-success)]/10 px-2 py-0.5 text-xs text-[var(--buh-success)]">
                Активен
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--buh-foreground-subtle)]/10 px-2 py-0.5 text-xs text-[var(--buh-foreground-subtle)]">
                Выключен
              </span>
            )}
          </p>
        </div>

        {/* Created Date */}
        <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4 sm:col-span-2 lg:col-span-3">
          <div className="flex items-center gap-2 text-[var(--buh-foreground-muted)] mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Дата регистрации</span>
          </div>
          <p className="font-medium text-[var(--buh-foreground)]">{createdDate}</p>
        </div>
      </div>
    </GlassCard>
  );
}

// ============================================
// CHAT DETAILS CONTENT COMPONENT
// ============================================

export function ChatDetailsContent({ chatId }: ChatDetailsContentProps) {
  const [activeTab, setActiveTab] = React.useState<Tab>('messages');
  const { data: chat, isLoading, error } = trpc.chats.getById.useQuery({ id: chatId });
  const utils = trpc.useUtils();

  // Restore mutation (gh-209)
  const restoreMutation = trpc.chats.restore.useMutation({
    onSuccess: () => {
      toast.success('Чат восстановлен');
      utils.chats.getById.invalidate({ id: chatId });
      utils.chats.list.invalidate();
      utils.chats.listDeleted.invalidate();
    },
    onError: (err) => {
      toast.error(`Ошибка восстановления: ${err.message}`);
    },
  });

  const handleRestore = () => {
    restoreMutation.mutate({ id: chatId });
  };

  // Loading state
  if (isLoading) {
    return (
      <AdminLayout>
        <PageHeader
          title="Загрузка..."
          breadcrumbs={[
            { label: 'Панель управления', href: '/dashboard' },
            { label: 'Чаты', href: '/chats' },
            { label: '...' },
          ]}
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--buh-accent)]" />
        </div>
      </AdminLayout>
    );
  }

  // Error state
  if (error || !chat) {
    return (
      <AdminLayout>
        <PageHeader
          title="Чат не найден"
          breadcrumbs={[
            { label: 'Панель управления', href: '/dashboard' },
            { label: 'Чаты', href: '/chats' },
            { label: 'Ошибка' },
          ]}
        />
        <GlassCard variant="default" padding="lg">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-[var(--buh-warning)] mb-4" />
            <h2 className="text-lg font-semibold text-[var(--buh-foreground)] mb-2">
              Чат не найден
            </h2>
            <p className="text-[var(--buh-foreground-muted)] mb-6">
              {error?.message || 'Запрошенный чат не существует или был удален'}
            </p>
            <Button asChild variant="outline">
              <Link href="/chats">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Вернуться к списку
              </Link>
            </Button>
          </div>
        </GlassCard>
      </AdminLayout>
    );
  }

  const chatTitle = chat.title || `Чат #${chat.id}`;

  return (
    <AdminLayout>
      {/* Page Header */}
      <PageHeader
        title={chatTitle}
        description="Информация и настройки чата"
        breadcrumbs={[
          { label: 'Панель управления', href: '/dashboard' },
          { label: 'Чаты', href: '/chats' },
          { label: chatTitle },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href="/chats">
              <ArrowLeft className="mr-2 h-4 w-4" />К списку чатов
            </Link>
          </Button>
        }
      />

      {/* Content sections with staggered animation */}
      <div className="space-y-6">
        {/* Deleted chat restoration banner (gh-209) */}
        {chat.deletedAt && (
          <section className="buh-animate-fade-in-up">
            <div className="rounded-lg border border-[var(--buh-warning)] bg-[var(--buh-warning)]/10 p-4 flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-[var(--buh-warning)] shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-[var(--buh-foreground)]">
                  Чат удалён{' '}
                  {new Date(chat.deletedAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-sm text-[var(--buh-foreground-muted)]">
                  Все данные сохранены. Вы можете восстановить чат.
                </p>
              </div>
              <Button
                onClick={handleRestore}
                disabled={restoreMutation.isPending}
                className="bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] text-white hover:text-white shrink-0"
              >
                {restoreMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Восстановить
              </Button>
            </div>
          </section>
        )}

        {/* Chat Info Section - always visible */}
        <section className="buh-animate-fade-in-up">
          <ChatInfoCard chat={chat as ChatInfoCardProps['chat']} />
        </section>

        {/* Tab Navigation */}
        <section className="buh-animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <ChatTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </section>

        {/* Tab Content */}
        <section className="buh-animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          {activeTab === 'messages' && (
            <GlassCard variant="default" padding="lg">
              <ChatMessageThread chatId={chat.id} />
            </GlassCard>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              {chat.deletedAt ? (
                /* When deleted, show read-only notice instead of settings (gh-209) */
                <GlassCard variant="default" padding="lg">
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Trash2 className="h-12 w-12 text-[var(--buh-foreground-subtle)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--buh-foreground)] mb-2">
                      Настройки недоступны
                    </h3>
                    <p className="text-sm text-[var(--buh-foreground-muted)] mb-4">
                      Чат удалён. Восстановите чат, чтобы изменить настройки.
                    </p>
                    <Button
                      onClick={handleRestore}
                      disabled={restoreMutation.isPending}
                      className="bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] text-white hover:text-white"
                    >
                      {restoreMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      )}
                      Восстановить чат
                    </Button>
                  </div>
                </GlassCard>
              ) : (
                <>
                  {/* Settings Form - dropdown uses z-[1000] so no wrapper z-index needed */}
                  <ChatSettingsForm
                    chatId={chat.id}
                    managerTelegramIds={chat.managerTelegramIds ?? []}
                    accountantTelegramIds={chat.accountantTelegramIds ?? []}
                    initialData={{
                      slaEnabled: chat.slaEnabled,
                      slaThresholdMinutes: chat.slaThresholdMinutes,
                      assignedAccountantId: chat.assignedAccountantId,
                      accountantUsernames: chat.accountantUsernames ?? [],
                      notifyInChatOnBreach: chat.notifyInChatOnBreach ?? false,
                    }}
                    accountantVerification={chat.accountantVerification}
                  />

                  {/* Danger Zone */}
                  <DangerZone chatId={chat.id} chatTitle={chatTitle} />
                </>
              )}
            </div>
          )}

          {activeTab === 'schedule' && (
            <GlassCard variant="default" padding="lg">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--buh-surface-overlay)] mb-4">
                  <Calendar className="h-8 w-8 text-[var(--buh-foreground-muted)]" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--buh-foreground)] mb-2">
                  Расписание работы
                </h3>
                <p className="text-sm text-[var(--buh-foreground-muted)]">
                  Настройка рабочих часов находится в разработке
                </p>
              </div>
            </GlassCard>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

// ============================================
// DANGER ZONE COMPONENT
// ============================================

type DangerZoneProps = {
  chatId: number;
  chatTitle: string;
};

function DangerZone({ chatId, chatTitle }: DangerZoneProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const deleteMutation = trpc.chats.delete.useMutation({
    onSuccess: () => {
      router.push('/chats');
    },
    onError: () => {
      setIsDeleting(false);
    },
  });

  const handleDelete = () => {
    setIsDeleting(true);
    deleteMutation.mutate({ id: chatId });
  };

  return (
    <GlassCard
      variant="default"
      padding="lg"
      className="border-[var(--buh-error)]/20 relative overflow-hidden buh-hover-lift group"
    >
      {/* Subtle danger gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--buh-error)]/5 via-transparent to-transparent opacity-50 pointer-events-none" />

      {/* Content wrapper with relative positioning */}
      <div className="relative">
        {/* Header with gradient icon */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-error)] to-[var(--buh-warning)] shadow-lg transition-transform group-hover:scale-105">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-[var(--buh-foreground)]">Опасная зона</h3>
            <p className="text-sm text-[var(--buh-foreground-muted)]">Действия с чатом</p>
          </div>
        </div>

        {/* Delete section - styled like info cards in ChatInfoCard */}
        <div className="rounded-lg border border-[var(--buh-error)]/30 bg-[var(--buh-surface-overlay)] p-5 transition-all hover:border-[var(--buh-error)]/50">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--buh-error)]/10 mt-0.5">
              <Trash2 className="h-4 w-4 text-[var(--buh-error)]" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-[var(--buh-foreground)] mb-1.5">Удалить чат</h4>
              <p className="text-sm text-[var(--buh-foreground-muted)] leading-relaxed">
                Чат будет помечен как удалённый. Мониторинг и SLA будут отключены. Все данные
                сохранятся, и чат можно будет восстановить позже.
              </p>
            </div>
          </div>

          {!showDeleteConfirm ? (
            <div className="pl-11">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-[var(--buh-error)] border-[var(--buh-error)]/40 hover:bg-[var(--buh-error)]/10 hover:border-[var(--buh-error)] transition-all font-medium"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить чат
              </Button>
            </div>
          ) : (
            <div className="pl-11 space-y-3 pt-2">
              {/* Confirmation message with danger styling */}
              <div className="rounded-lg bg-[var(--buh-error)]/10 border border-[var(--buh-error)]/20 p-3">
                <p className="text-sm font-semibold text-[var(--buh-error)] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Подтвердите удаление «{chatTitle}»
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="shadow-md hover:shadow-lg transition-all"
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Да, удалить
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="hover:bg-[var(--buh-surface-overlay)] transition-all"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
