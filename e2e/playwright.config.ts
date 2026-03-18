import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for BuhBot
 *
 * Configuration includes:
 * - Test directory: ./tests
 * - Base URL: http://localhost:3000
 * - Headless mode for CI, headed for dev
 * - Screenshot on failure
 * - Trace on retry
 * - 3 retries for flaky tests
 * - Workers: 1 for serial auth tests, 4 for parallel tests
 */
export default defineConfig({
  // Test directory
  testDir: './tests',

  // Test matching patterns
  testMatch: '**/*.spec.ts',

  // Fully parallel by default, but auth tests will use different worker settings
  fullyParallel: true,

  // Fail only on CI (prevent accidental test.only in production)
  forbidOnly: !!process.env.CI,

  // Number of retries for flaky tests
  retries: process.env.CI ? 3 : 3,

  // Number of parallel workers
  // Auth tests should run serially (workers: 1)
  // Other tests can run in parallel (workers: 4)
  workers: process.env.CI ? 4 : undefined,

  // Reporter configuration
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  // Global test timeout
  timeout: 30 * 1000,

  // Expect timeout
  expect: {
    timeout: 5000,
  },

  // Use configuration
  use: {
    // Base URL for all tests
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Collect trace on first retry of each test
    trace: 'on-first-retry',

    // Take screenshot only on failure
    screenshot: 'only-on-failure',

    // Video on retry for CI
    video: process.env.CI ? 'on-first-retry' : 'off',

    // Action timeout
    actionTimeout: 10 * 1000,

    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },

  // Project configurations
  projects: [
    // Chromium (Desktop Chrome)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },

    // Firefox (Desktop Firefox)
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },

    // WebKit (Desktop Safari)
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Local configuration overrides via environment
  defineConfig,
});
