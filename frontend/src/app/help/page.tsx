'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/layout/GlassCard';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Timer,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Activity,
  Star,
  Settings,
  User,
  ListChecks,
  FileText,
  HelpCircle,
  ChevronRight,
  Search,
} from 'lucide-react';
import { documentation } from '@/config/documentation';

// ============================================
// TYPES
// ============================================

type HelpSection = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  category: 'main' | 'monitoring' | 'settings';
};

// ============================================
// HELP SECTIONS CONFIG
// ============================================

const helpSections: HelpSection[] = [
  {
    id: 'dashboard',
    title: documentation.dashboard.title,
    description: documentation.dashboard.description,
    icon: LayoutDashboard,
    href: '/dashboard',
    category: 'main',
  },
  {
    id: 'chats',
    title: documentation.chats.title,
    description: documentation.chats.description,
    icon: MessageSquare,
    href: '/chats',
    category: 'main',
  },
  {
    id: 'requests',
    title: documentation.requests.title,
    description: documentation.requests.description,
    icon: Users,
    href: '/requests',
    category: 'main',
  },
  {
    id: 'sla',
    title: documentation.sla.title,
    description: documentation.sla.description,
    icon: Timer,
    href: '/sla',
    category: 'monitoring',
  },
  {
    id: 'alerts',
    title: documentation.alerts.title,
    description: documentation.alerts.description,
    icon: AlertCircle,
    href: '/alerts',
    category: 'monitoring',
  },
  {
    id: 'violations',
    title: documentation.violations.title,
    description: documentation.violations.description,
    icon: AlertTriangle,
    href: '/violations',
    category: 'monitoring',
  },
  {
    id: 'analytics',
    title: documentation.analytics.title,
    description: documentation.analytics.description,
    icon: Activity,
    href: '/analytics',
    category: 'monitoring',
  },
  {
    id: 'feedback',
    title: documentation.feedback.title,
    description: documentation.feedback.description,
    icon: Star,
    href: '/feedback',
    category: 'monitoring',
  },
  {
    id: 'settings-profile',
    title: documentation.settings.profile.title,
    description: documentation.settings.profile.description,
    icon: User,
    href: '/settings/profile',
    category: 'settings',
  },
  {
    id: 'settings-general',
    title: documentation.settings.general.title,
    description: documentation.settings.general.description,
    icon: Settings,
    href: '/settings',
    category: 'settings',
  },
  {
    id: 'settings-users',
    title: documentation.settings.users.title,
    description: documentation.settings.users.description,
    icon: Users,
    href: '/settings/users',
    category: 'settings',
  },
  {
    id: 'settings-survey',
    title: documentation.settings.survey.title,
    description: documentation.settings.survey.description,
    icon: ListChecks,
    href: '/settings/survey',
    category: 'settings',
  },
  {
    id: 'settings-templates',
    title: documentation.settings.templates.title,
    description: documentation.settings.templates.description,
    icon: FileText,
    href: '/settings/templates',
    category: 'settings',
  },
  {
    id: 'settings-faq',
    title: documentation.settings.faq.title,
    description: documentation.settings.faq.description,
    icon: HelpCircle,
    href: '/settings/faq',
    category: 'settings',
  },
];

// ============================================
// SECTION CARD COMPONENT
// ============================================

function SectionCard({ section }: { section: HelpSection }) {
  const Icon = section.icon;

  return (
    <Link href={section.href}>
      <GlassCard
        variant="default"
        padding="lg"
        className="group h-full cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-[var(--buh-primary)]/30"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--buh-primary-muted)]">
            <Icon className="h-5 w-5 text-[var(--buh-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-[var(--buh-foreground)] group-hover:text-[var(--buh-primary)] transition-colors">
                {section.title}
              </h3>
              <ChevronRight className="h-4 w-4 text-[var(--buh-foreground-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-1 text-sm text-[var(--buh-foreground-muted)] line-clamp-2">
              {section.description}
            </p>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

// ============================================
// HELP PAGE COMPONENT
// ============================================

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredSections = React.useMemo(() => {
    if (!searchQuery.trim()) return helpSections;

    const query = searchQuery.toLowerCase();
    return helpSections.filter(
      (section) =>
        section.title.toLowerCase().includes(query) ||
        section.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const mainSections = filteredSections.filter((s) => s.category === 'main');
  const monitoringSections = filteredSections.filter((s) => s.category === 'monitoring');
  const settingsSections = filteredSections.filter((s) => s.category === 'settings');

  return (
    <AdminLayout>
      {/* Page Header */}
      <PageHeader
        title="Справка"
        description="Руководство по работе с платформой BuhBot"
        breadcrumbs={[
          { label: 'Панель управления', href: '/dashboard' },
          { label: 'Справка' },
        ]}
      />

      {/* Search */}
      <div className="mb-8 buh-animate-fade-in-up">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--buh-foreground-muted)]" />
          <input
            type="text"
            placeholder="Поиск по разделам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--buh-foreground)] placeholder:text-[var(--buh-foreground-muted)] focus:border-[var(--buh-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--buh-primary)]/20 transition-all"
          />
        </div>
      </div>

      {/* Main Sections */}
      {mainSections.length > 0 && (
        <div className="mb-8 buh-animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-lg font-semibold text-[var(--buh-foreground)] mb-4">
            Основные разделы
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mainSections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>
        </div>
      )}

      {/* Monitoring Sections */}
      {monitoringSections.length > 0 && (
        <div className="mb-8 buh-animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-lg font-semibold text-[var(--buh-foreground)] mb-4">
            Мониторинг и аналитика
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {monitoringSections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>
        </div>
      )}

      {/* Settings Sections */}
      {settingsSections.length > 0 && (
        <div className="mb-8 buh-animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <h2 className="text-lg font-semibold text-[var(--buh-foreground)] mb-4">
            Настройки
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {settingsSections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {filteredSections.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center buh-animate-fade-in-up">
          <Search className="h-12 w-12 text-[var(--buh-foreground-subtle)] mb-4" />
          <p className="text-[var(--buh-foreground)]">Ничего не найдено</p>
          <p className="text-sm text-[var(--buh-foreground-muted)]">
            Попробуйте изменить поисковый запрос
          </p>
        </div>
      )}

      {/* Quick Tips */}
      <div className="mt-8 buh-animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
        <GlassCard variant="elevated" padding="lg">
          <h3 className="text-sm font-medium text-[var(--buh-foreground)] mb-3">
            Быстрые советы
          </h3>
          <ul className="space-y-2 text-sm text-[var(--buh-foreground-muted)]">
            <li className="flex items-start gap-2">
              <span className="text-[var(--buh-primary)]">•</span>
              <span>Нажмите кнопку <strong>?</strong> на любой странице для быстрой справки</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--buh-primary)]">•</span>
              <span>Используйте <strong>Ctrl+K</strong> для быстрого поиска по системе</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--buh-primary)]">•</span>
              <span>Красный индикатор в меню показывает количество активных алертов</span>
            </li>
          </ul>
        </GlassCard>
      </div>
    </AdminLayout>
  );
}
