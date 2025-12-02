'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProfileSettingsForm } from '@/components/settings/ProfileSettingsForm';
import { HelpButton } from '@/components/ui/HelpButton';

export default function ProfilePage() {
  return (
    <AdminLayout>
      <PageHeader
        title="Профиль"
        description="Управление личными данными и уведомлениями"
        actions={<HelpButton section="settings.profile" />}
        breadcrumbs={[
          { label: 'Настройки', href: '/settings' },
          { label: 'Профиль' },
        ]}
      />
      
      <div className="space-y-6">
        <ProfileSettingsForm />
      </div>
    </AdminLayout>
  );
}
