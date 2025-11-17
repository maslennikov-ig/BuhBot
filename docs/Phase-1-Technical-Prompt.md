# BuhBot - Phase 1 Implementation Prompt

**Project:** BuhBot - Accounting Firm Client Communication Automation Platform
**Phase:** Phase 1 - CORE + QUICK WINS
**Duration:** 6-8 weeks
**Budget:** ₽1,420,000 (~$15,000 USD)

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
6. 152-ФЗ compliance (Russian data localization law)

---

## 🏗️ Architecture Requirements

### Stack Constraints
- **Backend:** Node.js 18+ (TypeScript preferred)
- **Database:** PostgreSQL 14+ (Yandex Managed Database)
- **Cache/Queue:** Redis + BullMQ for job scheduling
- **Bot Framework:** node-telegram-bot-api or Telegraf
- **Frontend:** Next.js 14+ / React for admin panel
- **AI/NLP:** Yandex GPT Lite (for spam filtering, Russian language)
- **Hosting:** Yandex Cloud (MANDATORY for 152-ФЗ compliance)
- **Encryption:** AES-256 at rest, TLS 1.3 in transit

### Infrastructure
- Yandex Compute Cloud VMs
- Yandex Managed PostgreSQL with daily backups
- Yandex Object Storage for file handling
- Yandex Cloud Monitoring for alerting
- 3 months hosting included in budget

---

## 📦 MODULE 1.1: SLA Monitoring System

**Budget:** ₽480,000 | **Hours:** 178 | **Priority:** P0 (MUST-HAVE)

### Requirements

#### 1.1.1 Request Tracking (52 hours)
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
- Integration with Yandex GPT Lite API
- Keyword-based rules as fallback (if API fails)
- Train on real accounting firm chat data (50-100 examples)
- Classify messages: REQUEST | SPAM | GRATITUDE | CLARIFICATION

**Technical Specs:**
```typescript
interface SpamFilterResult {
  is_request: boolean;
  confidence: number; // 0-1
  category: 'REQUEST' | 'SPAM' | 'GRATITUDE' | 'CLARIFICATION';
  reasoning?: string;
}

async function filterSpam(message: string): Promise<SpamFilterResult>
```

**Acceptance Criteria:**
- ✅ 90%+ accuracy on test dataset
- ✅ Response time <2 seconds per message
- ✅ Fallback to keyword matching if API unavailable

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
- Next.js 14+ App Router
- tRPC for type-safe API
- Authentication: simple admin login (email + password)
- Responsive design (Tailwind CSS)

**Acceptance Criteria:**
- ✅ All CRUD operations work
- ✅ Real-time updates (WebSocket or polling every 30s)
- ✅ Mobile-responsive
- ✅ No UI bugs on Chrome/Safari/Firefox

---

## 📦 MODULE 1.2: Quarterly Feedback Collection

**Budget:** ₽280,000 | **Hours:** 142 | **Priority:** P0 (MUST-HAVE)

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

## 📦 MODULE 1.3: Quick Wins (Instant Value Features)

**Budget:** ₽320,000 | **Hours:** 160 | **Priority:** P0 (MUST-HAVE)

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
- Store file reference in database
- Optional: Upload to Yandex Object Storage (Phase 3: integrate with Yandex.Disk)

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

## 📦 MODULE 1.4: Unified Admin Panel

**Budget:** ₽200,000 | **Hours:** 104 | **Priority:** P0 (MUST-HAVE)

### Requirements

#### 1.4.1 Authentication & Roles (16 hours)

**Roles:**
1. **Admin:** Full access
2. **Manager:** View all data, configure settings, no user management
3. **Observer:** Read-only access

**Technical Specs:**
- Email + password authentication
- JWT tokens
- Role-based access control (RBAC)

**Acceptance Criteria:**
- ✅ Each role has correct permissions
- ✅ Secure (no JWT leaks, passwords hashed with bcrypt)

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

#### 1.5.1 Yandex Cloud Deployment (24 hours)

**Components:**
1. **Compute Cloud VM:**
   - 2 vCPU, 4 GB RAM
   - Ubuntu 22.04 LTS
   - Docker + Docker Compose

2. **Managed PostgreSQL:**
   - Standard configuration
   - Daily backups (retain 7 days)

3. **Redis:**
   - For BullMQ job queue
   - For session storage

4. **Object Storage:**
   - For file uploads (invoices, documents)
   - Bucket with lifecycle rules

5. **Monitoring:**
   - Yandex Cloud Monitoring
   - Alerts for:
     - High CPU (>80%)
     - Disk full (>90%)
     - Bot downtime
     - Database connection errors

**Technical Specs:**
- Infrastructure as Code (Terraform recommended)
- Nginx reverse proxy
- SSL certificate (Let's Encrypt)
- PM2 or systemd for process management

**Acceptance Criteria:**
- ✅ All services running in Yandex Cloud
- ✅ Monitoring alerts work
- ✅ SSL enabled
- ✅ Automated backups configured

---

#### 1.5.2 Data Localization & Encryption (16 hours)

**152-ФЗ Compliance Requirements:**
1. All servers physically in Russia (Yandex Cloud guarantees this)
2. Data stored encrypted at rest (AES-256)
3. Data transmitted encrypted (TLS 1.3)
4. Prepared documents for Roskomnadzor registration

**Technical Specs:**
```typescript
// Encrypt sensitive data before storing
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

function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

**Encrypted Fields:**
- Client personal data (name, email, phone)
- Feedback comments
- Chat message content (if stored)

**Acceptance Criteria:**
- ✅ All data at rest encrypted
- ✅ TLS 1.3 enabled for all connections
- ✅ Encryption keys stored in env variables (not in code)
- ✅ Roskomnadzor document template prepared

---

#### 1.5.3 Backup & Disaster Recovery (12 hours)

**Requirements:**
1. **Database backups:**
   - Daily automated backups (PostgreSQL)
   - Retain 30 days
   - Test restore monthly (automated script)

2. **Snapshot strategy:**
   - Weekly VM snapshots
   - Retain 4 weeks

3. **Recovery procedure:**
   - Documented step-by-step guide
   - Recovery Time Objective (RTO): 4 hours
   - Recovery Point Objective (RPO): 24 hours

**Technical Specs:**
- Backup script using `pg_dump`
- Upload backups to Yandex Object Storage
- Monitoring: alert if backup fails

**Acceptance Criteria:**
- ✅ Automated backups run daily
- ✅ Test restore succeeds
- ✅ RTO/RPO documented and achievable

---

## 📦 MODULE 1.6: Documentation & Training

**Budget:** ₽80,000 | **Hours:** 40 | **Priority:** P0 (MUST-HAVE)

### Requirements

#### 1.6.1 Documentation (24 hours)

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
- ✅ All team members attend training
- ✅ Feedback collected
- ✅ Recorded sessions available for future reference

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
1. **152-ФЗ Compliance:**
   - MUST use Yandex Cloud (or other Russian cloud)
   - MUST encrypt data at rest and in transit
   - MUST prepare Roskomnadzor registration docs

2. **Performance:**
   - Bot response time <2 seconds
   - Admin panel loads <3 seconds
   - No downtime during working hours (99.5% uptime target)

3. **Security:**
   - No hardcoded credentials
   - All API endpoints authenticated
   - Role-based access control enforced

4. **Scalability:**
   - Support 100+ chats simultaneously
   - Handle 1000+ requests/day
   - Database optimized for growth

### Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| AI spam filter inaccurate | Medium | Medium | Keyword fallback + manual override |
| Telegram API rate limits | High | Low | Queue system, respect rate limits |
| Manager alert fatigue | Medium | High | Configurable escalation, digest mode |
| Accountants ignore bot | High | Medium | Training, gamification (Phase 2) |
| Client privacy concerns | High | Low | Clear anonymity policy, 152-ФЗ compliance |

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

### Compliance Acceptance
- ✅ 152-ФЗ checklist completed
- ✅ Data encryption verified
- ✅ Roskomnadzor registration docs prepared
- ✅ Security audit passed (basic checklist)

---

## 🚀 Delivery Milestones

### Week 1-2: Requirements & Setup
- ✅ Finalize requirements
- ✅ Yandex Cloud setup
- ✅ Database schema designed
- ✅ Bot token obtained
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

### Backend
- **Runtime:** Node.js 18+ (TypeScript)
- **Framework:** Express.js or Fastify
- **ORM:** Prisma or TypeORM
- **Queue:** BullMQ
- **Validation:** Zod
- **Testing:** Vitest + Supertest

### Frontend (Admin Panel)
- **Framework:** Next.js 14+ (App Router)
- **UI:** Tailwind CSS + shadcn/ui
- **API:** tRPC (type-safe)
- **Charts:** Recharts or Chart.js
- **Auth:** NextAuth.js

### Bot
- **Library:** node-telegram-bot-api or Telegraf
- **State Management:** Redis (for conversation state)

### Database
- **Primary:** PostgreSQL 14+
- **Cache:** Redis
- **Search:** PostgreSQL Full-Text Search (or Typesense for Phase 2)

### AI/NLP
- **Provider:** Yandex GPT Lite (Russian language)
- **Fallback:** Keyword matching

### Hosting
- **Cloud:** Yandex Cloud (MANDATORY)
- **VM:** Yandex Compute Cloud
- **Database:** Yandex Managed PostgreSQL
- **Storage:** Yandex Object Storage
- **Monitoring:** Yandex Cloud Monitoring

### DevOps
- **CI/CD:** GitHub Actions
- **Containers:** Docker + Docker Compose
- **IaC:** Terraform (optional but recommended)
- **Process Manager:** PM2 or systemd

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
- Jan 1-8: New Year holidays
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
3. Initialize infrastructure (Yandex Cloud)
4. Begin sprint 1: Database schema + SLA monitoring core
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
