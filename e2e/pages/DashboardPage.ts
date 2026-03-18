import { Page, expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * DashboardPage - Page object for the dashboard page
 *
 * URL: /dashboard
 * Purpose: Main dashboard showing SLA metrics and recent activity
 *
 * Dashboard Widgets:
 * 1. SlaComplianceWidget - Shows compliance percentage, compliant count, violated count
 * 2. ActiveAlertsWidget - Shows total, critical, warning, info alerts
 * 3. ResponseTimeWidget - Average response time with trend chart
 * 4. ViolationsWidget - Today's violations with 7-day chart
 * 5. RecentRequestsTable - Table with chat name, client, message, status, SLA remaining
 */
export class DashboardPage extends BasePage {
  // Dashboard-specific selectors (from E2E testing findings)
  private readonly selectors = {
    // Page elements
    pageTitle: 'h1:has-text("Панель управления")',
    widgetsContainer: '.grid.grid-cols-1.md\\:grid-cols-2',

    // Widgets
    slaComplianceWidget: 'text=Соответствие SLA',
    activeAlertsWidget: 'text=Активные алерты',
    responseTimeWidget: 'text=Среднее время ответа',
    violationsWidget: 'text=Нарушения сегодня',
    recentRequestsTable: 'table:has-text("Последние запросы")',

    // Widget values (dynamic content)
    compliancePercent: '[class*="text"] >> text=%',
    alertCount: '[class*="alert"] >> text=\\d+',
    responseTime: '[class*="time"] >> text=\\d+',
    violationsCount: '[class*="violation"] >> text=\\d+',

    // Recent requests table columns
    requestsTable: 'table',
    requestRow: (chatName: string) => `tr:has-text("${chatName}")`,
    chatColumn: 'td:nth-child(1)',
    clientColumn: 'td:nth-child(2)',
    messageColumn: 'td:nth-child(3)',
    statusColumn: 'td:nth-child(4)',
    slaColumn: 'td:nth-child(5)',

    // Help button
    helpButton: 'button:has-text("?")',

    // Real-time indicators
    lastUpdated: 'text=Обновлено',
    loadingState: '.animate-spin',

    // Sidebar (for navigation)
    sidebar: 'aside',
    dashboardMenuItem: 'nav >> text=Панель',
    chatsMenuItem: 'nav >> text=Чаты',
    requestsMenuItem: 'nav >> text=Запросы',
    violationsMenuItem: 'nav >> text=Нарушения',
    slaMenuItem: 'nav >> text=SLA',
    analyticsMenuItem: 'nav >> text=Аналитика',
    alertsMenuItem: 'nav >> text=Оповещения',
    settingsMenuItem: 'nav >> text=Настройки',
  };

  constructor(page: Page, baseURL: string = '') {
    super(page, baseURL);
  }

  // Navigate to dashboard
  async goto(): Promise<void> {
    await this.navigate('/dashboard');
  }

  // Check if on dashboard page
  async isOnPage(): Promise<boolean> {
    return this.page.url().includes('/dashboard');
  }

  // Get page locators
  get locators() {
    return {
      pageTitle: this.page.locator(this.selectors.pageTitle),
      widgetsContainer: this.page.locator(this.selectors.widgetsContainer),
      slaComplianceWidget: this.page.locator(this.selectors.slaComplianceWidget),
      activeAlertsWidget: this.page.locator(this.selectors.activeAlertsWidget),
      responseTimeWidget: this.page.locator(this.selectors.responseTimeWidget),
      violationsWidget: this.page.locator(this.selectors.violationsWidget),
      recentRequestsTable: this.page.locator(this.selectors.recentRequestsTable),
      helpButton: this.page.locator(this.selectors.helpButton),
    };
  }

  // Verify dashboard page is loaded
  async verifyPageLoaded(): Promise<void> {
    await expect(this.locators.pageTitle).toBeVisible();
    await expect(this.locators.widgetsContainer).toBeVisible();
  }

  // Check if SLA compliance widget is visible
  async isSlaComplianceWidgetVisible(): Promise<boolean> {
    return this.locators.slaComplianceWidget.isVisible();
  }

  // Check if active alerts widget is visible
  async isActiveAlertsWidgetVisible(): Promise<boolean> {
    return this.locators.activeAlertsWidget.isVisible();
  }

  // Check if response time widget is visible
  async isResponseTimeWidgetVisible(): Promise<boolean> {
    return this.locators.responseTimeWidget.isVisible();
  }

  // Check if violations widget is visible
  async isViolationsWidgetVisible(): Promise<boolean> {
    return this.locators.violationsWidget.isVisible();
  }

  // Check if recent requests table is visible
  async isRecentRequestsTableVisible(): Promise<boolean> {
    return this.locators.recentRequestsTable.isVisible();
  }

  // Get all widgets
  async getWidgets(): Promise<Locator[]> {
    const container = this.page.locator(this.selectors.widgetsContainer);
    return container.locator('> div').all();
  }

  // Get recent requests count
  async getRecentRequestsCount(): Promise<number> {
    const table = this.page.locator(this.selectors.requestsTable);
    const rows = table.locator('tr');
    // Subtract header row
    const count = await rows.count();
    return count > 0 ? count - 1 : 0;
  }

  // Get SLA compliance percentage
  async getSlaCompliancePercent(): Promise<string> {
    const widget = this.page.locator(this.selectors.slaComplianceWidget);
    const percentLocator = widget.locator('[class*="text"]').first();
    return percentLocator.textContent() ?? '';
  }

  // Get active alerts count
  async getActiveAlertsCount(): Promise<string> {
    const widget = this.page.locator(this.selectors.activeAlertsWidget);
    const countLocator = widget.locator('[class*="count"], [class*="number"]').first();
    return countLocator.textContent() ?? '';
  }

  // Get response time value
  async getResponseTime(): Promise<string> {
    const widget = this.page.locator(this.selectors.responseTimeWidget);
    const timeLocator = widget.locator('[class*="time"]').first();
    return timeLocator.textContent() ?? '';
  }

  // Get violations count for today
  async getViolationsCount(): Promise<string> {
    const widget = this.page.locator(this.selectors.violationsWidget);
    const countLocator = widget.locator('[class*="count"], [class*="number"]').first();
    return countLocator.textContent() ?? '';
  }

  // Click help button
  async clickHelpButton(): Promise<void> {
    await this.locators.helpButton.click();
  }

  // Navigate via sidebar - Dashboard
  async navigateToDashboard(): Promise<void> {
    await this.page.locator(this.selectors.dashboardMenuItem).click();
    await this.waitForPageLoad();
  }

  // Navigate via sidebar - Chats
  async navigateToChats(): Promise<void> {
    await this.page.locator(this.selectors.chatsMenuItem).click();
    await this.waitForPageLoad();
  }

  // Navigate via sidebar - Requests
  async navigateToRequests(): Promise<void> {
    await this.page.locator(this.selectors.requestsMenuItem).click();
    await this.waitForPageLoad();
  }

  // Navigate via sidebar - Violations
  async navigateToViolations(): Promise<void> {
    await this.page.locator(this.selectors.violationsMenuItem).click();
    await this.waitForPageLoad();
  }

  // Navigate via sidebar - SLA
  async navigateToSLA(): Promise<void> {
    await this.page.locator(this.selectors.slaMenuItem).click();
    await this.waitForPageLoad();
  }

  // Navigate via sidebar - Analytics
  async navigateToAnalytics(): Promise<void> {
    await this.page.locator(this.selectors.analyticsMenuItem).click();
    await this.waitForPageLoad();
  }

  // Navigate via sidebar - Alerts
  async navigateToAlerts(): Promise<void> {
    await this.page.locator(this.selectors.alertsMenuItem).click();
    await this.waitForPageLoad();
  }

  // Navigate via sidebar - Settings
  async navigateToSettings(): Promise<void> {
    await this.page.locator(this.selectors.settingsMenuItem).click();
    await this.waitForPageLoad();
  }

  // Wait for real-time update (polls every 30 seconds)
  async waitForDataRefresh(timeout: number = 35000): Promise<void> {
    await this.page.waitForTimeout(timeout);
  }

  // Verify all widgets are present
  async verifyAllWidgets(): Promise<void> {
    await expect(this.locators.slaComplianceWidget).toBeVisible();
    await expect(this.locators.activeAlertsWidget).toBeVisible();
    await expect(this.locators.responseTimeWidget).toBeVisible();
    await expect(this.locators.violationsWidget).toBeVisible();
    await expect(this.locators.recentRequestsTable).toBeVisible();
  }

  // Get request row by chat name
  getRequestRow(chatName: string): Locator {
    return this.page.locator(this.selectors.requestRow(chatName));
  }

  // Verify request is in table
  async verifyRequestInTable(chatName: string): Promise<boolean> {
    const row = this.getRequestRow(chatName);
    return row.isVisible();
  }

  // Get sidebar menu items
  async getSidebarMenuItems(): Promise<string[]> {
    const sidebar = this.page.locator(this.selectors.sidebar);
    const menuItems = sidebar.locator('a, button');
    const count = await menuItems.count();

    const items: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await menuItems.nth(i).textContent();
      if (text) items.push(text.trim());
    }
    return items;
  }
}
