import { Page, Locator, expect } from '@playwright/test';

/**
 * BasePage - Base class for all page objects
 * 
 * Provides common functionality shared across all pages:
 * - Navigation helpers
 * - Element locators
 * - Common assertions
 * - Loading state handling
 */
export abstract class BasePage {
  protected page: Page;
  protected baseURL: string;
  
  // Common selectors (from E2E testing findings)
  protected readonly selectors = {
    // Navigation
    sidebar: 'aside, nav',
    menuItem: (text: string) => `nav >> text=${text}`,
    
    // Page elements
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    
    // Buttons
    primaryButton: (text: string) => `button:has-text("${text}")`,
    secondaryButton: (text: string) => `button:has-text("${text}")`,
    link: (text: string) => `a:has-text("${text}")`,
    
    // Forms
    input: (name: string) => `input[name="${name}"]`,
    select: (name: string) => `select[name="${name}"]`,
    checkbox: (name: string) => `input[type="checkbox"][name="${name}"]`,
    textArea: (name: string) => `textarea[name="${name}"]`,
    
    // Toast notifications
    toast: '[role="alert"], .toast',
    
    // Loading states
    loadingSpinner: '.animate-spin, .loader',
    
    // Tables
    table: 'table',
    tableRow: (text: string) => `tr:has-text("${text}")`,
  };

  constructor(page: Page, baseURL: string = '') {
    this.page = page;
    this.baseURL = baseURL;
  }

  // Navigation methods
  async navigate(path: string): Promise<void> {
    const url = this.baseURL ? `${this.baseURL}${path}` : path;
    await this.page.goto(url);
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle');
    
    // Wait for any loading spinners to disappear
    const spinner = this.page.locator(this.selectors.loadingSpinner);
    await spinner.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
      // Spinner may not exist, continue
    });
  }

  // Wait for URL to contain path
  async expectUrl(path: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  // Check if element is visible
  async isVisible(selector: string): Promise<boolean> {
    return this.page.locator(selector).isVisible();
  }

  // Click element with retry
  async click(selector: string): Promise<void> {
    await this.page.click(selector);
  }

  // Fill input field
  async fillInput(name: string, value: string): Promise<void> {
    await this.page.fill(this.selectors.input(name), value);
  }

  // Select option from dropdown
  async selectOption(name: string, value: string): Promise<void> {
    await this.page.selectOption(this.selectors.select(name), value);
  }

  // Toggle checkbox
  async toggleCheckbox(name: string, checked: boolean = true): Promise<void> {
    const checkbox = this.page.locator(this.selectors.checkbox(name));
    const isChecked = await checkbox.isChecked();
    
    if ((!isChecked && checked) || (isChecked && !checked)) {
      await checkbox.click();
    }
  }

  // Get text content
  async getText(selector: string): Promise<string> {
    return this.page.locator(selector).textContent() ?? '';
  }

  // Wait for toast notification
  async waitForToast(timeout: number = 5000): Promise<Locator> {
    const toast = this.page.locator(this.selectors.toast);
    await toast.waitFor({ state: 'visible', timeout });
    return toast;
  }

  // Get current page title
  async getPageTitle(): Promise<string> {
    return this.page.title();
  }

  // Get page heading (h1)
  async getPageHeading(): Promise<string> {
    return this.page.locator(this.selectors.h1).textContent() ?? '';
  }

  // Wait for element to be visible
  async waitForElement(selector: string, timeout: number = 5000): Promise<Locator> {
    return this.page.locator(selector).waitFor({ state: 'visible', timeout });
  }

  // Take screenshot
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
  }

  // Get all table rows
  async getTableRows(): Promise<Locator[]> {
    const table = this.page.locator(this.selectors.table);
    return table.locator('tr').all();
  }

  // Scroll to element
  async scrollTo(selector: string): Promise<void> {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  // Hover over element
  async hover(selector: string): Promise<void> {
    await this.page.hover(selector);
  }

  // Press keyboard key
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  // Wait for navigation after action
  async waitForNavigation(callback: () => Promise<void>): Promise<void> {
    await Promise.all([
      this.page.waitForNavigation(),
      callback(),
    ]);
  }

  // Click and wait for navigation
  async clickAndNavigate(selector: string): Promise<void> {
    await this.waitForNavigation(() => this.page.click(selector));
  }

  // Reload page
  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitForPageLoad();
  }

  // Go back
  async goBack(): Promise<void> {
    await this.page.goBack();
    await this.waitForPageLoad();
  }

  // Get current URL
  getCurrentUrl(): string {
    return this.page.url();
  }

  // Check if on expected page
  abstract isOnPage(): Promise<boolean>;
}
