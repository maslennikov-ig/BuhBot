import { test as base, Page, Locator } from '@playwright/test';

/**
 * Custom test fixtures for BuhBot E2E tests
 *
 * This file provides:
 * - Test user accounts (admin, manager, accountant)
 * - Test chat configurations
 * - Custom test context with authentication helpers
 */

// Test user accounts
export interface TestUser {
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'accountant';
  telegramId?: string;
  telegramUsername?: string;
}

export const testUsers: Record<string, TestUser> = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'testpassword',
    role: 'admin',
    telegramId: process.env.TEST_ADMIN_TELEGRAM_ID || '166848328',
  },
  manager: {
    email: process.env.TEST_MANAGER_EMAIL || 'manager@test.com',
    password: process.env.TEST_MANAGER_PASSWORD || 'testpassword',
    role: 'manager',
    telegramId: process.env.TEST_MANAGER_TELEGRAM_ID || '123456789',
  },
  accountant: {
    email: process.env.TEST_ACCOUNTANT_EMAIL || 'accountant@test.com',
    password: process.env.TEST_ACCOUNTANT_PASSWORD || 'testpassword',
    role: 'accountant',
    telegramUsername: process.env.TEST_ACCOUNTANT_USERNAME || 'test_accountant',
  },
};

// Test chat configurations
export interface TestChatConfig {
  chatId: string;
  slaEnabled: boolean;
  slaThresholdMinutes: number;
  managerTelegramIds: string[];
  accountantUsernames: string[];
}

export const testChatConfigs: Record<string, TestChatConfig> = {
  default: {
    chatId: '-5069248865',
    slaEnabled: true,
    slaThresholdMinutes: 60,
    managerTelegramIds: ['166848328'],
    accountantUsernames: ['maslennikovig'],
  },
  slaTest: {
    chatId: '-4993859421',
    slaEnabled: true,
    slaThresholdMinutes: 60,
    managerTelegramIds: ['166848328'],
    accountantUsernames: [],
  },
};

// Settings tab types
export type SettingsTab = 'profile' | 'general' | 'schedule' | 'notifications' | 'ai' | 'retention';

// Page URL paths
export const paths = {
  landing: '/',
  login: '/login',
  dashboard: '/dashboard',
  chats: '/chats',
  requests: '/requests',
  violations: '/violations',
  sla: '/sla',
  analytics: '/analytics',
  alerts: '/alerts',
  settings: '/settings',
};

// Common UI text selectors (from E2E testing findings)
export const uiText = {
  // Navigation
  dashboard: 'Панель',
  chats: 'Чаты',
  requests: 'Запросы',
  violations: 'Нарушения',
  sla: 'SLA мониторинг',
  analytics: 'Аналитика',
  alerts: 'Оповещения',
  settings: 'Настройки',

  // Dashboard widgets
  slaCompliance: 'Соответствие SLA',
  activeAlerts: 'Активные алерты',
  responseTime: 'Среднее время ответа',
  violationsToday: 'Нарушения сегодня',
  recentRequests: 'Последние запросы',

  // Settings tabs
  profileTab: 'Профиль',
  generalTab: 'Основные',
  scheduleTab: 'Расписание',
  notificationsTab: 'Уведомления',
  aiTab: 'AI',
  retentionTab: 'Хранение',

  // Buttons
  save: 'Сохранить',
  cancel: 'Отмена',
  login: 'Войти',
  logout: 'Выйти',

  // Status
  statusOk: 'В норме',
  statusBreached: 'Нарушен',
  statusPending: 'Ожидает',
};

// Extend Playwright test with custom fixtures
export interface CustomFixtures {
  authenticatedPage: Page;
  testUser: TestUser;
}

// Helper function to get environment variables
export function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// Authenticate user via Telegram (simplified for E2E)
async function authenticateUser(page: Page, user: TestUser): Promise<void> {
  // Navigate to login page
  await page.goto(paths.login);

  // Click Telegram login button (this would redirect to OAuth in real flow)
  const telegramButton = page.locator('button:has-text("Telegram")');

  if (await telegramButton.isVisible()) {
    await telegramButton.click();
    // In a real scenario, this would handle the OAuth flow
    // For testing, we might need to mock the session
  }
}

// Create authenticated page fixture
export const test = base.extend<CustomFixtures>({
  testUser: [testUsers.admin, { option: true }],

  authenticatedPage: async ({ page, testUser }, use) => {
    // Navigate to login
    await page.goto(paths.login);

    // Check if already authenticated (session exists)
    const currentUrl = page.url();

    if (!currentUrl.includes('/login')) {
      // User is already authenticated
      await use(page);
      return;
    }

    // Try to authenticate
    await authenticateUser(page, testUser);

    // Wait for navigation to dashboard or home
    await page.waitForURL(/(\/dashboard|\/)$/, { timeout: 10000 }).catch(() => {
      // If authentication fails, continue anyway for non-auth tests
      console.log('Authentication may have failed, continuing...');
    });

    await use(page);
  },
});

// Export common locators factory
export function createPageLocators(page: Page) {
  return {
    // Navigation
    sidebar: page.locator('aside, nav'),
    menuItem: (text: string) => page.locator(`nav >> text=${text}`),

    // Common elements
    h1: page.locator('h1'),
    h2: page.locator('h2'),
    button: (text: string) => page.locator(`button:has-text("${text}")`),
    link: (text: string) => page.locator(`a:has-text("${text}")`),

    // Forms
    input: (name: string) => page.locator(`input[name="${name}"]`),
    select: (name: string) => page.locator(`select[name="${name}"]`),
    checkbox: (name: string) => page.locator(`input[type="checkbox"][name="${name}"]`),

    // Toast notifications
    toast: page.locator('[role="alert"], .toast'),

    // Loading states
    loadingSpinner: page.locator('.animate-spin, .loader'),

    // Tables
    table: page.locator('table'),
    tableRow: (text: string) => page.locator(`tr:has-text("${text}")`),
  };
}
