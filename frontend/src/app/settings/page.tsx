import type { Metadata } from 'next';
import { SettingsPageContent } from './settings-page-content';

/**
 * Settings Page - SLA Configuration
 *
 * Admin page for configuring global SLA settings including:
 * - Working hours defaults (timezone, days, start/end times)
 * - SLA threshold configuration
 * - Holiday calendar management
 *
 * @module app/settings/page
 */

export const metadata: Metadata = {
  title: 'Настройки SLA | BuhBot Admin',
  description: 'Настройка рабочих часов, SLA порогов и календаря праздников',
};

/**
 * Settings Page (Server Component)
 *
 * Renders the settings page with metadata.
 * Uses AdminLayout for consistent premium admin UI.
 */
export default function SettingsPage() {
  return <SettingsPageContent />;
}
