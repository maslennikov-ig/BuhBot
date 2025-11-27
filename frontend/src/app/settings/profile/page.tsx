'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProfileSettingsForm } from '@/components/settings/ProfileSettingsForm';

export default function ProfilePage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-[var(--buh-foreground)]">Профиль</h3>
          <p className="text-sm text-[var(--buh-foreground-muted)]">
            Управление личными данными и уведомлениями
          </p>
        </div>
        
        <ProfileSettingsForm />
      </div>
    </AdminLayout>
  );
}
