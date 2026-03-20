import { Page, expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * LoginPage - Page object for the login page
 *
 * URL: /login
 * Purpose: User authentication gateway
 *
 * Components:
 * - LoginForm component (@/components/auth/LoginForm)
 * - Telegram OAuth button
 * - Session token handling via Supabase Auth
 */
export class LoginPage extends BasePage {
  // Page-specific selectors
  private readonly selectors = {
    // Form elements
    loginForm: 'form',
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button[type="submit"]',

    // Telegram OAuth
    telegramButton: 'button:has-text("Telegram")',
    telegramIcon: '[class*="telegram"]',

    // Error messages
    errorMessage: '[role="alert"], .text-red',
    errorText: (text: string) => `text=${text}`,

    // Success/redirect indicators
    loadingState: '.animate-spin',

    // Links
    forgotPasswordLink: 'a:has-text("Забыли пароль")',
    registerLink: 'a:has-text("Регистрация")',
    backToSiteLink: 'a:has-text("Вернуться на сайт")',
  };

  constructor(page: Page, baseURL: string = '') {
    super(page, baseURL);
  }

  // Navigate to login page
  async goto(): Promise<void> {
    await this.navigate('/login');
  }

  // Check if on login page
  async isOnPage(): Promise<boolean> {
    return this.page.url().includes('/login');
  }

  // Get page locators
  get locators() {
    return {
      form: this.page.locator(this.selectors.loginForm),
      emailInput: this.page.locator(this.selectors.emailInput),
      passwordInput: this.page.locator(this.selectors.passwordInput),
      submitButton: this.page.locator(this.selectors.submitButton),
      telegramButton: this.page.locator(this.selectors.telegramButton),
      errorMessage: this.page.locator(this.selectors.errorMessage),
    };
  }

  // Fill login form
  async fillLoginForm(email: string, password: string): Promise<void> {
    await this.locators.emailInput.fill(email);
    await this.locators.passwordInput.fill(password);
  }

  // Submit login form
  async submitLogin(): Promise<void> {
    await this.locators.submitButton.click();
    // Wait for navigation or loading
    await this.page.waitForLoadState('networkidle');
  }

  // Login with credentials
  async login(email: string, password: string): Promise<void> {
    await this.goto();
    await this.fillLoginForm(email, password);
    await this.submitLogin();
  }

  // Click Telegram login button
  async loginWithTelegram(): Promise<void> {
    await this.locators.telegramButton.click();
    // This will redirect to Telegram OAuth
    // In test environment, we may need to handle this differently
    await this.page.waitForLoadState('networkidle');
  }

  // Get error message text
  async getErrorMessage(): Promise<string> {
    const errorLocator = this.locators.errorMessage;
    if (await errorLocator.isVisible()) {
      return errorLocator.textContent() ?? '';
    }
    return '';
  }

  // Check if login form is visible
  async isLoginFormVisible(): Promise<boolean> {
    return this.locators.form.isVisible();
  }

  // Check if Telegram button is visible
  async isTelegramButtonVisible(): Promise<boolean> {
    return this.locators.telegramButton.isVisible();
  }

  // Check if submit button is enabled
  async isSubmitEnabled(): Promise<boolean> {
    return this.locators.submitButton.isEnabled();
  }

  // Wait for redirect after login
  async waitForLoginRedirect(expectedPath: string = '/dashboard'): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(expectedPath), { timeout: 10000 });
  }

  // Get validation error for specific field
  async getFieldError(field: 'email' | 'password'): Promise<string> {
    const fieldSelector =
      field === 'email' ? this.selectors.emailInput : this.selectors.passwordInput;

    const fieldLocator = this.page.locator(fieldSelector);
    const errorLocator = fieldLocator.locator('..').locator('[role="alert"], .text-red, .error');

    if (await errorLocator.isVisible()) {
      return errorLocator.textContent() ?? '';
    }
    return '';
  }

  // Clear form
  async clearForm(): Promise<void> {
    await this.locators.emailInput.clear();
    await this.locators.passwordInput.clear();
  }

  // Submit empty form to trigger validation
  async submitEmptyForm(): Promise<void> {
    await this.locators.submitButton.click();
  }

  // Verify login page elements are present
  async verifyPageElements(): Promise<void> {
    await expect(this.locators.form).toBeVisible();
    await expect(this.locators.emailInput).toBeVisible();
    await expect(this.locators.passwordInput).toBeVisible();
    await expect(this.locators.submitButton).toBeVisible();
    await expect(this.locators.telegramButton).toBeVisible();
  }

  // Test invalid credentials
  async testInvalidLogin(): Promise<string> {
    await this.login('invalid@example.com', 'wrongpassword');
    return this.getErrorMessage();
  }
}
