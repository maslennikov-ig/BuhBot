'use client';

/**
 * Settings Page Content - Client Component
 *
 * Interactive content for the settings page.
 * Renders child form components for working hours and holidays.
 *
 * Uses Tremor + shadcn/ui for beautiful admin UI.
 *
 * @module app/settings/settings-page-content
 */

import { Title, Text, Divider } from '@tremor/react';
import { WorkingHoursForm } from '@/components/settings/WorkingHoursForm';
import { HolidayCalendar } from '@/components/settings/HolidayCalendar';

/**
 * Settings Page Content Component
 *
 * Main client component for the settings page.
 * Renders WorkingHoursForm and HolidayCalendar components.
 */
export function SettingsPageContent() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Page Header with Tremor */}
      <header className="mb-8">
        <Title className="text-3xl">Настройки SLA</Title>
        <Text className="mt-2">
          Настройка рабочих часов, порогов SLA и календаря федеральных праздников.
          Эти настройки применяются ко всем чатам по умолчанию.
        </Text>
      </header>

      <div className="space-y-8">
        {/* Working Hours Section */}
        <section>
          <WorkingHoursForm />
        </section>

        <Divider />

        {/* Holidays Calendar Section */}
        <section>
          <HolidayCalendar />
        </section>
      </div>
    </div>
  );
}
