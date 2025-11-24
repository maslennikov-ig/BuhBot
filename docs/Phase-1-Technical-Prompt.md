# BuhBot - Phase 1 Implementation Prompt

**Project:** BuhBot - Accounting Firm Client Communication Automation Platform
**Phase:** Phase 1 - CORE + QUICK WINS
**Duration:** 6-8 weeks
**Budget:** ₽1,420,000 (~$15,000 USD)

**Last Updated:** 2025-11-24
**Architecture Version:** Hybrid Deployment (Supabase Cloud + First VDS)
**Current Version:** v0.2.0

---

## 📈 Project Status (As of 2025-11-24)

**Overall Progress:** ~75% complete. Core functionality (SLA Monitoring, Feedback Collection, Quick Wins) and infrastructure are fully deployed. Remaining: Admin Panel completion, Landing Page, Documentation.

### ✅ Completed Modules:

| Module | Status | Version | Hours |
|--------|--------|---------|-------|
| **MODULE 1.1: SLA Monitoring System** | ✅ 100% | v0.1.16 | 178h |
| **MODULE 1.2: Quarterly Feedback Collection** | ✅ 100% | v0.2.0 | 142h |
| **MODULE 1.3: Quick Wins** | ✅ 100% | v0.2.0 | 160h |
| **MODULE 1.5: Infrastructure & Security** | ✅ 100% | v0.1.16 | 52h |

### 🟡 Partially Completed Modules:

| Module | Status | Remaining |
|--------|--------|-----------|
| **MODULE 1.4: Unified Admin Panel** | 🟡 ~60% | Main Dashboard, User/FAQ/Template Management, Audit Logs, Global Settings |

### ❌ Not Started:

| Module | Status | Hours |
|--------|--------|-------|
| **MODULE 1.6: Documentation & Training** | ❌ 0% | 40h |
| **MODULE 1.7: Landing Page** | ❌ 0% | 24h (NEW) |

### Next Steps (Priority Order):
1. ⏳ **MODULE 1.4** - Complete Admin Panel (Main Dashboard, User Management, FAQ/Template Management, Audit Logs)
2. ⏳ **MODULE 1.7** - Create Landing Page for https://buhbot.aidevteam.ru
3. ⏳ **MODULE 1.6** - Documentation & Team Training

### Deployment Status:
- **Production URL:** https://buhbot.aidevteam.ru ✅
- **API Health:** https://buhbot.aidevteam.ru/health ✅
- **Grafana:** http://185.200.177.180:3002 ✅
- **SSL:** Let's Encrypt ✅

---

## 🎯 Mission Statement

Build a Telegram-based automation platform for accounting firms to monitor service quality (SLA), collect client feedback, and dramatically improve communication efficiency through intelligent automation and quick-response features.

---

## 📊 Core Objectives

### Business Goals
1. **Transparency:** 100% visibility into accountant response times
2. **Client Satisfaction:** Regular feedback collection with early problem detection
3. **Efficiency:** 4x productivity increase for accountants through automation
4. **Retention:** Foundation for 15-20% client retention improvement
5. **ROI:** 3-4 month payback period

### Technical Goals
1. Real-time SLA monitoring with working hours awareness
2. Automated quarterly feedback collection with anonymity
3. Intelligent spam filtering (distinguish real requests from "Thanks!" messages)
4. Quick-response system (buttons, FAQ auto-responses, templates)
5. Unified admin panel for management and analytics
6. Secure data handling with industry-standard encryption and authentication

---

## 🏗️ Architecture Requirements

### Stack Constraints
- **Backend:** Node.js 18+ (TypeScript strict mode)
- **Database:** Supabase (cloud-hosted PostgreSQL 15+ with Auth, Storage, Realtime)
- **Cache/Queue:** Redis + BullMQ for job scheduling (self-hosted on VDS)
- **Bot Framework:** Telegraf (recommended) or node-telegram-bot-api
- **Frontend:** Next.js 14+ App Router / React for admin panel
- **AI/NLP:** OpenRouter or OpenAI (GPT-4, Claude, or Russian LLMs)
- **Bot Hosting:** First VDS (Russian VDS provider)
- **Security:** HTTPS/TLS for all connections, Supabase RLS policies for data isolation

### Infrastructure (Hybrid Deployment)

**Supabase Cloud (EU region recommended):**
- PostgreSQL 15+ database (managed with automatic backups)
- Supabase Auth (email/password, magic links, optional social)
- Supabase Storage (document uploads, invoices, files)
- Realtime Subscriptions (WebSocket for live dashboard updates)
- Row Level Security (RLS) policies for role-based access control

**First VDS Server:**
- Node.js Telegram Bot application
- BullMQ workers (background jobs: alerts, surveys, reminders)
- Redis (queue management, conversation state)
- Nginx reverse proxy (SSL termination with Let's Encrypt)
- Prometheus + Grafana (monitoring bot metrics)
- Docker Compose for deployment

**External Services:**
- UptimeRobot or Pingdom (uptime monitoring)
- OpenRouter/OpenAI API (spam filtering, NLP)

**Estimated Costs (3 months):**
- First VDS: ~₽3,000-5,000/month (₽9,000-15,000 total)
- Supabase: Free tier for MVP (₽0), Pro tier ~$25/month if needed (₽7,500 total)
- OpenRouter API: ~₽5,000-10,000 for Phase 1 usage
- **Total infrastructure:** ~₽21,000-32,500 (included in ₽1,420,000 budget)

---

## 📦 MODULE 1.1: SLA Monitoring System [COMPLETED]

**Budget:** ₽480,000 | **Hours:** 178 | **Priority:** P0 (MUST-HAVE)

### Requirements

#### 1.1.1 Request Tracking (52 hours) [COMPLETED]
**Objective:** Automatically detect client requests and start SLA timer

**Functional Requirements:**
- Webhook integration with Telegram Bot API
- Distinguish "real request" from spam/flood:
  - Ignore: "Thank you", "Ok", "👍", greetings, single emojis
  - Detect: Questions, document requests, complaints
- Start timer ONLY during working hours
- Store request metadata: client_id, chat_id, timestamp, message_type
- API endpoints for admin panel

**Technical Specs:**
```typescript
interface ClientRequest {
  id: string;
  chat_id: string;
  client_id: string;
  message_text: string;
  timestamp: Date;
  is_spam: boolean;
  sla_timer_started: Date | null;
  responded_at: Date | null;
  response_time_minutes: number | null;
  assigned_accountant_id: string;
}
```

**Acceptance Criteria:**
- ✅ Detects 95%+ of real requests correctly
- ✅ Ignores 90%+ of spam/gratitude messages
- ✅ Timer starts within 5 seconds of message receipt
- ✅ All requests logged to database

---

#### 1.1.2 AI Spam Filter (24 hours)
**Objective:** Use AI to filter out non-request messages

**Functional Requirements:**
- Integration with OpenRouter or OpenAI API
- Recommended models: GPT-4 Turbo, Claude 3.5 Sonnet, or specialized Russian LLMs via OpenRouter
- Keyword-based rules as fallback (if API fails or rate limited)
- Train/test on real accounting firm chat data (50-100 examples)
- Classify messages: REQUEST | SPAM | GRATITUDE | CLARIFICATION

**Technical Specs:**
```typescript
interface SpamFilterResult {
  is_request: boolean;
  confidence: number; // 0-1
  category: 'REQUEST' | 'SPAM' | 'GRATITUDE' | 'CLARIFICATION';
  reasoning?: string;
  model_used: 'openrouter' | 'openai' | 'keyword-fallback';
}

async function filterSpam(message: string): Promise<SpamFilterResult>
```

**API Integration:**
- Primary: OpenRouter API (access to multiple models including Russian LLMs)
- Alternative: OpenAI API (GPT-4 Turbo with Russian language support)
- Fallback: Keyword-based classification (hardcoded rules)
- API key management: environment variables only
- Cost optimization: cache results for identical messages

**Acceptance Criteria:**
- ✅ 90%+ accuracy on test dataset
- ✅ Response time <2 seconds per message (including API call)
- ✅ Fallback to keyword matching if API unavailable or rate limited
- ✅ Cost per message <₽0.50 (track API usage)

---

#### 1.1.3 Working Hours Calendar (18 hours)
**Objective:** Calculate SLA time accounting for working hours, weekends, holidays

**Functional Requirements:**
- Default schedule: Mon-Fri 9:00-18:00 (Moscow time)
- Customizable per chat (some clients = 24/7 support)
- Russian federal holiday calendar (integration with API or static list)
- SLA timer PAUSES outside working hours
- API for admin panel to configure schedules

**Technical Specs:**
```typescript
interface WorkingSchedule {
  chat_id: string;
  timezone: string; // "Europe/Moscow"
  working_days: number[]; // [1,2,3,4,5] = Mon-Fri
  working_hours: { start: string; end: string }; // "09:00", "18:00"
  holidays: Date[]; // Federal holidays
}

function calculateSLATime(
  request_start: Date,
  response_time: Date,
  schedule: WorkingSchedule
): number // minutes within working hours
```

**Acceptance Criteria:**
- ✅ Correctly pauses timer on weekends
- ✅ Accounts for holidays
- ✅ Admin can override schedule per chat
- ✅ Edge case: Request at 17:55 Friday, response Monday 9:05 = 10 min SLA time

---

#### 1.1.4 Manager Alerts (32 hours)
**Objective:** Notify manager when SLA violated

**Functional Requirements:**
- Send Telegram alert to manager when:
  - Request unanswered for >1 hour (working time)
  - Escalation: Reminder every 30 minutes until resolved
- Alert message format:
  ```
  ⚠️ SLA VIOLATION

  Client: [Name] (@username)
  Chat: [Chat Name]
  Accountant: [Name]

  Unanswered for: 1h 23m
  Request: "Where is my invoice?"

  [Open Chat] [Notify Accountant]
  ```
- Inline buttons:
  - "Open Chat" → deep link to Telegram chat
  - "Notify Accountant" → ping assigned accountant
  - "Mark Resolved" → stop escalation
- History of all alerts in database

**Technical Specs:**
```typescript
interface SLAAlert {
  id: string;
  request_id: string;
  manager_telegram_id: string;
  violation_time_minutes: number;
  escalation_count: number; // 1, 2, 3...
  resolved_at: Date | null;
  resolved_by: string | null;
}
```

**Acceptance Criteria:**
- ✅ Alert sent within 60 seconds of SLA breach
- ✅ Escalation repeats every 30 min (max 5 times)
- ✅ Buttons work correctly
- ✅ Manager can mark resolved

---

#### 1.1.5 Admin Panel - SLA Configuration (52 hours)
**Objective:** Web interface to manage SLA settings

**Functional Requirements:**

**Pages:**
1. **Dashboard:**
   - SLA compliance rate (% requests answered <1h)
   - Average response time (overall, per accountant)
   - Total violations today/week/month
   - Active alerts count

2. **Chat Management:**
   - List all monitored chats (table view)
   - Assign accountant to chat (dropdown)
   - Set SLA threshold per chat (default 60 min)
   - Enable/disable monitoring per chat

3. **Accountant Performance:**
   - Table: Accountant | Avg Response Time | Violations | Compliance %
   - Filter by date range
   - Export to CSV

4. **Settings:**
   - Default working hours
   - Manager Telegram ID for alerts
   - Holiday calendar editor

**Technical Specs:**
- Next.js 14+ App Router (React Server Components)
- Supabase JS Client for data operations (direct DB queries with RLS)
- Supabase Auth for authentication (email + password)
- Supabase Realtime for live dashboard updates (WebSocket)
- Responsive design (Tailwind CSS + shadcn/ui components)

**Authentication Flow:**
1. User logs in via Supabase Auth (email + password)
2. Supabase returns JWT token (stored in httpOnly cookie)
3. All DB queries automatically filtered by RLS policies based on user role
4. No custom auth middleware needed

**Data Fetching Strategy:**
- Server Components: Direct Supabase queries (server-side)
- Client Components: Supabase client with RLS enforcement
- Real-time: Supabase Realtime subscriptions for live metrics

**Acceptance Criteria:**
- ✅ All CRUD operations work with RLS policy enforcement
- ✅ Real-time updates via Supabase Realtime (no polling needed)
- ✅ Mobile-responsive
- ✅ No UI bugs on Chrome/Safari/Firefox
- ✅ Role-based access: Admin sees all, Manager sees limited, Observer read-only

---

## 📦 MODULE 1.2: Quarterly Feedback Collection [COMPLETED ✅]

**Budget:** ₽280,000 | **Hours:** 142 | **Priority:** P0 (MUST-HAVE)
**Status:** ✅ Completed in v0.2.0 | **Tasks:** 76/76 completed
**Artifacts:** [`specs/003-client-feedback-quick-wins/tasks.md`](../specs/003-client-feedback-quick-wins/tasks.md)

### Requirements

#### 1.2.1 Survey System (48 hours)
**Objective:** Automatically send quarterly satisfaction surveys

**Functional Requirements:**
- Cron job runs every 3 months (Jan 1, Apr 1, Jul 1, Oct 1)
- Send survey to ALL active clients via Telegram bot
- Survey format:
  ```
  📊 Quarterly Feedback - Q1 2025

  How satisfied are you with our accounting services?

  ⭐ ⭐⭐ ⭐⭐⭐ ⭐⭐⭐⭐ ⭐⭐⭐⭐⭐

  [Comments (optional)]
  ```
- Inline buttons for 1-5 star rating
- Text input for optional comments
- Store response: client_id, rating, comment, timestamp

**Technical Specs:**
```typescript
interface FeedbackResponse {
  id: string;
  client_id: string;
  chat_id: string;
  quarter: string; // "2025-Q1"
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  timestamp: Date;
  is_anonymous_to_accountant: boolean; // always true
}
```

**Acceptance Criteria:**
- ✅ Survey sent to 100% active clients
- ✅ Survey auto-triggers quarterly (no manual intervention)
- ✅ Client can respond once per quarter
- ✅ Responses saved to database

---

#### 1.2.2 Anonymity (12 hours)
**Objective:** Hide client identity from accountant, visible to manager

**Functional Requirements:**
- Accountant sees ONLY:
  - Aggregate data (average rating, % distribution)
  - Anonymous comments (no client name)
- Manager sees:
  - Full data including client name
- Database stores full data, API filters by role

**Technical Specs:**
```typescript
// API endpoint examples
GET /api/feedback/summary → { avg_rating, distribution, anonymous_comments }
GET /api/feedback/detailed → { client_name, rating, comment } // Manager only
```

**Acceptance Criteria:**
- ✅ Accountant CANNOT see who gave low rating
- ✅ Manager CAN see full details
- ✅ No data leaks via API

---

#### 1.2.3 Low Rating Alerts (18 hours)
**Objective:** Alert manager when client gives rating ≤3

**Functional Requirements:**
- Instant Telegram alert to manager:
  ```
  🚨 LOW RATING ALERT

  Client: [Name]
  Rating: ⭐⭐ (2/5)
  Comment: "Slow responses lately"

  Accountant: [Name]
  Quarter: Q1 2025

  [Open Chat] [Contact Client]
  ```
- Track alert delivery in database
- History of all low ratings in admin panel

**Acceptance Criteria:**
- ✅ Alert sent within 30 seconds of low rating
- ✅ Manager receives alert even if offline (Telegram notification)
- ✅ Buttons work correctly

---

#### 1.2.4 Feedback Analytics Dashboard (44 hours)
**Objective:** Visualize feedback data

**Functional Requirements:**

**Metrics:**
- Average rating (overall, per accountant, per quarter)
- Rating distribution (% of 1-star, 2-star, etc.)
- Trend over time (line chart)
- Comment word cloud (optional, nice-to-have)

**Views:**
1. Overall summary
2. Per accountant breakdown
3. Per quarter comparison
4. Export to CSV/Excel

**Technical Specs:**
- Use Chart.js or Recharts for visualizations
- Filter by date range, accountant
- Responsive design

**Acceptance Criteria:**
- ✅ Charts render correctly
- ✅ Data updates after new survey
- ✅ Export works

---

#### 1.2.5 Manual Survey Trigger (20 hours)
**Objective:** Manager can trigger survey anytime

**Functional Requirements:**
- Admin panel button: "Send Survey Now"
- Select recipients:
  - All clients
  - Specific chat
  - Clients of specific accountant
- Preview survey before sending
- Confirmation dialog

**Acceptance Criteria:**
- ✅ Manager can send ad-hoc surveys
- ✅ No duplicate surveys (prevent double-sending)
- ✅ Confirmation prevents accidental sends

---

## 📦 MODULE 1.3: Quick Wins (Instant Value Features) [COMPLETED ✅]

**Budget:** ₽320,000 | **Hours:** 160 | **Priority:** P0 (MUST-HAVE)
**Status:** ✅ Completed in v0.2.0 | **Tasks:** Included in 003-client-feedback-quick-wins
**Artifacts:** [`specs/003-client-feedback-quick-wins/tasks.md`](../specs/003-client-feedback-quick-wins/tasks.md)

### Requirements

#### 1.3.1 Client Inline Buttons (24 hours)
**Objective:** Quick actions for clients

**Functional Requirements:**
- Buttons in bot menu:
  - "📊 Document Status"
  - "💰 Invoices"
  - "📄 Reports"
  - "📋 Order Service" (dropdown: Invoice, Act, Certificate)
  - "📞 Contact Accountant"
  - "ℹ️ Company Details"

- Each button triggers:
  - "Document Status" → show pending docs
  - "Invoices" → list unpaid invoices
  - "Order Service" → form to request document
  - etc.

**Technical Specs:**
- Telegram Bot API inline keyboards
- State management for multi-step flows
- Database queries for document status (mock data acceptable for Phase 1)

**Acceptance Criteria:**
- ✅ All 6 buttons work
- ✅ Response time <2 seconds
- ✅ Error handling (e.g., "No pending invoices")

**Expected Impact:**
- 80% faster client responses
- 30% reduction in support tickets

---

#### 1.3.2 Accountant Inline Buttons (20 hours)
**Objective:** Quick status updates for accountants

**Functional Requirements:**
- When client sends request, accountant sees buttons:
  - "✅ Started Working"
  - "❌ Reject"
  - "❓ Need Info"
  - "📤 Sent"
  - "✔️ Done"

- Clicking button:
  - Updates request status in database
  - Sends notification to client: "Your request is being processed"
  - Stops SLA timer

**Technical Specs:**
```typescript
enum RequestStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  NEED_INFO = 'need_info',
  SENT = 'sent',
  DONE = 'done',
  REJECTED = 'rejected'
}

interface RequestUpdate {
  request_id: string;
  new_status: RequestStatus;
  updated_by: string; // accountant_id
  timestamp: Date;
}
```

**Acceptance Criteria:**
- ✅ Status updates instantly
- ✅ Client receives notification
- ✅ SLA timer stops on first accountant interaction

**Expected Impact:**
- 4x productivity increase (proven by Yopa case study)

---

#### 1.3.3 FAQ Auto-Responses (32 hours)
**Objective:** Automatically answer 25 common questions

**Functional Requirements:**

**FAQ Categories (5 each = 25 total):**
1. Pricing questions
2. Document requests
3. Tax deadlines
4. Contact info
5. Service availability

**Example:**
- Client: "How much does monthly accounting cost?"
- Bot: "Monthly accounting costs ₽15,000-30,000 depending on company size and transactions. Would you like a detailed quote? [Yes] [No]"

**Technical Specs:**
- Keyword matching algorithm (e.g., "cost", "price" → pricing FAQ)
- Store FAQs in database (admin can edit)
- Fallback: "I didn't understand. Contact your accountant: @username"

**Acceptance Criteria:**
- ✅ Matches 25 FAQs correctly
- ✅ Response time <1 second
- ✅ Fallback message for unknown questions

**Expected Impact:**
- 55% of clients prefer instant auto-responses
- Response time: 45 min → 1 min

---

#### 1.3.4 File Receipt Confirmation (24 hours)
**Objective:** Confirm file uploads instantly

**Functional Requirements:**
- When client uploads file (PDF, Excel, image):
  ```
  ✅ FILE RECEIVED

  Filename: invoice_march.pdf
  Size: 2.3 MB
  Format: PDF

  Assigned to: [Accountant Name]
  Status: Processing

  You'll receive updates via this chat.
  ```

**Technical Specs:**
- Telegram file API integration
- Extract metadata: filename, size, mime type
- Store file reference in Supabase database
- Upload to Supabase Storage (with public URL generation)

**Acceptance Criteria:**
- ✅ Confirmation sent within 5 seconds
- ✅ All file types supported (PDF, JPG, PNG, XLS, XLSX)
- ✅ Metadata extracted correctly

**Expected Impact:**
- Reduces client anxiety ("Did they get my file?")
- Prevents duplicate file uploads

---

#### 1.3.5 Response Templates Library (60 hours)
**Objective:** Pre-written templates for accountants

**Functional Requirements:**

**25 Template Categories:**
1. Greetings
2. Invoice sent
3. Document received
4. Need more info
5. Deadline reminders
6. Tax consultation responses
7. etc.

**Template Example:**
```
Template: "Invoice Sent"

Hi {{client_name}},

Your invoice #{{invoice_number}} for {{amount}} RUB has been sent to {{email}}.

Payment due: {{due_date}}

Questions? Reply here anytime!

Best,
{{accountant_name}}
```

**Technical Specs:**
- Template system with variable substitution: `{{variable_name}}`
- Admin panel CRUD for templates
- Accountant bot command: `/template <keyword>` → shows matching templates
- Inline button to use template (inserts text into message input)

**Technical Implementation:**
```typescript
interface Template {
  id: string;
  title: string;
  keywords: string[]; // ["invoice", "sent", "payment"]
  template_text: string; // with {{variables}}
  category: string;
}

function renderTemplate(template: Template, variables: Record<string, string>): string
```

**Admin Panel Features:**
- Create/edit/delete templates
- Preview with sample data
- Search by keyword

**Acceptance Criteria:**
- ✅ 25 templates created
- ✅ Variable substitution works
- ✅ Accountants can search and use templates
- ✅ Admin can manage templates

**Expected Impact:**
- 4x faster responses
- Consistent messaging quality
- New accountants productive from day 1

---

## 📦 MODULE 1.4: Unified Admin Panel [PARTIALLY COMPLETED 🟡]

**Budget:** ₽200,000 | **Hours:** 104 | **Priority:** P0 (MUST-HAVE)
**Status:** 🟡 ~60% Complete | **Remaining:** ~44 hours

### Completion Status:

| Subsection | Status | Hours | Notes |
|------------|--------|-------|-------|
| 1.4.1 Authentication & Roles | ✅ Done | 16h | Supabase Auth + RLS policies |
| 1.4.2 Main Dashboard | ❌ TODO | 20h | Widgets, real-time metrics |
| 1.4.3 User Management | ❌ TODO | 16h | CRUD for accountants |
| 1.4.4 FAQ Management | ❌ TODO | 16h | CRUD for FAQs |
| 1.4.5 Template Management | ❌ TODO | 16h | CRUD for templates |
| 1.4.6 Audit Logs | ❌ TODO | 12h | Action logging |
| 1.4.7 Global Settings | 🟡 Partial | 8h | Survey settings done, SLA settings pending |
| Feedback Pages | ✅ Done | — | Added in v0.2.0 |
| Survey Pages | ✅ Done | — | Added in v0.2.0 |

### Requirements

#### 1.4.1 Authentication & Roles (16 hours) [COMPLETED ✅]

**Roles:**
1. **Admin:** Full access (CRUD all tables, user management, system settings)
2. **Manager:** View all data, configure settings, no user management
3. **Observer:** Read-only access (view dashboards, reports only)

**Technical Specs:**
- Supabase Auth for authentication (email + password, bcrypt handled automatically)
- JWT tokens managed by Supabase (httpOnly cookies)
- Row Level Security (RLS) policies in PostgreSQL for role-based access control
- User roles stored in `auth.users` metadata or separate `user_roles` table

**RLS Policy Examples:**
```sql
-- Admin: full access to all tables
CREATE POLICY admin_all_access ON client_requests
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Manager: view all, modify settings
CREATE POLICY manager_view ON client_requests
  FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));

-- Observer: read-only
CREATE POLICY observer_readonly ON client_requests
  FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'manager', 'observer'));
```

**Acceptance Criteria:**
- ✅ Each role has correct permissions enforced by RLS policies
- ✅ Secure (passwords hashed by Supabase Auth, JWT httpOnly cookies)
- ✅ Role assignment via Supabase dashboard or admin panel
- ✅ Unauthorized access attempts blocked at database level

---

#### 1.4.2 Main Dashboard (20 hours)

**Widgets:**
1. SLA Compliance (gauge: 92%)
2. Average Response Time (metric: 23 min)
3. Active Alerts (count: 3)
4. Feedback Rating (stars: ⭐⭐⭐⭐ 4.2/5)
5. Recent Activity (list: last 10 requests)

**Technical Specs:**
- Real-time updates via WebSocket or polling
- Responsive grid layout
- Drill-down: click widget → detailed view

**Acceptance Criteria:**
- ✅ All metrics accurate
- ✅ Updates every 30 seconds
- ✅ Mobile responsive

---

#### 1.4.3 User Management (16 hours)

**Features:**
- CRUD for accountants:
  - Add accountant (name, Telegram username, email)
  - Assign to chats (multi-select)
  - Deactivate accountant
- Table view: Name | Chats | Response Time | Status

**Acceptance Criteria:**
- ✅ All CRUD operations work
- ✅ Changes reflect immediately in bot

---

#### 1.4.4 FAQ Management (16 hours)

**Features:**
- CRUD for FAQs:
  - Question
  - Answer (rich text editor)
  - Keywords (comma-separated)
  - Category

**Technical Specs:**
- Search by keyword
- Preview answer
- Reorder FAQs (priority)

**Acceptance Criteria:**
- ✅ FAQs editable without developer
- ✅ Changes applied to bot instantly

---

#### 1.4.5 Template Management (16 hours)

**Features:**
- CRUD for templates (see 1.3.5)
- Test template with sample variables

**Acceptance Criteria:**
- ✅ Templates editable
- ✅ Preview works

---

#### 1.4.6 Audit Logs (12 hours)

**Features:**
- Table: Timestamp | User | Action | Details
- Actions logged:
  - User login
  - Settings changed
  - Template edited
  - Survey sent
  - etc.
- Filter by date, user, action type
- Export to CSV

**Acceptance Criteria:**
- ✅ All actions logged
- ✅ Logs immutable (can't be deleted)

---

#### 1.4.7 Global Settings (8 hours)

**Features:**
- Default working hours
- Default SLA threshold (60 min)
- Manager Telegram ID for alerts
- Holiday calendar
- Timezone

**Acceptance Criteria:**
- ✅ Settings persist
- ✅ Changes apply to new chats

---

## 📦 MODULE 1.5: Infrastructure & Security

**Budget:** ₽120,000 | **Hours:** 52 | **Priority:** P0 (MUST-HAVE)

### Requirements

#### 1.5.1 Hybrid Deployment Setup (24 hours)

**Objective:** Deploy bot application on First VDS + configure Supabase cloud database

**Components:**

**1. Supabase Cloud Setup (4 hours):**
   - Create Supabase project (EU region recommended for latency)
   - Configure database schema (tables, indexes, relationships)
   - Set up RLS policies for role-based access control
   - Configure Supabase Auth (email/password providers)
   - Set up Supabase Storage buckets (invoices, documents, files)
   - Configure automatic backups (Point-in-Time Recovery enabled)

**2. First VDS Server (12 hours):**
   - Rent VDS: 2-4 vCPU, 4-8 GB RAM, 50-100 GB SSD
   - OS: Ubuntu 22.04 LTS
   - Docker + Docker Compose installation
   - Deploy services:
     - Node.js Telegram Bot application
     - Redis (BullMQ queue + conversation state)
     - Nginx reverse proxy (SSL termination)
     - Prometheus + Grafana (monitoring)

**3. Networking & Security (4 hours):**
   - Configure VDS firewall (allow 443, 80, SSH only)
   - Set up Nginx reverse proxy with Let's Encrypt SSL
   - Configure Supabase connection from VDS (connection pooling)
   - Environment variables management (.env.production)

**4. Monitoring & Alerts (4 hours):**
   - Prometheus metrics collection (bot metrics, Redis, CPU, RAM)
   - Grafana dashboards (SLA metrics, bot performance, system health)
   - UptimeRobot or Pingdom for external uptime monitoring
   - Alerts:
     - Bot downtime
     - High CPU (>80%)
     - High memory (>80%)
     - Disk full (>85%)
     - Supabase connection errors

**Technical Specs:**
- Docker Compose for orchestration
- Nginx reverse proxy for HTTPS (Let's Encrypt)
- PM2 inside Docker for Node.js process management
- GitHub Actions for CI/CD deployment to VDS

**Deployment Architecture:**
```
┌─────────────────────────────────────┐
│      Supabase Cloud (EU)            │
│  ┌──────────────────────────────┐   │
│  │ PostgreSQL 15+               │   │
│  │ Supabase Auth                │   │
│  │ Supabase Storage             │   │
│  │ Realtime Subscriptions       │   │
│  └──────────────────────────────┘   │
└─────────────────┬───────────────────┘
                  │ HTTPS/WSS
                  │
┌─────────────────┴───────────────────┐
│      First VDS Server               │
│  ┌──────────────────────────────┐   │
│  │ Nginx (Reverse Proxy + SSL)  │   │
│  └──────────────┬───────────────┘   │
│  ┌──────────────┴───────────────┐   │
│  │ Node.js Telegram Bot         │   │
│  │ BullMQ Workers               │   │
│  └──────────────┬───────────────┘   │
│  ┌──────────────┴───────────────┐   │
│  │ Redis (Queue + State)        │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ Prometheus + Grafana         │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Acceptance Criteria:**
- ✅ Supabase project created and configured (database, auth, storage)
- ✅ VDS server provisioned and secured
- ✅ Bot application deployed and running via Docker Compose
- ✅ HTTPS enabled with Let's Encrypt SSL
- ✅ Monitoring dashboards operational (Grafana + UptimeRobot)
- ✅ Automated backups configured (Supabase PITR enabled)
- ✅ CI/CD pipeline working (GitHub Actions → VDS deployment)

---

#### 1.5.2 Security & Data Protection (16 hours)

**Objective:** Implement industry-standard security practices for data protection

**Security Requirements:**
1. **Transport Security:**
   - HTTPS/TLS for all connections (Let's Encrypt SSL on Nginx)
   - Supabase connections over TLS
   - Telegram Bot API uses HTTPS

2. **Data Protection:**
   - Supabase Auth password hashing (bcrypt automatically)
   - RLS policies enforce data isolation by role
   - Environment variables for all secrets (no hardcoded credentials)
   - Sensitive data fields in Supabase (client emails, phone numbers, feedback comments)

3. **API Security:**
   - Telegram webhook signature validation
   - Supabase JWT token validation (httpOnly cookies)
   - Rate limiting on bot endpoints (prevent abuse)
   - Input validation with Zod schemas

4. **Secrets Management:**
   - Environment variables for:
     - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
     - `TELEGRAM_BOT_TOKEN`
     - `OPENROUTER_API_KEY` or `OPENAI_API_KEY`
     - `REDIS_URL`
   - Never commit secrets to git (.env in .gitignore)
   - Use GitHub Secrets for CI/CD

**Optional Encryption (if required later):**
```typescript
// Encrypt sensitive data at application level (optional)
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte key
const algorithm = 'aes-256-gcm';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
```

**Acceptance Criteria:**
- ✅ All connections use HTTPS/TLS
- ✅ No hardcoded secrets in code (all in environment variables)
- ✅ Telegram webhook signature validation working
- ✅ Supabase RLS policies enforced
- ✅ Password authentication secure (Supabase Auth bcrypt)
- ✅ API rate limiting implemented

---

#### 1.5.3 Backup & Disaster Recovery (12 hours)

**Objective:** Ensure data recoverability and minimize downtime risk

**Requirements:**

1. **Supabase Automatic Backups:**
   - Point-in-Time Recovery (PITR) enabled (Pro plan feature)
   - Automatic daily backups retained for 7-30 days (depending on plan)
   - Manual backup export capability via Supabase dashboard
   - Test restore procedure documented

2. **VDS Backup Strategy:**
   - Weekly manual snapshots of VDS (Docker volumes, configs)
   - Store locally + offsite (optional: S3-compatible storage)
   - Retain 4 weeks
   - Automate with cron job

3. **Application-Level Backups:**
   - Export critical configuration tables weekly (settings, templates, FAQ)
   - Store as JSON/SQL dumps in git repository (encrypted)
   - Version control for audit trail

4. **Recovery Procedures:**
   - Documented step-by-step recovery guide
   - Recovery Time Objective (RTO): 4 hours
   - Recovery Point Objective (RPO): 24 hours (Supabase daily backups)
   - Disaster recovery runbook in docs/

**Technical Specs:**
```bash
# Example backup script for VDS
#!/bin/bash
# Backup Docker volumes
docker compose -f docker-compose.prod.yml down
tar -czf backup-$(date +%Y%m%d).tar.gz /var/lib/docker/volumes
docker compose -f docker-compose.prod.yml up -d

# Upload to storage (optional)
# rclone copy backup-*.tar.gz remote:backups/
```

**Acceptance Criteria:**
- ✅ Supabase PITR enabled and tested
- ✅ VDS backup script running weekly
- ✅ Manual restore test successful
- ✅ Recovery procedure documented
- ✅ RTO/RPO targets achievable

---

## 📦 MODULE 1.6: Documentation & Training [NOT STARTED ❌]

**Budget:** ₽80,000 | **Hours:** 40 | **Priority:** P0 (MUST-HAVE)
**Status:** ❌ Not Started | Blocked by: MODULE 1.4 completion

### Requirements

#### 1.6.1 Documentation (24 hours) [TODO]

**Documents to Create:**

1. **For Accountants: "How to Use BuhBot"**
   - Bot commands reference
   - How to use quick buttons
   - How to use templates
   - How to check SLA status
   - FAQ troubleshooting

2. **For Clients: "Quick Start Guide"**
   - How to use bot buttons
   - How to upload documents
   - How to check request status
   - How to contact accountant

3. **For Manager: "Admin Panel Guide"**
   - How to configure SLA settings
   - How to view analytics
   - How to manage accountants
   - How to send surveys
   - How to respond to alerts

4. **Technical Documentation:**
   - Architecture diagram
   - Database schema
   - API endpoints reference
   - Deployment guide
   - Troubleshooting guide

**Format:**
- Markdown files
- PDF exports
- Screenshots for UI guides
- Video tutorials (optional, nice-to-have)

**Acceptance Criteria:**
- ✅ All documents complete
- ✅ Reviewed by stakeholders
- ✅ Published to internal wiki or Google Drive

---

#### 1.6.2 Team Training (16 hours)

**Training Sessions:**

**Session 1: Accountants (2 hours online)**
- How to use bot effectively
- Template library demo
- Q&A

**Session 2: Manager (2 hours online)**
- Admin panel walkthrough
- Analytics interpretation
- Alert response procedures
- Q&A

**Session 3: Follow-up Q&A (1 hour, 2 weeks after launch)**
- Address issues encountered
- Collect feedback for improvements

**Training Materials:**
- Slide deck (PowerPoint/Google Slides)
- Hands-on exercises
- Cheat sheet (1-page reference)

**Acceptance Criteria:**
- ⏳ All team members attend training
- ⏳ Feedback collected
- ⏳ Recorded sessions available for future reference

---

## 📦 MODULE 1.7: Landing Page [NOT STARTED ❌]

**Budget:** ₽60,000 | **Hours:** 24 | **Priority:** P1 (SHOULD-HAVE)
**Status:** ❌ Not Started | **Added:** 2025-11-24

### Overview

The main page at https://buhbot.aidevteam.ru currently shows a default Next.js template. A professional landing page is needed to:
- Present BuhBot to potential clients
- Explain key features and benefits
- Provide contact/demo request form
- Build trust with testimonials and case studies

### Requirements

#### 1.7.1 Hero Section (4 hours)
**Objective:** Capture attention and communicate value proposition

**Content:**
- Headline: "BuhBot - Автоматизация коммуникаций для бухгалтерских фирм"
- Subheadline: Clear value proposition (SLA monitoring, client feedback, 4x productivity)
- CTA Button: "Запросить демо" / "Связаться с нами"
- Hero image/illustration: Bot + accounting theme

**Technical Specs:**
- Responsive design (mobile-first)
- Animated entrance (subtle)
- Above-the-fold optimization

---

#### 1.7.2 Features Section (6 hours)
**Objective:** Showcase key features with visual cards

**Features to Display:**
1. **SLA Monitoring** - Real-time tracking, manager alerts, working hours support
2. **Quarterly Feedback** - Automated surveys, NPS analytics, anonymity
3. **Quick Response Tools** - Templates, FAQ auto-responses, inline buttons
4. **Admin Panel** - Analytics dashboard, user management, audit logs
5. **Telegram Integration** - Native bot, inline keyboards, file handling
6. **Security** - HTTPS, RLS policies, Supabase Auth

**Design:**
- Icon + Title + Description for each feature
- Grid layout (3 columns desktop, 1 column mobile)
- Hover effects

---

#### 1.7.3 How It Works (4 hours)
**Objective:** Explain the setup and usage flow

**Steps:**
1. **Подключение** - Connect Telegram chats to BuhBot
2. **Настройка** - Configure SLA thresholds, working hours, templates
3. **Мониторинг** - Track response times, receive alerts
4. **Аналитика** - View dashboards, collect feedback, improve service

**Design:**
- Step-by-step visual flow
- Numbered circles with icons
- Connection lines between steps

---

#### 1.7.4 Benefits/Stats Section (4 hours)
**Objective:** Build credibility with metrics

**Stats to Display:**
- "4x быстрее ответы" (4x faster responses)
- "90%+ SLA compliance"
- "55% клиентов предпочитают авто-ответы"
- "ROI за 3-4 месяца"

**Design:**
- Large numbers with descriptions
- Counter animation on scroll
- Background accent color

---

#### 1.7.5 Contact/CTA Section (4 hours)
**Objective:** Convert visitors to leads

**Elements:**
- Contact form: Name, Email, Company, Message
- Telegram link for direct contact
- Email: contact@aidevteam.ru
- "Запросить демо" CTA button

**Technical Specs:**
- Form validation (Zod)
- Email notification on submit (or store in DB)
- Success/error states

---

#### 1.7.6 Footer (2 hours)
**Objective:** Navigation and legal info

**Content:**
- Logo + tagline
- Navigation links (Features, How It Works, Contact)
- Social links (Telegram, GitHub)
- Copyright: © 2025 AIDevTeam
- Privacy Policy link (optional)

---

### Technical Specifications

**Stack:**
- Next.js 16+ (App Router)
- Tailwind CSS 4.x
- shadcn/ui components
- Framer Motion (animations)
- React Hook Form + Zod (contact form)

**Pages:**
- `/` - Landing page (public, no auth)
- `/login` - Admin panel login
- `/dashboard` - Admin panel (protected)

**SEO:**
- Meta tags (title, description, og:image)
- Structured data (Organization schema)
- Sitemap.xml
- robots.txt

**Performance:**
- Lighthouse score ≥90
- Core Web Vitals: LCP <2.5s, FID <100ms, CLS <0.1
- Image optimization (next/image)
- Font optimization (next/font)

### Acceptance Criteria:
- ⏳ Landing page live at https://buhbot.aidevteam.ru
- ⏳ Mobile responsive (320px - 1920px)
- ⏳ Contact form works and sends notifications
- ⏳ Lighthouse Performance score ≥90
- ⏳ All sections render correctly
- ⏳ Russian language content

---

## 🎯 Success Metrics (Phase 1)

### KPIs to Measure After 3 Months

1. **SLA Compliance:**
   - Target: 90%+ requests answered <1 hour
   - Measurement: Admin panel analytics

2. **Client Satisfaction:**
   - Target: Average rating ≥4.0/5
   - Measurement: Quarterly survey results

3. **Efficiency Gains:**
   - Target: 30% reduction in average response time
   - Target: 4x faster responses using templates/buttons
   - Measurement: Before/after comparison

4. **Adoption:**
   - Target: 60%+ accountants use templates regularly
   - Target: 80%+ clients use quick buttons
   - Measurement: Usage logs

5. **ROI:**
   - Target: 3-4 month payback period
   - Calculation: Time saved × accountant hourly rate
   - Expected savings: ₽440K/month (5 accountants × 2 hours/day saved)

---

## 🚨 Critical Constraints & Risks

### Must-Have Constraints
1. **Performance:**
   - Bot response time <2 seconds
   - Admin panel loads <3 seconds
   - No downtime during working hours (99.5% uptime target)
   - Supabase queries <100ms (95th percentile)

2. **Security:**
   - No hardcoded credentials (environment variables only)
   - All API endpoints authenticated (Supabase Auth + RLS)
   - Role-based access control enforced (RLS policies)
   - HTTPS/TLS for all connections

3. **Scalability:**
   - Support 100+ chats simultaneously
   - Handle 1000+ requests/day
   - Database optimized for growth (Supabase auto-scaling)
   - VDS resources monitored (CPU, RAM, disk)

### Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| AI spam filter inaccurate | Medium | Medium | Keyword fallback + manual override + continuous training |
| Telegram API rate limits | High | Low | Queue system with BullMQ, respect rate limits (30 msg/s) |
| Manager alert fatigue | Medium | High | Configurable escalation, digest mode, smart grouping |
| Accountants ignore bot | High | Medium | Training, gamification (Phase 2), usage analytics |
| Client privacy concerns | High | Low | Clear anonymity policy, RLS data isolation, secure auth |
| Supabase service outage | High | Low | Monitor uptime, fallback to read-only mode, VDS cache |
| VDS resource exhaustion | Medium | Medium | Prometheus alerts, auto-restart on OOM, plan VDS upgrade |

---

## 📋 Acceptance Criteria (Phase 1 Complete)

### Functional Acceptance
- ✅ All 6 modules (1.1-1.6) implemented
- ✅ All 24 features working as specified
- ✅ No critical bugs (P0/P1 bugs must be fixed)
- ✅ Tested on real accounting firm chats (pilot: 20 chats)

### Performance Acceptance
- ✅ Bot response time <2s (95th percentile)
- ✅ Admin panel load time <3s
- ✅ 99.5% uptime during working hours
- ✅ Database query time <100ms (95th percentile)

### Quality Acceptance
- ✅ Test coverage ≥80% (unit + integration tests)
- ✅ No TypeScript errors
- ✅ No ESLint errors
- ✅ Accessibility: WCAG 2.1 AA compliance (admin panel)

### Documentation Acceptance
- ✅ All documentation complete
- ✅ Team trained
- ✅ Deployment guide tested (infrastructure can be replicated)

### Security Acceptance
- ✅ Security audit passed (basic checklist)
- ✅ HTTPS/TLS enabled for all connections
- ✅ No hardcoded secrets (all in environment variables)
- ✅ Supabase RLS policies tested and working
- ✅ Telegram webhook signature validation implemented

---

## 🚀 Delivery Milestones

### Week 1-2: Requirements & Setup
- ✅ Finalize requirements
- ✅ Supabase project setup (database, auth, storage)
- ✅ First VDS provisioning
- ✅ Database schema designed with RLS policies
- ✅ Telegram Bot token obtained
- ✅ Development environment ready

### Week 3-4: Core Development
- ✅ Module 1.1 (SLA Monitoring) - 70% complete
- ✅ Module 1.2 (Feedback) - 50% complete
- ✅ Database migrations

### Week 5: Quick Wins & Admin Panel
- ✅ Module 1.3 (Quick Wins) - 100% complete
- ✅ Module 1.4 (Admin Panel) - 80% complete

### Week 6: Testing & Integration
- ✅ All modules integrated
- ✅ End-to-end testing
- ✅ Bug fixes
- ✅ Module 1.5 (Infrastructure) - 100% complete

### Week 7: Documentation & Training
- ✅ Module 1.6 (Docs & Training) - 100% complete
- ✅ Pilot deployment (20 chats)
- ✅ Team training sessions

### Week 8: Launch
- ✅ Full deployment (all chats)
- ✅ Monitoring in place
- ✅ Post-launch support (1 week intensive)
- ✅ Handover to client

---

## 💰 Payment Schedule

**Total: ₽1,420,000**

1. **30% Prepayment (₽426,000):**
   - Upon contract signing
   - Triggers: Start development

2. **40% Milestone Payment (₽568,000):**
   - Upon completion of development
   - Triggers: Demo to client, all modules working in staging

3. **30% Final Payment (₽426,000):**
   - Upon production deployment
   - Triggers: All chats live, training complete, 1-week post-launch support done

---

## 🛠️ Tech Stack Summary

### Backend (Node.js on First VDS)
- **Runtime:** Node.js 18+ (TypeScript strict mode)
- **Framework:** Express.js or Fastify
- **Database Client:** Supabase JS SDK (@supabase/supabase-js)
- **Queue:** BullMQ with Redis
- **Validation:** Zod for input schemas
- **Testing:** Vitest + Supertest
- **Logging:** Pino (structured logs)

### Frontend (Admin Panel - Next.js)
- **Framework:** Next.js 14+ (App Router with React Server Components)
- **UI:** Tailwind CSS + shadcn/ui components
- **Database:** Supabase JS Client (direct queries with RLS enforcement)
- **Auth:** Supabase Auth (email/password, httpOnly cookies)
- **Realtime:** Supabase Realtime subscriptions (WebSocket)
- **Charts:** Recharts or Chart.js for analytics dashboards
- **API:** Supabase client (primary), optional tRPC for complex logic

### Bot (Telegram)
- **Library:** Telegraf (recommended) or node-telegram-bot-api
- **State Management:** Redis for conversation state
- **Database:** Supabase JS Client (server-side)
- **Queue:** BullMQ for background jobs (alerts, surveys, reminders)

### Database & Auth (Supabase Cloud)
- **Database:** Supabase PostgreSQL 15+ (cloud-hosted, EU region)
- **Auth:** Supabase Auth (built-in, bcrypt password hashing)
- **Storage:** Supabase Storage (document uploads, invoices, files)
- **Realtime:** Supabase Realtime (WebSocket subscriptions for live updates)
- **RLS:** Row Level Security policies for role-based data isolation
- **Backups:** Point-in-Time Recovery (PITR) enabled

### Cache & Queue (Self-hosted on VDS)
- **Cache:** Redis 7+ (for BullMQ and bot conversation state)
- **Queue:** BullMQ (background job processing)

### AI/NLP
- **Provider:** OpenRouter or OpenAI API
- **Recommended Models:** GPT-4 Turbo, Claude 3.5 Sonnet, or Russian LLMs via OpenRouter
- **Fallback:** Keyword-based classification (hardcoded rules)
- **Cost Optimization:** Result caching for identical messages

### Hosting (Hybrid Deployment)
- **Bot & Workers:** First VDS (Russian VDS provider)
  - VDS Specs: 2-4 vCPU, 4-8 GB RAM, 50-100 GB SSD
  - OS: Ubuntu 22.04 LTS
  - Components: Node.js app, Redis, Nginx, Prometheus, Grafana
- **Database & Auth:** Supabase Cloud (EU region, auto-scaling)
- **Monitoring:** Prometheus + Grafana (VDS) + Supabase Dashboard + UptimeRobot
- **SSL:** Let's Encrypt via Nginx

### DevOps
- **CI/CD:** GitHub Actions (deploy to VDS via SSH)
- **Containers:** Docker + Docker Compose (multi-service orchestration)
- **Process Manager:** PM2 inside Docker containers
- **Reverse Proxy:** Nginx (HTTPS termination, rate limiting)
- **Secrets:** Environment variables (.env.production, GitHub Secrets)

---

## 📞 Communication & Reporting

### Weekly Status Calls
- **When:** Every Monday, 30 minutes
- **Attendees:** PM, Lead Developer, Client
- **Agenda:**
  - Progress update (% complete per module)
  - Demo of completed features
  - Blockers and risks
  - Next week plan

### Bi-Weekly Demos
- **When:** Every other Friday
- **Format:** Live demo in staging environment
- **Feedback:** Collect client feedback, adjust if needed

### Issue Tracking
- **Tool:** GitHub Issues or Jira
- **Categories:** Bug, Feature, Question
- **SLA:** Response within 24 hours (working days)

---

## ✅ Definition of Done

A feature is "Done" when:
1. ✅ Code written and reviewed (PR approved)
2. ✅ Unit tests written (≥80% coverage)
3. ✅ Integration tests pass
4. ✅ Manual QA tested (no critical bugs)
5. ✅ Documentation updated
6. ✅ Deployed to staging
7. ✅ Client approved (demo sign-off)

---

## 🎓 Appendix: Russian Accounting Context

### Common Request Types (for spam filter training)
1. **Оплата счёта** (Invoice payment)
2. **Сверка** (Reconciliation)
3. **Выставить/отправить документы** (Issue/send documents)
4. **Консультация** (Consultation)
5. **Отчёты** (Reports)
6. **Общение с ФНС** (Communication with tax authorities)

### Typical "Spam" Messages (ignore these)
- "Спасибо" (Thank you)
- "Ок" (Ok)
- "👍" (emoji only)
- "Хорошо" (Good)
- "Договорились" (Agreed)

### Typical "Real Request" Patterns
- "Где мой счёт?" (Where is my invoice?)
- "Когда будет готов отчёт?" (When will report be ready?)
- "Нужна справка 2-НДФЛ" (Need certificate 2-NDFL)
- "Не могу оплатить" (Can't pay)

### Russian Holidays (for calendar)
- Jan 1-8: New year holidays
- Feb 23: Defender of Fatherland Day
- Mar 8: International Women's Day
- May 1: Labour Day
- May 9: Victory Day
- Jun 12: Russia Day
- Nov 4: Unity Day

---

## 🎯 Final Notes for Implementation

### Code Quality Standards
- **TypeScript strict mode** enabled
- **ESLint + Prettier** configured
- **No `any` types** (use `unknown` if necessary)
- **Error handling:** All async functions use try/catch
- **Logging:** Structured logging (Winston or Pino)
- **Security:** Input validation on all API endpoints (Zod)

### Database Design Principles
- **Normalization:** 3NF minimum
- **Indexes:** On all foreign keys and frequently queried columns
- **Timestamps:** `created_at`, `updated_at` on all tables
- **Soft deletes:** Use `deleted_at` instead of hard deletes
- **Audit trail:** Track who created/updated each record

### API Design Principles
- **RESTful** or **tRPC** (type-safe preferred)
- **Pagination:** Limit 100 items per page max
- **Filtering:** Support common filters (date range, status, etc.)
- **Sorting:** Support ASC/DESC on key columns
- **Error responses:** Consistent format (status code, message, details)

### Bot UX Principles
- **Fast responses:** <2s for all commands
- **Clear feedback:** Always acknowledge user action
- **Error recovery:** Helpful error messages, suggest next steps
- **Conversation flow:** Multi-step flows with cancel option
- **Accessibility:** Clear labels, emoji for visual cues

---

## 🚀 Ready to Build!

This prompt provides complete specifications for **Phase 1 of BuhBot**. All requirements are:
- ✅ Measurable (clear acceptance criteria)
- ✅ Testable (defined test cases)
- ✅ Achievable (proven by research and case studies)
- ✅ Time-bound (6-8 weeks delivery)

**Next Steps:**
1. Review this document with team
2. Set up project repository
3. Initialize infrastructure (Supabase project + First VDS)
4. Begin sprint 1: Database schema with RLS policies + SLA monitoring core
5. Ship Phase 1 in 6-8 weeks 🚀

**Questions?** Refer to:
- `/docs/Final-Modular-Offer-With-Hours.md` (detailed breakdown)
- `/docs/Technical-Specification.md` (original client requirements)
- `/docs/Commercial-Offer-Client-Version.md` (client-facing version)

---

**Document Version:** 1.0
**Created:** 2025-11-17
**For:** BuhBot Phase 1 Implementation
**Author:** Claude Code + Igor Maslennikov

---

## 📊 Phase 1 Progress Summary (Updated 2025-11-24)

**Status**: 🟡 **~75% COMPLETE** | **Current Version:** v0.2.0

### Module Completion Status:

| Module | Status | Hours | Completed |
|--------|--------|-------|-----------|
| 1.1 SLA Monitoring | ✅ Done | 178h | v0.1.16 |
| 1.2 Quarterly Feedback | ✅ Done | 142h | v0.2.0 |
| 1.3 Quick Wins | ✅ Done | 160h | v0.2.0 |
| 1.4 Admin Panel | 🟡 60% | 104h | Partial |
| 1.5 Infrastructure | ✅ Done | 52h | v0.1.16 |
| 1.6 Documentation | ❌ TODO | 40h | — |
| 1.7 Landing Page | ❌ TODO | 24h | — |
| **TOTAL** | **~75%** | **700h** | — |

### Completed Milestones:

**v0.1.16 (2025-11-22) - Infrastructure Foundation:**
- ✅ Hybrid VDS + Supabase infrastructure deployed
- ✅ CI/CD pipeline (GitHub Actions)
- ✅ Monitoring (Prometheus + Grafana + Uptime Kuma)
- ✅ Security (HTTPS, RLS, fail2ban)
- ✅ SLA Monitoring system functional

**v0.2.0 (2025-11-24) - Client Feedback & Quick Wins:**
- ✅ Quarterly feedback surveys (Telegram bot)
- ✅ Survey management (Admin Panel)
- ✅ Low rating alerts
- ✅ Client inline menu (/menu command)
- ✅ Template library (/template command)
- ✅ FAQ auto-responses
- ✅ File receipt confirmation
- ✅ NPS analytics dashboard

### Remaining Work:

| Task | Hours | Priority |
|------|-------|----------|
| Main Dashboard (1.4.2) | 20h | P0 |
| User Management (1.4.3) | 16h | P0 |
| FAQ Management (1.4.4) | 16h | P0 |
| Template Management (1.4.5) | 16h | P0 |
| Audit Logs (1.4.6) | 12h | P0 |
| Global Settings (1.4.7) | 4h | P0 |
| Landing Page (1.7) | 24h | P1 |
| Documentation (1.6.1) | 24h | P0 |
| Training (1.6.2) | 16h | P0 |
| **TOTAL REMAINING** | **~148h** | — |

### Key Artifacts:

- **Infrastructure Tasks**: [`specs/001-infrastructure-setup/tasks.md`](../specs/001-infrastructure-setup/tasks.md)
- **SLA Monitoring Tasks**: [`specs/002-sla-monitoring/tasks.md`](../specs/002-sla-monitoring/tasks.md)
- **Feedback & Quick Wins Tasks**: [`specs/003-client-feedback-quick-wins/tasks.md`](../specs/003-client-feedback-quick-wins/tasks.md)
- **Infrastructure Docs**: [`docs/infrastructure/`](../docs/infrastructure/)

### Production URLs:

- **Website**: https://buhbot.aidevteam.ru
- **API Health**: https://buhbot.aidevteam.ru/health
- **Grafana**: http://185.200.177.180:3002
- **Repository**: https://github.com/maslennikov-ig/BuhBot
