# API Contract: Telegram Login Integration

**Type**: tRPC Router (`user` router or new `telegram` router)
**Path**: `backend/src/trpc/routers/user.ts` (augmenting existing) or `telegram.ts`

## Procedures

### 1. `user.linkTelegram`

**Type**: Mutation
**Description**: Verifies Telegram auth data and links the account to the current user.

**Input (`z.object`)**:
```typescript
{
  id: z.number(),          // Telegram User ID
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string()
}
```

**Output**:
```typescript
{
  success: boolean,
  telegramAccount: {
    username: string | null,
    firstName: string | null,
    photoUrl: string | null
  }
}
```

**Errors**:
- `400 BAD_REQUEST`: Invalid hash (verification failed).
- `400 BAD_REQUEST`: Auth data expired (>24h).
- `409 CONFLICT`: Telegram account already linked to another user.
- `429 TOO_MANY_REQUESTS`: Rate limit exceeded (max 5 attempts per minute).

**Security**:
- Rate limiting: 5 requests per minute per user.
- Audit log entry created on success with userId, telegramId, timestamp.

---

### 2. `user.unlinkTelegram`

**Type**: Mutation
**Description**: Removes the link between the current user and their Telegram account.

**Input**: `void` (uses context `userId`)

**Output**:
```typescript
{
  success: boolean
}
```

**Errors**:
- `404 NOT_FOUND`: User has no linked Telegram account.

**Security**:
- Audit log entry created on success with userId, previousTelegramId, timestamp.

---

### 3. `user.getProfile` (Update)

**Type**: Query
**Description**: Existing query should include `telegramAccount` data.

**Output Update**:
```typescript
{
  // ... user fields ...
  telegramAccount: {
    id: string,
    telegramId: string, // BigInt serialized to string
    username: string | null,
    firstName: string | null,
    photoUrl: string | null
  } | null
}
```
