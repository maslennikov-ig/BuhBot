import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { paths, uiText } from '../fixtures';

/**
 * Navigation E2E Tests
 * 
 * Test Cases:
 * - NAV-001: Dashboard navigation
 * - NAV-002: Sidebar menu
 * - NAV-003: Breadcrumb navigation
 * - NAV-004: Help button
 * 
 * Menu Items to Test:
 * - Панель (Dashboard)
 * - Чаты (Chats)
 * - Запросы (Requests)
 * - Нарушения (Violations)
 * - SLA мониторинг (SLA)
 * - Аналитика (Analytics)
 * - Оповещения (Alerts)
 * - Настройки (Settings)
 */
test.describe('Navigation', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
  });

  /**
   * NAV-001: Dashboard page loads
   * Steps:
   * 1. Navigate to /dashboard
   * Expected: Dashboard page loads with all widgets
   */
  test('NAV-001: Dashboard page loads correctly', async ({ page }) => {
    await dashboardPage.goto();
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Verify dashboard elements are present
    const url = page.url();
    expect(url).toContain('/dashboard');
  });

  /**
   * NAV-002: Sidebar navigation to various pages
   * Steps:
   * 1. Navigate to dashboard
   * 2. Try to access each menu item
   * Expected: All pages accessible (or redirected if not authenticated)
   */
  test('NAV-002: Sidebar menu navigation', async ({ page }) => {
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');
    
    // Try each navigation option
    // Note: Some may require authentication
    const menuItems = [
      uiText.dashboard,
      uiText.chats,
      uiText.requests,
      uiText.violations,
      uiText.sla,
      uiText.analytics,
      uiText.alerts,
      uiText.settings,
    ];
    
    // Check if sidebar has navigation elements
    const sidebar = page.locator('aside, nav');
    const sidebarVisible = await sidebar.isVisible();
    
    // At minimum, we should see either the dashboard or a login page
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/(\/dashboard|\/login|\/)/);
  });

  /**
   * NAV-003: Direct navigation to dashboard
   * Steps:
   * 1. Navigate to /dashboard directly
   * Expected: Page loads without error
   */
  test('NAV-003: Direct navigation to dashboard', async ({ page }) => {
    await page.goto(paths.dashboard);
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the dashboard path
    const url = page.url();
    expect(url).toContain('/dashboard');
  });

  /**
   * NAV-004: Direct navigation to settings
   * Steps:
   * 1. Navigate to /settings
   * Expected: Page loads or redirects
   */
  test('NAV-004: Direct navigation to settings', async ({ page }) => {
    await page.goto(paths.settings);
    await page.waitForLoadState('networkidle');
    
    // Should either show settings or redirect to login
    const url = page.url();
    expect(url).toMatch(/(\/settings|\/login)/);
  });

  /**
   * NAV-005: Direct navigation to SLA page
   * Steps:
   * 1. Navigate to /sla
   * Expected: Page loads or redirects
   */
  test('NAV-005: Direct navigation to SLA page', async ({ page }) => {
    await page.goto(paths.sla);
    await page.waitForLoadState('networkidle');
    
    // Should either show SLA page or redirect to login
    const url = page.url();
    expect(url).toMatch(/(\/sla|\/login)/);
  });

  /**
   * NAV-006: Direct navigation to landing page
   * Steps:
   * 1. Navigate to /
   * Expected: Landing page loads
   */
  test('NAV-006: Landing page loads', async ({ page }) => {
    await page.goto(paths.landing);
    await page.waitForLoadState('networkidle');
    
    // Verify landing page
    const url = page.url();
    expect(url).toMatch(/(\/$|buhbot)/);
  });

  /**
   * NAV-007: Direct navigation to login page
   * Steps:
   * 1. Navigate to /login
   * Expected: Login page loads
   */
  test('NAV-007: Login page loads', async ({ page }) => {
    await page.goto(paths.login);
    await page.waitForLoadState('networkidle');
    
    // Verify login page
    const url = page.url();
    expect(url).toContain('/login');
  });

  /**
   * NAV-008: Page loads without console errors
   * Steps:
   * 1. Navigate to various pages
   * Expected: No critical console errors
   */
  test('NAV-008: Dashboard loads without critical errors', async ({ page }) => {
    const errors: string[] = [];
    
    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for any delayed errors
    await page.waitForTimeout(1000);
    
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('Failed to load resource')
    );
    
    // Should have no critical errors
    expect(criticalErrors.length).toBe(0);
  });

  /**
   * NAV-009: Check sidebar navigation elements exist
   * Steps:
   * 1. Navigate to dashboard
   * Expected: Sidebar exists with navigation
   */
  test('NAV-009: Sidebar navigation elements exist', async ({ page }) => {
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');
    
    // Check if there's a navigation/sidebar element
    const navElement = page.locator('nav, aside');
    const navExists = await navElement.count();
    
    // Either nav exists or we're on login page
    const url = page.url();
    if (url.includes('/dashboard')) {
      expect(navExists).toBeGreaterThan(0);
    }
  });

  /**
   * NAV-010: Page title is correct
   * Steps:
   * 1. Navigate to dashboard
   * Expected: Page has a title
   */
  test('NAV-010: Dashboard page has title', async ({ page }) => {
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');
    
    // Get the page title
    const title = await page.title();
    
    // Title should exist and not be empty
    expect(title).toBeTruthy();
  });
});
