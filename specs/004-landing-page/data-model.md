# Data Model: BuhBot Landing Page

**Date**: 2025-11-24
**Feature**: 004-landing-page

## New Entities

### ContactRequest

Represents a demo request submitted via the landing page contact form.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| name | String | Required, max 255 | Submitter's full name |
| email | String | Required, valid email format | Contact email address |
| company | String | Optional, max 255 | Company/organization name |
| message | String | Optional, max 2000 | Additional message/notes |
| honeypot | String | Optional | Anti-spam honeypot field (should be empty) |
| status | Enum | Default: NEW | Processing status |
| notificationSent | Boolean | Default: false | Telegram notification sent flag |
| telegramMessageId | BigInt | Optional | ID of sent Telegram notification |
| createdAt | DateTime | Auto, with timezone | Submission timestamp |
| updatedAt | DateTime | Auto-update, with timezone | Last update timestamp |

### ContactRequestStatus Enum

| Value | Description |
|-------|-------------|
| NEW | Freshly submitted, not yet reviewed |
| CONTACTED | Business team has reached out |
| CONVERTED | Lead became a customer |
| CLOSED | Request closed (not interested, spam, etc.) |

## Prisma Schema Addition

```prisma
// Contact Request Status Enum
enum ContactRequestStatus {
  NEW
  CONTACTED
  CONVERTED
  CLOSED
}

/// Demo request from landing page contact form
/// Stores visitor information for sales follow-up
model ContactRequest {
  id                String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name              String
  email             String
  company           String?
  message           String?
  honeypot          String?              // Anti-spam: should always be empty
  status            ContactRequestStatus @default(NEW)
  notificationSent  Boolean              @default(false) @map("notification_sent")
  telegramMessageId BigInt?              @map("telegram_message_id") @db.BigInt
  createdAt         DateTime             @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime             @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([status])
  @@index([createdAt])
  @@index([email])
  @@map("contact_requests")
}
```

## Entity Relationships

```
ContactRequest (standalone)
├── No foreign keys to other tables
└── Referenced by: None (isolated lead capture)
```

## State Transitions

```
NEW ──────────────────────┐
 │                        │
 ├──> CONTACTED ──> CONVERTED
 │         │
 └─────────┴──> CLOSED
```

**Transitions:**
- NEW → CONTACTED: Sales team initiates contact
- NEW → CLOSED: Spam detected or request invalidated
- CONTACTED → CONVERTED: Lead becomes customer
- CONTACTED → CLOSED: Lead not interested

## Data Validation Rules

### Name
- Required, non-empty
- Trimmed whitespace
- Max 255 characters

### Email
- Required, non-empty
- Valid email format (RFC 5322)
- Max 254 characters (RFC limit)

### Company
- Optional
- Trimmed whitespace
- Max 255 characters

### Message
- Optional
- Trimmed whitespace
- Max 2000 characters

### Honeypot
- Must be empty or undefined for valid submission
- If contains value, reject as spam (silently)

## Indexes

| Index | Fields | Purpose |
|-------|--------|---------|
| idx_contact_requests_status | status | Filter by status |
| idx_contact_requests_created_at | createdAt | Sort by date |
| idx_contact_requests_email | email | Duplicate detection |

## Migration Notes

- Run `prisma migrate dev --name add_contact_requests`
- No data migration needed (new table)
- No RLS policies needed (backend-only access)
