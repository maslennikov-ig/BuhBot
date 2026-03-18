# E2E Testing Findings Document

**Date:** March 18, 2026  
**Version:** 1.0  
**Purpose:** Comprehensive compilation of manual testing results for Playwright E2E test implementation

---

## 1. Executive Summary

This document compiles all manual testing results conducted on the BuhBot application across multiple testing sessions from December 2025 to March 2026. The testing covered critical user paths including authentication, dashboard functionality, SLA monitoring, chat management, and settings configuration.

### Testing Scope

| Category | Status | Coverage |
|----------|--------|----------|
| Authentication | ✅ PASS | Login, session management, Telegram OAuth |
| Dashboard | ✅ PASS | All widgets, real-time data, navigation |
| Chat Management | ✅ PASS | List, filters, settings, message display |
| SLA System | ✅ PASS | Violations, monitoring, notifications |
| Settings | ✅ PASS | Profile, general, schedule, notifications |
| Telegram Integration | ✅ PASS | Bot commands, responses, alerts |

### Key Findings

- All critical paths tested successfully on production environment
- Accountant username assignment fix verified working
- SLA breach notifications delivered correctly
- UI overlay issues from previous versions resolved

---

## 2. Pages Tested

### 2.1 Landing Page (`/`)

**URL:** `https://buhbot.aidevteam.ru/`

**Purpose:** Marketing landing page for potential clients

| Test Case | Expected Result | Status |
|-----------|----------------|--------|
| Page loads | All sections visible without errors | ✅ PASS |
| Navigation links | All internal links functional | ✅ PASS |
| Contact form | Form renders and validates | ✅ PASS |
| Responsive design | Layout adapts to mobile/tablet | ✅ PASS |

**Sections Verified:**
- Hero section with tagline
- Pain points section
- Features showcase
- How it works section
- Benefits section
- Testimonials
- Contact form
- Footer with links

---

### 2.2 Login Page (`/login`)

**URL:** `https://buhbot.aidevteam.ru/login`

**Purpose:** User authentication gateway

| Test Case | Expected Result | Status |
|-----------|----------------|--------|
| Login form renders | All input fields visible | ✅ PASS |
| Telegram login button | Redirects to Telegram OAuth | ✅ PASS |
| Session preservation | User stays logged in on refresh | ✅ PASS |
| Error handling | Invalid credentials show error message | ✅ PASS |

**Components:**
- `LoginForm` component (`@/components/auth/LoginForm`)
- Telegram OAuth button
- Session token handling via Supabase Auth

---

### 2.3 Dashboard (`/dashboard`)

**URL:** `https://buhbot.aidevteam.ru/dashboard`

**Purpose:** Main dashboard showing SLA metrics and recent activity

| Test Case | Expected Result | Status |
|-----------|----------------|--------|
| Dashboard loads | All widgets render correctly | ✅ PASS |
| SLA Compliance widget | Shows percentage with visual indicator | ✅ PASS |
| Active Alerts widget | Shows alert count with severity breakdown | ✅ PASS |
| Response Time widget | Shows average time with trend | ✅ PASS |
| Violations Today widget | Shows today's violation count | ✅ PASS |
| Recent Requests table | Last 10 requests displayed | ✅ PASS |
| Real-time polling | Data updates every 30 seconds | ✅ PASS |

**Dashboard Widgets:**
1. **SlaComplianceWidget** - Shows compliance percentage, compliant count, violated count
2. **ActiveAlertsWidget** - Shows total, critical, warning, info alerts
3. **ResponseTimeWidget** - Average response time with trend chart
4. **ViolationsWidget** - Today's violations with 7-day chart
5. **RecentRequestsTable** - Table with chat name, client, message, status, SLA remaining

**Key Selectors:**
```typescript
// Page elements
page.locator('h1:has-text("Панель управления")')  // Page title
page.locator('.grid.grid-cols-1.md\\:grid-cols-2')  // Widgets container
page.locator('table')  // Recent requests table

// Widget-specific
page.locator('text=Соответствие SLA')  // SLA widget
page.locator('text=Активные алерты')  // Alerts widget
page.locator('text=Среднее время ответа')  // Response time widget
page.locator('text=Нарушения сегодня')  // Violations widget
```

---

### 2.4 Settings (`/settings`)

**URL:** `https://buhbot.aidevteam.ru/settings`

**Purpose:** User and system configuration

**Tabs Available:**
- Profile (`profile`)
- General & Bot (`general`)
- Schedule & SLA (`schedule`)
- Notifications (`notifications`)
- AI Classification (`ai`)
- Data Retention (`retention`)

| Test Case | Expected Result | Status |
|-----------|----------------|--------|
| Settings page loads | All tabs render correctly | ✅ PASS |
| Profile tab | User info editable | ✅ PASS |
| General settings | Bot configuration editable | ✅ PASS |
| Working hours | Schedule configuration works | ✅ PASS |
| Notification settings | Alert preferences saved | ✅ PASS |
| Save confirmation | Toast message appears | ✅ PASS |

**Settings Components:**
- `GeneralSettingsForm` - Bot and company settings
- `WorkingHoursForm` - Business hours configuration
- `HolidayCalendar` - Holiday schedule
- `NotificationSettingsForm` - Alert preferences
- `ProfileSettingsForm` - User profile management
- `ClassificationSettingsForm` - AI classification settings
- `DataRetentionSettingsForm` - Data retention policies
- `SlaManagerSettingsForm` - SLA manager configuration

---

### 2.5 SLA Monitoring (`/sla`)

**URL:** `https://buhbot.aidevteam.ru/sla`

**Purpose:** Detailed SLA compliance monitoring and analytics

| Test Case | Expected Result | Status |
|-----------|----------------|--------|
| Page loads | KPI cards render | ✅ PASS |
| Compliance chart | Radial chart shows percentage | ✅ PASS |
| Response time stats | Average, median, P95 displayed | ✅ PASS |
| Filters | Status filter works | ✅ PASS |
| Requests table | Data loads with sorting | ✅ PASS |
| Pagination | Navigation works | ✅ PASS |

**KPI Cards:**
1. **Соответствие SLA** - Compliance percentage
2. **Запросов за период** - Total requests
3. **В норме** - Answered within SLA
4. **Нарушений** - Breached SLA count

**Table Columns:**
- Чат (Chat)
- Клиент (Client)
- Время получения (Received time)
- Время ответа (Response time)
- SLA статус (SLA status)
- Бухгалтер (Accountant)

---

## 3. Test Scenarios by Category

### 3.1 Authentication Tests

| Test ID | Test Name | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| AUTH-001 | Landing page login redirect | 1. Visit `/`<br>2. Click login | Redirect to `/login` with session preserved |
| AUTH-002 | Telegram OAuth flow | 1. Click Telegram login<br>2. Authorize in Telegram | User redirected to dashboard |
| AUTH-003 | Session persistence | 1. Login<br>2. Refresh page | User remains authenticated |
| AUTH-004 | Unauthorized access | 1. Visit protected page without login | Redirect to login |
| AUTH-005 | Role-based access | 1. Login as accountant<br>2. Visit admin pages | Access denied for restricted areas |

**Playwright Implementation Example:**
```typescript
test('AUTH-001: Landing page login redirect', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Войти');
  await expect(page).toHaveURL('/login');
});
```

---

### 3.2 Navigation Tests

| Test ID | Test Name | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| NAV-001 | Dashboard navigation | 1. Click dashboard in sidebar | Dashboard page loads |
| NAV-002 | Sidebar menu | 1. Click each menu item | All pages accessible |
| NAV-003 | Breadcrumb navigation | 1. Click breadcrumb links | Navigate correctly |
| NAV-004 | Help button | 1. Click help button | Help modal opens |

**Menu Items to Test:**
- Панель (Dashboard)
- Чаты (Chats)
- Запросы (Requests)
- Нарушения (Violations)
- SLA мониторинг (SLA)
- Аналитика (Analytics)
- Оповещения (Alerts)
- Настройки (Settings)

---

### 3.3 Form Validation Tests

| Test ID | Test Name | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| FORM-001 | Required fields | 1. Submit empty form | Validation errors shown |
| FORM-002 | Input length limits | 1. Enter very long text | Truncated or error shown |
| FORM-003 | Email validation | 1. Enter invalid email | Error message displayed |
| FORM-004 | Number inputs | 1. Enter non-numeric in number field | Input rejected |
| FORM-005 | Save success | 1. Fill valid form<br>2. Click save | Success toast appears |

---

### 3.4 Settings Management Tests

| Test ID | Test Name | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SET-001 | Profile update | 1. Change name<br>2. Save | Name updated |
| SET-002 | Working hours | 1. Set schedule<br>2. Save | Schedule saved |
| SET-003 | Notification preferences | 1. Toggle notifications<br>2. Save | Preferences saved |
| SET-004 | SLA threshold | 1. Set SLA minutes<br>2. Save | Threshold applied |
| SET-005 | Chat settings | 1. Open chat settings<br>2. Assign accountant<br>3. Save | Assignment saved |

---

### 3.5 Dashboard Widget Tests

| Test ID | Test Name | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| WID-001 | SLA widget loads | 1. Visit dashboard | Widget shows data |
| WID-002 | Alerts widget | 1. Visit dashboard | Alert counts visible |
| WID-003 | Response time widget | 1. Visit dashboard | Chart displays |
| WID-004 | Violations widget | 1. Visit dashboard | Count displayed |
| WID-005 | Recent requests table | 1. Visit dashboard | Table populates |
| WID-006 | Real-time updates | 1. Wait 30 seconds | Data refreshes |

---

## 4. UI Selectors Reference

This section provides a comprehensive mapping of UI elements to their selectors for Playwright tests.

### 4.1 Common Selectors

| Element | Selector | Notes |
|---------|----------|-------|
| Page heading | `h1` | Main page title |
| Secondary heading | `h2`, `h3` | Section titles |
| Primary button | `button:has-text("Сохранить")` | Save buttons |
| Secondary button | `button:has-text("Отмена")` | Cancel buttons |
| Input field | `input[type="text"]` | Text inputs |
| Checkbox | `input[type="checkbox"]` | Checkboxes |
| Select dropdown | `select` | Dropdowns |
| Toast notification | `.toast, [role="alert"]` | Success/error messages |
| Loading spinner | `.animate-spin, .loader` | Loading states |

### 4.2 Landing Page Selectors

| Element | Selector |
|---------|----------|
| Hero section | `#hero` |
| Features section | `#features` |
| Contact form | `#contact` |
| Login button | `text=Войти` or `a[href="/login"]` |
| Register button | `text=Регистрация` |

### 4.3 Login Page Selectors

| Element | Selector |
|---------|----------|
| Login form | `form` |
| Telegram button | `button:has-text("Telegram")` |
| Email input | `input[name="email"]` |
| Password input | `input[name="password"]` |
| Submit button | `button[type="submit"]` |

### 4.4 Dashboard Selectors

| Element | Selector |
|---------|----------|
| Page title | `h1:has-text("Панель управления")` |
| Widgets container | `.grid.grid-cols-1.md\\:grid-cols-2` |
| SLA widget | `text=Соответствие SLA` |
| Alerts widget | `text=Активные алерты` |
| Response time | `text=Среднее время ответа` |
| Violations | `text=Нарушения сегодня` |
| Requests table | `table:has-text("Последние запросы")` |
| Help button | `button:has-text("?")` |

### 4.5 Settings Page Selectors

| Element | Selector |
|---------|----------|
| Tabs | `[role="tablist"]` |
| Profile tab | `button:has-text("Профиль")` |
| General tab | `button:has-text("Основные")` |
| Schedule tab | `button:has-text("Расписание")` |
| Notifications tab | `button:has-text("Уведомления")` |
| AI tab | `button:has-text("AI")` |
| Retention tab | `button:has-text("Хранение")` |
| Save button | `button:has-text("Сохранить")` |
| Form inputs | `input[id*="name"], input[id*="email"]` |

### 4.6 Chat Settings Selectors

| Element | Selector |
|---------|----------|
| Chat list | `table:has-text("Чаты")` |
| Chat row | `tr:has-text("chat-name")` |
| Settings icon | `button:has-text("Настройки")` |
| Accountant dropdown | `select:has-text("Ответственный")` |
| Username input | `input[placeholder*="username"]` |
| Username chip | `.chip:has-text("@")` |
| Danger zone | `text=Опасная зона` |

### 4.7 SLA Page Selectors

| Element | Selector |
|---------|----------|
| KPI cards | `.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4` |
| Compliance chart | `[aria-label*="SLA соответствие"]` |
| Filters button | `button:has-text("Фильтры")` |
| Status filter | `select:has-text("SLA Статус")` |
| Requests table | `table:has-text("Чат")` |
| Pagination | `button:has-text("Назад"), button:has-text("Вперёд")` |

---

## 5. Issues & Observations

### 5.1 Resolved Issues

| Issue ID | Description | Resolution | Status |
|----------|-------------|------------|--------|
| ISSUE-001 | Danger Zone overlapping dropdown | Fixed UI z-index | ✅ RESOLVED |
| ISSUE-002 | Accountant not linked to bot | Auto-add username on save | ✅ RESOLVED |
| ISSUE-003 | SLA "Не назначен" not highlighted | Added yellow badge | ✅ RESOLVED |
| ISSUE-004 | Dashboard alerts mismatch | Fixed via activeAlertsCount query | ✅ RESOLVED |

### 5.2 Known Observations

| ID | Category | Description | Workaround |
|----|----------|-------------|------------|
| OBS-001 | Performance | Dashboard polls every 30s | Expected behavior |
| OBS-002 | UI | Toast messages auto-dismiss | Expected behavior |
| OBS-003 | Auth | Session expires after period | Re-authenticate |
| OBS-004 | Data | Empty states show placeholder | Expected behavior |

### 5.3 Areas for Improvement

1. **Loading States** - Consider skeleton loaders for all async content
2. **Error Boundaries** - Add error boundaries for graceful degradation
3. **Form Undo** - Implement undo for accidental changes
4. **Bulk Operations** - Add bulk select/delete for chat management

---

## 6. Test Data Requirements

### 6.1 User Accounts

| Role | Access Level | Test Scenarios |
|------|--------------|----------------|
| Admin | Full access | All admin features |
| Manager | Limited admin | Settings, reports |
| Accountant | Restricted | Profile, assigned chats |
| Client | Via Telegram | Chat interaction |

### 6.2 Test Chats

| Chat ID | Purpose | Requirements |
|---------|---------|--------------|
| -5069248865 | Топбух тестирование | SLA enabled, manager assigned |
| -4993859421 | Тестовая бобабух | For SLA breach tests |

### 6.3 Test Data Templates

```typescript
// Test user data
const testUsers = {
  admin: {
    email: 'admin@test.com',
    role: 'admin',
    telegramId: '166848328'
  },
  manager: {
    email: 'manager@test.com', 
    role: 'manager',
    telegramId: '123456789'
  },
  accountant: {
    email: 'accountant@test.com',
    role: 'accountant',
    telegramUsername: 'test_accountant'
  }
};

// Test chat configuration
const testChatConfig = {
  slaEnabled: true,
  slaThresholdMinutes: 60,
  managerTelegramIds: ['166848328'],
  accountantUsernames: ['maslennikovig']
};
```

### 6.4 Environment Variables

```bash
# Required for E2E tests
NEXT_PUBLIC_SITE_URL=http://localhost:3000
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword
TEST_TELEGRAM_ID=123456789
```

---

## 7. Recommended E2E Test Suite Structure

### 7.1 File Organization

```
frontend/
├── e2e/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── logout.spec.ts
│   │   └── session.spec.ts
│   ├── dashboard/
│   │   ├── dashboard.spec.ts
│   │   ├── widgets.spec.ts
│   │   └── realtime-updates.spec.ts
│   ├── chats/
│   │   ├── chat-list.spec.ts
│   │   ├── chat-settings.spec.ts
│   │   └── chat-filters.spec.ts
│   ├── sla/
│   │   ├── sla-overview.spec.ts
│   │   ├── sla-filters.spec.ts
│   │   └── sla-pagination.spec.ts
│   ├── settings/
│   │   ├── profile.spec.ts
│   │   ├── general.spec.ts
│   │   └── notifications.spec.ts
│   └── utils/
│       ├── test-data.ts
│       ├── helpers.ts
│       └── selectors.ts
```

### 7.2 Test Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

### 7.3 Base Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Login or setup
    await page.goto('/login');
  });

  test('TEST-ID: Test description', async ({ page }) => {
    // Navigate to page
    await page.goto('/dashboard');
    
    // Perform action
    await page.click('text=Фильтры');
    
    // Assert result
    await expect(page.locator('text=Результаты')).toBeVisible();
  });
});
```

### 7.4 Test Execution Commands

```bash
# Run all E2E tests
pnpm playwright test

# Run specific test file
pnpm playwright test e2e/auth/login.spec.ts

# Run tests with UI
pnpm playwright test --ui

# Run tests in headed mode
pnpm playwright test --headed

# Run tests matching pattern
pnpm playwright test -g "dashboard"

# Generate report
pnpm playwright show-report
```

---

## 8. Screenshots Captured

Based on manual testing sessions, the following screenshots document the application state:

### 8.1 Testing Session: December 26, 2025

| Screenshot | Location | Description |
|------------|----------|-------------|
| Dashboard overview | Production | All widgets visible |
| Chat settings | Production | Accountant dropdown |
| SLA violations | Production | Violations table |
| User profile | Production | Telegram linked status |

### 8.2 Screenshot Naming Convention

```
docs/testing/screenshots/
├── 2025-12-26/
│   ├── dashboard-overview.png
│   ├── chat-settings-accountant.png
│   ├── sla-violations-table.png
│   └── profile-telegram-linked.png
├── 2025-12-25/
│   └── ...
└── 2026-01-14/
    └── ...
```

---

## 9. Additional Test Scenarios

### 9.1 Telegram Integration Tests

| Test ID | Description |
|---------|-------------|
| TG-001 | Create chat via invitation link |
| TG-002 | Bot responds to /start command |
| TG-003 | Client message creates request |
| TG-004 | Accountant response resolves request |
| TG-005 | SLA breach triggers notification |
| TG-006 | Global manager fallback works |

### 9.2 SLA System Tests

| Test ID | Description |
|---------|-------------|
| SLA-001 | Timer starts on client message |
| SLA-002 | Warning at 80% threshold |
| SLA-003 | Breach alert at 100% threshold |
| SLA-004 | Response stops timer |
| SLA-005 | Multiple chats independent |

### 9.3 Edge Cases

| Test ID | Description |
|---------|-------------|
| EDGE-001 | Empty chat list state |
| EDGE-002 | No violations state |
| EDGE-003 | Network error handling |
| EDGE-004 | Session timeout during action |
| EDGE-005 | Concurrent edits conflict |

---

## Appendix A: API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/trpc/auth.me` | GET | Current user |
| `/trpc/analytics.getDashboard` | GET | Dashboard data |
| `/trpc/chats.getAll` | GET | Chat list |
| `/trpc/chats.getById` | GET | Chat details |
| `/trpc/chats.update` | POST | Update chat |
| `/trpc/sla.getRequests` | GET | SLA requests |
| `/trpc/settings.get` | GET | User settings |
| `/trpc/settings.update` | POST | Update settings |

---

## Appendix B: Database Queries for Verification

```sql
-- Check active alerts
SELECT * FROM "SlaAlert" 
WHERE "deliveryStatus" = 'delivered' 
ORDER BY "createdAt" DESC LIMIT 5;

-- Check client requests
SELECT id, status, "slaBreached", "receivedAt", "respondedAt" 
FROM "ClientRequest" 
ORDER BY "createdAt" DESC LIMIT 10;

-- Check chat configuration
SELECT id, title, "slaEnabled", "slaThresholdMinutes", "accountantUsernames" 
FROM "Chat";
```

---

**Document Version:** 1.0  
**Last Updated:** March 18, 2026  
**Next Review:** Quarterly or after major releases
