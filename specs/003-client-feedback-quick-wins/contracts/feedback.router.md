# API Contract: Feedback Router

**Path**: `backend/src/api/trpc/routers/feedback.ts`
**Date**: 2025-11-24

## Overview

tRPC router for feedback analytics with role-based access control.

## Procedures

### feedback.getAggregates

**Type**: Query
**Access**: All authenticated users (manager, accountant, observer)
**Description**: Returns aggregate feedback statistics without client-identifying information.

**Input**:
```typescript
z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  surveyId: z.string().uuid().optional(),
})
```

**Output**:
```typescript
{
  totalResponses: number;
  averageRating: number;
  npsScore: number; // -100 to +100
  ratingDistribution: {
    rating: number; // 1-5
    count: number;
    percentage: number;
  }[];
  recentComments: {
    comment: string; // No client identifiers
    rating: number;
    submittedAt: Date;
  }[];
  trendData: {
    period: string; // "2025-Q1"
    averageRating: number;
    responseCount: number;
  }[];
}
```

**Business Logic**:
- NPS = (% ratings 4-5) - (% ratings 1-3)
- Comments returned without chatId or clientUsername
- Trend data grouped by quarter

---

### feedback.getAll

**Type**: Query
**Access**: Manager only
**Description**: Returns full feedback details including client identifiers.

**Input**:
```typescript
z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  surveyId: z.string().uuid().optional(),
  minRating: z.number().min(1).max(5).optional(),
  maxRating: z.number().min(1).max(5).optional(),
  chatId: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(100).default(20),
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
    accountantUsername: string | null;
    rating: number;
    comment: string | null;
    submittedAt: Date;
    surveyId: string | null;
    surveyQuarter: string | null;
  }[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
```

**Business Logic**:
- Requires `manager` role (use middleware)
- Includes all client-identifying information
- Joins with Chat for chatTitle and accountant info

---

### feedback.getById

**Type**: Query
**Access**: Manager only
**Description**: Get single feedback entry with full details.

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
  chatId: string;
  chatTitle: string | null;
  clientUsername: string | null;
  accountant: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  rating: number;
  comment: string | null;
  submittedAt: Date;
  survey: {
    id: string;
    quarter: string;
    status: SurveyStatus;
  } | null;
  relatedRequest: {
    id: string;
    messageText: string;
    receivedAt: Date;
  } | null;
}
```

---

### feedback.submitRating

**Type**: Mutation
**Access**: Internal (bot callback, no user auth)
**Description**: Records client rating from Telegram callback.

**Input**:
```typescript
z.object({
  chatId: z.string(),
  deliveryId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  telegramUsername: z.string().optional(),
})
```

**Output**:
```typescript
{
  success: boolean;
  feedbackId: string;
  shouldPromptComment: boolean; // true to ask for comment
}
```

**Business Logic**:
- Create FeedbackResponse record
- Update SurveyDelivery status to 'responded'
- Increment FeedbackSurvey.responseCount
- Recalculate averageRating
- If rating <= 3, trigger low-rating alert

---

### feedback.addComment

**Type**: Mutation
**Access**: Internal (bot handler)
**Description**: Adds comment to existing feedback.

**Input**:
```typescript
z.object({
  feedbackId: z.string().uuid(),
  comment: z.string().max(2000),
})
```

**Output**:
```typescript
{
  success: boolean;
}
```

---

### feedback.exportCsv

**Type**: Query
**Access**: Manager only
**Description**: Export feedback data as CSV.

**Input**:
```typescript
z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  surveyId: z.string().uuid().optional(),
})
```

**Output**:
```typescript
{
  filename: string;
  content: string; // CSV content
  rowCount: number;
}
```

## Error Codes

| Code | Description |
|------|-------------|
| UNAUTHORIZED | Not authenticated |
| FORBIDDEN | Role not permitted for this operation |
| NOT_FOUND | Feedback entry not found |
| SURVEY_CLOSED | Cannot submit to closed/expired survey |
| ALREADY_RESPONDED | Client already responded to this survey |
