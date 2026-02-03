# Data Model: Onboarding & Dashboard

**Feature**: 005-onboarding-dashboard

## Schema Updates

### User Model

Added `isOnboardingComplete` to track wizard status.

```prisma
model User {
  // ... existing fields
  isOnboardingComplete Boolean @default(false) @map("is_onboarding_complete")
}
```

### GlobalSettings Model

Ensure these fields exist (from Phase 1, verified for Phase 2 usage).

```prisma
model GlobalSettings {
  id String @id // "default"

  // Telegram Bot
  botToken        String? @map("bot_token") // Encrypted or restricted access
  botUsername     String? @map("bot_username")
  botId           BigInt? @map("bot_id")

  // Onboarding State (Alternative to User flag if workspace-wide)
  // We will stick to User flag for "User has seen wizard"
  // AND GlobalSettings presence for "Workspace is ready"

  // ... existing SLA fields
}
```

### Analytics Types (Virtual / API DTOs)

These are not DB tables but return types for the Analytics Router.

```typescript
// SLA Compliance Widget
type SlaComplianceMetric = {
  period: string; // "today", "week", "month"
  totalRequests: number;
  metSla: number;
  breachedSla: number;
  compliancePercentage: number; // (met / total) * 100
};

// Response Time Widget
type ResponseTimeMetric = {
  period: string;
  averageMinutes: number;
  previousPeriodAverage: number; // for trend calculation
  trendPercentage: number; // +15% or -10%
};

// Active Alert Item
type ActiveAlertItem = {
  id: string; // Request ID
  chatTitle: string;
  clientName: string;
  messagePreview: string;
  receivedAt: Date;
  slaDeadline: Date; // Calculated based on working hours
  status: 'warning' | 'breach';
};
```

## Database Migrations

1.  `alter_user_add_onboarding_status`: Add `is_onboarding_complete` to `users`.
2.  `update_global_settings_bot`: Ensure `bot_token` and `bot_username` columns exist.
