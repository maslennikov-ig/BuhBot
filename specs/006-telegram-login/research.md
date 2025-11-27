# Research: Telegram Login Integration

**Feature**: Telegram Login Integration
**Date**: 2025-11-27

## R-001: Verification Method

**Problem**: How to securely verify the data received from Telegram Login Widget?

**Options**:
1.  **Custom Crypto**: Implement HMAC-SHA256 verification manually using Node.js `crypto`.
2.  **Library**: Use a library like `@telegram-auth/server`.

**Decision**: **Custom Crypto**.
**Rationale**: The verification algorithm is stable and simple documented by Telegram. Adding a dependency for 10 lines of code is unnecessary.
**Reference**: https://core.telegram.org/widgets/login#checking-authorization

## R-002: Data Storage

**Problem**: Where to store Telegram identity data?

**Options**:
1.  **Columns on User**: Add `telegramId`, `telegramUsername`, etc. to `User` table.
2.  **Separate Table**: Create `TelegramAccount` table with 1:1 relation to `User`.

**Decision**: **Separate Table (`TelegramAccount`)**.
**Rationale**:
- Keeps `User` table clean.
- Allows potential future expansion (e.g., multiple accounts, though currently out of scope).
- Easier to index and query specifically for Telegram users.
- Separation of concerns (Identity vs Application User).

**Schema Draft**:
```prisma
model TelegramAccount {
  id          String   @id @default(cuid())
  telegramId  BigInt   @unique // Telegram IDs are large integers
  username    String?
  firstName   String?
  lastName    String?
  photoUrl    String?
  authDate    Int      // Timestamp from Telegram
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## R-003: Frontend Widget

**Problem**: How to render the Telegram widget in React/Next.js?

**Decision**: **Script Injection**.
**Rationale**: The widget is a `<script>` tag. We need a React component wrapper that injects this script and handles the `data-onauth` callback.
**Implementation**: Create `TelegramLoginButton.tsx` that appends the script to a ref and defines the global callback function.

## R-004: Audit Logging

**Problem**: How to log link/unlink operations for audit?

**Decision**: **Winston structured logging**.
**Rationale**:
- Project already uses Winston for logging.
- Structured JSON logs can be queried/exported.
- No need for separate audit table (overkill for this feature).

**Implementation**:
```typescript
logger.info('telegram_account_linked', {
  userId: ctx.user.id,
  telegramId: input.id,
  telegramUsername: input.username,
  action: 'link',
  timestamp: new Date().toISOString()
});
```

## R-005: Rate Limiting

**Problem**: How to prevent brute-force attacks on linkTelegram?

**Decision**: **In-memory rate limiter with Redis fallback**.
**Rationale**:
- Simple Map-based limiter for MVP.
- Can upgrade to Redis for production scale.
- 5 attempts per minute per user is reasonable.

**Implementation**: Use existing rate limiting middleware or create simple limiter in TelegramService.
