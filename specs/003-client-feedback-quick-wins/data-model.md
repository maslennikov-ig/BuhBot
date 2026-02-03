# Data Model: Client Feedback & Quick Wins

**Date**: 2025-11-24
**Feature**: 003-client-feedback-quick-wins

## Entity Overview

```
┌─────────────────────┐     ┌─────────────────────┐
│   FeedbackSurvey    │────<│  SurveyDelivery     │
│   (NEW)             │     │  (NEW)              │
└─────────────────────┘     └─────────────────────┘
         │                           │
         │ 1:N                       │ 1:1
         ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐
│  FeedbackResponse   │────>│      Chat           │
│  (EXTEND)           │     │   (EXISTING)        │
└─────────────────────┘     └─────────────────────┘
```

## New Entities

### FeedbackSurvey

Tracks quarterly survey campaigns.

| Field          | Type         | Constraints                   | Description               |
| -------------- | ------------ | ----------------------------- | ------------------------- |
| id             | UUID         | PK, default gen_random_uuid() | Unique identifier         |
| quarter        | String       | NOT NULL                      | Format: "2025-Q1"         |
| scheduledAt    | DateTime     | NOT NULL                      | When survey was scheduled |
| sentAt         | DateTime     | NULL                          | When delivery started     |
| expiresAt      | DateTime     | NOT NULL                      | Survey validity deadline  |
| closedAt       | DateTime     | NULL                          | Manual close timestamp    |
| closedBy       | UUID         | FK → User.id, NULL            | Who closed manually       |
| status         | SurveyStatus | NOT NULL, default 'scheduled' | Campaign status           |
| totalClients   | Int          | default 0                     | Total clients targeted    |
| deliveredCount | Int          | default 0                     | Successfully delivered    |
| responseCount  | Int          | default 0                     | Responses received        |
| averageRating  | Float        | NULL                          | Calculated average        |
| createdAt      | DateTime     | default now()                 | Record creation           |
| updatedAt      | DateTime     | auto-update                   | Last modification         |

**Enum: SurveyStatus**

- `scheduled` - Waiting for scheduled time
- `sending` - Delivery in progress
- `active` - Delivered, accepting responses
- `closed` - Manually closed by manager
- `expired` - Past expiry date

**Indexes**:

- `idx_survey_quarter` on (quarter)
- `idx_survey_status` on (status)

### SurveyDelivery

Tracks individual survey delivery to each client.

| Field             | Type           | Constraints                      | Description                           |
| ----------------- | -------------- | -------------------------------- | ------------------------------------- |
| id                | UUID           | PK, default gen_random_uuid()    | Unique identifier                     |
| surveyId          | UUID           | FK → FeedbackSurvey.id, NOT NULL | Parent survey                         |
| chatId            | BigInt         | FK → Chat.id, NOT NULL           | Target client chat                    |
| messageId         | BigInt         | NULL                             | Telegram message ID                   |
| status            | DeliveryStatus | NOT NULL, default 'pending'      | Delivery status                       |
| deliveredAt       | DateTime       | NULL                             | When successfully sent                |
| reminderSentAt    | DateTime       | NULL                             | When reminder sent (day 2)            |
| managerNotifiedAt | DateTime       | NULL                             | When manager notified of non-response |
| retryCount        | Int            | default 0                        | Delivery retry attempts               |
| errorMessage      | String         | NULL                             | Last error if failed                  |
| createdAt         | DateTime       | default now()                    | Record creation                       |

**Enum: DeliveryStatus**

- `pending` - Not yet attempted
- `delivered` - Successfully sent
- `reminded` - Reminder sent on day 2
- `expired` - No response, manager notified
- `failed` - Delivery failed after retries
- `responded` - Client has responded

**Indexes**:

- `idx_delivery_survey` on (surveyId)
- `idx_delivery_chat` on (chatId)
- `idx_delivery_status` on (status)
- `unique_survey_chat` on (surveyId, chatId) - One delivery per client per survey

## Extended Entities

### FeedbackResponse (EXTEND existing)

Add fields to link responses to surveys.

| Field            | Type    | Constraints                  | Description                        |
| ---------------- | ------- | ---------------------------- | ---------------------------------- |
| surveyId         | UUID    | FK → FeedbackSurvey.id, NULL | Parent survey (NULL for ad-hoc)    |
| deliveryId       | UUID    | FK → SurveyDelivery.id, NULL | Delivery record                    |
| clientUsername   | String  | NULL                         | Telegram username for manager view |
| isAnonymizedView | Boolean | computed                     | Helper for accountant queries      |

**New Index**:

- `idx_feedback_survey` on (surveyId)

### GlobalSettings (EXTEND existing)

Add survey configuration fields.

| Field              | Type | Constraints | Description                       |
| ------------------ | ---- | ----------- | --------------------------------- |
| surveyValidityDays | Int  | default 7   | Days until survey expires         |
| surveyReminderDay  | Int  | default 2   | Day to send reminder              |
| lowRatingThreshold | Int  | default 3   | Rating that triggers alert (<=)   |
| surveyQuarterDay   | Int  | default 1   | Day of month to send (1st Monday) |

## State Transitions

### FeedbackSurvey Lifecycle

```
scheduled ──[cron trigger]──> sending ──[all delivered]──> active
    │                            │                           │
    │                            │                           ▼
    │                            │                     [expiry date]
    │                            │                           │
    │                            ▼                           ▼
    │                    [delivery error]               expired
    │                            │                           │
    ▼                            ▼                           │
[manual close] ──────────────> closed <────────────────────┘
```

### SurveyDelivery Lifecycle

```
pending ──[send success]──> delivered ──[day 2]──> reminded ──[expiry]──> expired
    │                           │                      │              │
    │                           │                      │              ▼
    │                           ▼                      ▼         [manager notified]
    │                    [client responds]      [client responds]
    │                           │                      │
    ▼                           ▼                      ▼
[5 retries fail]           responded              responded
    │
    ▼
  failed
```

## Validation Rules

### FeedbackSurvey

- `quarter` must match pattern `^\d{4}-Q[1-4]$`
- `expiresAt` must be after `scheduledAt`
- `closedBy` required when `status = 'closed'`
- `averageRating` must be between 1.0 and 5.0

### SurveyDelivery

- `retryCount` max value: 5
- `reminderSentAt` only set if `status` was 'delivered'
- `managerNotifiedAt` only set if `status` transitions to 'expired'

### FeedbackResponse

- `rating` must be 1-5 (existing CHECK constraint)
- If `surveyId` set, survey must be in 'active' status

## Migration Plan

1. Add `SurveyStatus` and `DeliveryStatus` enums
2. Create `FeedbackSurvey` table
3. Create `SurveyDelivery` table with foreign keys
4. Add new columns to `FeedbackResponse`
5. Add new columns to `GlobalSettings`
6. Create indexes
7. Seed default `GlobalSettings` values if not exists

## Prisma Schema Changes

```prisma
// New enums
enum SurveyStatus {
  scheduled
  sending
  active
  closed
  expired
}

enum DeliveryStatus {
  pending
  delivered
  reminded
  expired
  failed
  responded
}

// New models
model FeedbackSurvey {
  id             String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  quarter        String       // "2025-Q1"
  scheduledAt    DateTime     @map("scheduled_at") @db.Timestamptz(6)
  sentAt         DateTime?    @map("sent_at") @db.Timestamptz(6)
  expiresAt      DateTime     @map("expires_at") @db.Timestamptz(6)
  closedAt       DateTime?    @map("closed_at") @db.Timestamptz(6)
  closedBy       String?      @map("closed_by") @db.Uuid
  status         SurveyStatus @default(scheduled)
  totalClients   Int          @default(0) @map("total_clients")
  deliveredCount Int          @default(0) @map("delivered_count")
  responseCount  Int          @default(0) @map("response_count")
  averageRating  Float?       @map("average_rating")
  createdAt      DateTime     @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  // Relations
  closedByUser   User?            @relation("SurveyClosedBy", fields: [closedBy], references: [id])
  deliveries     SurveyDelivery[]
  responses      FeedbackResponse[]

  @@index([quarter])
  @@index([status])
  @@map("feedback_surveys")
}

model SurveyDelivery {
  id                String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  surveyId          String         @map("survey_id") @db.Uuid
  chatId            BigInt         @map("chat_id") @db.BigInt
  messageId         BigInt?        @map("message_id") @db.BigInt
  status            DeliveryStatus @default(pending)
  deliveredAt       DateTime?      @map("delivered_at") @db.Timestamptz(6)
  reminderSentAt    DateTime?      @map("reminder_sent_at") @db.Timestamptz(6)
  managerNotifiedAt DateTime?      @map("manager_notified_at") @db.Timestamptz(6)
  retryCount        Int            @default(0) @map("retry_count")
  errorMessage      String?        @map("error_message")
  createdAt         DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)

  // Relations
  survey   FeedbackSurvey    @relation(fields: [surveyId], references: [id])
  chat     Chat              @relation(fields: [chatId], references: [id])
  response FeedbackResponse?

  @@unique([surveyId, chatId], name: "unique_survey_chat")
  @@index([surveyId])
  @@index([chatId])
  @@index([status])
  @@map("survey_deliveries")
}

// Extend existing FeedbackResponse
model FeedbackResponse {
  // ... existing fields ...
  surveyId       String?        @map("survey_id") @db.Uuid
  deliveryId     String?        @unique @map("delivery_id") @db.Uuid
  clientUsername String?        @map("client_username")

  // New relations
  survey   FeedbackSurvey?  @relation(fields: [surveyId], references: [id])
  delivery SurveyDelivery?  @relation(fields: [deliveryId], references: [id])

  @@index([surveyId])
}

// Extend GlobalSettings
model GlobalSettings {
  // ... existing fields ...
  surveyValidityDays  Int @default(7) @map("survey_validity_days")
  surveyReminderDay   Int @default(2) @map("survey_reminder_day")
  lowRatingThreshold  Int @default(3) @map("low_rating_threshold")
  surveyQuarterDay    Int @default(1) @map("survey_quarter_day")
}
```
