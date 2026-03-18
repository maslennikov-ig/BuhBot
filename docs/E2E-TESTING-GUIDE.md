# E2E Testing Guide

Comprehensive guide for the BuhBot end-to-end testing setup using Playwright.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Writing Tests](#writing-tests)
4. [Running Tests](#running-tests)
5. [Debugging Tests](#debugging-tests)
6. [CI/CD Integration](#cicd-integration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

---

## Getting Started

### Prerequisites

Before running E2E tests, ensure you have:

- **Node.js** 20.x or later
- **pnpm** 10.x or later
- **PostgreSQL** 16.x (for local development)
- **Redis** 7.x (for queues)
- **Playwright browsers** installed

### Quick Start

1. **Navigate to the E2E directory:**

```bash
cd e2e
```

2. **Install dependencies:**

```bash
pnpm install
```

3. **Install Playwright browsers:**

```bash
pnpm run test:install
```

4. **Set up environment variables:**

```bash
cp .env.example .env
```

Edit `.env` with your test configuration. The key variables are:

```bash
# Application URLs
BASE_URL=http://localhost:3000
API_URL=http://localhost:3001

# Development mode (bypasses authentication)
DEV_MODE=true

# Test user accounts (optional - uses defaults if not set)
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=testpassword
```

5. **Start the application servers:**

```bash
# Terminal 1: Start backend
cd backend
pnpm dev

# Terminal 2: Start frontend
cd frontend
pnpm dev
```

6. **Run the tests:**

```bash
cd e2e
pnpm test
```

---

## Project Structure

```
e2e/
├── .env.example          # Environment variable template
├── playwright.config.ts  # Playwright configuration
├── package.json          # E2E dependencies and scripts
├── tsconfig.json         # TypeScript configuration
│
├── fixtures/
│   └── index.ts         # Test fixtures, user accounts, URL paths
│
├── pages/
│   ├── BasePage.ts      # Base page object with common methods
│   ├── LoginPage.ts     # Login page object
│   ├── DashboardPage.ts # Dashboard page object
│   ├── SettingsPage.ts  # Settings page object
│   └── SLAPage.ts       # SLA monitoring page object
│
└── tests/
    ├── auth.spec.ts     # Authentication tests
    ├── dashboard.spec.ts # Dashboard tests
    ├── navigation.spec.ts # Navigation tests
    └── settings.spec.ts  # Settings tests
```

### Directory Purposes

| Directory | Purpose |
|-----------|---------|
| `fixtures/` | Test data, user accounts, common selectors, URL paths |
| `pages/` | Page Object Model classes for each page |
| `tests/` | Test specifications using Playwright test runner |

### Key Files

| File | Description |
|------|-------------|
| [`playwright.config.ts`](e2e/playwright.config.ts) | Main Playwright configuration with browser settings, timeouts, and reporters |
| [`fixtures/index.ts`](e2e/fixtures/index.ts) | Test user accounts, URL paths, and custom test fixtures |
| [`pages/BasePage.ts`](e2e/pages/BasePage.ts) | Base class with common page interactions |

---

## Writing Tests

### Using Page Object Models

Page Object Models (POM) encapsulate page interactions, making tests maintainable and readable.

#### Creating a New Page Object

```typescript
// pages/MyPage.ts
import { Page, expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class MyPage extends BasePage {
  // Private selectors specific to this page
  private readonly selectors = {
    pageTitle: 'h1:has-text("My Page Title")',
    submitButton: 'button[type="submit"]',
    inputField: 'input[name="myField"]',
  };

  constructor(page: Page, baseURL: string = '') {
    super(page, baseURL);
  }

  // Navigate to the page
  async goto(): Promise<void> {
    await this.navigate('/my-page');
  }

  // Check if on the correct page
  async isOnPage(): Promise<boolean> {
    return this.page.url().includes('/my-page');
  }

  // Get locators for external use
  get locators() {
    return {
      submitButton: this.page.locator(this.selectors.submitButton),
      inputField: this.page.locator(this.selectors.inputField),
    };
  }

  // Page-specific actions
  async submitForm(): Promise<void> {
    await this.locators.submitButton.click();
    await this.waitForPageLoad();
  }
}
```

#### Using Page Objects in Tests

```typescript
// tests/my-page.spec.ts
import { test, expect } from '@playwright/test';
import { MyPage } from '../pages/MyPage';

test.describe('My Feature', () => {
  let myPage: MyPage;

  test.beforeEach(async ({ page }) => {
    myPage = new MyPage(page);
  });

  test('MyPage-001: Form submission works', async ({ page }) => {
    await myPage.goto();
    
    // Use page object methods
    await myPage.locators.inputField.fill('test value');
    await myPage.submitForm();
    
    // Verify outcome
    await expect(page).toHaveURL('/success');
  });
});
```

### Writing Maintainable Selectors

#### Selector Priority (Best to Worst)

1. **Test IDs** (most reliable)
   ```html
   <button data-testid="submit-button">Submit</button>
   ```
   ```typescript
   page.getByTestId('submit-button')
   ```

2. **Semantic queries**
   ```typescript
   page.getByRole('button', { name: 'Submit' })
   page.getByLabel('Email')
   page.getByPlaceholder('Enter email')
   ```

3. **Text content**
   ```typescript
   page.getByText('Submit')
   page.locator('button:has-text("Submit")')
   ```

4. **CSS selectors** (use when necessary)
   ```typescript
   page.locator('#submit-button')
   page.locator('.btn-primary')
   ```

#### Selector Best Practices

```typescript
// ✅ Good: Descriptive, stable selectors
private readonly selectors = {
  // Use semantic queries
  submitButton: 'button[type="submit"]',
  emailInput: 'input[name="email"]',
  
  // Use text for buttons
  loginButton: 'button:has-text("Войти")',
  
  // Parameterized selectors
  menuItem: (text: string) => `nav >> text=${text}`,
  
  // Partial text matching
  statusBadge: 'text=В норме',
};

// ❌ Avoid: Fragile selectors
private readonly badSelectors = {
  // Nested classes that may change
  widget: '.grid.grid-cols-2 .widget-container .content',
  
  // Indices (unreliable)
  firstButton: 'button:nth-child(1)',
  
  // Deep DOM paths
  deeplyNested: 'div > section > div:nth-child(2) > article > p',
};
```

### Handling Async Operations

Playwright handles most async operations automatically, but certain patterns require attention:

#### Waiting for Page Load

```typescript
// ✅ Good: Wait for network idle
async goto(): Promise<void> {
  await this.navigate('/page');
  await this.page.waitForLoadState('networkidle');
}

// ✅ Good: Wait for specific element
async waitForDashboard(): Promise<void> {
  await expect(this.dashboardTitle).toBeVisible();
}
```

#### Waiting for API Calls

```typescript
// Wait for API response
await page.waitForResponse(
  response => response.url().includes('/api/data') && response.status() === 200
);

// Or wait for specific network idle
await page.waitForLoadState('networkidle');
```

#### Waiting for Animations

```typescript
// Wait for spinner to disappear
const spinner = page.locator('.animate-spin');
await spinner.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

// Wait for element to be stable
await page.locator('.widget').waitFor({ state: 'attached' });
```

### Test Data Management

#### Using Fixtures

The [`fixtures/index.ts`](e2e/fixtures/index.ts) provides test data:

```typescript
import { testUsers, testChatConfigs, paths, uiText } from '../fixtures';

// Access test users
const admin = testUsers.admin;
const manager = testUsers.manager;

// Access URL paths
await page.goto(paths.dashboard);

// Access UI text constants
const saveButton = page.locator(`button:has-text("${uiText.save}")`);
```

#### Creating Test Data

```typescript
// In your test or fixture
test('Create and verify new chat', async ({ page }) => {
  // Create data via API (if available)
  // Or use UI to create data
  
  const testChat = {
    name: `Test Chat ${Date.now()}`,
    slaEnabled: true,
    slaThreshold: 60,
  };
  
  // Use test data in your test
  await createChat(testChat);
});
```

### Test Isolation

Each test should be independent and not rely on the state from other tests.

```typescript
// ✅ Good: Each test sets up its own state
test('Dashboard shows correct metrics', async ({ page }) => {
  // Set up any required state for this specific test
  await setupTestData();
  
  // Run test
  await page.goto('/dashboard');
  // ... assertions
});

// ✅ Good: Use test.describe.configure for serial tests
test.describe.configure({ mode: 'serial' });

test('Auth flow 1', async ({ page }) => {
  // Login flow
});

test('Auth flow 2', async ({ page }) => {
  // Logout flow - runs after auth flow 1
});
```

#### Authenticated Tests

```typescript
// Using the custom authenticatedPage fixture
test('Dashboard loads for authenticated user', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage.locator('h1')).toContainText('Панель');
});

// Or manually authenticate
test('Login and access dashboard', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login('admin@test.com', 'password');
  
  // Now authenticated
  await page.goto('/dashboard');
});
```

---

## Running Tests

### Available Commands

| Command | Description |
|---------|-------------|
| `pnpm test` | Run all tests in headless mode |
| `pnpm test:headed` | Run tests with browser visible |
| `pnpm test:ui` | Run tests with Playwright UI |
| `pnpm test:debug` | Run tests in debug mode |
| `pnpm test:report` | Open HTML test report |
| `pnpm test:install` | Install Playwright browsers |

### Running Specific Tests

#### Run a Specific Test File

```bash
npx playwright test tests/auth.spec.ts
```

#### Run Tests Matching a Pattern

```bash
# Run tests with "auth" in the name
npx playwright test --grep "auth"

# Run tests with "AUTH-001" in the name
npx playwright test --grep "AUTH-001"
```

#### Run Tests in a Specific Browser

```bash
# Chromium only
npx playwright test --browser=chromium

# Firefox only
npx playwright test --browser=firefox

# WebKit only
npx playwright test --browser=webkit
```

#### Run Tests with Specific Configuration

```bash
# Override base URL
BASE_URL=http://staging.example.com pnpm test

# Run with more retries
npx playwright test --retries=3

# Run with single worker
npx playwright test --workers=1
```

### Development Mode

For development, use the UI mode which provides:

- Visual test selection
- Live reloading
- Time travel debugging

```bash
pnpm test:ui
```

### Headed Mode

To see the browser while tests run:

```bash
pnpm test:headed
```

---

## Debugging Tests

### Using Playwright Inspector

Start debug mode to step through tests:

```bash
npx playwright test --debug
```

This opens the Playwright inspector where you can:
- Step through each action
- Inspect the DOM
- View console logs
- Take screenshots

### Viewing Trace Files

Playwright captures traces on test failures. To view them:

```bash
# Open the HTML report
npx playwright show-report

# Click on a failed test
# Look for "View Trace" button
```

#### Programmatic Trace Viewing

```typescript
// In your test, add:
await page.tracing.start({ screenshots: true, snapshots: true });
// ... your test actions
await page.tracing.stop();
// Trace is saved to trace.zip
```

### Screenshots and Videos

Screenshots are automatically captured on test failures:

```bash
# View failure screenshots
ls test-results/
```

To capture screenshots manually:

```typescript
// Take a screenshot
await page.screenshot({ path: 'debug.png', fullPage: true });

// Take screenshot of specific element
await page.locator('.widget').screenshot({ path: 'widget.png' });
```

Videos are recorded on CI failures (configurable in `playwright.config.ts`):

```typescript
// In playwright.config.ts
use: {
  video: process.env.CI ? 'on-first-retry' : 'off',
}
```

### Console Logs

#### Capturing Console Output

```typescript
test('Debug console output', async ({ page }) => {
  const logs: string[] = [];
  const errors: string[] = [];

  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('/dashboard');
  
  // View logs
  console.log('Console logs:', logs);
  console.log('Errors:', errors);
});
```

#### Filtering Console Errors

```typescript
// Filter out known non-critical errors
const criticalErrors = errors.filter(err => 
  !err.includes('favicon') && 
  !err.includes('Failed to load resource') &&
  !err.includes('net::ERR')
);
```

### Using expect Assertions

Playwright's `expect` provides detailed failure messages:

```typescript
// ✅ Good: Clear assertion
await expect(page.locator('.error')).toBeVisible();

// ❌ Avoid: Vague assertion
const isVisible = await page.locator('.error').isVisible();
```

---

## CI/CD Integration

### GitHub Actions Workflows

The project includes two workflows:

1. **E2E Tests** (`e2e-tests.yml`) - Runs on every push to main and PRs
2. **E2E Nightly** (`e2e-nightly.yml`) - Runs nightly at 2:00 AM UTC

### Main Workflow Triggers

The E2E test workflow runs on:

- **Push** to `main` branch
- **Pull request** to `main` branch
- **Manual trigger** via `workflow_dispatch`

```yaml
# .github/workflows/e2e-tests.yml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      test_tag:
        description: 'Run tests matching tag (optional)'
        required: false
        type: string
```

### Nightly Tests

The nightly workflow:

- Runs every night at 2:00 AM UTC
- Can be triggered manually with different options
- Tests across all browsers (Chromium, Firefox, WebKit)

```yaml
# .github/workflows/e2e-nightly.yml
on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:
    inputs:
      test_suite:
        description: 'Test suite to run'
        options:
          - full
          - auth
          - dashboard
          - chats
          - sla
          - settings
      browser:
        description: 'Browser to use'
        options:
          - chromium
          - firefox
          - webkit
          - all
```

### Viewing Test Results

#### GitHub Actions

1. Go to your repository on GitHub
2. Navigate to **Actions** tab
3. Select the workflow run
4. View test results in the summary

#### Downloading Artifacts

On workflow failure, artifacts are uploaded:

1. **Test Results** - `e2e-test-results/`
   - HTML report (`playwright-report/`)
   - Test traces
   - Server logs

2. **Failure Screenshots** - `e2e-failure-screenshots/`
   - PNG screenshots of failures

```bash
# Download artifacts using GitHub CLI
gh run download <run-id> --name "e2e-test-results"
```

### CI Environment Variables

The CI workflow sets:

```bash
# Application
BASE_URL=http://localhost:3000
API_URL=http://localhost:3001
DEV_MODE=true

# Test
TEST_USER_EMAIL=admin@buhbot.local
PLAYWRIGHT_RETRIES=2
```

---

## Best Practices

### Test Naming Conventions

Use descriptive, consistent naming:

```typescript
// Format: TEST-ID: Test description
test('AUTH-001: Landing page login redirect', async ({ page }) => {});
test('DASH-001: Dashboard widgets load correctly', async ({ page }) => {});
test('SET-001: Settings page loads', async ({ page }) => {});
```

### Test Organization

```typescript
// Group related tests
test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Setup for each test
  });

  test('AUTH-001: Login page loads', async ({ page }) => {});
  test('AUTH-002: Invalid credentials show error', async ({ page }) => {});
  
  // Serial tests for dependent flows
  test.describe.configure({ mode: 'serial' });
  test('AUTH-003: Full login flow', async ({ page }) => {});
  test('AUTH-004: Logout works', async ({ page }) => {});
});
```

### Avoiding Flaky Tests

1. **Wait for elements properly**
   ```typescript
   // ✅ Good: Wait for element
   await expect(page.locator('.widget')).toBeVisible();
   
   // ❌ Avoid: Race conditions
   await page.waitForTimeout(1000); // Unreliable
   ```

2. **Handle dynamic content**
   ```typescript
   // ✅ Good: Wait for network
   await page.waitForLoadState('networkidle');
   
   // ✅ Good: Wait for specific response
   await page.waitForResponse(response => response.status() === 200);
   ```

3. **Use retry mechanisms wisely**
   ```typescript
   // Configure retries in playwright.config.ts
   retries: process.env.CI ? 3 : 3,
   ```

4. **Avoid timing dependencies**
   ```typescript
   // ✅ Good: State-based assertion
   await expect(page.locator('.loaded')).toBeVisible();
   
   // ❌ Avoid: Time-based
   await page.waitForTimeout(2000);
   ```

### Performance Considerations

1. **Run tests in parallel**
   ```typescript
   // In playwright.config.ts
   fullyParallel: true,
   workers: process.env.CI ? 4 : undefined,
   ```

2. **Use serial mode only when needed**
   ```typescript
   // Only for tests that share state
   test.describe.configure({ mode: 'serial' });
   ```

3. **Optimize selectors**
   ```typescript
   // ✅ Fast: ID-based
   page.locator('#submit-button');
   
   // ❌ Slow: Deep DOM traversal
   page.locator('div > section > article > button');
   ```

### Security - Handling Credentials

**Never commit real credentials!**

1. **Use environment variables**
   ```typescript
   // ✅ Good: Environment variable
   const password = process.env.TEST_PASSWORD;
   
   // ❌ Bad: Hardcoded
   const password = 'realPassword123';
   ```

2. **Use secrets in CI**
   ```yaml
   # GitHub Actions
   env:
     TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
   ```

3. **Mask sensitive output**
   ```typescript
   // Don't log passwords
   console.log('Login failed'); // ✅
   console.log(`Password was: ${password}`); // ❌
   ```

---

## Troubleshooting

### Timeout Issues

#### "Timeout exceeded" Errors

```bash
# Increase timeout via CLI
npx playwright test --timeout=60000

# Or in playwright.config.ts
timeout: 60 * 1000,  // 60 seconds
```

#### Common Timeout Causes

1. **Slow page load**
   ```typescript
   // Increase navigation timeout
   await page.goto('/page', { timeout: 60000 });
   ```

2. **Slow API responses**
   ```typescript
   // Wait for specific response
   await page.waitForResponse(
     resp => resp.url().includes('/api') && resp.status() === 200,
     { timeout: 30000 }
   );
   ```

3. **Element not appearing**
   ```typescript
   // Wait for element
   await page.locator('.element').waitFor({ timeout: 10000 });
   ```

### Browser Installation Problems

#### "Browser not found" Error

```bash
# Reinstall browsers
npx playwright install --with-deps chromium

# Or install all browsers
npx playwright install
```

#### "Permission denied" on Linux

```bash
# Install dependencies
sudo apt-get install -y \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2
```

### Environment Setup Issues

#### "Cannot connect to server"

1. **Check if servers are running**
   ```bash
   # Check ports
   lsof -i :3000  # Frontend
   lsof -i :3001  # Backend
   ```

2. **Verify environment variables**
   ```bash
   # Check .env file exists and has correct values
   cat .env
   ```

3. **Check database connection**
   ```bash
   # Test PostgreSQL
   psql -U buhbot -d buhbot_test -c "SELECT 1;"
   
   # Test Redis
   redis-cli ping
   ```

### Test Flakiness

#### "Test passes sometimes, fails sometimes"

1. **Check for race conditions**
   ```typescript
   // Add explicit waits
   await page.waitForLoadState('networkidle');
   await expect(element).toBeVisible();
   ```

2. **Check for shared state**
   ```typescript
   // Use unique data per test
   const uniqueEmail = `test-${Date.now()}@example.com`;
   ```

3. **Run with more retries**
   ```bash
   npx playwright test --retries=3
   ```

4. **Check for timing issues**
   ```typescript
   // Wait for animations
   await page.waitForTimeout(500);
   ```

#### "Element not found" on Retry

This often happens when selectors change between runs. Update selectors to be more robust:

```typescript
// ❌ Fragile: Exact class match
page.locator('.grid.grid-cols-2.widget')

// ✅ Stable: Flexible matching
page.locator('[class*="grid"]').filter({ hasText: 'Widget' })
```

---

## Maintenance

### Updating Selectors When UI Changes

When the UI changes, update selectors in the appropriate Page Object:

1. **Find the failing test**
2. **Identify the page**
3. **Update the selector in the Page Object**

```typescript
// pages/DashboardPage.ts

// Before (old selector)
private readonly selectors = {
  pageTitle: 'h1.title',  // Old class
};

// After (new selector)
private readonly selectors = {
  pageTitle: 'h1:has-text("Панель")',  // New stable selector
};
```

### Adding New Page Objects

1. **Create the page object file**

```typescript
// pages/NewPage.ts
import { Page, expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class NewPage extends BasePage {
  private readonly selectors = {
    // Add selectors here
  };

  constructor(page: Page, baseURL: string = '') {
    super(page, baseURL);
  }

  async goto(): Promise<void> {
    await this.navigate('/new-page');
  }

  async isOnPage(): Promise<boolean> {
    return this.page.url().includes('/new-page');
  }
}
```

2. **Add to fixtures if needed**

```typescript
// fixtures/index.ts
export const paths = {
  // Add new path
  newPage: '/new-page',
};
```

3. **Create test file**

```typescript
// tests/new-page.spec.ts
import { test, expect } from '@playwright/test';
import { NewPage } from '../pages/NewPage';

test.describe('New Feature', () => {
  let newPage: NewPage;

  test.beforeEach(async ({ page }) => {
    newPage = new NewPage(page);
  });

  test('NEW-001: Page loads', async ({ page }) => {
    await newPage.goto();
    await expect(page).toHaveURL(/new-page/);
  });
});
```

### Keeping Tests Up to Date

1. **Review test results regularly**
   - Check for warnings
   - Look for deprecated selectors

2. **Update selectors proactively**
   - When UI changes, update immediately
   - Don't wait for tests to fail

3. **Add new tests for new features**
   - Follow naming conventions
   - Use Page Objects

### Test Coverage Guidelines

**Focus on:**

1. **Critical paths**
   - Login/Authentication
   - Dashboard loading
   - Key user workflows

2. **High-value tests**
   - SLA monitoring
   - Alert generation
   - Settings persistence

3. **Regression coverage**
   - Common user actions
   - Navigation flows
   - Form submissions

**Don't over-test:**
- Every variation of a button
- Edge cases that never happen
- Internal implementation details

---

## Quick Reference

### Common Commands

```bash
# Run all tests
pnpm test

# Run with UI
pnpm test:ui

# Run specific file
npx playwright test tests/auth.spec.ts

# Run with grep
npx playwright test --grep "auth"

# Open report
pnpm test:report

# Install browsers
pnpm test:install
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | Frontend URL |
| `API_URL` | `http://localhost:3001` | Backend API URL |
| `DEV_MODE` | `false` | Bypass authentication |
| `CI` | `false` | Running in CI mode |

### File Locations

| Purpose | File |
|---------|------|
| Configuration | `e2e/playwright.config.ts` |
| Test Fixtures | `e2e/fixtures/index.ts` |
| Page Objects | `e2e/pages/*.ts` |
| Tests | `e2e/tests/*.spec.ts` |
| Test Results | `e2e/test-results/` |
| HTML Report | `e2e/playwright-report/` |

---

## Additional Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright API Reference](https://playwright.dev/docs/api/class-page)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [CI Integration](https://playwright.dev/docs/ci)
