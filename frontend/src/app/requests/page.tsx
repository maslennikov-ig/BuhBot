'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { trpc } from '@/lib/trpc';
import { Loader2 } from 'lucide-react';
import { RequestsTable } from '@/components/requests/RequestsTable';
import { HelpButton } from '@/components/ui/HelpButton';

export default function RequestsPage() {
  const { data, isLoading, refetch } = trpc.requests.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const requests = React.useMemo(() => {
    if (!data) return [];
    return data.requests.map((req) => {
      const status = req.status as
        | 'pending'
        | 'in_progress'
        | 'waiting_client'
        | 'transferred'
        | 'answered'
        | 'escalated'
        | 'closed';

      return {
        id: req.id,
        chatName: req.chat.title || `Chat ${req.chatId}`,
        clientName: req.clientUsername || 'Неизвестный',
        message: req.messageText,
        status,
        time: new Date(req.receivedAt).toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        slaRemaining: undefined,
        responseTimeMinutes: req.responseTimeMinutes,
        responseMessage: req.responseMessage?.messageText ?? null,
        responseUsername: req.responseMessage?.username ?? null,
        threadId: req.threadId ?? null,
        clientTier: req.chat.clientTier ?? null,
      };
    });
  }, [data]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full min-h-[500px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">
              Запросы
            </h1>
            <p className="mt-2 text-[var(--buh-foreground-muted)]">
              Управление обращениями клиентов
            </p>
          </div>
          <HelpButton section="requests" />
        </div>

        <RequestsTable requests={requests} onRefresh={refetch} />
      </div>
    </AdminLayout>
  );
}
