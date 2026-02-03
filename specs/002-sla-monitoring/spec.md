# Feature Specification: SLA Monitoring System

**Feature Branch**: `002-sla-monitoring`
**Created**: 2025-11-22
**Status**: Draft
**Input**: MODULE 1.1 from Phase-1-Technical-Prompt.md

## Clarifications

### Session 2025-11-22

- Q: Какова политика хранения данных сообщений? → A: 3 года
- Q: Конфигурация менеджеров для алертов? → A: Один глобальный + per-chat override + дополнительные менеджеры
- Q: Длина превью сообщения в алертах? → A: 500 символов
- Q: Порог уверенности AI для принятия классификации? → A: 0.7 (70%)
- Q: Какой ответ бухгалтера останавливает SLA таймер? → A: Любое сообщение

## Overview

Build a comprehensive SLA monitoring system for accounting firms to track client request response times, automatically detect real requests vs spam, account for working hours in SLA calculations, alert managers on violations, and provide an admin panel for configuration and analytics.

**Business Value**: 100% visibility into accountant response times, early detection of service quality issues, and 4x productivity increase through automation.

## User Scenarios & Testing

### User Story 1 - Client Sends Request (Priority: P1)

A client sends a message in their Telegram chat asking a question or requesting a document. The system automatically detects this as a real request (not spam/gratitude), starts the SLA timer during working hours only, and logs the request for tracking.

**Independent Test**: Send a question message "Где мой счёт?" to the bot and verify SLA timer starts within 5 seconds.

**Acceptance Scenarios**:

1. **Given** a client chat is monitored, **When** client sends "Где мой счёт?" at 10:00 Monday, **Then** system classifies as REQUEST and starts SLA timer immediately
2. **Given** a client chat is monitored, **When** client sends "Спасибо!" at any time, **Then** system classifies as GRATITUDE and does NOT start SLA timer
3. **Given** a client chat is monitored, **When** client sends a question at 20:00 Friday, **Then** SLA timer is scheduled to start at 9:00 Monday (next working day)

---

### User Story 2 - Accountant Responds (Priority: P1)

An accountant sends a reply to a client request. The system detects the response, stops the SLA timer, and calculates the response time (working hours only). The request is marked as answered.

**Independent Test**: After a client request, send a response from accountant and verify SLA timer stops and response time is calculated.

**Acceptance Scenarios**:

1. **Given** an open request with SLA timer running, **When** assigned accountant sends any message, **Then** SLA timer stops and response time is recorded
2. **Given** request sent at 17:55 Friday, **When** accountant responds at 9:05 Monday, **Then** response time is calculated as 10 minutes (5 min Friday + 5 min Monday)
3. **Given** an open request, **When** someone other than assigned accountant responds, **Then** SLA timer continues (unless configured otherwise)

---

### User Story 3 - Manager Receives SLA Alert (Priority: P1)

When a client request goes unanswered beyond the SLA threshold (default 60 minutes working time), the manager receives an immediate Telegram alert with request details and action buttons.

**Independent Test**: Create a request and wait 60+ minutes working time - verify manager receives alert with correct information and working buttons.

**Acceptance Scenarios**:

1. **Given** an unanswered request for 60 minutes working time, **When** SLA threshold is breached, **Then** manager receives Telegram alert within 60 seconds
2. **Given** an SLA violation alert, **When** manager clicks "Notify Accountant", **Then** accountant receives a ping message
3. **Given** an escalated request, **When** no response after 30 more minutes, **Then** manager receives follow-up alert (max 5 escalations)
4. **Given** an SLA violation, **When** manager clicks "Mark Resolved", **Then** escalation chain stops

---

### User Story 4 - Admin Configures Working Hours (Priority: P2)

A system administrator configures default working hours, per-chat overrides, and holiday calendar through the admin panel. SLA calculations respect these settings.

**Independent Test**: Configure custom working hours for a chat and verify SLA timer pauses correctly outside those hours.

**Acceptance Scenarios**:

1. **Given** admin panel access, **When** admin sets default hours to Mon-Fri 9:00-18:00 Moscow time, **Then** all new chats inherit these settings
2. **Given** a specific chat, **When** admin sets 24/7 support mode, **Then** SLA timer runs continuously for that chat
3. **Given** admin adds a holiday (Jan 1-8), **When** request is sent during holiday, **Then** SLA timer is paused until first working day

---

### User Story 5 - Admin Views SLA Dashboard (Priority: P2)

Manager views the SLA dashboard to see compliance rates, average response times, violations count, and accountant performance metrics.

**Independent Test**: Navigate to dashboard and verify all metrics display correctly and update in real-time.

**Acceptance Scenarios**:

1. **Given** dashboard access, **When** manager opens dashboard, **Then** sees SLA compliance percentage, average response time, violations today/week/month
2. **Given** new request is answered, **When** dashboard is open, **Then** metrics update within 30 seconds (real-time)
3. **Given** performance page, **When** manager filters by date range, **Then** shows accountant stats for that period with export to CSV option

---

### User Story 6 - Admin Manages Chats (Priority: P2)

Administrator adds monitored chats, assigns accountants to chats, sets per-chat SLA thresholds, and enables/disables monitoring.

**Independent Test**: Add a new chat, assign accountant, set custom SLA threshold, verify monitoring works.

**Acceptance Scenarios**:

1. **Given** chat management page, **When** admin adds new chat, **Then** chat appears in list and monitoring starts
2. **Given** a chat, **When** admin assigns accountant, **Then** that accountant receives alerts for the chat
3. **Given** a chat, **When** admin sets SLA threshold to 30 minutes, **Then** alerts trigger at 30 minutes for that chat only
4. **Given** monitoring enabled for a chat, **When** admin disables monitoring, **Then** no SLA tracking or alerts for that chat

---

### Edge Cases

- What happens when message contains both a question and "thank you"? (Classify as REQUEST if question detected)
- How does system handle accountant who works in multiple chats simultaneously? (Track per-chat, one SLA per request)
- What if client sends multiple messages rapidly? (First message starts timer, subsequent messages do not reset)
- How to handle chats without assigned accountant? (Alert manager to assign, or use default pool)
- What if AI spam filter API is unavailable? (Fall back to keyword-based classification)
- What if manager Telegram is unreachable for alerts? (Queue alerts in database, retry with exponential backoff)

## Requirements

### Functional Requirements

#### Request Tracking

- **FR-001**: System MUST integrate with Telegram Bot API via webhook to receive all messages from monitored chats
- **FR-002**: System MUST classify each incoming message as REQUEST, SPAM, GRATITUDE, or CLARIFICATION
- **FR-003**: System MUST start SLA timer only for messages classified as REQUEST
- **FR-004**: System MUST start timer only during configured working hours, or queue for next working period
- **FR-005**: System MUST store request metadata: client identifier, chat identifier, message content, timestamp, classification, assigned accountant

#### AI Spam Filter

- **FR-006**: System MUST use AI service to classify messages with confidence score (0-1)
- **FR-007**: System MUST fall back to keyword-based classification when AI is unavailable, rate-limited, or confidence score < 0.7
- **FR-008**: System MUST support Russian language patterns (see Appendix in Phase-1-Technical-Prompt.md)
- **FR-009**: System MUST cache classification results for identical messages to optimize costs
- **FR-010**: System MUST log model used for each classification (AI provider or keyword-fallback)

#### Working Hours Calendar

- **FR-011**: System MUST support configurable default working schedule (days, hours, timezone)
- **FR-012**: System MUST allow per-chat schedule overrides (including 24/7 mode)
- **FR-013**: System MUST support holiday calendar configuration
- **FR-014**: System MUST pause SLA timer outside working hours and resume automatically
- **FR-015**: System MUST calculate response time counting only working hours elapsed

#### Manager Alerts

- **FR-016**: System MUST send Telegram alert to configured manager(s) when SLA threshold is breached (supports: global default, per-chat override, additional managers per chat)
- **FR-017**: Alert message MUST include: client name, chat name, accountant name, wait time, request preview (up to 500 characters)
- **FR-018**: Alert MUST include actionable buttons: Open Chat (deep link), Notify Accountant, Mark Resolved
- **FR-019**: System MUST escalate with reminder every 30 minutes until resolved (max 5 escalations)
- **FR-020**: System MUST track all alerts in database with delivery status

#### Admin Panel - SLA Configuration

- **FR-021**: System MUST provide dashboard showing: SLA compliance rate, average response time, violations count, active alerts
- **FR-022**: System MUST provide chat management: list chats, assign accountants, set per-chat SLA threshold, enable/disable monitoring
- **FR-023**: System MUST provide accountant performance view: table with avg response time, violations, compliance % per accountant
- **FR-024**: System MUST allow date range filtering and CSV export for analytics
- **FR-025**: System MUST provide settings page for: default working hours, global manager Telegram ID(s), holiday calendar, default SLA threshold; per-chat manager override in chat management
- **FR-026**: Dashboard MUST update in real-time without page refresh

### Non-Functional Requirements

- **NFR-001**: SLA timer MUST start within 5 seconds of message receipt
- **NFR-002**: AI classification MUST complete within 2 seconds per message
- **NFR-003**: SLA alerts MUST be sent within 60 seconds of breach detection
- **NFR-004**: Spam filter MUST achieve 90%+ accuracy on test dataset
- **NFR-005**: Real requests MUST be detected with 95%+ recall
- **NFR-006**: Admin panel MUST load within 3 seconds
- **NFR-007**: System MUST support 100+ monitored chats simultaneously
- **NFR-008**: System MUST handle 1000+ requests per day
- **NFR-009**: Cost per AI classification MUST be under 0.50 RUB

### Key Entities

- **ClientRequest**: Represents a tracked client request (id, chat_id, client_id, message, timestamp, classification, sla_timer_started, responded_at, response_time_minutes, assigned_accountant_id, status)
- **WorkingSchedule**: Working hours configuration per chat (chat_id, timezone, working_days, start_time, end_time, holidays)
- **SLAAlert**: Manager alert record (id, request_id, manager_telegram_id, violation_time_minutes, escalation_count, resolved_at, resolved_by)
- **Chat**: Monitored Telegram chat (id, telegram_chat_id, name, assigned_accountant_id, manager_telegram_ids[], sla_threshold_minutes, monitoring_enabled)
- **User**: System user who handles client requests (id, telegram_id, name, telegram_username, email, role, status) — Note: `telegram_id` (BigInt) is required for response detection and direct notifications; maps to Prisma `User` model with roles (admin, manager, observer)

## Success Criteria

### Measurable Outcomes

- **SC-001**: 95% of real client requests are correctly detected and tracked (recall)
- **SC-002**: 90% of spam/gratitude messages are correctly ignored (precision)
- **SC-003**: SLA timer starts within 5 seconds of message receipt
- **SC-004**: Manager alerts are delivered within 60 seconds of SLA breach
- **SC-005**: System tracks response times accurately to within 1 minute
- **SC-006**: Dashboard displays real-time updates within 30 seconds of data changes
- **SC-007**: Accountant performance reports are exportable and accurate
- **SC-008**: System handles peak load of 1000 requests/day without degradation

## Assumptions

- Telegram Bot has been registered and API token is available
- Working hours default to Moscow timezone (Europe/Moscow) Mon-Fri 9:00-18:00
- Data retention: Client request messages and metadata stored for 3 years, then automatically purged
- SLA threshold defaults to 60 minutes working time unless overridden
- Messages from bot administrators/system are excluded from tracking
- First accountant response (any message) stops SLA timer - no content filtering applied
- Russian federal holidays are pre-configured for the current year
- AI service (OpenRouter/OpenAI) is available and configured
- Manager has an active Telegram account for receiving alerts

## Out of Scope

- Multi-language support beyond Russian
- Client satisfaction surveys (separate module 1.2)
- Quick response buttons for accountants (separate module 1.3)
- FAQ auto-responses (separate module 1.3)
- File receipt confirmation (separate module 1.3)
- Response templates (separate module 1.3)
- Audit logging (module 1.4)
- User management CRUD (module 1.4)

## Dependencies

- **Infrastructure**: Completed in Phase 1 (001-infrastructure-setup)
  - VDS server with Docker, Nginx, SSL
  - Supabase database with RLS policies
  - Redis for queues and state
  - Monitoring stack (Prometheus, Grafana)
- **External Services**:
  - Telegram Bot API
  - OpenRouter or OpenAI API for spam classification
