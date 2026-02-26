/**
 * Format Service Tests - formatWarningMessage
 *
 * Verifies the warning message template used for pre-breach notifications.
 */

import { describe, it, expect } from 'vitest';
import { formatWarningMessage, formatAlertMessage, escapeHtml } from '../format.service.js';

describe('formatWarningMessage', () => {
  const baseData = {
    clientUsername: 'test_client',
    messagePreview: 'Где мой счёт за прошлый месяц?',
    minutesElapsed: 48,
    threshold: 60,
    remainingMinutes: 12,
    chatTitle: 'Бухгалтерия Тест',
  };

  it('should contain warning header', () => {
    const message = formatWarningMessage(baseData);
    expect(message).toContain('ПРЕДУПРЕЖДЕНИЕ');
    expect(message).toContain('SLA');
  });

  it('should show remaining minutes', () => {
    const message = formatWarningMessage(baseData);
    expect(message).toContain('12 мин');
    expect(message).toContain(`${baseData.threshold} мин`);
  });

  it('should include client username', () => {
    const message = formatWarningMessage(baseData);
    expect(message).toContain('@test_client');
  });

  it('should include chat title', () => {
    const message = formatWarningMessage(baseData);
    expect(message).toContain('Бухгалтерия Тест');
  });

  it('should include message preview', () => {
    const message = formatWarningMessage(baseData);
    expect(message).toContain('Где мой счёт за прошлый месяц?');
  });

  it('should include call to action', () => {
    const message = formatWarningMessage(baseData);
    expect(message).toContain('ответьте');
  });

  it('should handle null clientUsername', () => {
    const message = formatWarningMessage({
      ...baseData,
      clientUsername: null,
    });
    expect(message).not.toContain('@null');
    expect(message).toContain('Клиент');
  });

  it('should handle null chatTitle', () => {
    const message = formatWarningMessage({
      ...baseData,
      chatTitle: null,
    });
    expect(message).toContain('личный чат');
  });

  it('should escape HTML in user-provided content', () => {
    const message = formatWarningMessage({
      ...baseData,
      clientUsername: 'user<script>',
      messagePreview: 'test <b>bold</b> & "quotes"',
      chatTitle: 'Chat & <Company>',
    });
    expect(message).not.toContain('<script>');
    expect(message).toContain('&lt;script&gt;');
    expect(message).toContain('&amp;');
  });

  it('should show 0 remaining minutes without negative values', () => {
    const message = formatWarningMessage({
      ...baseData,
      remainingMinutes: 0,
    });
    expect(message).toContain('0 мин');
    expect(message).not.toMatch(/-\d+ мин/);
  });
});

describe('formatAlertMessage with escalation context', () => {
  it('should include escalation context for level 2+', () => {
    const message = formatAlertMessage({
      alertType: 'breach',
      escalationLevel: 2,
      clientUsername: 'test',
      messagePreview: 'Test',
      minutesElapsed: 90,
      threshold: 60,
      chatTitle: 'Test Chat',
      chatId: '123',
      requestId: 'uuid-123',
    });
    expect(message).toContain('Эскалация');
    expect(message).toContain('бухгалтеры не ответили');
  });

  it('should NOT include escalation context for level 1', () => {
    const message = formatAlertMessage({
      alertType: 'breach',
      escalationLevel: 1,
      clientUsername: 'test',
      messagePreview: 'Test',
      minutesElapsed: 60,
      threshold: 60,
      chatTitle: 'Test Chat',
      chatId: '123',
      requestId: 'uuid-123',
    });
    expect(message).not.toContain('Эскалация');
  });
});

describe('escapeHtml', () => {
  it('should escape all HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should escape ampersands', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });
});
