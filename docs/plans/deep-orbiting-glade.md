# Plan: Fix 4 SLA & Chat bugs (gh-31, gh-32, gh-33, gh-34)

## Context

QA-тестирование 2026-02-11 выявило 4 связанных бага в SLA и Telegram-чатах. Все баги репродуцированы локально. Issues #32-34 — дочерние от #31.

**Критически важно**: аналогичные задачи уже закрывались раньше (buh-2vc, buh-mpj, buh-w1w, buh-jo3, gh-12, gh-13, gh-17), но предыдущие фиксы сами стали причиной текущих багов:

| Предыдущий фикс | Что сделано | Какой баг это создало |
|---|---|---|
| buh-2vc (gh-12) | Добавлен `notifyInChatOnBreach` с `@default(true)` | #31B — утечка уведомлений в чат клиента |
| buh-mpj (gh-17) | Хардкод `notifyInChatOnBreach: true` в registerChat (line 608) | #31B — усилил утечку |
| buh-w1w (gh-13) | Warning в ChatSettingsForm, но НЕ в GeneralSettingsForm | #34 — глобальное предупреждение отсутствует |

**Вывод**: нужно не только исправить текущие баги, но и исправить/откатить предыдущие ошибочные фиксы.

---

## Issues

### #31 Bug A: Сообщения теряются при slaEnabled=false (P1)
- **Корень**: `message.handler.ts:96-103` — early return ДО логирования сообщения в ChatMessage
- **Два пути регистрации чатов расходятся**: bot handler (`slaEnabled: false`), tRPC registerChat (`slaEnabled: true`)
- **Фикс**: разделить логирование и SLA-обработку — сообщения всегда логируются

### #31 Bug B: SLA breach уведомление утекает в чат клиента (P1)
- **Корень**: `notifyInChatOnBreach @default(true)` + hardcoded `true` в registerChat + `true` в frontend defaults
- **Фикс**: изменить default на `false` во ВСЕХ местах, обновить существующие записи миграцией

### #32: Дубликаты чатов при миграции group→supergroup (P2)
- **Корень**: `chat-event.handler.ts:169` использует `create()` вместо `upsert()`
- **Фикс**: заменить на `upsert()`, пометить старый чат как мигрированный

### #33: Frontend показывает неправильное поле SLA (P2)
- **Корень**: Frontend показывает `slaResponseMinutes`, backend использует `slaThresholdMinutes` для breach
- tRPC router НИКОГДА не возвращает `slaThresholdMinutes`
- **Фикс**: заменить `slaResponseMinutes` на `slaThresholdMinutes` в API и frontend

### #34: SLA breach alert молча проваливается (P2)
- **Корень**: при пустых `managerTelegramIds` и `globalManagerIds` alert создается, помечается `failed`, никто не узнает
- Warning есть в ChatSettingsForm, но НЕТ в GeneralSettingsForm (предыдущий фикс buh-w1w был неполным)
- **Фикс**: добавить warning в GeneralSettingsForm

---

## Implementation

### Phase 1: Prisma Schema + Migration

**File**: `backend/prisma/schema.prisma`
- Line 221: `notifyInChatOnBreach @default(true)` → `@default(false)`

**Migration SQL** (generate via `npx prisma migrate dev`):
```sql
ALTER TABLE "chats" ALTER COLUMN "notify_in_chat_on_breach" SET DEFAULT false;
UPDATE "chats" SET "notify_in_chat_on_breach" = false WHERE "notify_in_chat_on_breach" = true;
```

### Phase 2: Backend — message.handler.ts (#31A)

**File**: `backend/src/bot/handlers/message.handler.ts`

Текущий поток (НЕПРАВИЛЬНЫЙ):
```
line 96:  if (!slaEnabled || !monitoringEnabled) return;  ← ТЕРЯЕТ СООБЩЕНИЕ
line 107: check accountant
line 132: log to ChatMessage  ← НИКОГДА НЕ ДОСТИГАЕТСЯ
line 197: classify
```

Новый поток:
```
line 96:  if (!monitoringEnabled) return;           ← только monitoring, НЕ sla
line 107: check accountant
line 132: log to ChatMessage                        ← ВСЕГДА выполняется
line NEW: if (!slaEnabled) return;                  ← ПОСЛЕ логирования
line 184: if accountant → response handler
line 197: classify
```

**Изменения**:
1. Line 96: убрать `!chat.slaEnabled ||` — оставить только `!chat.monitoringEnabled`
2. After line 181 (после блока логирования): добавить check `!chat.slaEnabled` с return

### Phase 3: Backend — chat-event.handler.ts (#32)

**File**: `backend/src/bot/handlers/chat-event.handler.ts`

Line 169: заменить `prisma.chat.create()` на `prisma.chat.upsert()`:
```typescript
await prisma.chat.upsert({
  where: { id: BigInt(newChatId) },
  create: {
    id: BigInt(newChatId),
    chatType: 'supergroup',
    title: oldChat.title,
    slaEnabled: oldChat.slaEnabled,
    slaThresholdMinutes: oldChat.slaThresholdMinutes,
    slaResponseMinutes: oldChat.slaResponseMinutes,
    monitoringEnabled: oldChat.monitoringEnabled,
    is24x7Mode: oldChat.is24x7Mode,
    managerTelegramIds: oldChat.managerTelegramIds,
    notifyInChatOnBreach: oldChat.notifyInChatOnBreach,
    accountantUsername: oldChat.accountantUsername,
    accountantUsernames: oldChat.accountantUsernames,
    assignedAccountantId: oldChat.assignedAccountantId,
    inviteLink: oldChat.inviteLink,
  },
  update: {
    title: oldChat.title,
    slaEnabled: oldChat.slaEnabled,
    slaThresholdMinutes: oldChat.slaThresholdMinutes,
    slaResponseMinutes: oldChat.slaResponseMinutes,
    monitoringEnabled: oldChat.monitoringEnabled,
    is24x7Mode: oldChat.is24x7Mode,
    managerTelegramIds: oldChat.managerTelegramIds,
    notifyInChatOnBreach: oldChat.notifyInChatOnBreach,
  },
});
```

Line 178-181: пометить старый чат как мигрированный, добавить `[MIGRATED]` к title.

Line 184-192 (else branch): тоже заменить `create` на `upsert`.

### Phase 4: Backend — sla-timer.worker.ts (#31B)

**File**: `backend/src/queues/sla-timer.worker.ts`

Before line 117: добавить JSDoc `@test-only` с предупреждением о безопасности.

### Phase 5: Backend — chats.ts tRPC router (#33 + #31B fix)

**File**: `backend/src/api/trpc/routers/chats.ts`

1. **Замена `slaResponseMinutes` → `slaThresholdMinutes`** во всех output schemas и select блоках:
   - `list` query: output schema + select
   - `getById` query: output schema + select
   - `getByIdWithMessages` query: output schema + return mapping
   - `update` mutation: input/output schemas + data mapping
   - `registerChat` mutation: output schema + select

2. **Исправление registerChat** (line 608):
   - `notifyInChatOnBreach: true` → `notifyInChatOnBreach: false`
   - Обновить комментарий

### Phase 6: Frontend — ChatsListContent.tsx (#33)

**File**: `frontend/src/components/chats/ChatsListContent.tsx`

- Type definition: `slaResponseMinutes` → `slaThresholdMinutes`
- Line 410: `{chat.slaResponseMinutes}` → `{chat.slaThresholdMinutes}`

### Phase 7: Frontend — ChatDetailsContent.tsx (#33 + #31B)

**File**: `frontend/src/components/chats/ChatDetailsContent.tsx`

- Type definition: `slaResponseMinutes` → `slaThresholdMinutes`
- Line 143: `{chat.slaResponseMinutes}` → `{chat.slaThresholdMinutes}`
- Line 281: `notifyInChatOnBreach: chat.notifyInChatOnBreach ?? true` → `?? false`

### Phase 8: Frontend — ChatSettingsForm.tsx (#33 + #31B)

**File**: `frontend/src/components/chats/ChatSettingsForm.tsx`

- Line 76: `slaResponseMinutes: 60` → `slaThresholdMinutes: 60` в schema
- Line 79: `notifyInChatOnBreach: true` → `notifyInChatOnBreach: false`
- Line 231+: добавить warning text "Только для тестовых чатов" к toggle notifyInChatOnBreach
- Все references `slaResponseMinutes` → `slaThresholdMinutes`

### Phase 9: Frontend — GeneralSettingsForm.tsx (#34)

**File**: `frontend/src/components/settings/GeneralSettingsForm.tsx`

Добавить warning banner когда `globalManagerIds` пуст:
- Import `AlertTriangle` из lucide-react
- Показать предупреждение: "Менеджеры для SLA уведомлений не настроены"

### Phase 10: Tests

**File**: `backend/src/api/trpc/routers/__tests__/chats.test.ts`

- Line 85: `notifyInChatOnBreach: true` → `false`
- Line 102: `expect(capturedCreateData!.notifyInChatOnBreach).toBe(true)` → `toBe(false)`
- All test fixtures: update `slaResponseMinutes` → `slaThresholdMinutes`

---

## Files to Modify (11 files)

| # | File | Changes |
|---|---|---|
| 1 | `backend/prisma/schema.prisma` | `notifyInChatOnBreach @default(false)` |
| 2 | `backend/prisma/migrations/...` | Generated migration |
| 3 | `backend/src/bot/handlers/message.handler.ts` | Move SLA check after logging |
| 4 | `backend/src/bot/handlers/chat-event.handler.ts` | `create` → `upsert` for migration |
| 5 | `backend/src/queues/sla-timer.worker.ts` | JSDoc @test-only |
| 6 | `backend/src/api/trpc/routers/chats.ts` | `slaResponseMinutes` → `slaThresholdMinutes`, notifyInChatOnBreach default |
| 7 | `backend/src/api/trpc/routers/__tests__/chats.test.ts` | Update test expectations |
| 8 | `frontend/src/components/chats/ChatsListContent.tsx` | `slaResponseMinutes` → `slaThresholdMinutes` |
| 9 | `frontend/src/components/chats/ChatDetailsContent.tsx` | Field rename + fallback fix |
| 10 | `frontend/src/components/chats/ChatSettingsForm.tsx` | Field rename + defaults + warning |
| 11 | `frontend/src/components/settings/GeneralSettingsForm.tsx` | Warning banner |

## Verification

```bash
# Type check
cd backend && npm run type-check
cd frontend && npm run type-check

# Build
cd backend && npm run build
cd frontend && npm run build

# Tests
cd backend && npm test
```

## Commit Strategy

4 atomic commits by logical unit:
1. `fix(schema): change notifyInChatOnBreach default to false` — schema + migration
2. `fix(backend): resolve message drop, migration duplicate, test-only doc` — handlers + worker
3. `fix(api): replace slaResponseMinutes with slaThresholdMinutes` — tRPC + tests
4. `fix(frontend): correct SLA field display and add manager warnings` — all frontend files
