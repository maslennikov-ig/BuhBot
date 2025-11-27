'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettingsForm } from '@/components/settings/GeneralSettingsForm';
import { WorkingHoursForm } from '@/components/settings/WorkingHoursForm';
import { NotificationSettingsForm } from '@/components/settings/NotificationSettingsForm';
import { ProfileSettingsForm } from '@/components/settings/ProfileSettingsForm';

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
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="general">General & Bot</TabsTrigger>
            <TabsTrigger value="schedule">Schedule & SLA</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-4">
            <ProfileSettingsForm />
          </TabsContent>

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