# BuhBot Prisma Schema Summary

**Generated**: 2025-11-17
**Source**: `/specs/001-infrastructure-setup/data-model.md`
**Schema Version**: 1.0.0 (Phase 1)
**Total Lines**: 234

## Schema Validation Status

- **Syntax**: Valid (Prisma formatted successfully)
- **Models**: 8 tables fully defined
- **Enums**: 5 enums defined
- **Relationships**: All foreign keys properly configured
- **Indexes**: All required indexes defined
- **Environment**: Requires `DATABASE_URL` and `DIRECT_URL` configuration

## Models Overview

### 1. User (users)

**Purpose**: Admin panel users synchronized with Supabase Auth

| Column    | Type          | Constraints      | Description                |
| --------- | ------------- | ---------------- | -------------------------- |
| id        | String (UUID) | PRIMARY KEY      | Supabase Auth user ID      |
| email     | String        | UNIQUE, NOT NULL | User email                 |
| fullName  | String        | NOT NULL         | Display name               |
| role      | UserRole      | NOT NULL         | admin/manager/observer     |
| createdAt | DateTime      | DEFAULT now()    | Account creation timestamp |
| updatedAt | DateTime      | AUTO UPDATE      | Last update timestamp      |

**Relations**:

- assignedChats → Chat[] (one-to-many)
- assignedRequests → ClientRequest[] (one-to-many)
- acknowledgedAlerts → SlaAlert[] (one-to-many)
- createdTemplates → Template[] (one-to-many)
- createdFaqItems → FaqItem[] (one-to-many)

**Indexes**: email, role

---

### 2. Chat (chats)

**Purpose**: Telegram chat metadata for SLA tracking

| Column               | Type          | Constraints             | Description               |
| -------------------- | ------------- | ----------------------- | ------------------------- |
| id                   | BigInt        | PRIMARY KEY             | Telegram chat ID          |
| chatType             | ChatType      | NOT NULL                | private/group/supergroup  |
| title                | String        | NULLABLE                | Chat title or client name |
| accountantUsername   | String        | NULLABLE                | Telegram username         |
| assignedAccountantId | String (UUID) | NULLABLE, FK → users.id | Assigned accountant       |
| slaEnabled           | Boolean       | DEFAULT true            | Enable SLA monitoring     |
| createdAt            | DateTime      | DEFAULT now()           | First message timestamp   |
| updatedAt            | DateTime      | AUTO UPDATE             | Last update timestamp     |

**Relations**:

- assignedAccountant → User (many-to-one)
- clientRequests → ClientRequest[] (one-to-many)
- feedbackResponses → FeedbackResponse[] (one-to-many)
- workingSchedules → WorkingSchedule[] (one-to-many)

**Indexes**: assignedAccountantId, slaEnabled (conditional)

---

### 3. ClientRequest (client_requests)

**Purpose**: Incoming client messages with SLA tracking

| Column              | Type          | Constraints               | Description                            |
| ------------------- | ------------- | ------------------------- | -------------------------------------- |
| id                  | String (UUID) | PRIMARY KEY, DEFAULT uuid | Unique request ID                      |
| chatId              | BigInt        | NOT NULL, FK → chats.id   | Chat where request originated          |
| messageId           | BigInt        | NOT NULL                  | Telegram message ID                    |
| messageText         | String        | NOT NULL                  | Original message content               |
| clientUsername      | String        | NULLABLE                  | Client's Telegram username             |
| receivedAt          | DateTime      | DEFAULT now()             | Message receipt timestamp              |
| assignedTo          | String (UUID) | NULLABLE, FK → users.id   | Assigned accountant                    |
| responseAt          | DateTime      | NULLABLE                  | First response timestamp               |
| responseTimeMinutes | Int           | NULLABLE                  | Working minutes to respond             |
| status              | RequestStatus | DEFAULT pending           | pending/in_progress/answered/escalated |
| isSpam              | Boolean       | DEFAULT false             | AI spam filter flag                    |
| createdAt           | DateTime      | DEFAULT now()             | Record creation timestamp              |
| updatedAt           | DateTime      | AUTO UPDATE               | Last update timestamp                  |

**Relations**:

- chat → Chat (many-to-one)
- assignedUser → User (many-to-one)
- slaAlerts → SlaAlert[] (one-to-many)
- feedbackResponses → FeedbackResponse[] (one-to-many)

**Indexes**: chatId, assignedTo, status, receivedAt, isSpam (conditional)

---

### 4. SlaAlert (sla_alerts)

**Purpose**: SLA warnings and breaches for compliance reporting

| Column          | Type          | Constraints                       | Description                    |
| --------------- | ------------- | --------------------------------- | ------------------------------ |
| id              | String (UUID) | PRIMARY KEY, DEFAULT uuid         | Unique alert ID                |
| requestId       | String (UUID) | NOT NULL, FK → client_requests.id | Related client request         |
| alertType       | AlertType     | NOT NULL                          | warning (80%) or breach (100%) |
| minutesElapsed  | Int           | NOT NULL                          | Working minutes elapsed        |
| alertSentAt     | DateTime      | DEFAULT now()                     | When alert was triggered       |
| acknowledgedAt  | DateTime      | NULLABLE                          | Acknowledgment timestamp       |
| acknowledgedBy  | String (UUID) | NULLABLE, FK → users.id           | Acknowledging user             |
| resolutionNotes | String        | NULLABLE                          | Acknowledgment notes           |

**Relations**:

- request → ClientRequest (many-to-one)
- acknowledgedUser → User (many-to-one)

**Indexes**: requestId, alertType, alertSentAt

---

### 5. FeedbackResponse (feedback_responses)

**Purpose**: Client satisfaction ratings and feedback

| Column      | Type          | Constraints                       | Description                         |
| ----------- | ------------- | --------------------------------- | ----------------------------------- |
| id          | String (UUID) | PRIMARY KEY, DEFAULT uuid         | Unique feedback ID                  |
| chatId      | BigInt        | NOT NULL, FK → chats.id           | Chat where feedback was given       |
| requestId   | String (UUID) | NULLABLE, FK → client_requests.id | Related request (optional)          |
| rating      | Int           | NOT NULL, CHECK 1-5               | Star rating (validated at DB level) |
| comment     | String        | NULLABLE                          | Optional text feedback              |
| submittedAt | DateTime      | DEFAULT now()                     | Submission timestamp                |

**Relations**:

- chat → Chat (many-to-one)
- request → ClientRequest (many-to-one, optional)

**Indexes**: chatId, rating, submittedAt

---

### 6. WorkingSchedule (working_schedules)

**Purpose**: Working hours per chat for SLA calculation

| Column    | Type            | Constraints               | Description                   |
| --------- | --------------- | ------------------------- | ----------------------------- |
| id        | String (UUID)   | PRIMARY KEY, DEFAULT uuid | Unique schedule ID            |
| chatId    | BigInt          | NOT NULL, FK → chats.id   | Chat this schedule applies to |
| dayOfWeek | Int             | NOT NULL, CHECK 1-7       | 1=Monday, 7=Sunday            |
| startTime | DateTime (Time) | NOT NULL                  | Working hours start           |
| endTime   | DateTime (Time) | NOT NULL                  | Working hours end             |
| isActive  | Boolean         | DEFAULT true              | Enable/disable schedule       |

**Relations**:

- chat → Chat (many-to-one)

**Unique Constraints**: (chatId, dayOfWeek)
**Indexes**: chatId, dayOfWeek

---

### 7. Template (templates)

**Purpose**: Reusable message templates with variable substitution

| Column     | Type             | Constraints               | Description                                       |
| ---------- | ---------------- | ------------------------- | ------------------------------------------------- |
| id         | String (UUID)    | PRIMARY KEY, DEFAULT uuid | Unique template ID                                |
| title      | String           | NOT NULL                  | Short descriptive title                           |
| content    | String           | NOT NULL                  | Template message (supports {{variables}})         |
| category   | TemplateCategory | NOT NULL                  | greeting/status/document_request/reminder/closing |
| createdBy  | String (UUID)    | NOT NULL, FK → users.id   | Template creator                                  |
| usageCount | Int              | DEFAULT 0                 | Popularity tracking                               |
| createdAt  | DateTime         | DEFAULT now()             | Creation timestamp                                |
| updatedAt  | DateTime         | AUTO UPDATE               | Last modification timestamp                       |

**Relations**:

- creator → User (many-to-one)

**Indexes**: category, usageCount (DESC), createdBy

---

### 8. FaqItem (faq_items)

**Purpose**: FAQ with keyword search for quick replies

| Column     | Type          | Constraints               | Description                        |
| ---------- | ------------- | ------------------------- | ---------------------------------- |
| id         | String (UUID) | PRIMARY KEY, DEFAULT uuid | Unique FAQ ID                      |
| question   | String        | NOT NULL                  | Question text (shown in button)    |
| answer     | String        | NOT NULL                  | Answer text (sent to client)       |
| keywords   | String[]      | DEFAULT []                | Search keywords (PostgreSQL array) |
| usageCount | Int           | DEFAULT 0                 | Usage tracking                     |
| createdBy  | String (UUID) | NOT NULL, FK → users.id   | FAQ creator                        |
| createdAt  | DateTime      | DEFAULT now()             | Creation timestamp                 |
| updatedAt  | DateTime      | AUTO UPDATE               | Last modification timestamp        |

**Relations**:

- creator → User (many-to-one)

**Indexes**: usageCount (DESC), createdBy
**Special**: GIN index on keywords[] (created at DB level via migration)

---

## Enums

### UserRole

```prisma
enum UserRole {
  admin      // Full access to all tables (CRUD)
  manager    // Read all, modify settings, update assignments
  observer   // Read-only access to all tables
}
```

### ChatType

```prisma
enum ChatType {
  private      // One-on-one chat with client
  group        // Group chat
  supergroup   // Supergroup chat
}
```

### RequestStatus

```prisma
enum RequestStatus {
  pending      // Awaiting response
  in_progress  // Being handled
  answered     // Response sent
  escalated    // Escalated to supervisor
}
```

### AlertType

```prisma
enum AlertType {
  warning      // 80% of SLA threshold reached
  breach       // 100% of SLA threshold exceeded
}
```

### TemplateCategory

```prisma
enum TemplateCategory {
  greeting           // Welcome messages
  status            // Status updates
  document_request  // Document collection
  reminder          // Follow-up reminders
  closing           // Conversation closings
}
```

---

## Database Features NOT in Prisma Schema

These features are managed at the Supabase database level via migrations:

### 1. Row-Level Security (RLS) Policies

- Role-based access control (admin/manager/observer)
- User-specific data isolation
- Read-only policies for observers

### 2. Database Triggers

- `update_updated_at_column()`: Auto-update `updated_at` timestamps
- `increment_template_usage()`: Track template usage
- `increment_faq_usage()`: Track FAQ usage

### 3. Database Functions

- `calculate_working_minutes()`: SLA calculation excluding off-hours
- Custom validation functions

### 4. Advanced Indexes

- GIN index on `faq_items.keywords[]` for full-text search
- Partial indexes for conditional queries

### 5. Check Constraints

- `rating` between 1-5 (feedback_responses)
- `dayOfWeek` between 1-7 (working_schedules)
- Enum value validation

---

## Connection Configuration

### Supabase Connection Pooling

**DATABASE_URL** (Pooled connection for queries):

```
postgresql://postgres.PROJECT-REF:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**DIRECT_URL** (Direct connection for migrations):

```
postgresql://postgres:PASSWORD@db.PROJECT-REF.supabase.co:5432/postgres
```

**Why Two URLs?**:

- **DATABASE_URL**: Uses Supabase Supavisor pooler (PgBouncer) for efficient connection reuse
- **DIRECT_URL**: Bypasses pooler for migrations and schema introspection (required for DDL operations)

---

## Type Mappings

### PostgreSQL → Prisma

| PostgreSQL Type | Prisma Type                 | Mapping                     |
| --------------- | --------------------------- | --------------------------- |
| uuid            | String @db.Uuid             | UUID primary/foreign keys   |
| bigint          | BigInt @db.BigInt           | Telegram chat/message IDs   |
| timestamptz     | DateTime @db.Timestamptz(6) | Timezone-aware timestamps   |
| time            | DateTime @db.Time(6)        | Working hours (time of day) |
| text            | String                      | Text fields                 |
| text[]          | String[]                    | PostgreSQL arrays           |
| integer         | Int                         | Numeric fields              |
| boolean         | Boolean                     | Boolean flags               |

### Special Type Handling

**BigInt Usage** (Telegram IDs):

```typescript
// Use BigInt literals (add 'n' suffix)
const chatId = 123456789n;

// Query with BigInt
const chat = await prisma.chat.findUnique({
  where: { id: 123456789n },
});
```

**Array Fields** (keywords):

```typescript
// Search with array overlap
const faqs = await prisma.faqItem.findMany({
  where: {
    keywords: {
      hasSome: ['налог', 'отчет'],
    },
  },
});
```

---

## Next Steps

### 1. Set Up Environment Variables

```bash
cd backend
cp .env.example .env
# Edit .env with Supabase credentials
```

### 2. Generate Prisma Client

```bash
npm run prisma:generate
```

### 3. Apply Supabase Migrations

```bash
# From infrastructure/supabase directory
supabase db push
```

### 4. Introspect Database (Optional)

```bash
# Sync Prisma schema with database
npx prisma db pull
```

### 5. Open Prisma Studio (Visual DB Editor)

```bash
npm run prisma:studio
# Opens at http://localhost:5555
```

---

## Validation Checklist

- [x] All 8 tables defined with correct column types
- [x] All foreign key relationships configured with @relation
- [x] All indexes defined (FKs, query columns, conditional)
- [x] All enums defined (5 enums)
- [x] PostgreSQL-specific types mapped (@db.Uuid, @db.BigInt, @db.Timestamptz)
- [x] Connection pooling configured (DATABASE_URL + DIRECT_URL)
- [x] Auto-update timestamps configured (@updatedAt)
- [x] Default values configured (UUIDs, timestamps, booleans, counters)
- [x] Unique constraints defined (email, chatId+dayOfWeek)
- [x] Schema formatted and syntax-validated

---

## Files Created

1. **`/backend/prisma/schema.prisma`** (234 lines)
   - Complete Prisma schema with 8 models and 5 enums

2. **`/backend/prisma/README.md`**
   - Comprehensive documentation with usage examples

3. **`/backend/prisma/SCHEMA_SUMMARY.md`** (this file)
   - Quick reference and validation checklist

4. **`/backend/.env.example`** (updated)
   - Added DATABASE_URL and DIRECT_URL configuration

---

**Schema Status**: Ready for Prisma Client generation
**Next Task**: Apply Supabase migrations to create database tables
**Documentation**: See `/backend/prisma/README.md` for detailed usage guide
