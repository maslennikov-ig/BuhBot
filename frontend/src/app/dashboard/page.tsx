import type { Metadata } from 'next';
import { DashboardContent } from './dashboard-content';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Панель управления | BuhBot',
  description: 'Панель управления BuhBot - мониторинг SLA и статистика обращений клиентов',
  openGraph: {
    title: 'Панель управления | BuhBot',
    description: 'Панель управления BuhBot - мониторинг SLA и статистика обращений клиентов',
    type: 'website',
  },
};

// ============================================
// PAGE COMPONENT
// ============================================

export default function DashboardPage() {
  return <DashboardContent />;
}
