'use client';

/**
 * RequestDetailsContent - Client Component
 *
 * Interactive content for the request details page.
 * Shows request info, classification, status, and SLA alerts.
 *
 * @module components/requests/RequestDetailsContent
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  User,
  Calendar,
  Clock,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
  Trash2,
  Settings,
  RotateCcw,
  PauseCircle,
  ArrowRightLeft,
  Ban,
} from 'lucide-react';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

// ============================================
// TYPES
// ============================================

type RequestDetailsContentProps = {
  requestId: string;
};

type RequestStatus =
  | 'pending'
  | 'in_progress'
  | 'waiting_client'
  | 'transferred'
  | 'answered'
  | 'escalated'
  | 'closed';
type Classification = 'REQUEST' | 'SPAM' | 'GRATITUDE' | 'CLARIFICATION';
type AlertType = 'warning' | 'breach';

const STATUS_CONFIG: Record<
  RequestStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: 'Ожидает ответа', color: 'var(--buh-warning)', icon: Clock },
  in_progress: { label: 'В работе', color: 'var(--buh-accent)', icon: AlertCircle },
  waiting_client: { label: 'Ждём клиента', color: 'var(--buh-warning)', icon: PauseCircle },
  transferred: { label: 'Передано', color: 'var(--buh-info)', icon: ArrowRightLeft },
  answered: { label: 'Отвечено', color: 'var(--buh-success)', icon: CheckCircle2 },
  escalated: { label: 'Эскалация', color: 'var(--buh-danger)', icon: XCircle },
  closed: { label: 'Закрыто', color: 'var(--buh-foreground-muted)', icon: Ban },
};

const CLASSIFICATION_CONFIG: Record<Classification, { label: string; color: string }> = {
  REQUEST: { label: 'Запрос', color: 'var(--buh-accent)' },
  SPAM: { label: 'Спам', color: 'var(--buh-foreground-subtle)' },
  GRATITUDE: { label: 'Благодарность', color: 'var(--buh-success)' },
  CLARIFICATION: { label: 'Уточнение', color: 'var(--buh-warning)' },
};

const ALERT_TYPE_CONFIG: Record<AlertType, { label: string; color: string }> = {
  warning: { label: 'Предупреждение', color: 'var(--buh-warning)' },
  breach: { label: 'Нарушение SLA', color: 'var(--buh-danger)' },
};

// ============================================
// RESPONSE SECTION
// ============================================

type ResponseSectionProps = {
  responseMessage: {
    id: string;
    messageText: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    createdAt: string | Date;
  } | null;
  responseAt: string | Date | null;
  responseTimeMinutes: number | null;
};

function ResponseSection({
  responseMessage,
  responseAt,
  responseTimeMinutes,
}: ResponseSectionProps) {
  if (!responseMessage) {
    return null;
  }

  const responseDate = new Date(responseMessage.createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const respondentName = responseMessage.username
    ? `@${responseMessage.username}`
    : responseMessage.firstName || 'Бухгалтер';

  return (
    <GlassCard variant="default" padding="lg" className="buh-hover-lift">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-success)] to-[var(--buh-accent)] shadow-lg">
            <CheckCircle2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">Ответ бухгалтера</h2>
            <p className="text-sm text-[var(--buh-foreground-muted)]">
              {respondentName} • {responseDate}
            </p>
          </div>
        </div>
        {responseTimeMinutes !== null && (
          <div className="flex items-center gap-2 rounded-full bg-[var(--buh-success)]/10 px-3 py-1.5 text-[var(--buh-success)]">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">{responseTimeMinutes} мин</span>
          </div>
        )}
      </div>

      {/* Response Text */}
      <div className="rounded-lg border border-[var(--buh-success)]/30 bg-[var(--buh-success)]/5 p-4">
        <p className="text-[var(--buh-foreground)] whitespace-pre-wrap break-words">
          {responseMessage.messageText}
        </p>
      </div>
    </GlassCard>
  );
}

// ============================================
// REQUEST INFO CARD
// ============================================

type RequestInfoCardProps = {
  request: {
    id: string;
    chatId: number;
    messageId: number;
    messageText: string;
    clientUsername: string | null;
    receivedAt: string | Date;
    responseAt: string | Date | null;
    responseTimeMinutes: number | null;
    status: RequestStatus;
    classification: Classification;
    createdAt: string | Date;
  };
};

function RequestInfoCard({ request }: RequestInfoCardProps) {
  const statusConfig = STATUS_CONFIG[request.status];
  const classificationConfig = CLASSIFICATION_CONFIG[request.classification];
  const StatusIcon = statusConfig.icon;

  const receivedDate = new Date(request.receivedAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const responseDate = request.responseAt
    ? new Date(request.responseAt).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <GlassCard variant="default" padding="lg" className="buh-hover-lift">
      {/* Header with status */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)] shadow-lg">
            <MessageSquare className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">
              Запрос от {request.clientUsername ? `@${request.clientUsername}` : 'клиента'}
            </h2>
            <p className="text-sm text-[var(--buh-foreground-muted)]">Chat ID: {request.chatId}</p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{ backgroundColor: `${statusConfig.color}20`, color: statusConfig.color }}
        >
          <StatusIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{statusConfig.label}</span>
        </div>
      </div>

      {/* Message Text */}
      <div className="mb-6 rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4">
        <div className="flex items-center gap-2 text-[var(--buh-foreground-muted)] mb-2">
          <MessageSquare className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wide">Текст сообщения</span>
        </div>
        <p className="text-[var(--buh-foreground)] whitespace-pre-wrap break-words">
          {request.messageText}
        </p>
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Classification */}
        <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4">
          <div className="flex items-center gap-2 text-[var(--buh-foreground-muted)] mb-1">
            <Tag className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Классификация</span>
          </div>
          <p className="font-medium" style={{ color: classificationConfig.color }}>
            {classificationConfig.label}
          </p>
        </div>

        {/* Client */}
        <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4">
          <div className="flex items-center gap-2 text-[var(--buh-foreground-muted)] mb-1">
            <User className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Клиент</span>
          </div>
          <p className="font-medium text-[var(--buh-foreground)]">
            {request.clientUsername ? (
              `@${request.clientUsername}`
            ) : (
              <span className="text-[var(--buh-foreground-subtle)] italic">Неизвестен</span>
            )}
          </p>
        </div>

        {/* Received Date */}
        <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4">
          <div className="flex items-center gap-2 text-[var(--buh-foreground-muted)] mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Получено</span>
          </div>
          <p className="font-medium text-[var(--buh-foreground)]">{receivedDate}</p>
        </div>

        {/* Response Time */}
        <div className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4">
          <div className="flex items-center gap-2 text-[var(--buh-foreground-muted)] mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Время ответа</span>
          </div>
          {request.responseTimeMinutes !== null ? (
            <p className="font-medium text-[var(--buh-foreground)]">
              {request.responseTimeMinutes} мин
            </p>
          ) : responseDate ? (
            <p className="font-medium text-[var(--buh-foreground)]">{responseDate}</p>
          ) : (
            <p className="font-medium text-[var(--buh-warning)]">Ожидает ответа</p>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// ============================================
// ALERTS SECTION
// ============================================

type AlertsListProps = {
  alerts: Array<{
    id: string;
    alertType: AlertType;
    minutesElapsed: number;
    alertSentAt: string | Date;
    acknowledgedAt: string | Date | null;
    acknowledgedBy: string | null;
    resolutionNotes: string | null;
  }>;
};

// ============================================
// ACTIONS CARD
// ============================================

type ActionsCardProps = {
  requestId: string;
  currentStatus: RequestStatus;
  currentClassification: Classification;
  onUpdate: () => void;
};

function ActionsCard({
  requestId,
  currentStatus,
  currentClassification,
  onUpdate,
}: ActionsCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const utils = trpc.useUtils();

  const updateMutation = trpc.requests.update.useMutation({
    onSuccess: () => {
      utils.requests.getById.invalidate({ id: requestId });
      onUpdate();
    },
  });

  const updateClassificationMutation = trpc.requests.updateClassification.useMutation({
    onSuccess: () => {
      utils.requests.getById.invalidate({ id: requestId });
      onUpdate();
    },
  });

  const deleteMutation = trpc.requests.delete.useMutation({
    onSuccess: () => {
      router.push('/requests');
    },
  });

  const handleStatusChange = (newStatus: RequestStatus) => {
    updateMutation.mutate({ id: requestId, status: newStatus });
  };

  const handleClassificationChange = (newClassification: Classification) => {
    updateClassificationMutation.mutate({ id: requestId, classification: newClassification });
  };

  const handleDelete = () => {
    setIsDeleting(true);
    deleteMutation.mutate({ id: requestId });
  };

  const isLoading =
    updateMutation.isPending || updateClassificationMutation.isPending || deleteMutation.isPending;

  return (
    <GlassCard variant="default" padding="lg">
      <div className="flex items-center gap-3 mb-4">
        <Settings className="h-5 w-5 text-[var(--buh-accent)]" />
        <h3 className="text-lg font-semibold text-[var(--buh-foreground)]">Действия</h3>
      </div>

      <div className="space-y-4">
        {/* Status Actions */}
        <div>
          <label className="block text-sm font-medium text-[var(--buh-foreground-muted)] mb-2">
            Изменить статус
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={currentStatus === 'pending' ? 'default' : 'outline'}
              onClick={() => handleStatusChange('pending')}
              disabled={isLoading || currentStatus === 'pending'}
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Ожидает
            </Button>
            <Button
              size="sm"
              variant={currentStatus === 'in_progress' ? 'default' : 'outline'}
              onClick={() => handleStatusChange('in_progress')}
              disabled={isLoading || currentStatus === 'in_progress'}
            >
              <AlertCircle className="mr-1.5 h-3.5 w-3.5" />В работе
            </Button>
            <Button
              size="sm"
              variant={currentStatus === 'answered' ? 'default' : 'outline'}
              onClick={() => handleStatusChange('answered')}
              disabled={isLoading || currentStatus === 'answered'}
              className={
                currentStatus === 'answered'
                  ? 'bg-[var(--buh-success)] hover:bg-[var(--buh-success)]/90'
                  : ''
              }
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Выполнено
            </Button>
            <Button
              size="sm"
              variant={currentStatus === 'escalated' ? 'default' : 'outline'}
              onClick={() => handleStatusChange('escalated')}
              disabled={isLoading || currentStatus === 'escalated'}
              className={
                currentStatus === 'escalated'
                  ? 'bg-[var(--buh-danger)] hover:bg-[var(--buh-danger)]/90'
                  : ''
              }
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Эскалация
            </Button>
          </div>
        </div>

        {/* Classification Actions */}
        <div>
          <label className="block text-sm font-medium text-[var(--buh-foreground-muted)] mb-2">
            Изменить классификацию
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={currentClassification === 'REQUEST' ? 'default' : 'outline'}
              onClick={() => handleClassificationChange('REQUEST')}
              disabled={isLoading || currentClassification === 'REQUEST'}
            >
              Запрос
            </Button>
            <Button
              size="sm"
              variant={currentClassification === 'CLARIFICATION' ? 'default' : 'outline'}
              onClick={() => handleClassificationChange('CLARIFICATION')}
              disabled={isLoading || currentClassification === 'CLARIFICATION'}
            >
              Уточнение
            </Button>
            <Button
              size="sm"
              variant={currentClassification === 'GRATITUDE' ? 'default' : 'outline'}
              onClick={() => handleClassificationChange('GRATITUDE')}
              disabled={isLoading || currentClassification === 'GRATITUDE'}
            >
              Благодарность
            </Button>
            <Button
              size="sm"
              variant={currentClassification === 'SPAM' ? 'default' : 'outline'}
              onClick={() => handleClassificationChange('SPAM')}
              disabled={isLoading || currentClassification === 'SPAM'}
            >
              Спам
            </Button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="pt-4 border-t border-[var(--buh-border)]">
          <label className="block text-sm font-medium text-[var(--buh-danger)] mb-2">
            Опасная зона
          </label>
          {!showDeleteConfirm ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-[var(--buh-danger)] border-[var(--buh-danger)] hover:bg-[var(--buh-danger)]/10"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Удалить запрос
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--buh-foreground-muted)]">Удалить?</span>
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Да, удалить
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Отмена
              </Button>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// ============================================
// ALERTS SECTION
// ============================================

function AlertsList({ alerts }: AlertsListProps) {
  if (alerts.length === 0) {
    return (
      <GlassCard variant="default" padding="lg">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="h-5 w-5 text-[var(--buh-foreground-muted)]" />
          <h3 className="text-lg font-semibold text-[var(--buh-foreground)]">SLA Оповещения</h3>
        </div>
        <p className="text-[var(--buh-foreground-muted)] text-center py-4">
          Нет оповещений для этого запроса
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="default" padding="lg">
      <div className="flex items-center gap-3 mb-4">
        <AlertCircle className="h-5 w-5 text-[var(--buh-warning)]" />
        <h3 className="text-lg font-semibold text-[var(--buh-foreground)]">
          SLA Оповещения ({alerts.length})
        </h3>
      </div>
      <div className="space-y-3">
        {alerts.map((alert) => {
          const alertConfig = ALERT_TYPE_CONFIG[alert.alertType];
          const sentDate = new Date(alert.alertSentAt).toLocaleString('ru-RU');
          const acknowledgedDate = alert.acknowledgedAt
            ? new Date(alert.acknowledgedAt).toLocaleString('ru-RU')
            : null;

          return (
            <div
              key={alert.id}
              className="rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-overlay)] p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: `${alertConfig.color}20`, color: alertConfig.color }}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {alertConfig.label}
                </span>
                <span className="text-xs text-[var(--buh-foreground-muted)]">
                  {alert.minutesElapsed} мин
                </span>
              </div>
              <div className="text-sm text-[var(--buh-foreground-muted)]">
                <p>Отправлено: {sentDate}</p>
                {acknowledgedDate && (
                  <p className="text-[var(--buh-success)]">Подтверждено: {acknowledgedDate}</p>
                )}
                {alert.resolutionNotes && (
                  <p className="mt-1 text-[var(--buh-foreground)]">
                    Примечание: {alert.resolutionNotes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

// ============================================
// REQUEST DETAILS CONTENT COMPONENT
// ============================================

export function RequestDetailsContent({ requestId }: RequestDetailsContentProps) {
  const { data, isLoading, error, refetch } = trpc.requests.getById.useQuery({ id: requestId });

  // Loading state
  if (isLoading) {
    return (
      <AdminLayout>
        <PageHeader
          title="Загрузка..."
          breadcrumbs={[
            { label: 'Панель управления', href: '/dashboard' },
            { label: 'Запросы', href: '/requests' },
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
  if (error || !data) {
    return (
      <AdminLayout>
        <PageHeader
          title="Запрос не найден"
          breadcrumbs={[
            { label: 'Панель управления', href: '/dashboard' },
            { label: 'Запросы', href: '/requests' },
            { label: 'Ошибка' },
          ]}
        />
        <GlassCard variant="default" padding="lg">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-[var(--buh-warning)] mb-4" />
            <h2 className="text-lg font-semibold text-[var(--buh-foreground)] mb-2">
              Запрос не найден
            </h2>
            <p className="text-[var(--buh-foreground-muted)] mb-6">
              {error?.message || 'Запрошенный запрос не существует или был удален'}
            </p>
            <Button asChild variant="outline">
              <Link href="/requests">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Вернуться к списку
              </Link>
            </Button>
          </div>
        </GlassCard>
      </AdminLayout>
    );
  }

  const { request, alerts } = data;
  const clientName = request.clientUsername ? `@${request.clientUsername}` : 'Клиент';

  return (
    <AdminLayout>
      {/* Page Header */}
      <PageHeader
        title={`Запрос от ${clientName}`}
        description="Детали обращения клиента"
        breadcrumbs={[
          { label: 'Панель управления', href: '/dashboard' },
          { label: 'Запросы', href: '/requests' },
          { label: `Запрос ${request.id.slice(0, 8)}...` },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href="/requests">
              <ArrowLeft className="mr-2 h-4 w-4" />К списку запросов
            </Link>
          </Button>
        }
      />

      {/* Content sections with staggered animation */}
      <div className="space-y-6 buh-stagger">
        {/* Request Info Section */}
        <section className="buh-animate-fade-in-up">
          <RequestInfoCard request={request} />
        </section>

        {/* Response Section - only if answered */}
        {data.responseMessage && (
          <section className="buh-animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
            <ResponseSection
              responseMessage={data.responseMessage}
              responseAt={request.responseAt}
              responseTimeMinutes={request.responseTimeMinutes}
            />
          </section>
        )}

        {/* Actions Section */}
        <section className="buh-animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <ActionsCard
            requestId={requestId}
            currentStatus={request.status}
            currentClassification={request.classification}
            onUpdate={refetch}
          />
        </section>

        {/* Alerts Section */}
        <section className="buh-animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <AlertsList alerts={alerts} />
        </section>
      </div>
    </AdminLayout>
  );
}
