'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import {
  SlaComplianceWidget,
  ResponseTimeWidget,
  ViolationsWidget,
  ActiveAlertsWidget,
  RecentRequestsTable,
} from '@/components/dashboard';

// ============================================
// MOCK DATA
// ============================================

const mockSlaData = {
  compliance: 87.5,
  compliantCount: 42,
  violatedCount: 6,
};

const mockResponseTimeData = {
  averageTime: 32,
  trend: {
    value: 12,
    direction: 'down' as const,
  },
  chartData: [
    { time: 'Пн', 'Время ответа': 38 },
    { time: 'Вт', 'Время ответа': 42 },
    { time: 'Ср', 'Время ответа': 35 },
    { time: 'Чт', 'Время ответа': 45 },
    { time: 'Пт', 'Время ответа': 30 },
    { time: 'Сб', 'Время ответа': 28 },
    { time: 'Вс', 'Время ответа': 32 },
  ],
};

const mockViolationsData = {
  count: 3,
  yesterdayCount: 5,
};

const mockAlertsData = {
  totalCount: 5,
  criticalCount: 1,
  warningCount: 2,
  infoCount: 2,
  recentAlerts: [
    {
      id: '1',
      title: 'SLA нарушение: ООО "Ромашка"',
      severity: 'critical' as const,
      time: '5 мин назад',
    },
    {
      id: '2',
      title: 'Ожидание ответа > 30 мин',
      severity: 'warning' as const,
      time: '15 мин назад',
    },
    {
      id: '3',
      title: 'Новый клиент без привязки',
      severity: 'info' as const,
      time: '1 час назад',
    },
  ],
};

const mockRequestsData = [
  {
    id: '1',
    chatName: 'ООО "Ромашка"',
    clientName: 'Иванов И.И.',
    message: 'Добрый день! Подскажите, пожалуйста, по НДС за 3 квартал...',
    status: 'pending' as const,
    time: '10:45',
    slaRemaining: '25 мин',
  },
  {
    id: '2',
    chatName: 'ИП Петров',
    clientName: 'Петров П.П.',
    message: 'Когда будет готова декларация по УСН?',
    status: 'in_progress' as const,
    time: '10:30',
    slaRemaining: '40 мин',
  },
  {
    id: '3',
    chatName: 'АО "Техно"',
    clientName: 'Сидорова А.С.',
    message: 'Спасибо за оперативный ответ!',
    status: 'resolved' as const,
    time: '10:15',
  },
  {
    id: '4',
    chatName: 'ООО "Строй"',
    clientName: 'Козлов К.К.',
    message: 'Срочно нужна справка о доходах',
    status: 'violated' as const,
    time: '09:45',
  },
  {
    id: '5',
    chatName: 'ИП Новиков',
    clientName: 'Новиков Н.Н.',
    message: 'Подготовьте документы для банка',
    status: 'resolved' as const,
    time: '09:30',
  },
  {
    id: '6',
    chatName: 'ООО "Альфа"',
    clientName: 'Морозова М.М.',
    message: 'Есть вопрос по зарплатному проекту',
    status: 'pending' as const,
    time: '09:15',
    slaRemaining: '55 мин',
  },
  {
    id: '7',
    chatName: 'АО "Бета"',
    clientName: 'Волков В.В.',
    message: 'Нужна консультация по ЕНП',
    status: 'in_progress' as const,
    time: '09:00',
    slaRemaining: '35 мин',
  },
  {
    id: '8',
    chatName: 'ООО "Гамма"',
    clientName: 'Зайцев З.З.',
    message: 'Отправьте акт сверки за год',
    status: 'resolved' as const,
    time: '08:45',
  },
];

// ============================================
// DASHBOARD CONTENT COMPONENT
// ============================================

export function DashboardContent() {
  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">
          Панель управления
        </h1>
        <p className="mt-2 text-[var(--buh-foreground-muted)]">
          Обзор показателей SLA и активности за сегодня
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {/* SLA Compliance */}
        <SlaComplianceWidget
          compliance={mockSlaData.compliance}
          compliantCount={mockSlaData.compliantCount}
          violatedCount={mockSlaData.violatedCount}
        />

        {/* Response Time */}
        <ResponseTimeWidget
          averageTime={mockResponseTimeData.averageTime}
          trend={mockResponseTimeData.trend}
          chartData={mockResponseTimeData.chartData}
        />

        {/* Violations */}
        <ViolationsWidget
          count={mockViolationsData.count}
          yesterdayCount={mockViolationsData.yesterdayCount}
        />

        {/* Active Alerts */}
        <ActiveAlertsWidget
          totalCount={mockAlertsData.totalCount}
          criticalCount={mockAlertsData.criticalCount}
          warningCount={mockAlertsData.warningCount}
          infoCount={mockAlertsData.infoCount}
          recentAlerts={mockAlertsData.recentAlerts}
        />
      </div>

      {/* Recent Requests Table */}
      <div className="mt-8">
        <RecentRequestsTable requests={mockRequestsData} />
      </div>
    </AdminLayout>
  );
}

export default DashboardContent;
