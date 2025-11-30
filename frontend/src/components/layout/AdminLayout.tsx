'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Timer,
  BarChart3,
  Settings,
  Bell,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  User,
  Star,
  ListChecks,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { ProfileMenu } from '@/components/ProfileMenu';
import { NotificationPopover } from '@/components/layout/NotificationPopover';
import { SearchInput } from '@/components/ui/SearchInput';

// ============================================
// TYPES
// ============================================

type NavItem = {
  id: string;
  label: string;
  labelRu: string;
  icon: React.ElementType;
  href: string;
  badge?: string | number;
};

type AdminLayoutProps = {
  children: React.ReactNode;
};

// ============================================
// NAVIGATION CONFIG
// ============================================

const navigationItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    labelRu: 'Панель управления',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    id: 'requests',
    label: 'Requests',
    labelRu: 'Запросы',
    icon: MessageSquare,
    href: '/requests',
  },
  {
    id: 'chats',
    label: 'Chats',
    labelRu: 'Чаты',
    icon: Users,
    href: '/chats',
  },
  {
    id: 'sla',
    label: 'SLA Monitor',
    labelRu: 'SLA Мониторинг',
    icon: Timer,
    href: '/sla',
  },
  {
    id: 'alerts',
    label: 'Alerts',
    labelRu: 'Алерты',
    icon: AlertCircle,
    href: '/alerts',
  },
  {
    id: 'reports',
    label: 'Reports',
    labelRu: 'Отчеты',
    icon: BarChart3,
    href: '/reports',
  },
  {
    id: 'settings',
    label: 'Settings',
    labelRu: 'Настройки',
    icon: Settings,
    href: '/settings',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    labelRu: 'Обратная связь',
    icon: Star,
    href: '/feedback',
  },
  {
    id: 'survey',
    label: 'Survey',
    labelRu: 'Опросы',
    icon: ListChecks,
    href: '/settings/survey',
  },
];

// ============================================
// SIDEBAR COMPONENT
// ============================================

function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  alertCount,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  alertCount?: number;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col bg-[var(--buh-sidebar-background)] border-r border-[var(--buh-sidebar-border)]',
          'transition-all duration-300 ease-out',
          collapsed ? 'w-[72px]' : 'w-[260px]',
          // Mobile styles
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo Section */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-[var(--buh-border)]">
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center gap-3 transition-opacity duration-200',
              collapsed && 'lg:justify-center'
            )}
          >
            {/* Logo Icon */}
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)] shadow-lg">
              <span className="text-lg font-bold text-white">B</span>
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-50 blur-lg" />
            </div>

            {/* Logo Text */}
            {!collapsed && (
              <span className="text-xl font-bold tracking-tight text-[var(--buh-foreground)]">
                Buh<span className="gradient-text">Bot</span>
              </span>
            )}
          </Link>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 buh-scrollbar">
          <ul className="space-y-1">
            {navigationItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              // Dynamic badge for alerts
              const badge = item.id === 'alerts' && alertCount && alertCount > 0
                ? alertCount > 99 ? '99+' : alertCount.toString()
                : item.badge;

              return (
                <li
                  key={item.id}
                  className="buh-animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <Link
                    href={item.href}
                    onClick={onCloseMobile}
                    className={cn(
                      'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                      'transition-all duration-200',
                      collapsed && 'lg:justify-center lg:px-0',
                      isActive
                        ? 'bg-[var(--buh-primary-muted)] text-[var(--buh-primary)]'
                        : 'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]'
                    )}
                    title={collapsed ? item.labelRu : undefined}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-[var(--buh-accent)] to-[var(--buh-primary)]" />
                    )}

                    <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-[var(--buh-primary)]')} />

                    {!collapsed && (
                      <>
                        <span className="truncate">{item.labelRu}</span>

                        {/* Badge */}
                        {badge && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--buh-accent)] px-1.5 text-xs font-semibold text-white">
                            {badge}
                          </span>
                        )}
                      </>
                    )}

                    {/* Collapsed badge */}
                    {collapsed && badge && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--buh-accent)] px-1 text-[10px] font-semibold text-white">
                        {badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse Toggle (Desktop only) */}
        <div className="hidden border-t border-[var(--buh-border)] p-3 lg:block">
          <button
            onClick={onToggleCollapse}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
              'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]',
              'transition-all duration-200',
              collapsed && 'justify-center px-0'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span>Свернуть</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

// ============================================
// HEADER COMPONENT
// ============================================

function Header({
  sidebarCollapsed,
  onToggleMobileSidebar,
  userEmail,
}: {
  sidebarCollapsed: boolean;
  onToggleMobileSidebar: () => void;
  userEmail: string | null;
}) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by only rendering the toggle icon after mount
  // Or better yet, assume a default and update. But next-themes handles this via resolvedTheme mostly.
  // However, for the icon rendering, we want to be sure.

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--buh-border)]',
        'bg-[var(--buh-header-background)] backdrop-blur-xl',
        'px-4 lg:px-6',
        'transition-[margin] duration-300',
        sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'
      )}
    >
      {/* Mobile menu button */}
      <button
        onClick={onToggleMobileSidebar}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="flex-1">
        <SearchInput
          placeholder="Поиск..."
          className="max-w-md"
          enableShortcut={true}
          showShortcutHint={true}
          autoFocusOnShortcut={true}
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface-elevated)] hover:text-[var(--buh-foreground)]',
            'transition-all duration-200'
          )}
          aria-label="Toggle theme"
        >
           {mounted ? (
            resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />
          ) : (
            <div className="h-5 w-5" /> // Placeholder to avoid mismatch
          )}
        </button>

        {/* Notifications */}
        <NotificationPopover />

        {/* User menu */}
        <div className="relative ml-2">
          <ProfileMenu email={userEmail} />
        </div>
      </div>
    </header>
  );
}

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';

// ============================================
// MAIN LAYOUT COMPONENT
// ============================================

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  // Check onboarding status
  const { data: userProfile } = trpc.auth.me.useQuery(undefined, {
    enabled: isAuthorized,
    retry: false,
  });

  // Fetch active alerts count for badge
  const { data: alertCountData } = trpc.alert.getActiveAlertCount.useQuery(undefined, {
    enabled: isAuthorized,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  React.useEffect(() => {
    if (userProfile && userProfile.isOnboardingComplete === false) {
      router.push('/onboarding');
    }
  }, [userProfile, router]);

  // Check authentication
  React.useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setIsAuthorized(true);
        setUserEmail(session.user.email ?? null);
      }
    };
    checkAuth();
  }, [router]);

  // Handle escape key to close mobile sidebar
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  React.useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileSidebarOpen]);

  if (!isAuthorized) {
    return null; // Or a loading spinner
  }

  return (
    <div className="min-h-screen bg-[var(--buh-background)]">
      {/* Aurora background effect */}
      <div className="buh-aurora fixed inset-0 pointer-events-none" aria-hidden="true" />

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        alertCount={alertCountData?.count}
      />

      {/* Main content area */}
      <div
        className={cn(
          'flex min-h-screen flex-col',
          'transition-[margin] duration-300',
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'
        )}
      >
        {/* Header */}
        <Header
          sidebarCollapsed={sidebarCollapsed}
          onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
          userEmail={userEmail}
        />

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl buh-stagger">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-[var(--buh-border)] bg-[var(--buh-surface)] px-4 py-3 lg:px-6">
          <p className="text-center text-sm text-[var(--buh-foreground-subtle)]">
            &copy; {new Date().getFullYear()} BuhBot. Все права защищены. &middot; v0.4.0
          </p>
        </footer>
      </div>
    </div>
  );
}

// ============================================
// EXPORTED LAYOUT WITH THEME PROVIDER
// ============================================

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AdminLayoutContent>{children}</AdminLayoutContent>
  );
}

export default AdminLayout;
