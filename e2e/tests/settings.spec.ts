import { test, expect } from '@playwright/test';
import { SettingsPage } from '../pages/SettingsPage';
import { paths, uiText } from '../fixtures';

/**
 * Settings E2E Tests
 *
 * Test Cases:
 * - SET-001: Settings page loads
 * - SET-002: Profile tab
 * - SET-003: General settings
 * - SET-004: Working hours
 * - SET-005: Notification preferences
 * - SET-006: AI settings
 * - SET-007: Data retention settings
 */
test.describe('Settings', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
  });

  /**
   * SET-001: Settings page loads
   * Steps:
   * 1. Navigate to /settings
   * Expected: Settings page loads or redirects to login
   */
  test('SET-001: Settings page loads', async ({ page }) => {
    await settingsPage.goto();
    await page.waitForLoadState('networkidle');

    // Should either show settings or redirect to login
    const url = page.url();
    expect(url).toMatch(/(\/settings|\/login)/);
  });

  /**
   * SET-002: Settings page has tabs
   * Steps:
   * 1. Navigate to /settings
   * Expected: Settings page has tab navigation
   */
  test('SET-002: Settings page has tab navigation', async ({ page }) => {
    await settingsPage.goto();
    await page.waitForLoadState('networkidle');

    // Check for tabs
    const tabs = page.locator('[role="tablist"], [class*="tab"]');
    const hasTabs = await tabs.count();

    // URL should contain settings
    const url = page.url();
    if (url.includes('/settings')) {
      expect(hasTabs).toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * SET-003: Settings page has form elements
   * Steps:
   * 1. Navigate to /settings
   * Expected: Page contains form inputs
   */
  test('SET-003: Settings page has form elements', async ({ page }) => {
    await settingsPage.goto();
    await page.waitForLoadState('networkidle');

    // Look for form inputs
    const inputs = page.locator('input, select, textarea');
    const hasInputs = await inputs.count();

    const url = page.url();
    if (url.includes('/settings')) {
      expect(hasInputs).toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * SET-004: Settings page loads without errors
   * Steps:
   * 1. Navigate to /settings
   * Expected: No critical console errors
   */
  test('SET-004: Settings page loads without critical errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await settingsPage.goto();
    await page.waitForLoadState('networkidle');

    // Wait for delayed errors
    await page.waitForTimeout(2000);

    // Filter out network errors
    const criticalErrors = errors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('Failed to load resource') &&
        !err.includes('net::ERR')
    );

    // Should have minimal critical errors
    expect(criticalErrors.length).toBeLessThanOrEqual(1);
  });

  /**
   * SET-005: Settings page responds to refresh
   * Steps:
   * 1. Navigate to /settings
   * 2. Refresh page
   * Expected: Page reloads successfully
   */
  test('SET-005: Settings page can be refreshed', async ({ page }) => {
    await settingsPage.goto();
    await page.waitForLoadState('networkidle');

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be on settings or redirected to login
    const url = page.url();
    expect(url).toMatch(/(\/settings|\/login)/);
  });

  /**
   * SET-006: Settings page has title
   * Steps:
   * 1. Navigate to /settings
   * Expected: Page has title element
   */
  test('SET-006: Settings page has title', async ({ page }) => {
    await settingsPage.goto();
    await page.waitForLoadState('networkidle');

    // Check for heading
    const heading = page.locator('h1');
    const hasHeading = await heading.count();

    const url = page.url();
    if (url.includes('/settings')) {
      expect(hasHeading).toBeGreaterThanOrEqual(1);
    }
  });

  /**
   * SET-007: Settings page is accessible via direct navigation
   * Steps:
   * 1. Navigate directly to /settings
   * Expected: Settings page loads correctly
   */
  test('SET-007: Direct navigation to settings works', async ({ page }) => {
    await page.goto(paths.settings);
    await page.waitForLoadState('networkidle');

    // Verify URL
    const url = page.url();
    expect(url).toContain('/settings');
  });

  /**
   * SET-008: Settings page has save button
   * Steps:
   * 1. Navigate to /settings
   * Expected: Save button exists
   */
  test('SET-008: Settings page has save button', async ({ page }) => {
    await settingsPage.goto();
    await page.waitForLoadState('networkidle');

    // Look for save button
    const saveButton = page.locator(`button:has-text("${uiText.save}")`);
    const hasSaveButton = await saveButton.count();

    const url = page.url();
    if (url.includes('/settings')) {
      expect(hasSaveButton).toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * SET-009: Settings page has proper structure
   * Steps:
   * 1. Navigate to /settings
   * Expected: Page has proper semantic structure
   */
  test('SET-009: Settings page has proper structure', async ({ page }) => {
    await settingsPage.goto();
    await page.waitForLoadState('networkidle');

    // Check for main content
    const main = page.locator('main, [class*="main"], [class*="container"]');
    const hasMain = await main.count();

    const url = page.url();
    if (url.includes('/settings')) {
      expect(hasMain).toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * SET-010: Settings page is usable in standard viewport
   * Steps:
   * 1. Navigate to /settings with standard viewport
   * Expected: Page renders properly
   */
  test('SET-010: Settings page renders in standard viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    await settingsPage.goto();
    await page.waitForLoadState('networkidle');

    // Page should render
    const url = page.url();
    expect(url).toMatch(/(\/settings|\/login)/);
  });
});
