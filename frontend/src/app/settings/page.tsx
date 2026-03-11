'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettingsForm } from '@/components/settings/GeneralSettingsForm';
import { WorkingHoursForm } from '@/components/settings/WorkingHoursForm';
import { HolidayCalendar } from '@/components/settings/HolidayCalendar';
import { NotificationSettingsForm } from '@/components/settings/NotificationSettingsForm';
import { ProfileSettingsForm } from '@/components/settings/ProfileSettingsForm';
import { ClassificationSettingsForm } from '@/components/settings/ClassificationSettingsForm';
import { DataRetentionSettingsForm } from '@/components/settings/DataRetentionSettingsForm';
import { SlaManagerSettingsForm } from '@/components/settings/SlaManagerSettingsForm';
import { HelpButton } from '@/components/ui/HelpButton';
import { trpc } from '@/lib/trpc';

export default function SettingsPage() {
  const { data: meData } = trpc.auth.me.useQuery();

  if (meData?.role === 'accountant') {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-medium">Настройки</h3>
              <p className="text-sm text-muted-foreground">Управление профилем.</p>
            </div>
          </div>
          <ProfileSettingsForm />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium">Настройки</h3>
            <p className="text-sm text-muted-foreground">
              Управление параметрами рабочего пространства и конфигурациями.
            </p>
          </div>
          <HelpButton section="settings.general" />
        </div>
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Профиль</TabsTrigger>
            <TabsTrigger value="general">Основные и бот</TabsTrigger>
            <TabsTrigger value="schedule">Расписание и SLA</TabsTrigger>
            <TabsTrigger value="notifications">Уведомления</TabsTrigger>
            <TabsTrigger value="ai">AI Классификация</TabsTrigger>
            <TabsTrigger value="retention">Хранение данных</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <ProfileSettingsForm />
          </TabsContent>

          <TabsContent value="general" className="space-y-4">
            <GeneralSettingsForm />
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <SlaManagerSettingsForm />
            <WorkingHoursForm />
            <HolidayCalendar />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <NotificationSettingsForm />
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <ClassificationSettingsForm />
          </TabsContent>

          <TabsContent value="retention" className="space-y-4">
            <DataRetentionSettingsForm />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
