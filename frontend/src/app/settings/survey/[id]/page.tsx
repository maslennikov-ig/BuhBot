import type { Metadata } from 'next';
import { SurveyDetailContent } from './survey-detail-content';

/**
 * Survey Detail Page
 *
 * Admin page for viewing survey details:
 * - Survey info and stats
 * - Delivery list with status
 * - Actions (Send Now, Close)
 *
 * @module app/settings/survey/[id]/page
 */

export const metadata: Metadata = {
  title: 'Детали опроса | BuhBot',
  description: 'Просмотр деталей опроса и статистики доставки',
};

/**
 * Survey Detail Page (Server Component)
 *
 * Renders the survey detail page with metadata.
 * Uses AdminLayout for consistent premium admin UI.
 */
export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SurveyDetailContent surveyId={id} />;
}
