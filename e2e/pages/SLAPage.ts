import { Page, expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * SLAPage - Page object for the SLA monitoring page
 * 
 * URL: /sla
 * Purpose: Detailed SLA compliance monitoring and analytics
 * 
 * KPI Cards:
 * 1. Соответствие SLA - Compliance percentage
 * 2. Запросов за период - Total requests
 * 3. В норме - Answered within SLA
 * 4. Нарушений - Breached SLA count
 * 
 * Table Columns:
 * - Чат (Chat)
 * - Клиент (Client)
 * - Время получения (Received time)
 * - Время ответа (Response time)
 * - SLA статус (SLA status)
 * - Бухгалтер (Accountant)
 */
export class SLAPage extends BasePage {
  // SLA-specific selectors (from E2E testing findings)
  private readonly selectors = {
    // Page elements
    pageTitle: 'h1:has-text("SLA")',
    
    // KPI cards container
    kpiCards: '.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4',
    
    // KPI cards
    complianceKpi: 'text=Соответствие SLA',
    totalRequestsKpi: 'text=Запросов за период',
    withinSlaKpi: 'text=В норме',
    violationsKpi: 'text=Нарушений',
    
    // KPI values
    kpiValue: '[class*="text"] >> text=%',
    kpiNumber: '[class*="text"] >> text=\\d+',
    
    // Charts
    complianceChart: '[aria-label*="SLA"], [aria-label*="соответствие"]',
    responseTimeChart: 'text=Время ответа',
    
    // Filters
    filtersButton: 'button:has-text("Фильтры")',
    filtersPanel: '[class*="filters"]',
    statusFilter: 'select:has-text("SLA Статус")',
    dateRangeFilter: 'input[type="date"]',
    
    // Status filter options
    statusAll: 'option:value("")',
    statusOk: 'option:has-text("В норме")',
    statusBreached: 'option:has-text("Нарушен")',
    statusPending: 'option:has-text("Ожидает")',
    
    // Requests table
    requestsTable: 'table:has-text("Чат")',
    tableHeader: 'thead th',
    tableRow: 'tbody tr',
    
    // Table columns
    chatColumn: 'td:nth-child(1)',
    clientColumn: 'td:nth-child(2)',
    receivedColumn: 'td:nth-child(3)',
    responseColumn: 'td:nth-child(4)',
    statusColumn: 'td:nth-child(5)',
    accountantColumn: 'td:nth-child(6)',
    
    // Status badges
    statusBadge: (status: string) => `text=${status}`,
    okBadge: 'text=В норме',
    breachedBadge: 'text=Нарушен',
    pendingBadge: 'text=Ожидает',
    unassignedBadge: 'text=Не назначен',
    
    // Pagination
    pagination: '[class*="pagination"]',
    prevButton: 'button:has-text("Назад")',
    nextButton: 'button:has-text("Вперёд")',
    pageInfo: 'text=Страница',
    
    // Export
    exportButton: 'button:has-text("Экспорт")',
    exportCsv: 'button:has-text("CSV")',
    exportExcel: 'button:has-text("Excel")',
  };

  constructor(page: Page, baseURL: string = '') {
    super(page, baseURL);
  }

  // Navigate to SLA page
  async goto(): Promise<void> {
    await this.navigate('/sla');
  }

  // Check if on SLA page
  async isOnPage(): Promise<boolean> {
    return this.page.url().includes('/sla');
  }

  // Get page locators
  get locators() {
    return {
      pageTitle: this.page.locator(this.selectors.pageTitle),
      kpiCards: this.page.locator(this.selectors.kpiCards),
      filtersButton: this.page.locator(this.selectors.filtersButton),
      requestsTable: this.page.locator(this.selectors.requestsTable),
      prevButton: this.page.locator(this.selectors.prevButton),
      nextButton: this.page.locator(this.selectors.nextButton),
    };
  }

  // Verify SLA page is loaded
  async verifyPageLoaded(): Promise<void> {
    await expect(this.locators.pageTitle).toBeVisible();
    await expect(this.locators.kpiCards).toBeVisible();
  }

  // Get KPI value (e.g., "95%")
  async getCompliancePercent(): Promise<string> {
    const kpi = this.page.locator(this.selectors.complianceKpi);
    const value = kpi.locator(this.selectors.kpiValue);
    return value.textContent() ?? '';
  }

  // Get total requests count
  async getTotalRequestsCount(): Promise<string> {
    const kpi = this.page.locator(this.selectors.totalRequestsKpi);
    const value = kpi.locator(this.selectors.kpiNumber);
    return value.textContent() ?? '';
  }

  // Get "within SLA" count
  async getWithinSlaCount(): Promise<string> {
    const kpi = this.page.locator(this.selectors.withinSlaKpi);
    const value = kpi.locator(this.selectors.kpiNumber);
    return value.textContent() ?? '';
  }

  // Get violations count
  async getViolationsCount(): Promise<string> {
    const kpi = this.page.locator(this.selectors.violationsKpi);
    const value = kpi.locator(this.selectors.kpiNumber);
    return value.textContent() ?? '';
  }

  // Click filters button
  async clickFilters(): Promise<void> {
    await this.locators.filtersButton.click();
  }

  // Apply status filter
  async applyStatusFilter(status: 'all' | 'ok' | 'breached' | 'pending'): Promise<void> {
    await this.clickFilters();
    
    const filterMap = {
      all: this.selectors.statusAll,
      ok: this.selectors.statusOk,
      breached: this.selectors.statusBreached,
      pending: this.selectors.statusPending,
    };
    
    await this.page.selectOption(this.selectors.statusFilter, filterMap[status]);
    await this.waitForPageLoad();
  }

  // Get table row count
  async getTableRowCount(): Promise<number> {
    const table = this.page.locator(this.selectors.requestsTable);
    const rows = table.locator('tbody tr');
    return rows.count();
  }

  // Get all table data
  async getTableData(): Promise<Array<{
    chat: string;
    client: string;
    received: string;
    response: string | null;
    status: string;
    accountant: string | null;
  }>> {
    const rows = this.page.locator(`${this.selectors.requestsTable} tbody tr`);
    const rowCount = await rows.count();
    
    const data: Array<{
      chat: string;
      client: string;
      received: string;
      response: string | null;
      status: string;
      accountant: string | null;
    }> = [];
    
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const cells = row.locator('td');
      
      const chat = await cells.nth(0).textContent() ?? '';
      const client = await cells.nth(1).textContent() ?? '';
      const received = await cells.nth(2).textContent() ?? '';
      const response = await cells.nth(3).textContent();
      const status = await cells.nth(4).textContent() ?? '';
      const accountant = await cells.nth(5).textContent();
      
      data.push({
        chat: chat.trim(),
        client: client.trim(),
        received: received.trim(),
        response: response?.trim() ?? null,
        status: status.trim(),
        accountant: accountant?.trim() ?? null,
      });
    }
    
    return data;
  }

  // Check if pagination is visible
  async isPaginationVisible(): Promise<boolean> {
    return this.locators.pagination.isVisible();
  }

  // Click next page
  async clickNextPage(): Promise<void> {
    await this.locators.nextButton.click();
    await this.waitForPageLoad();
  }

  // Click previous page
  async clickPrevPage(): Promise<void> {
    await this.locators.prevButton.click();
    await this.waitForPageLoad();
  }

  // Get current page number
  async getCurrentPage(): Promise<number> {
    const pageInfo = this.page.locator(this.selectors.pageInfo);
    const text = await pageInfo.textContent() ?? '';
    const match = text.match(/Страница (\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  // Click export button
  async clickExport(): Promise<void> {
    await this.page.locator(this.selectors.exportButton).click();
  }

  // Export to CSV
  async exportToCsv(): Promise<void> {
    await this.clickExport();
    await this.page.locator(this.selectors.exportCsv).click();
  }

  // Export to Excel
  async exportToExcel(): Promise<void> {
    await this.clickExport();
    await this.page.locator(this.selectors.exportExcel).click();
  }

  // Check if compliance chart is visible
  async isComplianceChartVisible(): Promise<boolean> {
    return this.page.locator(this.selectors.complianceChart).isVisible();
  }

  // Get all requests with specific status
  async getRequestsByStatus(status: string): Promise<string[]> {
    const statusCells = this.page.locator(`${this.selectors.statusColumn}:has-text("${status}")`);
    const count = await statusCells.count();
    
    const requests: string[] = [];
    for (let i = 0; i < count; i++) {
      const row = statusCells.nth(i).locator('..');
      const chatCell = row.locator(this.selectors.chatColumn);
      const chat = await chatCell.textContent();
      if (chat) requests.push(chat.trim());
    }
    
    return requests;
  }

  // Get unassigned requests
  async getUnassignedRequests(): Promise<string[]> {
    const unassignedCells = this.page.locator(this.selectors.unassignedBadge);
    const count = await unassignedCells.count();
    
    const requests: string[] = [];
    for (let i = 0; i < count; i++) {
      const row = unassignedCells.nth(i).locator('..');
      const chatCell = row.locator(this.selectors.chatColumn);
      const chat = await chatCell.textContent();
      if (chat) requests.push(chat.trim());
    }
    
    return requests;
  }

  // Click on a request row to view details
  async clickRequestRow(chatName: string): Promise<void> {
    const row = this.page.locator(`${this.selectors.requestsTable} tr:has-text("${chatName}")`);
    await row.click();
  }

  // Verify all KPI cards are present
  async verifyAllKPIs(): Promise<void> {
    await expect(this.page.locator(this.selectors.complianceKpi)).toBeVisible();
    await expect(this.page.locator(this.selectors.totalRequestsKpi)).toBeVisible();
    await expect(this.page.locator(this.selectors.withinSlaKpi)).toBeVisible();
    await expect(this.page.locator(this.selectors.violationsKpi)).toBeVisible();
  }

  // Verify table is present
  async verifyTablePresent(): Promise<void> {
    await expect(this.locators.requestsTable).toBeVisible();
  }

  // Get table headers
  async getTableHeaders(): Promise<string[]> {
    const headers = this.page.locator(`${this.selectors.requestsTable} ${this.selectors.tableHeader}`);
    const count = await headers.count();
    
    const headerTexts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.trim());
    }
    
    return headerTexts;
  }
}
