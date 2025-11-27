# Data Model: Telegram Login Integration

## Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o| TelegramAccount : "has one"
    
    User {
        string id PK
        string email
        ...
    }

    TelegramAccount {
        string id PK
        bigint telegramId UK "Unique Telegram User ID"
        string userId FK "Link to User"
        string username "Optional Telegram username"
        string firstName
        string lastName
        string photoUrl
        int authDate "Auth timestamp"
        datetime createdAt
        datetime updatedAt
    }
```

## Prisma Schema Changes

```prisma
// backend/prisma/schema.prisma

model User {
  // ... existing fields ...
  telegramAccount TelegramAccount?
}

model TelegramAccount {
  id          String   @id @default(cuid())
  
  // Telegram Data
  telegramId  BigInt   @unique
  username    String?
  firstName   String?
  lastName    String?
  photoUrl    String?
  authDate    Int
  
  // Relations
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String   @unique
  
  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("telegram_accounts")
}
```

## Validation Rules

1.  **Uniqueness**: `telegramId` must be unique across the system. `userId` must be unique (1:1).
2.  **Updates**: If a user links a Telegram account that is already linked to *another* user, the operation must fail (or require explicit transfer, but spec says "fail").
3.  **Data Types**: `telegramId` fits in BigInt (64-bit integer).
