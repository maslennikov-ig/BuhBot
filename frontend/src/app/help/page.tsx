'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Timer,
  AlertCircle,
  AlertTriangle,
  Activity,
  Star,
  Settings,
  User,
  ListChecks,
  FileText,
  HelpCircle,
  Search,
  Sparkles,
  TrendingUp,
  Zap,
  BookOpen,
  Target,
  Shield,
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
// CATEGORY CONFIG
// ============================================

const categoryConfig = {
  main: {
    title: 'Основные разделы',
    icon: BookOpen,
    gradient: 'from-[var(--buh-primary)] to-[var(--buh-accent)]',
    glowColor: 'var(--buh-accent-glow)',
    borderColor: 'border-[var(--buh-primary)]/20',
    iconBgLight: 'bg-[var(--buh-primary)]/10',
    iconBgDark: 'bg-[var(--buh-primary)]/20',
  },
  monitoring: {
    title: 'Мониторинг и аналитика',
    icon: TrendingUp,
    gradient: 'from-[var(--buh-accent)] to-[var(--buh-accent-secondary)]',
    glowColor: 'var(--buh-accent-secondary-glow)',
    borderColor: 'border-[var(--buh-accent)]/20',
    iconBgLight: 'bg-[var(--buh-accent)]/10',
    iconBgDark: 'bg-[var(--buh-accent)]/20',
  },
  settings: {
    title: 'Настройки',
    icon: Shield,
    gradient: 'from-[var(--buh-accent-secondary)] to-[var(--buh-primary)]',
    glowColor: 'rgba(124, 58, 237, 0.3)',
    borderColor: 'border-[var(--buh-accent-secondary)]/20',
    iconBgLight: 'bg-[var(--buh-accent-secondary)]/10',
    iconBgDark: 'bg-[var(--buh-accent-secondary)]/20',
  },
};

// ============================================
// HERO SECTION COMPONENT
// ============================================

function HeroSection({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}) {
  return (
    <div className="relative mb-16 overflow-hidden rounded-2xl buh-glass border border-[var(--buh-glass-border)]">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 buh-mesh-gradient opacity-40" />

      {/* Content */}
      <div className="relative z-10 px-8 py-16 md:px-12 md:py-20">
        {/* Icon */}
        <div
          className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)] shadow-lg buh-animate-fade-in-up"
          style={{ animationDelay: '0.1s' }}
        >
          <Sparkles className="h-8 w-8 text-white" />
        </div>

        {/* Heading */}
        <h1
          className="mb-4 text-4xl md:text-5xl font-bold text-[var(--buh-foreground)] buh-animate-fade-in-up"
          style={{ animationDelay: '0.2s' }}
        >
          Центр справки <span className="buh-text-gradient">BuhBot</span>
        </h1>

        {/* Description */}
        <p
          className="mb-8 max-w-2xl text-lg text-[var(--buh-foreground-muted)] buh-animate-fade-in-up"
          style={{ animationDelay: '0.3s' }}
        >
          Полное руководство по работе с платформой автоматизации коммуникаций для бухгалтерских
          фирм
        </p>

        {/* Search */}
        <div
          className="relative max-w-2xl buh-animate-fade-in-up"
          style={{ animationDelay: '0.4s' }}
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--buh-foreground-subtle)]" />
            <input
              type="text"
              placeholder="Найти раздел или функцию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border-2 border-[var(--buh-border)] bg-[var(--buh-surface)] py-4 pl-12 pr-4 text-base text-[var(--buh-foreground)] placeholder:text-[var(--buh-foreground-subtle)] focus:border-[var(--buh-accent)] focus:outline-none focus:ring-4 focus:ring-[var(--buh-accent-glow)] transition-all shadow-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SECTION CARD COMPONENT
// ============================================

function SectionCard({ section, index }: { section: HelpSection; index: number }) {
  const Icon = section.icon;
  const config = categoryConfig[section.category];

  return (
    <Link href={section.href}>
      <div
        className="group relative h-full buh-animate-fade-in-up"
        style={{ animationDelay: `${0.05 * index}s` }}
      >
        {/* Card */}
        <GlassCard
          variant="default"
          padding="none"
          className="relative h-full cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1"
        >
          {/* Gradient border effect on hover */}
          <div
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
            style={{
              background: `linear-gradient(135deg, ${config.glowColor}, transparent)`,
              filter: 'blur(20px)',
            }}
          />

          {/* Top gradient accent */}
          <div
            className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
          />

          <div className="p-6">
            {/* Icon with gradient background */}
            <div className="relative mb-4">
              <div
                className={`inline-flex h-14 w-14 items-center justify-center rounded-xl ${config.iconBgLight} dark:${config.iconBgDark} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}
              >
                <div
                  className={`absolute inset-0 rounded-xl bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300`}
                />
                <Icon className="relative h-7 w-7 text-[var(--buh-foreground)]" />
              </div>
            </div>

            {/* Title */}
            <h3 className="mb-2 text-lg font-semibold text-[var(--buh-foreground)] group-hover:buh-text-gradient transition-all duration-300">
              {section.title}
            </h3>

            {/* Description (full, no line-clamp) */}
            <p className="text-sm text-[var(--buh-foreground-muted)] leading-relaxed">
              {section.description}
            </p>

            {/* Arrow indicator */}
            <div className="mt-4 flex items-center text-sm font-medium text-[var(--buh-foreground-subtle)] group-hover:text-[var(--buh-accent)] transition-colors duration-300">
              <span>Подробнее</span>
              <svg
                className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </GlassCard>
      </div>
    </Link>
  );
}

// ============================================
// CATEGORY SECTION COMPONENT
// ============================================

function CategorySection({
  category,
  sections,
  delay,
}: {
  category: 'main' | 'monitoring' | 'settings';
  sections: HelpSection[];
  delay: number;
}) {
  if (sections.length === 0) return null;

  const config = categoryConfig[category];
  const CategoryIcon = config.icon;

  return (
    <div className="mb-12 buh-animate-fade-in-up" style={{ animationDelay: `${delay}s` }}>
      {/* Category Header */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.iconBgLight} dark:${config.iconBgDark}`}
        >
          <CategoryIcon className="h-5 w-5 text-[var(--buh-foreground)]" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--buh-foreground)]">{config.title}</h2>
        <div className={`ml-2 h-px flex-1 bg-gradient-to-r ${config.gradient} opacity-30`} />
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section, index) => (
          <SectionCard key={section.id} section={section} index={index} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// QUICK TIPS COMPONENT
// ============================================

function QuickTips() {
  const tips = [
    {
      icon: HelpCircle,
      text: 'Нажмите кнопку ? на любой странице для быстрой справки',
      gradient: 'from-[var(--buh-info)] to-[var(--buh-primary)]',
    },
    {
      icon: Zap,
      text: 'Используйте Ctrl+K для быстрого поиска по системе',
      gradient: 'from-[var(--buh-warning)] to-[var(--buh-accent)]',
    },
    {
      icon: Target,
      text: 'Красный индикатор в меню показывает количество активных алертов',
      gradient: 'from-[var(--buh-error)] to-[var(--buh-accent-secondary)]',
    },
  ];

  return (
    <div className="mt-16 buh-animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
      <GlassCard variant="elevated" padding="none" className="overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Быстрые советы</h3>
              <p className="text-sm text-white/80">Полезные подсказки для эффективной работы</p>
            </div>
          </div>
        </div>

        {/* Tips List */}
        <div className="divide-y divide-[var(--buh-border)]">
          {tips.map((tip, index) => {
            const TipIcon = tip.icon;
            return (
              <div
                key={index}
                className="group flex items-start gap-4 p-6 transition-colors duration-200 hover:bg-[var(--buh-surface-elevated)]"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${tip.gradient} shadow-lg`}
                >
                  <TipIcon className="h-5 w-5 text-white" />
                </div>
                <p className="flex-1 text-[var(--buh-foreground)] leading-relaxed">{tip.text}</p>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
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
      <div className="space-y-8">
        {/* Hero Section */}
        <HeroSection searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

        {/* Main Sections */}
        <CategorySection category="main" sections={mainSections} delay={0.1} />

        {/* Monitoring Sections */}
        <CategorySection category="monitoring" sections={monitoringSections} delay={0.2} />

        {/* Settings Sections */}
        <CategorySection category="settings" sections={settingsSections} delay={0.3} />

        {/* No results */}
        {filteredSections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center buh-animate-fade-in-up">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)]">
              <Search className="h-10 w-10 text-[var(--buh-foreground-subtle)]" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-[var(--buh-foreground)]">
              Ничего не найдено
            </h3>
            <p className="text-[var(--buh-foreground-muted)]">
              Попробуйте изменить поисковый запрос
            </p>
          </div>
        )}

        {/* Quick Tips */}
        {filteredSections.length > 0 && <QuickTips />}
      </div>
    </AdminLayout>
  );
}
