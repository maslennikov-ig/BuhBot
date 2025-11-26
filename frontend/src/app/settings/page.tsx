'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettingsForm } from '@/components/settings/GeneralSettingsForm';
import { WorkingHoursForm } from '@/components/settings/WorkingHoursForm';
import { NotificationSettingsForm } from '@/components/settings/NotificationSettingsForm';

export default function SettingsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Settings</h3>
          <p className="text-sm text-muted-foreground">
            Manage your workspace preferences and configurations.
          </p>
        </div>
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">General & Bot</TabsTrigger>
            <TabsTrigger value="schedule">Schedule & SLA</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4">
            <GeneralSettingsForm />
          </TabsContent>
          
          <TabsContent value="schedule" className="space-y-4">
            <WorkingHoursForm />
          </TabsContent>
          
          <TabsContent value="notifications" className="space-y-4">
            <NotificationSettingsForm />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}