# Quick Start: Admin CRUD Pages

## Prerequisites
- Backend running (`npm run dev` in `backend/`)
- Frontend running (`npm run dev` in `frontend/`)
- Logged in as an **Admin** user (to test all features)

## Testing FAQ Management
1. Navigate to `/settings/faq` (via sidebar or URL).
2. Click "Add FAQ".
3. Fill form:
   - Question: "How to reset password?"
   - Answer: "Go to settings..."
   - Keywords: "password", "reset"
4. Save and verify it appears in the list.
5. Edit the item and save.
6. Delete the item.

## Testing Template Management
1. Navigate to `/settings/templates`.
2. Click "Create Template".
3. Title: "Welcome". Category: "Greeting".
4. Content: "Hello {{clientName}}, welcome!" (Use helper chips).
5. Save and verify.

## Testing User Management
1. Navigate to `/settings/users`.
2. See list of users.
3. Click "Edit Role" on a user (not yourself).
4. Change role to "Manager".
5. Save and verify the badge updates.

## Navigation Check
1. Click "Clients" in sidebar -> Should go to `/chats`.
2. Click "SLA Monitor" -> Should show "Coming Soon".
3. Click "Reports" -> Should show "Coming Soon".
