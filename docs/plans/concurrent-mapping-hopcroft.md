# Plan: Resolve merge conflicts in PR #268

## Context

PR #268 (`feat/telegram-first-accountant-onboarding` -> `main`) имеет статус CONFLICTING.
Причина: в `main` уже смержены PR #265 (fix FK constraint violations в deleteUser) и PR #266 (feat: Telegram-first onboarding), а текущая ветка содержит дополнительные security hardening коммиты поверх тех же файлов.

**Конфликтующие файлы (3):**
1. `.beads/issues.jsonl`
2. `backend/src/api/trpc/routers/auth.ts`
3. `backend/src/bot/handlers/accountant.handler.ts`

## Step 1: Merge main into feature branch

```bash
git merge origin/main
```

Это создаст конфликтные маркеры в 3 файлах.

## Step 2: Resolve `.beads/issues.jsonl`

**Тип конфликта:** append-only — обе стороны добавили новые строки.
**Решение:** принять обе стороны (все записи). Использовать `git checkout --theirs` + дописать наши записи, либо вручную убрать маркеры, сохранив все строки.

## Step 3: Resolve `backend/src/api/trpc/routers/auth.ts`

Здесь 2 зоны конфликта с разной стратегией:

### 3a. createUser (imports + helper + mutation) — принять HEAD (ours)

- Импорты `type { Prisma }` и `type TransactionClient` — из HEAD
- Функция `createAccountantInTransaction` — из HEAD
- DEV_MODE блок — из HEAD (использует helper)
- Production accountant creation — из HEAD (fail-fast проверка `BOT_USERNAME`, использует helper)

### 3b. deleteUser — принять main (theirs), адаптировать стиль

- **main** содержит комплексную атомарную `$transaction([...])` из PR #265, которая чистит все 13 FK-связей (chat, userManager, verificationToken, notificationPreference, telegramAccount, chatInvitation, template, faqItem, classificationCorrection, feedbackSurvey, errorLog, slaAlert, user.delete)
- **HEAD** имеет упрощённый `Promise.all` с 5 таблицами — **недостаточно**, вызовет FK violations
- **main** также имеет Supabase Auth cleanup + audit log после транзакции
- **main** использует `TRPCError` вместо bare `Error` — уже правильный стиль

**Решение:** взять deleteUser целиком из main.

## Step 4: Resolve `backend/src/bot/handlers/accountant.handler.ts`

**Тип конфликта:** разные реализации rate limiting.

| Аспект | HEAD (ours) | main (theirs) |
|--------|-------------|---------------|
| Rate limiting | Redis (distributed) | In-memory Map (process-local) |
| Auto-delete password msg | Да (5 мин) | Нет |
| Failure mode | Fail-open с логированием | Нет обработки ошибок |

**Решение:** принять HEAD (ours) — Redis-based cooldown + auto-delete. Это улучшения из коммитов security hardening, ради которых и создан этот PR.

## Step 5: Verify

```bash
cd backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit
```

## Step 6: Commit & push

```bash
git add .
git commit -m "merge: resolve conflicts with main (keep deleteUser FK cleanup from #265)"
git push
```

## Critical files

- `backend/src/api/trpc/routers/auth.ts` — главный файл с конфликтами
- `backend/src/bot/handlers/accountant.handler.ts` — rate limiting + auto-delete
- `.beads/issues.jsonl` — тривиальный append-only конфликт
