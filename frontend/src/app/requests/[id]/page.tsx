import type { Metadata } from 'next';
import { RequestDetailsContent } from '@/components/requests/RequestDetailsContent';

/**
 * Request Details Page - Individual Client Request View
 *
 * Admin page for viewing individual client request:
 * - Request message and metadata
 * - Classification and status
 * - SLA alerts history
 *
 * @module app/requests/[id]/page
 */

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Запрос | BuhBot Admin`,
    description: `Просмотр запроса ${id}`,
  };
}

/**
 * Request Details Page (Server Component)
 *
 * Renders the request details page with metadata.
 * Uses AdminLayout for consistent premium admin UI.
 */
export default async function RequestDetailsPage({ params }: PageProps) {
  const { id } = await params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Invalid request ID</p>
      </div>
    );
  }

  return <RequestDetailsContent requestId={id} />;
}
