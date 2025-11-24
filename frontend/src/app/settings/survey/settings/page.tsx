import type { Metadata } from 'next';
import { SurveySettingsContent } from './survey-settings-content';

/**
 * Survey Settings Page
 *
 * Admin page for configuring survey-related settings:
 * - Survey validity duration
 * - Reminder timing
 * - Low rating threshold
 * - Quarter day for auto-scheduling
 *
 * @module app/settings/survey/settings/page
 */

export const metadata: Metadata = {
  title: 'Настройки опросов | BuhBot',
  description: 'Конфигурация параметров опросов клиентов',
};

/**
 * Survey Settings Page (Server Component)
 *
 * Renders the survey settings page with metadata.
 * Uses AdminLayout for consistent premium admin UI.
 */
export default function SurveySettingsPage() {
  return <SurveySettingsContent />;
}
