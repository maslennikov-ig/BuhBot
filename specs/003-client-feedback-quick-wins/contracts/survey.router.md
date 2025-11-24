# API Contract: Survey Router

**Path**: `backend/src/api/trpc/routers/survey.ts`
**Date**: 2025-11-24

## Overview

tRPC router for survey campaign management (manager only).

## Procedures

### survey.list

**Type**: Query
**Access**: Manager only
**Description**: List all survey campaigns.

**Input**:
```typescript
z.object({
  status: z.enum(['scheduled', 'sending', 'active', 'closed', 'expired']).optional(),
  year: z.number().min(2024).optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(50).default(10),
})
```

**Output**:
```typescript
{
  items: {
    id: string;
    quarter: string;
    status: SurveyStatus;
    scheduledAt: Date;
    sentAt: Date | null;
    expiresAt: Date;
    closedAt: Date | null;
    totalClients: number;
    deliveredCount: number;
    responseCount: number;
    responseRate: number; // percentage
    averageRating: number | null;
  }[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
```

---

### survey.getById

**Type**: Query
**Access**: Manager only
**Description**: Get detailed survey campaign info.

**Input**:
```typescript
z.object({
  id: z.string().uuid(),
})
```

**Output**:
```typescript
{
  id: string;
  quarter: string;
  status: SurveyStatus;
  scheduledAt: Date;
  sentAt: Date | null;
  expiresAt: Date;
  closedAt: Date | null;
  closedBy: {
    id: string;
    fullName: string;
  } | null;
  totalClients: number;
  deliveredCount: number;
  responseCount: number;
  responseRate: number;
  averageRating: number | null;
  npsScore: number | null;
  deliveryStats: {
    pending: number;
    delivered: number;
    reminded: number;
    expired: number;
    failed: number;
    responded: number;
  };
  ratingDistribution: {
    rating: number;
    count: number;
  }[];
}
```

---

### survey.create

**Type**: Mutation
**Access**: Manager only
**Description**: Schedule a new survey campaign.

**Input**:
```typescript
z.object({
  quarter: z.string().regex(/^\d{4}-Q[1-4]$/), // "2025-Q1"
  scheduledAt: z.date(),
  validityDays: z.number().min(1).max(30).optional(), // Override global setting
})
```

**Output**:
```typescript
{
  id: string;
  quarter: string;
  scheduledAt: Date;
  expiresAt: Date;
  status: 'scheduled';
}
```

**Business Logic**:
- Calculate expiresAt from scheduledAt + validityDays
- Validate no active survey for same quarter
- Create BullMQ job scheduled for scheduledAt

---

### survey.close

**Type**: Mutation
**Access**: Manager only
**Description**: Manually close an active survey.

**Input**:
```typescript
z.object({
  id: z.string().uuid(),
})
```

**Output**:
```typescript
{
  success: boolean;
  closedAt: Date;
  finalStats: {
    responseCount: number;
    responseRate: number;
    averageRating: number | null;
  };
}
```

**Business Logic**:
- Only close if status is 'active' or 'sending'
- Set status to 'closed', closedAt, closedBy
- Cancel any pending delivery/reminder jobs
- Mark all pending deliveries as 'expired'

---

### survey.sendNow

**Type**: Mutation
**Access**: Manager only
**Description**: Immediately start sending a scheduled survey.

**Input**:
```typescript
z.object({
  id: z.string().uuid(),
})
```

**Output**:
```typescript
{
  success: boolean;
  clientCount: number;
  estimatedCompletionMinutes: number;
}
```

**Business Logic**:
- Only for status = 'scheduled'
- Update status to 'sending'
- Queue delivery jobs for all active clients

---

### survey.getDeliveries

**Type**: Query
**Access**: Manager only
**Description**: List delivery status for a survey.

**Input**:
```typescript
z.object({
  surveyId: z.string().uuid(),
  status: z.enum(['pending', 'delivered', 'reminded', 'expired', 'failed', 'responded']).optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(100).default(50),
})
```

**Output**:
```typescript
{
  items: {
    id: string;
    chatId: string;
    chatTitle: string | null;
    clientUsername: string | null;
    status: DeliveryStatus;
    deliveredAt: Date | null;
    reminderSentAt: Date | null;
    retryCount: number;
    errorMessage: string | null;
    response: {
      rating: number;
      submittedAt: Date;
    } | null;
  }[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
```

---

### survey.retryFailed

**Type**: Mutation
**Access**: Manager only
**Description**: Retry failed deliveries for a survey.

**Input**:
```typescript
z.object({
  surveyId: z.string().uuid(),
  deliveryIds: z.array(z.string().uuid()).optional(), // All failed if not specified
})
```

**Output**:
```typescript
{
  retriedCount: number;
  skippedCount: number; // Already at max retries
}
```

---

### survey.getSettings

**Type**: Query
**Access**: Manager only
**Description**: Get survey-related global settings.

**Output**:
```typescript
{
  surveyValidityDays: number;
  surveyReminderDay: number;
  lowRatingThreshold: number;
  surveyQuarterDay: number;
}
```

---

### survey.updateSettings

**Type**: Mutation
**Access**: Admin only
**Description**: Update survey-related global settings.

**Input**:
```typescript
z.object({
  surveyValidityDays: z.number().min(1).max(30).optional(),
  surveyReminderDay: z.number().min(1).max(7).optional(),
  lowRatingThreshold: z.number().min(1).max(5).optional(),
  surveyQuarterDay: z.number().min(1).max(28).optional(),
})
```

**Output**:
```typescript
{
  success: boolean;
  settings: {
    surveyValidityDays: number;
    surveyReminderDay: number;
    lowRatingThreshold: number;
    surveyQuarterDay: number;
  };
}
```

## Error Codes

| Code | Description |
|------|-------------|
| UNAUTHORIZED | Not authenticated |
| FORBIDDEN | Role not permitted (requires manager/admin) |
| NOT_FOUND | Survey not found |
| INVALID_STATUS | Operation not allowed for current status |
| DUPLICATE_QUARTER | Survey already exists for this quarter |
| INVALID_SCHEDULE | Scheduled date must be in the future |
