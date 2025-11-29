# Data Model: Admin Panel CRUD Pages

**Feature Branch**: `007-admin-crud-pages`

## Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ FaqItem : "creates"
    User ||--o{ Template : "creates"
    
    User {
        uuid id PK
        string email
        string fullName
        enum role "admin, manager, observer"
        boolean isOnboardingComplete
        datetime createdAt
        datetime updatedAt
    }

    FaqItem {
        uuid id PK
        string question
        string answer
        string[] keywords
        int usageCount
        uuid createdBy FK
        datetime createdAt
        datetime updatedAt
    }

    Template {
        uuid id PK
        string title
        string content
        enum category "greeting, status, document_request, reminder, closing"
        uuid createdBy FK
        int usageCount
        datetime createdAt
        datetime updatedAt
    }
```

## Schema Notes

- **User**: Existing model. `role` field is key for User Management page.
- **FaqItem**: Existing model. `keywords` is a string array (PostgreSQL `text[]`).
- **Template**: Existing model. `content` stores the message text with variables (e.g. `{{clientName}}`).

No database migrations are required for this feature.
