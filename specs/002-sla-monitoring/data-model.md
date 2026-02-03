# Data Model: SLA Monitoring System

**Branch**: `002-sla-monitoring`
**Date**: 2025-11-22
**Base Schema**: `backend/prisma/schema.prisma`

## Overview

Расширение существующей схемы базы данных для поддержки полного функционала SLA мониторинга согласно spec.md MODULE 1.1.

## Existing Entities (требуют модификации)

### Chat

Уже существует. Требуется добавить поля:

```prisma
model Chat {
  // Existing fields...

  // NEW: SLA Configuration per chat
  slaThresholdMinutes  Int       @default(60) @map("sla_threshold_minutes")
  monitoringEnabled    Boolean   @default(true) @map("monitoring_enabled")
  is24x7Mode           Boolean   @default(false) @map("is_24x7_mode")

  // NEW: Manager override for alerts
  managerTelegramIds   String[]  @default([]) @map("manager_telegram_ids")

  // Relations
  workingSchedules     WorkingSchedule[]
  holidays             ChatHoliday[]
}
```

### ClientRequest

Уже существует. Требуется добавить поля:

```prisma
model ClientRequest {
  // Existing fields...

  // NEW: Classification
  classification      MessageClassification @default(REQUEST)
  classificationScore Float?               @map("classification_score")
  classificationModel String?              @map("classification_model") // 'openrouter', 'keyword-fallback'

  // NEW: SLA Timer details
  slaTimerStartedAt   DateTime?            @map("sla_timer_started_at") @db.Timestamptz(6)
  slaTimerPausedAt    DateTime?            @map("sla_timer_paused_at") @db.Timestamptz(6)
  slaWorkingMinutes   Int?                 @map("sla_working_minutes") // calculated
  slaBreached         Boolean              @default(false) @map("sla_breached")

  // NEW: Response tracking
  respondedBy         String?              @map("responded_by") @db.Uuid
  responseMessageId   BigInt?              @map("response_message_id") @db.BigInt
}
```

### SlaAlert

Уже существует. Требуется добавить поля:

```prisma
model SlaAlert {
  // Existing fields...

  // NEW: Alert delivery
  telegramMessageId   BigInt?              @map("telegram_message_id") @db.BigInt
  deliveryStatus      AlertDeliveryStatus  @default(pending) @map("delivery_status")
  deliveredAt         DateTime?            @map("delivered_at") @db.Timestamptz(6)

  // NEW: Escalation
  escalationLevel     Int                  @default(1) @map("escalation_level") // 1-5
  nextEscalationAt    DateTime?            @map("next_escalation_at") @db.Timestamptz(6)

  // NEW: Resolution
  resolvedAction      AlertAction?         @map("resolved_action")
}
```

### WorkingSchedule

Уже существует. Структура подходит, но требуется добавить:

```prisma
model WorkingSchedule {
  // Existing fields...

  // NEW: Timezone per schedule (override global)
  timezone  String  @default("Europe/Moscow")
}
```

## New Entities

### MessageClassification (Enum)

```prisma
enum MessageClassification {
  REQUEST
  SPAM
  GRATITUDE
  CLARIFICATION
}
```

### AlertDeliveryStatus (Enum)

```prisma
enum AlertDeliveryStatus {
  pending
  sent
  delivered
  failed
}
```

### AlertAction (Enum)

```prisma
enum AlertAction {
  mark_resolved       // Менеджер отметил как решённое
  accountant_responded // Бухгалтер ответил
  auto_expired        // Автоматически закрыто (max escalations)
}
```

### ChatHoliday

Праздничные дни для чата (override глобальных).

```prisma
model ChatHoliday {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  chatId      BigInt    @map("chat_id") @db.BigInt
  date        DateTime  @db.Date
  description String?
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  // Relations
  chat        Chat      @relation(fields: [chatId], references: [id], onDelete: Cascade)

  @@unique([chatId, date], name: "unique_chat_holiday")
  @@index([chatId])
  @@index([date])
  @@map("chat_holidays")
}
```

### GlobalSettings

Глобальные настройки системы.

```prisma
model GlobalSettings {
  id                      String   @id @default("default")

  // Working Hours Defaults
  defaultTimezone         String   @default("Europe/Moscow") @map("default_timezone")
  defaultWorkingDays      Int[]    @default([1,2,3,4,5]) @map("default_working_days")
  defaultStartTime        String   @default("09:00") @map("default_start_time")
  defaultEndTime          String   @default("18:00") @map("default_end_time")

  // SLA Defaults
  defaultSlaThreshold     Int      @default(60) @map("default_sla_threshold")
  maxEscalations          Int      @default(5) @map("max_escalations")
  escalationIntervalMin   Int      @default(30) @map("escalation_interval_min")

  // Manager Alerts
  globalManagerIds        String[] @default([]) @map("global_manager_ids")

  // AI Classification
  aiConfidenceThreshold   Float    @default(0.7) @map("ai_confidence_threshold")
  messagePreviewLength    Int      @default(500) @map("message_preview_length")

  // Data Retention
  dataRetentionYears      Int      @default(3) @map("data_retention_years")

  updatedAt               DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@map("global_settings")
}
```

### GlobalHoliday

Глобальный календарь праздников (федеральные праздники РФ).

```prisma
model GlobalHoliday {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  date        DateTime @unique @db.Date
  name        String
  year        Int
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([year])
  @@index([date])
  @@map("global_holidays")
}
```

### ClassificationCache

Кеш результатов AI классификации.

```prisma
model ClassificationCache {
  id              String                @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  messageHash     String                @unique @map("message_hash") // SHA256 of normalized text
  classification  MessageClassification
  confidence      Float
  model           String
  createdAt       DateTime              @default(now()) @map("created_at") @db.Timestamptz(6)
  expiresAt       DateTime              @map("expires_at") @db.Timestamptz(6)

  @@index([messageHash])
  @@index([expiresAt])
  @@map("classification_cache")
}
```

## Entity Relationships

```
GlobalSettings (1) ──────── System Config
       │
GlobalHoliday (N) ──────── Federal Holidays

User (N)
  │
  ├──< Chat (N) ─────────── Assigned Accountant
  │      │
  │      ├──< WorkingSchedule (N) ── Per-day schedule
  │      ├──< ChatHoliday (N) ────── Chat-specific holidays
  │      │
  │      └──< ClientRequest (N)
  │             │
  │             ├──< SlaAlert (N) ── Breach notifications
  │             │
  │             └── ClassificationCache ── AI results
  │
  └──< SlaAlert (N) ─────── Acknowledged By
```

## Indexes

```sql
-- Performance indexes for SLA queries
CREATE INDEX idx_client_requests_sla_breached ON client_requests(sla_breached) WHERE sla_breached = true;
CREATE INDEX idx_client_requests_sla_timer ON client_requests(sla_timer_started_at) WHERE status = 'pending';
CREATE INDEX idx_sla_alerts_pending ON sla_alerts(next_escalation_at) WHERE delivery_status = 'pending';

-- Analytics indexes
CREATE INDEX idx_client_requests_analytics ON client_requests(chat_id, received_at, status);
CREATE INDEX idx_sla_alerts_analytics ON sla_alerts(alert_sent_at, alert_type);
```

## Validation Rules

### ClientRequest

- `classificationScore` MUST be between 0 and 1
- `slaWorkingMinutes` MUST be >= 0
- `responseTimeMinutes` MUST be >= 0

### WorkingSchedule

- `dayOfWeek` MUST be between 1 and 7
- `startTime` MUST be valid time format (HH:MM)
- `endTime` MUST be > `startTime`

### SlaAlert

- `escalationLevel` MUST be between 1 and 5
- `minutesElapsed` MUST be > 0

### GlobalSettings

- `aiConfidenceThreshold` MUST be between 0 and 1
- `messagePreviewLength` MUST be between 100 and 1000

## State Transitions

### ClientRequest Status

```
┌─────────┐     classify      ┌────────────┐
│ CREATED │ ──────────────────▶│  pending   │
└─────────┘                    └──────┬─────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              ┌───────────┐   ┌────────────┐    ┌────────────┐
              │ escalated │   │in_progress │    │  answered  │
              └─────┬─────┘   └──────┬─────┘    └────────────┘
                    │                │
                    └────────────────┘
                            │
                            ▼
                     ┌────────────┐
                     │  answered  │
                     └────────────┘
```

### SlaAlert Lifecycle

```
┌─────────┐    send     ┌──────┐   deliver   ┌───────────┐
│ pending │ ──────────▶ │ sent │ ──────────▶ │ delivered │
└─────────┘             └──────┘             └─────┬─────┘
                                                   │
                         ┌─────────────────────────┤
                         ▼                         ▼
                  ┌────────────┐           ┌────────────┐
                  │  escalate  │           │  resolved  │
                  │ (level++)  │           └────────────┘
                  └────────────┘
```

## Migration Strategy

1. **Add new enums** - MessageClassification, AlertDeliveryStatus, AlertAction
2. **Add new columns to existing tables** - with defaults, nullable where needed
3. **Create new tables** - GlobalSettings, GlobalHoliday, ChatHoliday, ClassificationCache
4. **Add indexes** - performance critical
5. **Seed data** - Russian federal holidays 2025, default GlobalSettings

## RLS Policies (Supabase)

```sql
-- GlobalSettings: Only admins can modify
CREATE POLICY "GlobalSettings admin access" ON global_settings
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- ClientRequest: Accountant sees assigned, Manager sees all
CREATE POLICY "ClientRequest role access" ON client_requests
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin' OR
    auth.jwt() ->> 'role' = 'manager' OR
    (auth.jwt() ->> 'role' = 'accountant' AND assigned_to = auth.uid())
  );

-- SlaAlert: Manager and Admin only
CREATE POLICY "SlaAlert manager access" ON sla_alerts
  FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
```
