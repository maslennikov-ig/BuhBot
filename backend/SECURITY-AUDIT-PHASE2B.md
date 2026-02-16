# Security Audit Phase 2b: Telegram Bot Handlers

**Date:** 2026-02-16
**Auditor:** Security Audit
**Scope:** 16 files in `backend/src/bot/`

---

## Executive Summary

This phase analyzes Telegram bot handlers for security vulnerabilities and bugs. **11 issues identified** across 8 categories with varying severity levels.

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 2 |
| Medium | 5 |
| Low | 3 |

---

## Issue Details

### Issue 1: Missing Authorization on Alert Callbacks (CRITICAL)

**File:** [`alert-callback.handler.ts:52-54`](backend/src/bot/handlers/alert-callback.handler.ts:52)

```typescript
bot.action(/^notify_(.+)$/, async (ctx) => {
  const alertId = ctx.match[1];
  const userId = ctx.from?.id?.toString(); // Captured but NEVER verified!

  if (!alertId) {
    await ctx.answerCbQuery('Некорректные данные');
    return;
  }
  // ... continues to process without authorization
```

**Problem:** The callback handlers for `notify_` and `resolve_` actions capture the user ID but **never verify** that the user clicking the button is authorized to perform these actions. Any Telegram user who receives the inline keyboard button can click it and:
- Trigger notifications to accountants
- Mark alerts as resolved

**Why it's a problem:** This allows unauthorized users to manipulate alert states and send notifications on behalf of the system.

**Severity:** Critical  
**Category:** Security  
**Recommendation:** Add authorization check - verify that `userId` matches the assigned accountant or chat manager before processing callback.

---

### Issue 2: Fail-Open Rate Limiting (HIGH)

**File:** [`rate-limit.ts:162-173`](backend/src/bot/middleware/rate-limit.ts:162)

```typescript
} catch (error) {
  // Redis error - log and allow request to prevent blocking users
  logger.error('Rate limit middleware Redis error', {
    userId,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    service: 'rate-limiter',
  });

  // Fail open - allow request if Redis is unavailable
  return next();
}
```

**Problem:** When Redis is unavailable (connection failure, timeout), the rate limiter fails open and allows ALL requests through without any limiting.

**Why it's a problem:** An attacker can cause Redis failure (or wait for it) and then flood the bot with requests, bypassing rate limiting entirely.

**Severity:** High  
**Category:** Security  
**Recommendation:** Implement fail-closed behavior or secondary in-memory rate limiter as fallback.

---

### Issue 3: Survey Response Missing Authorization (HIGH)

**File:** [`survey.handler.ts:67-120`](backend/src/bot/handlers/survey.handler.ts:67)

```typescript
bot.action(/^survey:rating:([^:]+):(\d)$/, async (ctx) => {
  const deliveryId = ctx.match[1];
  const ratingStr = ctx.match[2];
  // ...
  // NO CHECK if ctx.from is the intended survey recipient!
  const feedbackId = await recordResponse(deliveryId, ratingStr, username);
```

**Problem:** The survey handler does not verify that the user responding to the survey is the intended recipient. Any Telegram user who has the `deliveryId` (from callback data) can submit ratings.

**Why it's a problem:** Survey responses can be spoofed by anyone with access to the callback data (which appears in the inline keyboard).

**Severity:** High  
**Category:** Security  
**Recommendation:** Verify that the responding user's Telegram ID matches the intended recipient stored with the survey delivery.

---

### Issue 4: Thread Creation Race Condition (MEDIUM)

**File:** [`message.handler.ts:314-327`](backend/src/bot/handlers/message.handler.ts:314)

```typescript
// Start new thread from parent - update parent too
threadId = randomUUID();
await prisma.clientRequest.update({
  where: { id: parentRequest.id },
  data: { threadId },
});
```

**Problem:** When creating a new thread from a parent request, the code generates a UUID and updates the parent in a non-atomic way. If two messages arrive simultaneously as replies to the same parent, both could generate different thread IDs.

**Why it's a problem:** Can result in duplicate threads or inconsistent thread grouping.

**Severity:** Medium  
**Category:** Bug  
**Recommendation:** Use database transaction with unique constraint on threadId, or use `FOR UPDATE` locking.

---

### Issue 5: Response Resolution Race Condition (MEDIUM)

**File:** [`response.handler.ts:354-370`](backend/src/bot/handlers/response.handler.ts:354)

```typescript
// 3. If no reply or reply not to a tracked message, find latest pending request (LIFO)
if (!requestToResolve) {
  requestToResolve = await findLatestPendingRequest(String(chatId));

  if (!requestToResolve) {
    logger.debug('No pending requests in chat to resolve', {
      chatId,
      service: 'response-handler',
    });
    return;
  }

  logger.info('Resolving latest pending request (LIFO)', {
    chatId,
    requestId: requestToResolve.id,
    service: 'response-handler',
  });
}

// 5. Stop the SLA timer - NOT ATOMIC with find!
const result = await stopSlaTimer(requestToResolve.id, {
  respondedBy: accountantId,
  responseMessageId: messageId,
});
```

**Problem:** The find-then-update pattern is not atomic. Between finding the latest pending request and stopping its SLA timer, another accountant response could resolve the same request.

**Why it's a problem:** Can lead to:
- Double-resolution of SLA timers
- Incorrect "working minutes" calculations
- Data inconsistency between ChatMessage and ClientRequest

**Severity:** Medium  
**Category:** Bug  
**Recommendation:** Use database transaction or optimistic locking with version field.

---

### Issue 6: Off-By-One in Rate Limit Check (MEDIUM)

**File:** [`rate-limit.ts:132`](backend/src/bot/middleware/rate-limit.ts:132)

```typescript
// Check if rate limit exceeded
if (currentCount >= config.maxRequests) {
```

**Problem:** The check `>=` allows `maxRequests + 1` before rate limiting kicks in.

**Why it's a problem:** One extra request per window per user can accumulate, amplifying load.

**Severity:** Medium  
**Category:** Bug  
**Recommendation:** Change to `>` for strict enforcement.

---

### Issue 7: Missing Template ID Validation (MEDIUM)

**File:** [`template.handler.ts:225-233`](backend/src/bot/handlers/template.handler.ts:225)

```typescript
// /template {id} - send specific template
await sendTemplate(
  ctx.reply.bind(ctx),
  ctx.from,
  ctx.chat && 'title' in ctx.chat
    ? { title: ctx.chat.title, id: ctx.chat.id }
    : { id: ctx.chat?.id },
  arg  // Directly passed without validation
);
```

**Problem:** The `arg` (template ID) is passed directly to `sendTemplate` without format validation. While Prisma will reject invalid IDs, this bypasses input sanitization.

**Why it's a problem:** Could potentially expose database errors or unexpected behavior with malformed IDs.

**Severity:** Medium  
**Category:** Security  
**Recommendation:** Add regex validation for template ID format before lookup.

---

### Issue 8: Information Disclosure in /info Command (MEDIUM)

**File:** [`system.handler.ts:39-46`](backend/src/bot/handlers/system.handler.ts:39)

```typescript
const infoMessage = `🤖 *BuhBot Info*\n\n🔹 *Версия:* ${BOT_VERSION}
🔹 *Среда:* ${env.NODE_ENV}
🔹 *ID Чата:* 
${ctx.chat?.id}
🔹 *Тип чата:* ${ctx.chat?.type}
🔹 *Ваш ID:* 
${ctx.from?.id}
```

**Problem:** The `/info` command exposes sensitive identifiers to any user who invokes it:
- Chat ID (can be used to identify and target the chat)
- User ID (can be used to identify and target the user)

**Why it's a problem:** This information should only be visible to administrators, not regular users.

**Severity:** Medium  
**Category:** Security  
**Recommendation:** Restrict `/info` command to authorized users only, or remove sensitive IDs from output for non-admin users.

---

### Issue 9: Missing Chat Title Sanitization (MEDIUM)

**File:** [`chat-event.handler.ts:126-133`](backend/src/bot/handlers/chat-event.handler.ts:126)

```typescript
// Handle Chat Title Changes
bot.on('new_chat_title', async (ctx) => {
  const chatId = ctx.chat.id;
  const newTitle = ctx.message.new_chat_title;

  logger.info('Chat title changed', { chatId, newTitle, service: 'chat-event-handler' });

  await prisma.chat.update({
    where: { id: BigInt(chatId) },
    data: { title: newTitle },  // Direct insertion without sanitization
  });
```

**Problem:** Chat title from Telegram is inserted directly into the database without sanitization.

**Why it's a problem:** While Telegram titles are generally trusted, they could contain:
- Very long strings (performance issue)
- Special characters
- Potential XSS if rendered in web UI

**Severity:** Medium  
**Category:** Security  
**Recommendation:** Sanitize title with length limit and character filtering before database insertion.

---

### Issue 10: Untrusted File Name Handling (LOW)

**File:** [`file.handler.ts:108`](backend/src/bot/handlers/file.handler.ts:108)

```typescript
const filename = document.file_name ?? 'Без названия';
```

**Problem:** File name from Telegram document is used directly without sanitization.

**Why it's a problem:** Could contain special characters that might cause issues in:
- Log files
- File system operations
- Display in UI

**Severity:** Low  
**Category:** Bug  
**Recommendation:** Sanitize filename before logging or display.

---

### Issue 11: Tracer Span Not Ended on Error (LOW)

**File:** [`message.handler.ts:236-244`](backend/src/bot/handlers/message.handler.ts:236)

```typescript
const classifySpan = tracer.startSpan('classify_message', {
  attributes: { 'chat.id': chatId, 'message.id': messageId },
});
const classification = await classifyMessage(prisma, text);
classifySpan.setAttribute('classification.result', classification.classification);
classifySpan.setAttribute('classification.confidence', classification.confidence);
classifySpan.setAttribute('classification.model', classification.model);
classifySpan.end();
```

**Problem:** If `classifyMessage` throws an exception, the span is never ended, causing memory leak in the tracer.

**Why it's a problem:** Can lead to memory leaks and incomplete traces.

**Severity:** Low  
**Category:** Bug  
**Recommendation:** Use try-finally to ensure span is always ended.

---

## Positive Security Findings

### Input Validation
- [`invitation.handler.ts:16`](backend/src/bot/handlers/invitation.handler.ts:16): Proper regex validation of invitation tokens before database lookup
- [`message.handler.ts:33-38`](backend/src/bot/handlers/message.handler.ts:33): Zod schema validates all incoming message data
- [`survey.handler.ts:77-85`](backend/src/bot/handlers/survey.handler.ts:77): Rating validated to be 1-5

### Authentication & Authorization
- [`response.handler.ts:46-217`](backend/src/bot/handlers/response.handler.ts:46): Multi-tier accountant verification with secure ID-based checks prioritized over username

### Data Integrity
- [`invitation.handler.ts:178`](backend/src/bot/handlers/invitation.handler.ts:178): Uses database transaction for invitation processing
- [`message.handler.ts:267-290`](backend/src/bot/handlers/message.handler.ts:267): Proper deduplication with hash and time window

### Error Handling
- [`middleware/error.ts`](backend/src/bot/middleware/error.ts): Comprehensive error handling with proper classification and user-friendly messages

### Rate Limiting
- [`rate-limit.ts`](backend/src/bot/middleware/rate-limit.ts): Redis-based sliding window rate limiting

---

## Recommendations Summary

| Priority | Action |
|----------|--------|
| P0 | Add authorization check to alert callbacks (Issue 1) |
| P0 | Add authorization to survey responses (Issue 3) |
| P1 | Fix fail-open rate limiting (Issue 2) |
| P1 | Fix thread creation race condition (Issue 4) |
| P1 | Fix response resolution race condition (Issue 5) |
| P2 | Fix off-by-one rate limit (Issue 6) |
| P2 | Add template ID validation (Issue 7) |
| P2 | Restrict /info command output (Issue 8) |
| P3 | Sanitize chat titles (Issue 9) |
| P3 | Sanitize filenames (Issue 10) |
| P3 | Fix tracer span cleanup (Issue 11) |

---

## Testing Recommendations

1. **Authorization Tests**: Write tests to verify callback handlers reject unauthorized users
2. **Race Condition Tests**: Load test with concurrent messages to verify thread/request handling
3. **Rate Limit Tests**: Verify rate limiting behavior under Redis failure scenarios
4. **Input Validation Tests**: Test with malformed IDs and edge cases

---

*End of Phase 2b Report*
