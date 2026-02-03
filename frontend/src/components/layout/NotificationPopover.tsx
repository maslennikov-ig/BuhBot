'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  Trash2,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export function NotificationPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Queries
  const { data: notificationsData, isLoading } = trpc.notification.list.useQuery(
    { limit: 10 },
    {
      enabled: isOpen, // Fetch when opened
      staleTime: 10000,
    }
  );

  const { data: unreadCountData } = trpc.notification.getUnreadCount.useQuery(
    undefined,
    { refetchInterval: 30000 } // Poll every 30s for badge
  );

  // Mutations
  const markAsReadMutation = trpc.notification.markAsRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.getUnreadCount.invalidate();
    },
  });

  const markAllAsReadMutation = trpc.notification.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.getUnreadCount.invalidate();
    },
  });

  const deleteMutation = trpc.notification.delete.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.getUnreadCount.invalidate();
    },
  });

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsReadMutation.mutate({ id });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMutation.mutate({ id });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const unreadCount = unreadCountData ?? 0;

  return (
    <div className="relative z-40" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200',
          isOpen
            ? 'bg-[var(--buh-surface-elevated)] text-[var(--buh-primary)]'
            : 'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]'
        )}
        aria-label="Уведомления"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--buh-accent)] ring-2 ring-[var(--buh-header-background)] animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-3 w-80 sm:w-96 origin-top-right rounded-2xl bg-[var(--buh-surface-elevated)]/95 backdrop-blur-xl border border-[var(--buh-border)] shadow-2xl overflow-hidden ring-1 ring-black/5"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--buh-border)] bg-[var(--buh-surface)]/50">
              <h3 className="font-semibold text-[var(--buh-foreground)]">Уведомления</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  className="text-xs font-medium text-[var(--buh-primary)] hover:text-[var(--buh-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {markAllAsReadMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Прочитать все
                </button>
              )}
            </div>

            {/* Content */}
            <div className="max-h-[400px] overflow-y-auto buh-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-[var(--buh-foreground-muted)]">
                  <Loader2 className="h-6 w-6 animate-spin mb-2" />
                  <span className="text-sm">Загрузка...</span>
                </div>
              ) : notificationsData?.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--buh-foreground-muted)]">
                  <Bell className="h-12 w-12 opacity-20 mb-3" />
                  <p className="text-sm">Нет новых уведомлений</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--buh-border)]">
                  {notificationsData?.items.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'relative group p-4 transition-colors hover:bg-[var(--buh-surface)]',
                        !notification.isRead ? 'bg-[var(--buh-primary)]/5' : ''
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="mt-1 shrink-0">{getIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                'text-sm font-medium text-[var(--buh-foreground)]',
                                !notification.isRead && 'font-semibold'
                              )}
                            >
                              {notification.title}
                            </p>
                            <span className="text-[10px] text-[var(--buh-foreground-muted)] shrink-0 whitespace-nowrap">
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                                locale: ru,
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--buh-foreground-muted)] mt-1 break-words line-clamp-3">
                            {notification.message}
                          </p>

                          {/* Actions */}
                          <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!notification.isRead && (
                              <button
                                onClick={(e) => handleMarkAsRead(notification.id, e)}
                                className="text-xs font-medium text-[var(--buh-primary)] hover:underline flex items-center gap-1"
                              >
                                <Check className="h-3 w-3" />
                                Прочитано
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDelete(notification.id, e)}
                              className="text-xs font-medium text-red-500 hover:underline flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              Удалить
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Unread dot */}
                      {!notification.isRead && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[var(--buh-primary)]" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 bg-[var(--buh-surface)]/30 border-t border-[var(--buh-border)] text-center">
              <Link
                href="/alerts"
                onClick={() => setIsOpen(false)}
                className="text-xs font-medium text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)] transition-colors"
              >
                Показать все алерты
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
