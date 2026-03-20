# Fix: User deletion fails due to FK constraints

## Context

При удалении пользователя через admin-панель Prisma падает с ошибкой:
```
Foreign key constraint violated on the constraint: `chat_invitations_created_by_fkey`
```

Процедура `deleteUser` в `auth.ts:586-664` очищает только часть связей (chats, userManagers, verificationTokens, notificationPreferences, telegramAccounts). **6 таблиц** с FK на User не обрабатываются и не имеют `onDelete` правил в схеме.

## Блокирующие FK (все 6)

| Таблица | Поле | Prisma модель | Nullable сейчас? |
|---------|------|---------------|------------------|
| `chat_invitations` | `created_by` | `ChatInvitation.createdBy` | Нет |
| `templates` | `created_by` | `Template.createdBy` | Нет |
| `faq_items` | `created_by` | `FaqItem.createdBy` | Нет |
| `classification_corrections` | `corrected_by` | `ClassificationCorrection.correctedBy` | Нет |
| `feedback_surveys` | `closed_by` | `FeedbackSurvey.closedBy` | Нет |
| `error_logs` | `assigned_to` | `ErrorLog.assignedTo` | Нет |

## Подход: SET NULL + миграция

Сделать поля nullable, добавить `onDelete: SetNull`, плюс manual cleanup в deleteUser как defense-in-depth.

## Изменения

### 1. Prisma schema — `backend/prisma/schema.prisma`

Для каждой из 6 моделей:
- Сделать поле nullable (`String?` вместо `String`)
- Сделать relation nullable (`User?` вместо `User`)
- Добавить `onDelete: SetNull`

```prisma
// ChatInvitation — было:
createdBy String   @map("created_by") @db.Uuid
creator   User     @relation("InvitationCreator", fields: [createdBy], references: [id])

// ChatInvitation — стало:
createdBy String?  @map("created_by") @db.Uuid
creator   User?    @relation("InvitationCreator", fields: [createdBy], references: [id], onDelete: SetNull)
```

Аналогично для Template, FaqItem, ClassificationCorrection, FeedbackSurvey, ErrorLog.

### 2. Prisma migration

```bash
npx prisma migrate dev --name user-delete-set-null-fk
```

Сгенерирует SQL:
```sql
ALTER TABLE "chat_invitations" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE "chat_invitations" DROP CONSTRAINT "chat_invitations_created_by_fkey";
ALTER TABLE "chat_invitations" ADD CONSTRAINT "chat_invitations_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
-- ... аналогично для остальных 5 таблиц
```

### 3. deleteUser procedure — `backend/src/api/trpc/routers/auth.ts`

Добавить в существующий `Promise.all` блок (строка ~636) cleanup для 6 таблиц:

```typescript
// Existing cleanups...
ctx.prisma.userManager.deleteMany({ ... }),
ctx.prisma.verificationToken.deleteMany({ ... }),
// ...

// NEW: Set NULL for authored/assigned records
ctx.prisma.chatInvitation.updateMany({
  where: { createdBy: input.userId },
  data: { createdBy: null },
}),
ctx.prisma.template.updateMany({
  where: { createdBy: input.userId },
  data: { createdBy: null },
}),
ctx.prisma.faqItem.updateMany({
  where: { createdBy: input.userId },
  data: { createdBy: null },
}),
ctx.prisma.classificationCorrection.updateMany({
  where: { correctedBy: input.userId },
  data: { correctedBy: null },
}),
ctx.prisma.feedbackSurvey.updateMany({
  where: { closedBy: input.userId },
  data: { closedBy: null },
}),
ctx.prisma.errorLog.updateMany({
  where: { assignedTo: input.userId },
  data: { assignedTo: null },
}),
```

### 4. Типы (если нужно)

Проверить и обновить TypeScript типы/Zod-схемы, если они строго типизируют эти поля как non-nullable.

## Файлы для изменения

1. `backend/prisma/schema.prisma` — 6 моделей, nullable + onDelete: SetNull
2. `backend/src/api/trpc/routers/auth.ts` — deleteUser cleanup (строка ~636)
3. Сгенерированная миграция — `backend/prisma/migrations/*/migration.sql`

## Верификация

1. `npx prisma migrate dev` — миграция применяется без ошибок
2. `pnpm type-check` — TS компиляция проходит
3. `pnpm build` — билд успешен
4. Ручной тест: создать тестового пользователя → создать от его имени инвайт/шаблон → удалить пользователя → проверить что удаление прошло и данные сохранились с `created_by = null`
5. Применить миграцию на production: `npx prisma migrate deploy`
