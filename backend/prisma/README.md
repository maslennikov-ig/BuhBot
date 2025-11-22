# BuhBot Prisma Schema Documentation

## Overview

This directory contains the Prisma schema for BuhBot - a Telegram bot platform for accounting firms. The schema defines 8 tables for Phase 1 infrastructure setup, supporting SLA monitoring, feedback collection, templates, FAQ management, and admin panel user management.

**Database**: PostgreSQL 15+ (Supabase Cloud, EU region)
**ORM**: Prisma 5.22.0+
**Connection**: Supabase Supavisor pooler (PgBouncer)

## Schema Structure

### 8 Core Models

1. **User** - Admin panel users (synced with Supabase Auth)
2. **Chat** - Telegram chat metadata with SLA settings
3. **ClientRequest** - Incoming messages with SLA tracking
4. **SlaAlert** - SLA warnings and breaches
5. **FeedbackResponse** - Client satisfaction ratings
6. **WorkingSchedule** - Working hours per chat
7. **Template** - Reusable message templates
8. **FaqItem** - FAQ with keyword search

### 5 Enums

- `UserRole`: admin, manager, observer
- `ChatType`: private, group, supergroup
- `RequestStatus`: pending, in_progress, answered, escalated
- `AlertType`: warning, breach
- `TemplateCategory`: greeting, status, document_request, reminder, closing

## Database Setup

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required Variables**:

```env
# Connection pooler URL (for queries)
DATABASE_URL=postgresql://postgres.PROJECT-REF:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# Direct database URL (for migrations)
DIRECT_URL=postgresql://postgres:PASSWORD@db.PROJECT-REF.supabase.co:5432/postgres
```

**Connection String Details**:
- `DATABASE_URL`: Uses Supabase Supavisor pooler (port 6543) with `pgbouncer=true`
- `DIRECT_URL`: Direct connection (port 5432) for running migrations (bypasses pooler)

### 2. Generate Prisma Client

```bash
npm run prisma:generate
# or
npx prisma generate
```

This generates the type-safe Prisma Client in `node_modules/.prisma/client`.

### 3. Apply Database Migrations

**IMPORTANT**: Database schema is managed through Supabase migrations (in `infrastructure/supabase/migrations/`), NOT Prisma migrations.

Prisma schema is used for:
- Generating Prisma Client for type-safe queries
- Database introspection after Supabase migrations are applied
- Type definitions for backend code

**Do NOT run**: `npx prisma migrate dev` (schema is managed by Supabase)

### 4. Introspect Existing Database

If Supabase migrations are already applied, sync Prisma schema with database:

```bash
npx prisma db pull
```

This updates `schema.prisma` to match the current database structure.

## Schema Features

### Foreign Key Relationships

All foreign keys are properly defined with `@relation`:

```prisma
model ClientRequest {
  chatId BigInt @map("chat_id")
  chat   Chat   @relation(fields: [chatId], references: [id])
}
```

### Indexes

Indexes are defined on:
- All foreign key columns
- Frequently queried columns (status, rating, timestamps)
- Conditional indexes for filtered queries (e.g., `slaEnabled = true`)

Example:
```prisma
@@index([chatId])
@@index([status])
@@index([receivedAt])
```

### PostgreSQL-Specific Types

- **UUID**: `@db.Uuid` with `gen_random_uuid()` default
- **BigInt**: `@db.BigInt` for Telegram IDs
- **Timestamptz**: `@db.Timestamptz(6)` for timezone-aware timestamps
- **Text[]**: `String[]` for PostgreSQL arrays (keywords)
- **Time**: `@db.Time(6)` for working hours

### Special Features

#### 1. GIN Index on Keywords Array

The `FaqItem.keywords` field uses PostgreSQL's GIN index for fast full-text search. This index is created at the database level via Supabase migration (Prisma doesn't support GIN syntax in schema):

```sql
-- In Supabase migration
CREATE INDEX idx_faq_keywords ON faq_items USING GIN (keywords);
```

#### 2. Check Constraints

Some constraints are enforced at the database level (not in Prisma schema):

- `rating` between 1-5 (feedback_responses)
- `dayOfWeek` between 1-7 (working_schedules)
- Enum values (role, status, etc.)

These are defined in Supabase migrations.

#### 3. Triggers

Database triggers are NOT included in Prisma schema (handled by Supabase):

- `update_updated_at_column()`: Auto-update `updated_at` on row modifications
- `increment_template_usage()`: Track template usage
- `increment_faq_usage()`: Track FAQ usage

#### 4. Row-Level Security (RLS)

RLS policies are enforced at Supabase level, not in Prisma schema. See Supabase migration files for:

- Role-based access control (admin/manager/observer)
- User-specific data isolation
- Read-only policies for observers

## Usage Examples

### Initialize Prisma Client

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

export default prisma;
```

### Query Examples

```typescript
// Find all pending requests for a chat
const pendingRequests = await prisma.clientRequest.findMany({
  where: {
    chatId: 123456789n, // BigInt literal
    status: 'pending',
  },
  include: {
    chat: true,
    assignedUser: true,
  },
  orderBy: {
    receivedAt: 'asc',
  },
});

// Create SLA alert
const alert = await prisma.slaAlert.create({
  data: {
    requestId: 'uuid-here',
    alertType: 'warning',
    minutesElapsed: 48,
    alertSentAt: new Date(),
  },
});

// Update template usage count
await prisma.template.update({
  where: { id: 'template-uuid' },
  data: {
    usageCount: { increment: 1 },
  },
});

// Search FAQ by keyword
const faqItems = await prisma.faqItem.findMany({
  where: {
    keywords: {
      hasSome: ['налог', 'отчет'], // Array overlap search
    },
  },
  orderBy: {
    usageCount: 'desc',
  },
});
```

### Working with BigInt (Telegram IDs)

Telegram chat IDs and message IDs are stored as `BigInt`:

```typescript
// Use BigInt literals (add 'n' suffix)
const chatId = 123456789n;

// Or convert from string
const chatIdFromString = BigInt('123456789');

// Query by BigInt
const chat = await prisma.chat.findUnique({
  where: { id: chatId },
});
```

### Transaction Example

```typescript
// Update request status and create SLA alert atomically
await prisma.$transaction([
  prisma.clientRequest.update({
    where: { id: requestId },
    data: { status: 'escalated' },
  }),
  prisma.slaAlert.create({
    data: {
      requestId,
      alertType: 'breach',
      minutesElapsed: 60,
    },
  }),
]);
```

## Connection Pooling

Prisma uses internal connection pooling with limits:

```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings (optional, defaults to 10)
  // __internal: {
  //   engine: {
  //     connectionLimit: 10,
  //   },
  // },
});
```

**Supabase Pooler Configuration**:
- Max connections per project: 1000 (Supabase Cloud)
- Recommended Prisma pool size: 5-10 connections
- Pooler mode: Transaction (PgBouncer)

## Common Tasks

### 1. Update Schema After Database Changes

If Supabase migrations modify the database:

```bash
# Pull latest schema from database
npx prisma db pull

# Regenerate Prisma Client
npx prisma generate
```

### 2. Open Prisma Studio (Database GUI)

```bash
npm run prisma:studio
# or
npx prisma studio
```

Opens at `http://localhost:5555` for visual database exploration.

### 3. Format Prisma Schema

```bash
npx prisma format
```

### 4. Validate Prisma Schema

```bash
npx prisma validate
```

## Migration Workflow

1. **Create Supabase Migration**: Define schema changes in `infrastructure/supabase/migrations/`
2. **Apply Migration**: Use Supabase CLI or SQL Editor to apply migration
3. **Update Prisma Schema**: Run `npx prisma db pull` to sync schema
4. **Regenerate Client**: Run `npx prisma generate` to update types
5. **Commit Changes**: Commit both Supabase migration and updated `schema.prisma`

## Troubleshooting

### Error: Environment variable not found: DATABASE_URL

**Solution**: Create `.env` file from `.env.example` and add database credentials.

### Error: Prisma Client not generated

**Solution**: Run `npx prisma generate` to generate client.

### Error: Can't reach database server

**Solution**:
- Check DATABASE_URL format
- Verify Supabase project is running
- Test connection with `npx prisma db pull`

### Error: Type mismatch (BigInt vs Number)

**Solution**: Use BigInt literals (`123n`) for Telegram IDs, not regular numbers.

### Error: Migration failed (when using directUrl)

**Solution**:
- Ensure `DIRECT_URL` bypasses pooler (port 5432, no `pgbouncer=true`)
- Use Supabase CLI for migrations instead of Prisma Migrate

## References

- **Prisma Documentation**: https://www.prisma.io/docs
- **Supabase Prisma Guide**: https://supabase.com/docs/guides/integrations/prisma
- **Data Model Spec**: `/specs/001-infrastructure-setup/data-model.md`
- **Supabase Migrations**: `/infrastructure/supabase/migrations/`

## Schema Versioning

**Current Version**: 1.0.0 (Phase 1)
**Last Updated**: 2025-11-17
**Generated From**: `specs/001-infrastructure-setup/data-model.md`

**Future Enhancements** (Phase 2+):
- Materialized views for analytics
- Partitioning for `client_requests` table
- Additional indexes for complex queries
- Audit logging tables
- Message attachments storage metadata
