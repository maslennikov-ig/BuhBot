# Feature Specification: Client Feedback & Quick Wins

**Feature Branch**: `003-client-feedback-quick-wins`
**Created**: 2025-11-24
**Status**: Draft
**Input**: "Modules 1.2 (Quarterly Feedback Collection) and 1.3 (Quick Wins - Client & Accountant Tools)"

## Clarifications

### Session 2025-11-24

- Q: Что происходит, если клиент не отвечает на опрос? → A: Напоминание на 2-й день, затем уведомление менеджера чата о неответе клиента
- Q: Как обрабатывать сбои доставки Telegram-сообщений? → A: 5 повторных попыток в течение 1 часа, затем пометить как "не доставлено" и уведомить админа
- Q: Когда опрос считается закрытым? → A: Настраиваемый срок действия в админке (по умолчанию 7 дней) + возможность ручного закрытия менеджером

## Overview

This specification covers two modules designed to improve client engagement and accountant efficiency:

- **Module 1.2**: Automated quarterly satisfaction surveys with role-based access to feedback data
- **Module 1.3**: Productivity tools for clients and accountants including inline menus, templates, and auto-responses

## User Scenarios & Testing

### User Story 1 - Client Receives Quarterly Survey (Priority: P1)

A client using BuhBot receives a satisfaction survey quarterly via Telegram. They rate their experience on a 1-5 star scale and optionally provide written feedback. The process is quick and non-intrusive.

**Independent Test**: Client can complete a survey in under 30 seconds by tapping rating buttons

**Acceptance Scenarios**:

1. **Given** a client has been active in the last quarter, **When** the quarterly survey job runs, **Then** the client receives a survey message with 1-5 star rating buttons
2. **Given** a client receives a survey, **When** they tap a rating button, **Then** their rating is recorded and they see a thank-you confirmation
3. **Given** a client has rated, **When** they want to add a comment, **Then** they can reply with text that gets attached to their feedback

---

### User Story 2 - Manager Views Full Feedback Details (Priority: P1)

A manager accesses the Admin Panel to view complete feedback data including client identifiers, ratings, comments, and trends. They can filter by time period, rating, and accountant to identify areas for improvement.

**Independent Test**: Manager can view individual feedback entries with client and accountant attribution

**Acceptance Scenarios**:

1. **Given** a manager logs into the Admin Panel, **When** they navigate to the Feedback section, **Then** they see all feedback entries with client usernames, ratings, comments, and timestamps
2. **Given** feedback data exists, **When** the manager applies filters (date range, rating, accountant), **Then** the list updates to show matching entries
3. **Given** a manager views the feedback dashboard, **When** they look at the summary widgets, **Then** they see Average Rating, NPS score, and trend charts

---

### User Story 3 - Accountant Views Anonymous Aggregate Feedback (Priority: P1)

An accountant accesses feedback data but only sees aggregate statistics and anonymized comments. They cannot identify which specific client left which rating. This protects client privacy while still providing useful performance insights.

**Independent Test**: Accountant sees aggregate stats without any client-identifying information

**Acceptance Scenarios**:

1. **Given** an accountant logs into the Admin Panel, **When** they navigate to the Feedback section, **Then** they see only aggregate statistics (average rating, distribution chart) without individual entries
2. **Given** an accountant views feedback, **When** they look at comments, **Then** comments are shown without client names or chat identifiers
3. **Given** an accountant's role in the system, **When** they attempt to access detailed feedback via API, **Then** the request is denied with a permission error

---

### User Story 4 - Manager Receives Low Rating Alert (Priority: P1)

When a client submits a low satisfaction rating (3 stars or below), the system immediately notifies managers via Telegram so they can follow up quickly.

**Independent Test**: Manager receives Telegram notification within 1 minute of low rating submission

**Acceptance Scenarios**:

1. **Given** a client submits a 1, 2, or 3 star rating, **When** the feedback is saved, **Then** all designated managers receive a Telegram alert with client info, rating, and comment
2. **Given** a client submits a 4 or 5 star rating, **When** the feedback is saved, **Then** no alert is sent
3. **Given** a low rating alert is sent, **When** the manager views it, **Then** it includes a direct link to the client's chat in the Admin Panel

---

### User Story 5 - Client Uses Inline Menu (Priority: P2)

A client interacting with BuhBot has persistent menu buttons for common actions. They can quickly check document status, contact their accountant, or request a new service without typing commands.

**Independent Test**: Client can access all menu options with a single tap

**Acceptance Scenarios**:

1. **Given** a client starts a conversation with BuhBot, **When** they view the chat, **Then** they see persistent menu buttons: "Document Status", "Contact Accountant", "Request Service"
2. **Given** a client taps "Document Status", **When** the bot responds, **Then** it shows the status of their recent document submissions
3. **Given** a client taps "Contact Accountant", **When** the bot responds, **Then** it notifies the assigned accountant and confirms to the client
4. **Given** a client taps "Request Service", **When** the bot responds, **Then** it presents a list of available services or prompts for details

---

### User Story 6 - Accountant Uses Template Library (Priority: P2)

An accountant can quickly send pre-saved response templates to clients using a command. This saves time on repetitive responses and ensures consistent messaging.

**Independent Test**: Accountant sends a template with a single command

**Acceptance Scenarios**:

1. **Given** an accountant is in a client chat, **When** they type "/template invoice", **Then** the bot sends the "invoice" template text to the client
2. **Given** an accountant types "/template", **When** no template name is specified, **Then** the bot shows a list of available templates
3. **Given** a template contains variables like {{client_name}}, **When** the accountant uses it, **Then** variables are replaced with actual values from the client record
4. **Given** an accountant wants to manage templates, **When** they access the Admin Panel Templates section, **Then** they can create, edit, and delete templates

---

### User Story 7 - Auto-File Confirmation (Priority: P2)

When a client uploads a document (file, photo, etc.) to the chat, the bot automatically acknowledges receipt with confirmation and metadata. This assures clients their documents were received.

**Independent Test**: Client sees confirmation message immediately after uploading a file

**Acceptance Scenarios**:

1. **Given** a client uploads a document, **When** the bot receives it, **Then** it replies with "File received" and shows filename, file size, and timestamp
2. **Given** a client uploads an image, **When** the bot receives it, **Then** it acknowledges with "Image received" and metadata
3. **Given** a client uploads multiple files, **When** the bot receives them, **Then** each file gets individual confirmation

---

### User Story 8 - FAQ Auto-Responses (Priority: P3)

The bot can automatically respond to common questions using keyword matching. This provides instant answers to frequently asked questions without requiring accountant intervention.

**Independent Test**: Client receives automatic answer to a common question within 5 seconds

**Acceptance Scenarios**:

1. **Given** a client asks about pricing (message contains "price", "cost", "tariff"), **When** the bot processes the message, **Then** it responds with the FAQ answer for pricing
2. **Given** a client asks about deadlines (message contains "deadline", "when", "срок"), **When** the bot processes the message, **Then** it responds with the FAQ answer for deadlines
3. **Given** no FAQ keyword matches, **When** the bot processes a message, **Then** normal message handling continues without auto-response
4. **Given** an admin wants to manage FAQ entries, **When** they access the Admin Panel FAQ section, **Then** they can create, edit, and delete FAQ items with keywords

---

### Edge Cases

- What happens when a client submits feedback multiple times in a quarter? (Allow multiple submissions, track all)
- How does the system handle clients who block the bot before survey completion? (Mark as undelivered, skip)
- What if a template variable has no value? (Skip variable - remove {{variable}} from output)
- What if FAQ keywords match multiple entries? (Return highest usage count match)
- How are surveys sent to inactive clients? (Define "active" as having messages in the quarter)
- What if client doesn't respond to survey? (Send reminder on day 2; if still no response, notify chat manager that client declined to respond)
- What if Telegram message delivery fails? (See NFR-006)

## Requirements

### Functional Requirements

#### Module 1.2: Feedback Collection

- **FR-001**: System MUST send quarterly satisfaction surveys to all clients who have been active in the past quarter
- **FR-002**: System MUST present 1-5 star rating options as inline buttons in the survey message
- **FR-003**: System MUST allow clients to optionally add a text comment after rating
- **FR-004**: System MUST record all feedback with timestamp, chat ID, rating, and optional comment
- **FR-005**: System MUST restrict accountants to viewing only aggregate feedback data (average rating, distribution, anonymized comments)
- **FR-006**: System MUST allow managers to view complete feedback data including client identifiers
- **FR-007**: System MUST send real-time Telegram alerts to managers for ratings of 3 stars or lower
- **FR-008**: System MUST display feedback analytics in the Admin Panel (Average Rating, NPS, Recent Comments, Trend Charts)
- **FR-009**: System MUST schedule feedback surveys using a quarterly cron job (configurable date)
- **FR-010**: System MUST send one survey reminder to non-responding clients on day 2 after initial survey delivery
- **FR-011**: System MUST notify the chat's assigned manager when a client does not respond to survey after reminder
- **FR-012**: System MUST provide configurable survey validity period in Admin Panel settings (default: 7 days)
- **FR-013**: System MUST allow managers to manually close an active survey campaign from Admin Panel

#### Module 1.3: Quick Wins

- **FR-014**: System MUST display a persistent inline menu to clients with "Document Status", "Contact Accountant", "Request Service" buttons
- **FR-015**: System MUST allow accountants to use templates via "/template [name]" command
- **FR-016**: System MUST support variable substitution in templates using {{variable}} syntax
- **FR-017**: System MUST automatically confirm document/file receipt with filename, size, and timestamp
- **FR-018**: System MUST provide keyword-based FAQ auto-responses for common questions
- **FR-019**: System MUST allow management of templates and FAQ items through the Admin Panel

### Non-Functional Requirements

- **NFR-001**: Survey delivery MUST complete within 4 hours for up to 10,000 clients
- **NFR-002**: Low-rating alerts MUST be delivered within 60 seconds of feedback submission
- **NFR-003**: Auto-file confirmation MUST respond within 3 seconds of file receipt
- **NFR-004**: FAQ matching MUST respond within 2 seconds
- **NFR-005**: All feedback data MUST be retained according to system data retention policy
- **NFR-006**: Failed Telegram message delivery MUST retry up to 5 times over 1 hour with exponential backoff, then mark as "undelivered" and notify admin

### Key Entities

- **FeedbackResponse** (existing): Extended to support quarterly surveys. Contains chatId, rating (1-5), comment, submittedAt, and new fields for survey tracking.
- **FeedbackSurvey** (new): Tracks survey campaigns with scheduledAt, sentAt, expiresAt, closedAt, closedBy, responseCount, status (active/closed/expired), and average rating.
- **Template** (existing): Already defined in schema. Stores reusable message templates with category, content, and variable support.
- **FaqItem** (existing): Already defined in schema. Stores FAQ entries with question, answer, keywords, and usage tracking.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 80% of quarterly surveys are completed within 48 hours of delivery
- **SC-002**: Managers receive low-rating alerts within 60 seconds of submission 100% of the time
- **SC-003**: Client document confirmation response time averages under 2 seconds
- **SC-004**: FAQ auto-responses correctly match queries at least 90% of the time
- **SC-005**: Accountant template usage reduces average response time by 30%
- **SC-006**: 95% of active clients successfully receive quarterly surveys

## Assumptions

- "Active client" is defined as a client who sent at least one message in the past quarter
- Quarterly surveys are sent on the first Monday of each calendar quarter (January, April, July, October)
- NPS (Net Promoter Score) is calculated as: % Promoters (4-5) minus % Detractors (1-3)
- Template variables available: {{client_name}}, {{accountant_name}}, {{chat_title}}, {{date}}
- Low rating threshold is fixed at 3 stars (1, 2, or 3 triggers alert)
- Observer role has same data access as accountant role (aggregate only)
- Default survey validity period is 7 days (configurable in Admin Panel settings)

## Out of Scope

- Mobile push notifications (Telegram only)
- Email survey delivery
- Multi-language survey support (Russian only for MVP)
- Survey customization per client segment
- Advanced analytics (cohort analysis, predictive scoring)
- Template approval workflow
