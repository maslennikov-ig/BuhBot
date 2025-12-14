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
import {
  MessageSquare,
  Users,
  User,
  Calendar,
  Clock,
  ArrowLeft,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { ChatSettingsForm } from '@/components/chats/ChatSettingsForm';
import { trpc } from '@/lib/trpc';

// ============================================
// TYPES
// ============================================

type ChatDetailsContentProps = {
  chatId: number;
};

type ChatType = 'private' | 'group' | 'supergroup';

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
    slaResponseMinutes: number;
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
          <p className="text-sm text-[var(--buh-foreground-muted)]">
            ID: {chat.id}
          </p>
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
              <span className="text-[var(--buh-foreground-subtle)] italic">
                Не назначен
              </span>
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
            {chat.slaResponseMinutes} минут
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
  const { data: chat, isLoading, error } = trpc.chats.getById.useQuery({ id: chatId });

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
              <ArrowLeft className="mr-2 h-4 w-4" />
              К списку чатов
            </Link>
          </Button>
        }
      />

      {/* Content sections with staggered animation */}
      <div className="space-y-6 buh-stagger">
        {/* Chat Info Section */}
        <section className="buh-animate-fade-in-up">
          <ChatInfoCard chat={chat as ChatInfoCardProps['chat']} />
        </section>

        {/* Divider with gradient accent */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--buh-border)]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[var(--buh-background)] px-4 text-xs font-medium uppercase tracking-wider text-[var(--buh-foreground-subtle)]">
              Настройки
            </span>
          </div>
        </div>

        {/* Settings Form Section */}
        <section className="buh-animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <ChatSettingsForm
            chatId={chat.id}
            initialData={{
              slaEnabled: chat.slaEnabled,
              slaResponseMinutes: chat.slaResponseMinutes,
              assignedAccountantId: chat.assignedAccountantId,
            }}
          />
        </section>
      </div>
    </AdminLayout>
  );
}

