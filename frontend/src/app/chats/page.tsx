import type { Metadata } from 'next';
import { ChatsListContent } from '@/components/chats/ChatsListContent';

/**
 * Chats Page - Chat Management
 *
 * Admin page for managing Telegram chats including:
 * - List of all registered chats
 * - Filtering by accountant and SLA status
 * - Registration of new chats
 * - Navigation to chat settings
 *
 * @module app/chats/page
 */

export const metadata: Metadata = {
  title: 'Управление чатами | BuhBot Admin',
  description: 'Просмотр и настройка чатов Telegram с клиентами',
};

/**
 * Chats Page (Server Component)
 *
 * Renders the chats list page with metadata.
 * Uses AdminLayout for consistent premium admin UI.
 */
export default function ChatsPage() {
  return <ChatsListContent />;
}
