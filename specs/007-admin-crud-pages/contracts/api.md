# API Contracts: Admin Panel CRUD Pages

## 1. FAQ Management (`trpc.faq`)

### `list`

- **Input**: `{ sortBy: 'usage_count' | 'created_at' }`
- **Output**: `Array<{ id, question, answer, keywords, usageCount, ... }>`

### `create`

- **Input**: `{ question: string, answer: string, keywords: string[] }`
- **Output**: `{ success: boolean, faq: FaqItem }`

### `update`

- **Input**: `{ id: string, question?: string, answer?: string, keywords?: string[] }`
- **Output**: `{ success: boolean, faq: FaqItem }`

### `delete`

- **Input**: `{ id: string }`
- **Output**: `{ success: boolean }`

---

## 2. Template Management (`trpc.templates`)

### `list`

- **Input**: `{ category?: TemplateCategory, sortBy: 'usage_count' | 'created_at' }`
- **Output**: `Array<{ id, title, content, category, usageCount, ... }>`

### `create`

- **Input**: `{ title: string, content: string, category: TemplateCategory }`
- **Output**: `{ success: boolean, template: Template }`

### `update`

- **Input**: `{ id: string, title?: string, content?: string, category?: TemplateCategory }`
- **Output**: `{ success: boolean, template: Template }`

### `delete`

- **Input**: `{ id: string }`
- **Output**: `{ success: boolean }`

---

## 3. User Management (`trpc.auth`)

### `listUsers`

- **Input**: `{ role?: UserRole }`
- **Output**: `Array<{ id, email, fullName, role, telegramId: string | null }>`
- **Note**: `telegramId` field already exists in User model (see `backend/src/api/trpc/routers/auth.ts`)

### `updateUserRole` (NEW)

- **Description**: Updates a user's role. Requires Admin privileges.
- **Input**: `{ userId: string, role: UserRole }`
- **Output**: `{ success: boolean, user: User }`
