/**
 * Chat Event Handler Regression Tests
 *
 * These tests prevent regressions in:
 * 1. Migration handler duplicate chat creation bug
 * 2. notifyInChatOnBreach default value bug
 *
 * @see https://github.com/maslennikov-ig/BuhBot/issues/[ISSUE_NUMBER]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

describe('Chat migration handler regression', () => {
  const handlerSource = readFileSync(resolve(__dirname, '../chat-event.handler.ts'), 'utf-8');

  it('should use upsert (not create) in migrate_to_chat_id handler', () => {
    // Extract the migration section (after 'migrate_to_chat_id')
    const migrationSection = handlerSource.split("'migrate_to_chat_id'")[1];
    expect(migrationSection).toBeDefined();

    // Should use upsert, not bare create
    expect(migrationSection).toContain('tx.chat.upsert');
    // Verify no bare create calls in migration handler
    // (upsert internally has create/update blocks, but no standalone prisma.chat.create)
    const standaloneCreates = migrationSection!.match(/tx\.chat\.create\(/g);
    expect(standaloneCreates).toBeNull();
  });

  it('should mark old chat as MIGRATED', () => {
    const migrationSection = handlerSource.split("'migrate_to_chat_id'")[1];
    expect(migrationSection).toContain('[MIGRATED]');
  });
});

describe('notifyInChatOnBreach default regression', () => {
  it('schema should default notifyInChatOnBreach to false', () => {
    const schemaSource = readFileSync(
      resolve(__dirname, '../../../../prisma/schema.prisma'),
      'utf-8'
    );

    // Find the notifyInChatOnBreach line
    const line = schemaSource.split('\n').find((l) => l.includes('notifyInChatOnBreach'));
    expect(line).toBeDefined();
    expect(line).toContain('@default(false)');
    expect(line).not.toContain('@default(true)');
  });

  it('registerChat should set notifyInChatOnBreach to false (not true)', () => {
    const chatsRouterSource = readFileSync(
      resolve(__dirname, '../../../api/trpc/routers/chats.ts'),
      'utf-8'
    );

    // Find the registerChat procedure implementation (not the JSDoc comment)
    const parts = chatsRouterSource.split('registerChat: managerProcedure');
    expect(parts.length).toBe(2);
    const registerSection = parts[1]!;

    // Should contain notifyInChatOnBreach set to false
    expect(registerSection).toContain('notifyInChatOnBreach: false');

    // Should NOT contain it set to true (allowing for whitespace variations)
    const trueMatch = registerSection.match(/notifyInChatOnBreach:\s*true/);
    expect(trueMatch).toBeNull();
  });
});
