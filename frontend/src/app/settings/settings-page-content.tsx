'use client';

/**
 * Settings Page Content - Client Component
 *
 * Interactive content for the settings page with premium BuhBot design system.
 * Renders child form components for working hours and holidays with
 * glass morphism effects and orchestrated animations.
 *
 * @module app/settings/settings-page-content
 */

import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { WorkingHoursForm } from '@/components/settings/WorkingHoursForm';
import { HolidayCalendar } from '@/components/settings/HolidayCalendar';

/**
 * Settings Page Content Component
 *
 * Main client component for the settings page.
 * Uses AdminLayout for consistent admin UI with sidebar and header.
 * Renders WorkingHoursForm and HolidayCalendar with premium styling.
 */
export function SettingsPageContent() {
  return (
    <AdminLayout>
      {/* Page Header */}
      <PageHeader
        title="Настройки SLA"
        description="Настройка рабочих часов, порогов SLA и календаря федеральных праздников. Эти настройки применяются ко всем чатам по умолчанию."
        breadcrumbs={[
          { label: 'Панель управления', href: '/dashboard' },
          { label: 'Настройки' },
        ]}
      />

      {/* Content sections with staggered animation */}
      <div className="space-y-6 buh-stagger">
        {/* Working Hours Section */}
        <section className="buh-animate-fade-in-up">
          <WorkingHoursForm />
        </section>

        {/* Divider with gradient accent */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--buh-border)]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[var(--buh-background)] px-4 text-xs font-medium uppercase tracking-wider text-[var(--buh-foreground-subtle)]">
              Календарь
            </span>
          </div>
        </div>

        {/* Holidays Calendar Section */}
        <section className="buh-animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <HolidayCalendar />
        </section>
      </div>
    </AdminLayout>
  );
}
