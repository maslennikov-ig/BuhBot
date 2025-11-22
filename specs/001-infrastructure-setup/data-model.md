# Data Model: BuhBot Infrastructure & Application Schema

**Feature**: 001-infrastructure-setup
**Date**: 2025-11-17
**Phase**: 1 - Design
**Database**: PostgreSQL 15+ (Supabase Cloud, EU region)

## Overview

This document defines the complete PostgreSQL database schema for BuhBot Phase 1, including tables for SLA monitoring, feedback collection, quick wins (templates, FAQ), admin panel user management, and system configuration. Schema designed for 3NF normalization with Row-Level Security (RLS) policies for role-based access control.

---

## Entities & Relationships

```mermaid
erDiagram
    users ||--o{ chats : "manages (admin/manager)"
    chats ||--o{ client_requests : "has many"
    chats ||--o{ feedback_responses : "has many"
    users ||--o{ client_requests : "assigned to"
    client_requests ||--o{ sla_alerts : "triggers"
    chats ||--o{ working_schedules : "has schedule"
    users ||--o{ templates : "creates"
    users ||--o{ faq_items : "creates"

    users {
        uuid id PK
        text email UK
        text full_name
        text role "admin|manager|observer"
        timestamp created_at
        timestamp updated_at
    }

    chats {
        bigint id PK "Telegram chat ID"
        text chat_type "private|group|supergroup"
        text title
        text accountant_username
        uuid assigned_accountant_id FK
        boolean sla_enabled
        int sla_response_minutes
        timestamp created_at
        timestamp updated_at
    }

    client_requests {
        uuid id PK
        bigint chat_id FK
        bigint message_id
        text message_text
        text client_username
        timestamp received_at
        uuid assigned_to FK
        timestamp response_at
        int response_time_minutes
        text status "pending|in_progress|answered|escalated"
        boolean is_spam
        timestamp created_at
        timestamp updated_at
    }

    sla_alerts {
        uuid id PK
        uuid request_id FK
        text alert_type "warning|breach"
        int minutes_elapsed
        timestamp alert_sent_at
        timestamp acknowledged_at
        uuid acknowledged_by FK
        text resolution_notes
    }

    feedback_responses {
        uuid id PK
        bigint chat_id FK
        uuid request_id FK
        int rating "1-5 stars"
        text comment
        timestamp submitted_at
    }

    working_schedules {
        uuid id PK
        bigint chat_id FK
        int day_of_week "1=Monday, 7=Sunday"
        time start_time
        time end_time
        boolean is_active
    }

    templates {
        uuid id PK
        text title
        text content
        text category "greeting|status|document_request|reminder|closing"
        uuid created_by FK
        int usage_count
        timestamp created_at
        timestamp updated_at
    }

    faq_items {
        uuid id PK
        text question
        text answer
        text keywords ARRAY
        int usage_count
        uuid created_by FK
        timestamp created_at
        timestamp updated_at
    }
```

---

## Table Definitions

### 1. `users` (Supabase Auth Integration)

**Purpose**: Store admin panel users (accountants, managers, observers). Synchronized with Supabase Auth.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | References `auth.users.id` in Supabase Auth |
| email | text | NOT NULL, UNIQUE | User email (from Supabase Auth) |
| full_name | text | NOT NULL | Display name |
| role | text | NOT NULL, CHECK IN ('admin', 'manager', 'observer') | RBAC role |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Account creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last update timestamp |

**Indexes**:
- `idx_users_email` on `email`
- `idx_users_role` on `role`

**RLS Policies**:
- **SELECT**: All authenticated users can read all users (for assignment dropdowns)
- **INSERT**: Only admins can create users
- **UPDATE**: Admins can update all, users can update their own `full_name`
- **DELETE**: Only admins can delete users

---

### 2. `chats`

**Purpose**: Store Telegram chat metadata for SLA tracking and accountant assignments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | bigint | PRIMARY KEY | Telegram chat ID (unique per chat) |
| chat_type | text | NOT NULL, CHECK IN ('private', 'group', 'supergroup') | Chat type |
| title | text | NULL | Chat title (for groups) or client name (for private) |
| accountant_username | text | NULL | Telegram username of assigned accountant |
| assigned_accountant_id | uuid | FOREIGN KEY → users(id) | Assigned accountant for this chat |
| sla_enabled | boolean | NOT NULL, DEFAULT true | Enable SLA monitoring for this chat |
| sla_response_minutes | int | NOT NULL, DEFAULT 60 | SLA threshold in working minutes |
| created_at | timestamptz | NOT NULL, DEFAULT now() | First message timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last update timestamp |

**Indexes**:
- `idx_chats_assigned_accountant` on `assigned_accountant_id`
- `idx_chats_sla_enabled` on `sla_enabled` WHERE `sla_enabled = true`

**RLS Policies**:
- **SELECT**:
  - Admins: all chats
  - Managers: all chats
  - Observers: all chats (read-only)
- **INSERT/UPDATE**: Admins and managers only
- **DELETE**: Admins only

---

### 3. `client_requests`

**Purpose**: Track incoming client messages for SLA monitoring and analytics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique request ID |
| chat_id | bigint | NOT NULL, FOREIGN KEY → chats(id) | Chat where request originated |
| message_id | bigint | NOT NULL | Telegram message ID |
| message_text | text | NOT NULL | Original message content |
| client_username | text | NULL | Client's Telegram username |
| received_at | timestamptz | NOT NULL, DEFAULT now() | Message receipt timestamp |
| assigned_to | uuid | FOREIGN KEY → users(id) | Accountant assigned to this request |
| response_at | timestamptz | NULL | Timestamp of first response |
| response_time_minutes | int | NULL | Working minutes from received_at to response_at |
| status | text | NOT NULL, DEFAULT 'pending', CHECK IN ('pending', 'in_progress', 'answered', 'escalated') | Request lifecycle status |
| is_spam | boolean | NOT NULL, DEFAULT false | Flagged as spam by AI filter |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Record creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last update timestamp |

**Indexes**:
- `idx_client_requests_chat_id` on `chat_id`
- `idx_client_requests_assigned_to` on `assigned_to`
- `idx_client_requests_status` on `status`
- `idx_client_requests_received_at` on `received_at` (for time-series queries)
- `idx_client_requests_is_spam` on `is_spam` WHERE `is_spam = true`

**RLS Policies**:
- **SELECT**:
  - Admins/Managers: all requests
  - Observers: all requests (read-only)
- **INSERT**: Bot application (service role key)
- **UPDATE**:
  - Admins/Managers: all requests
  - Observers: none
- **DELETE**: Admins only

---

### 4. `sla_alerts`

**Purpose**: Log SLA warnings and breaches for monitoring and compliance reporting.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique alert ID |
| request_id | uuid | NOT NULL, FOREIGN KEY → client_requests(id) | Related client request |
| alert_type | text | NOT NULL, CHECK IN ('warning', 'breach') | Warning (80% threshold) or breach (100%) |
| minutes_elapsed | int | NOT NULL | Working minutes elapsed at alert time |
| alert_sent_at | timestamptz | NOT NULL, DEFAULT now() | When alert was triggered |
| acknowledged_at | timestamptz | NULL | When accountant acknowledged alert |
| acknowledged_by | uuid | FOREIGN KEY → users(id) | User who acknowledged alert |
| resolution_notes | text | NULL | Notes added during acknowledgment |

**Indexes**:
- `idx_sla_alerts_request_id` on `request_id`
- `idx_sla_alerts_alert_type` on `alert_type`
- `idx_sla_alerts_alert_sent_at` on `alert_sent_at`

**RLS Policies**:
- **SELECT**: All authenticated users
- **INSERT**: Bot application (service role key)
- **UPDATE**: Admins/Managers (for acknowledgment)
- **DELETE**: Admins only

---

### 5. `feedback_responses`

**Purpose**: Store client satisfaction ratings and feedback comments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique feedback ID |
| chat_id | bigint | NOT NULL, FOREIGN KEY → chats(id) | Chat where feedback was given |
| request_id | uuid | FOREIGN KEY → client_requests(id) | Related request (optional) |
| rating | int | NOT NULL, CHECK (rating >= 1 AND rating <= 5) | Star rating (1-5) |
| comment | text | NULL | Optional text feedback |
| submitted_at | timestamptz | NOT NULL, DEFAULT now() | Submission timestamp |

**Indexes**:
- `idx_feedback_chat_id` on `chat_id`
- `idx_feedback_rating` on `rating`
- `idx_feedback_submitted_at` on `submitted_at`

**RLS Policies**:
- **SELECT**: All authenticated users
- **INSERT**: Bot application (service role key)
- **UPDATE/DELETE**: Admins only

---

### 6. `working_schedules`

**Purpose**: Define working hours per chat for accurate SLA calculation (exclude weekends/off-hours).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique schedule ID |
| chat_id | bigint | NOT NULL, FOREIGN KEY → chats(id) | Chat this schedule applies to |
| day_of_week | int | NOT NULL, CHECK (day_of_week >= 1 AND day_of_week <= 7) | 1=Monday, 7=Sunday |
| start_time | time | NOT NULL | Working hours start (e.g., 09:00:00) |
| end_time | time | NOT NULL | Working hours end (e.g., 18:00:00) |
| is_active | boolean | NOT NULL, DEFAULT true | Enable/disable this schedule |

**Indexes**:
- `idx_working_schedules_chat_id` on `chat_id`
- `idx_working_schedules_day` on `day_of_week`

**Constraints**:
- `UNIQUE (chat_id, day_of_week)` - one schedule per day per chat

**RLS Policies**:
- **SELECT**: All authenticated users
- **INSERT/UPDATE/DELETE**: Admins and managers only

---

### 7. `templates`

**Purpose**: Store reusable message templates for quick responses.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique template ID |
| title | text | NOT NULL | Short descriptive title (e.g., "Greeting - Morning") |
| content | text | NOT NULL | Template message content (supports {{variables}}) |
| category | text | NOT NULL, CHECK IN ('greeting', 'status', 'document_request', 'reminder', 'closing') | Template category |
| created_by | uuid | NOT NULL, FOREIGN KEY → users(id) | User who created template |
| usage_count | int | NOT NULL, DEFAULT 0 | Track popularity for analytics |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last modification timestamp |

**Indexes**:
- `idx_templates_category` on `category`
- `idx_templates_usage_count` on `usage_count DESC` (for "most used" queries)
- `idx_templates_created_by` on `created_by`

**RLS Policies**:
- **SELECT**: All authenticated users
- **INSERT**: Admins and managers
- **UPDATE**:
  - Admins/Managers: all templates
  - Users: only templates they created
- **DELETE**: Admins only

---

### 8. `faq_items`

**Purpose**: Store frequently asked questions and answers for inline button quick replies.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique FAQ ID |
| question | text | NOT NULL | Question text (shown in button) |
| answer | text | NOT NULL | Answer text (sent to client) |
| keywords | text[] | NOT NULL, DEFAULT '{}' | Search keywords for matching |
| usage_count | int | NOT NULL, DEFAULT 0 | Track how often FAQ is used |
| created_by | uuid | NOT NULL, FOREIGN KEY → users(id) | User who created FAQ |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last modification timestamp |

**Indexes**:
- `idx_faq_keywords` GIN index on `keywords` (for fast array searches)
- `idx_faq_usage_count` on `usage_count DESC`
- `idx_faq_created_by` on `created_by`

**RLS Policies**:
- **SELECT**: All authenticated users
- **INSERT**: Admins and managers
- **UPDATE**:
  - Admins/Managers: all FAQs
  - Users: only FAQs they created
- **DELETE**: Admins only

---

## Database Functions & Triggers

### 1. `update_updated_at_column()` Trigger Function

**Purpose**: Automatically update `updated_at` timestamp on row modifications.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Applied to**: `users`, `chats`, `client_requests`, `templates`, `faq_items`

```sql
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- (repeat for other tables)
```

---

### 2. `calculate_working_minutes()` Function

**Purpose**: Calculate elapsed working minutes between two timestamps, excluding off-hours and weekends based on chat's working schedule.

```sql
CREATE OR REPLACE FUNCTION calculate_working_minutes(
    chat_id_param bigint,
    start_time timestamptz,
    end_time timestamptz
) RETURNS int AS $$
DECLARE
    total_minutes int := 0;
    -- Implementation details: iterate through each day, check working_schedules, accumulate minutes
BEGIN
    -- Pseudo-implementation (full logic in migration file)
    -- 1. Get working schedules for chat_id_param
    -- 2. For each day between start_time and end_time:
    --    - Check if day_of_week has schedule and is_active
    --    - Calculate overlap between [start_time, end_time] and [start_time + day's start_time, start_time + day's end_time]
    --    - Add overlap minutes to total_minutes
    -- 3. Return total_minutes

    RETURN total_minutes;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Usage**: Called when updating `client_requests.response_time_minutes` after response is received.

---

### 3. `increment_template_usage()` Trigger Function

**Purpose**: Automatically increment `usage_count` when template is used (tracked by bot application).

```sql
CREATE OR REPLACE FUNCTION increment_template_usage(template_id_param uuid)
RETURNS void AS $$
BEGIN
    UPDATE templates
    SET usage_count = usage_count + 1
    WHERE id = template_id_param;
END;
$$ LANGUAGE plpgsql;
```

**Invoked by**: Bot application after sending template message.

---

### 4. `increment_faq_usage()` Trigger Function

**Purpose**: Automatically increment `usage_count` when FAQ is sent.

```sql
CREATE OR REPLACE FUNCTION increment_faq_usage(faq_id_param uuid)
RETURNS void AS $$
BEGIN
    UPDATE faq_items
    SET usage_count = usage_count + 1
    WHERE id = faq_id_param;
END;
$$ LANGUAGE plpgsql;
```

**Invoked by**: Bot application after sending FAQ answer.

---

## Row-Level Security (RLS) Policies Summary

### Role Definitions (from Supabase Auth):
- **admin**: Full access to all tables (CRUD)
- **manager**: Read all, modify settings (templates, FAQ, schedules), update assignments
- **observer**: Read-only access to all tables

### Policy Implementation:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_items ENABLE ROW LEVEL SECURITY;

-- Example: client_requests SELECT policy
CREATE POLICY "Admins/Managers/Observers can view all requests"
ON client_requests FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager', 'observer')
    )
);

-- Example: templates UPDATE policy
CREATE POLICY "Admins/Managers can update all templates, users can update own"
ON templates FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND (
            users.role IN ('admin', 'manager')
            OR (templates.created_by = auth.uid())
        )
    )
);
```

**Note**: Full RLS policies will be defined in Supabase migration files (`infrastructure/supabase/migrations/`).

---

## Normalization & Constraints

- **3NF Compliance**: All tables are in Third Normal Form (no transitive dependencies)
- **Foreign Key Constraints**: All FKs defined with `ON DELETE CASCADE` (or `RESTRICT` where appropriate)
- **Check Constraints**: Enums validated via CHECK constraints (e.g., `role IN ('admin', 'manager', 'observer')`)
- **Unique Constraints**: Applied to natural keys (e.g., `users.email`, `working_schedules (chat_id, day_of_week)`)

---

## Initial Seed Data

### Default Admin User:
```sql
-- Inserted after first Supabase Auth user creation
INSERT INTO users (id, email, full_name, role)
VALUES (
    '00000000-0000-0000-0000-000000000001', -- Replace with actual auth.users.id
    'admin@buhbot.example.com',
    'System Administrator',
    'admin'
);
```

### Default Working Schedule (Mon-Fri 9-18):
```sql
-- Example for chat_id = 123456789 (replace with actual chat)
INSERT INTO working_schedules (chat_id, day_of_week, start_time, end_time, is_active) VALUES
(123456789, 1, '09:00:00', '18:00:00', true), -- Monday
(123456789, 2, '09:00:00', '18:00:00', true), -- Tuesday
(123456789, 3, '09:00:00', '18:00:00', true), -- Wednesday
(123456789, 4, '09:00:00', '18:00:00', true), -- Thursday
(123456789, 5, '09:00:00', '18:00:00', true); -- Friday
```

### Sample Templates:
```sql
INSERT INTO templates (title, content, category, created_by) VALUES
('Morning Greeting', 'Доброе утро! Чем могу помочь сегодня?', 'greeting', '00000000-0000-0000-0000-000000000001'),
('Status Update', 'Ваш вопрос в работе. Отвечу в течение часа.', 'status', '00000000-0000-0000-0000-000000000001'),
('Document Request', 'Пожалуйста, отправьте документы для проверки.', 'document_request', '00000000-0000-0000-0000-000000000001');
```

---

## Migration Strategy

1. **Supabase Project Setup**: Create project via Supabase dashboard
2. **Initial Migration**: Run `00001_initial_schema.sql` (creates all tables, indexes, functions)
3. **RLS Policies Migration**: Run `00002_rls_policies.sql` (enables RLS, creates policies)
4. **Seed Data**: Run `00003_seed_data.sql` (inserts default admin, working schedules, templates)

**Migration Execution**: Use Supabase CLI (`supabase db push`) or SQL Editor in dashboard.

---

## Performance Optimization

- **Connection Pooling**: Configure Prisma with max 10 connections (per constitution)
- **Query Optimization**: All foreign keys indexed, composite indexes on common query patterns
- **Materialized Views** (Phase 2): For complex analytics queries (e.g., SLA compliance reports)
- **Partitioning** (Future): Partition `client_requests` by `received_at` date if volume exceeds 1M rows

---

**Next**: Generate API contracts for admin panel integration (tRPC routers)
