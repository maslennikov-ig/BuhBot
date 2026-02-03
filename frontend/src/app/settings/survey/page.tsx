import type { Metadata } from 'next';
import { SurveyListContent } from './survey-list-content';

/**
 * Survey Management Page
 *
 * Admin page for managing quarterly feedback surveys:
 * - List all survey campaigns with status/stats
 * - Create new surveys
 * - Access survey settings
 *
 * @module app/settings/survey/page
 */

export const metadata: Metadata = {
  title: 'Управление опросами | BuhBot',
  description: 'Создание и управление квартальными опросами клиентов',
};

/**
 * Survey List Page (Server Component)
 *
 * Renders the survey management page with metadata.
 * Uses AdminLayout for consistent premium admin UI.
 */
export default function SurveyListPage() {
  return <SurveyListContent />;
}
