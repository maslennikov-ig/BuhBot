import { Page, expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * SettingsPage - Page object for the settings page
 *
 * URL: /settings
 * Purpose: User and system configuration
 *
 * Tabs Available:
 * - Profile (profile)
 * - General & Bot (general)
 * - Schedule & SLA (schedule)
 * - Notifications (notifications)
 * - AI Classification (ai)
 * - Data Retention (retention)
 *
 * Settings Components:
 * - GeneralSettingsForm - Bot and company settings
 * - WorkingHoursForm - Business hours configuration
 * - HolidayCalendar - Holiday schedule
 * - NotificationSettingsForm - Alert preferences
 * - ProfileSettingsForm - User profile management
 * - ClassificationSettingsForm - AI classification settings
 * - DataRetentionSettingsForm - Data retention policies
 * - SlaManagerSettingsForm - SLA manager configuration
 */
export class SettingsPage extends BasePage {
  // Settings-specific selectors (from E2E testing findings)
  private readonly selectors = {
    // Page elements
    pageTitle: 'h1:has-text("Настройки")',

    // Tabs
    tabList: '[role="tablist"]',
    profileTab: 'button:has-text("Профиль")',
    generalTab: 'button:has-text("Основные")',
    scheduleTab: 'button:has-text("Расписание")',
    notificationsTab: 'button:has-text("Уведомления")',
    aiTab: 'button:has-text("AI")',
    retentionTab: 'button:has-text("Хранение")',

    // Tab panels
    profilePanel: '[role="tabpanel"]:has-text("Профиль")',
    generalPanel: '[role="tabpanel"]:has-text("Основные")',
    schedulePanel: '[role="tabpanel"]:has-text("Расписание")',
    notificationsPanel: '[role="tabpanel"]:has-text("Уведомления")',
    aiPanel: '[role="tabpanel"]:has-text("AI")',
    retentionPanel: '[role="tabpanel"]:has-text("Хранение")',

    // Form elements (common)
    saveButton: 'button:has-text("Сохранить")',
    cancelButton: 'button:has-text("Отмена")',
    formInput: (id: string) => `input[id*="${id}"]`,
    formSelect: (id: string) => `select[id*="${id}"]`,
    formCheckbox: (id: string) => `input[type="checkbox"][id*="${id}"]`,

    // Profile form
    nameInput: 'input[id*="name"]',
    emailInput: 'input[id*="email"]',
    telegramInput: 'input[id*="telegram"]',

    // General settings form
    companyNameInput: 'input[id*="company"]',
    botNameInput: 'input[id*="bot"]',
    timezoneSelect: 'select[id*="timezone"]',

    // Working hours form
    workStartSelect: 'select[id*="workStart"]',
    workEndSelect: 'select[id*="workEnd"]',
    workdaySelect: 'select[id*="workday"]',

    // Notification settings
    emailNotificationToggle: 'input[id*="emailNotify"]',
    telegramNotificationToggle: 'input[id*="telegramNotify"]',
    slaWarningToggle: 'input[id*="slaWarning"]',
    slaBreachToggle: 'input[id*="slaBreach"]',

    // AI settings
    modelSelect: 'select[id*="model"]',
    temperatureInput: 'input[id*="temperature"]',
    classificationToggle: 'input[id*="classification"]',

    // Data retention
    retentionDaysInput: 'input[id*="retention"]',

    // Toast notification
    successToast: '[role="alert"]:has-text("Сохранено"), [role="alert"]:has-text("успешно")',
    errorToast: '[role="alert"]:has-text("Ошибка")',
  };

  constructor(page: Page, baseURL: string = '') {
    super(page, baseURL);
  }

  // Navigate to settings
  async goto(): Promise<void> {
    await this.navigate('/settings');
  }

  // Check if on settings page
  async isOnPage(): Promise<boolean> {
    return this.page.url().includes('/settings');
  }

  // Get page locators
  get locators() {
    return {
      pageTitle: this.page.locator(this.selectors.pageTitle),
      tabList: this.page.locator(this.selectors.tabList),
      profileTab: this.page.locator(this.selectors.profileTab),
      generalTab: this.page.locator(this.selectors.generalTab),
      scheduleTab: this.page.locator(this.selectors.scheduleTab),
      notificationsTab: this.page.locator(this.selectors.notificationsTab),
      aiTab: this.page.locator(this.selectors.aiTab),
      retentionTab: this.page.locator(this.selectors.retentionTab),
      saveButton: this.page.locator(this.selectors.saveButton),
    };
  }

  // Verify settings page is loaded
  async verifyPageLoaded(): Promise<void> {
    await expect(this.locators.pageTitle).toBeVisible();
    await expect(this.locators.tabList).toBeVisible();
  }

  // Click on profile tab
  async clickProfileTab(): Promise<void> {
    await this.locators.profileTab.click();
    await this.waitForPageLoad();
  }

  // Click on general tab
  async clickGeneralTab(): Promise<void> {
    await this.locators.generalTab.click();
    await this.waitForPageLoad();
  }

  // Click on schedule tab
  async clickScheduleTab(): Promise<void> {
    await this.locators.scheduleTab.click();
    await this.waitForPageLoad();
  }

  // Click on notifications tab
  async clickNotificationsTab(): Promise<void> {
    await this.locators.notificationsTab.click();
    await this.waitForPageLoad();
  }

  // Click on AI tab
  async clickAITab(): Promise<void> {
    await this.locators.aiTab.click();
    await this.waitForPageLoad();
  }

  // Click on retention tab
  async clickRetentionTab(): Promise<void> {
    await this.locators.retentionTab.click();
    await this.waitForPageLoad();
  }

  // Switch to tab by name
  async switchToTab(
    tabName: 'profile' | 'general' | 'schedule' | 'notifications' | 'ai' | 'retention'
  ): Promise<void> {
    const tabMap = {
      profile: this.selectors.profileTab,
      general: this.selectors.generalTab,
      schedule: this.selectors.scheduleTab,
      notifications: this.selectors.notificationsTab,
      ai: this.selectors.aiTab,
      retention: this.selectors.retentionTab,
    };

    await this.page.locator(tabMap[tabName]).click();
    await this.waitForPageLoad();
  }

  // Fill profile form
  async fillProfileForm(data: { name?: string; email?: string }): Promise<void> {
    if (data.name) {
      await this.page.fill(this.selectors.nameInput, data.name);
    }
    if (data.email) {
      await this.page.fill(this.selectors.emailInput, data.email);
    }
  }

  // Fill general settings form
  async fillGeneralForm(data: {
    companyName?: string;
    botName?: string;
    timezone?: string;
  }): Promise<void> {
    if (data.companyName) {
      await this.page.fill(this.selectors.companyNameInput, data.companyName);
    }
    if (data.botName) {
      await this.page.fill(this.selectors.botNameInput, data.botName);
    }
    if (data.timezone) {
      await this.page.selectOption(this.selectors.timezoneSelect, data.timezone);
    }
  }

  // Fill working hours
  async fillWorkingHours(data: {
    start?: string;
    end?: string;
    workDays?: string[];
  }): Promise<void> {
    if (data.start) {
      await this.page.selectOption(this.selectors.workStartSelect, data.start);
    }
    if (data.end) {
      await this.page.selectOption(this.selectors.workEndSelect, data.end);
    }
  }

  // Toggle notification settings
  async toggleNotification(
    setting: 'email' | 'telegram' | 'slaWarning' | 'slaBreach',
    enabled: boolean = true
  ): Promise<void> {
    const toggleMap = {
      email: this.selectors.emailNotificationToggle,
      telegram: this.selectors.telegramNotificationToggle,
      slaWarning: this.selectors.slaWarningToggle,
      slaBreach: this.selectors.slaBreachToggle,
    };

    const toggle = this.page.locator(toggleMap[setting]);
    const isChecked = await toggle.isChecked();

    if ((!isChecked && enabled) || (isChecked && !enabled)) {
      await toggle.click();
    }
  }

  // Fill AI settings
  async fillAISettings(data: { model?: string; temperature?: number }): Promise<void> {
    if (data.model) {
      await this.page.selectOption(this.selectors.modelSelect, data.model);
    }
    if (data.temperature !== undefined) {
      await this.page.fill(this.selectors.temperatureInput, data.temperature.toString());
    }
  }

  // Fill data retention settings
  async fillRetentionSettings(days: number): Promise<void> {
    await this.page.fill(this.selectors.retentionDaysInput, days.toString());
  }

  // Click save button
  async clickSave(): Promise<void> {
    await this.locators.saveButton.click();
    await this.waitForPageLoad();
  }

  // Save settings and wait for success toast
  async saveSettings(): Promise<boolean> {
    await this.clickSave();

    // Wait for toast
    try {
      const toast = this.page.locator(this.selectors.successToast);
      await toast.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  // Get error message if save failed
  async getSaveError(): Promise<string> {
    try {
      const errorToast = this.page.locator(this.selectors.errorToast);
      await errorToast.waitFor({ state: 'visible', timeout: 3000 });
      return errorToast.textContent() ?? '';
    } catch {
      return '';
    }
  }

  // Get all available tabs
  async getAvailableTabs(): Promise<string[]> {
    const tabs = this.page.locator('[role="tab"]');
    const count = await tabs.count();

    const tabNames: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await tabs.nth(i).textContent();
      if (text) tabNames.push(text.trim());
    }
    return tabNames;
  }

  // Verify tab is active
  async verifyTabActive(tabName: string): Promise<boolean> {
    const tab = this.page.locator(
      `button[role="tab"][aria-selected="true"]:has-text("${tabName}")`
    );
    return tab.isVisible();
  }

  // Check if form has unsaved changes (cancel button visible)
  async hasUnsavedChanges(): Promise<boolean> {
    return this.page.locator(this.selectors.cancelButton).isVisible();
  }

  // Discard changes by clicking cancel
  async discardChanges(): Promise<void> {
    await this.page.locator(this.selectors.cancelButton).click();
    await this.waitForPageLoad();
  }

  // Get current profile data
  async getProfileData(): Promise<{ name: string; email: string; telegram: string }> {
    await this.clickProfileTab();

    const name = await this.page.inputValue(this.selectors.nameInput);
    const email = await this.page.inputValue(this.selectors.emailInput);
    const telegram = await this.page.inputValue(this.selectors.telegramInput);

    return { name, email, telegram };
  }

  // Add holiday to calendar
  async addHoliday(date: string): Promise<void> {
    const holidayInput = this.page.locator('input[type="date"]');
    await holidayInput.fill(date);
    await this.page.keyboard.press('Enter');
  }

  // Remove holiday from calendar
  async removeHoliday(date: string): Promise<void> {
    const holidayChip = this.page.locator(`.chip:has-text("${date}")`);
    await holidayChip.locator('button').click();
  }
}
