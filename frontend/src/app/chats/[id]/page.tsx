import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ChatDetailsContent } from '@/components/chats/ChatDetailsContent';

/**
 * Chat Details Page - Individual Chat Settings
 *
 * Admin page for viewing and configuring individual chat settings:
 * - Chat information display
 * - SLA configuration
 * - Accountant assignment
 *
 * @module app/chats/[id]/page
 */

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Чат #${id} | BuhBot Admin`,
    description: `Настройки чата #${id}`,
  };
}

/**
 * Chat Details Page (Server Component)
 *
 * Renders the chat details page with metadata.
 * Uses AdminLayout for consistent premium admin UI.
 */
export default async function ChatDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const chatId = parseInt(id, 10);

  if (isNaN(chatId)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Invalid chat ID</p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full min-h-[500px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <ChatDetailsContent chatId={chatId} />
    </Suspense>
  );
}
