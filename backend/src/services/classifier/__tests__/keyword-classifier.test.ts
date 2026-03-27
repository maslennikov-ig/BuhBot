/**
 * Keyword Classifier Tests
 *
 * Tests for classifyByKeywords() function from keyword-classifier.ts
 *
 * Test Coverage:
 * 1. SPAM patterns - @mentions, confirmations, waiting statements
 * 2. GRATITUDE patterns - thanks expressions
 * 3. REQUEST patterns - questions with ?
 * 4. Priority system - REQUEST wins over SPAM when both match
 * 5. Safety net - default CLARIFICATION when no patterns match
 */

import { describe, it, expect, vi } from 'vitest';

// Mock logger before importing classifier
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { classifyByKeywords } from '../keyword-classifier.js';

describe('classifyByKeywords - SPAM patterns', () => {
  it('should classify @username as SPAM', () => {
    const result = classifyByKeywords('@user123');

    expect(result).toMatchObject({
      classification: 'SPAM',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify multiple @mentions as SPAM', () => {
    const result = classifyByKeywords('@user1 @user2');

    expect(result).toMatchObject({
      classification: 'SPAM',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should NOT classify @mention with text after as SPAM', () => {
    const result = classifyByKeywords('@user привет, как дела?');

    // Should match REQUEST (question mark) instead of SPAM
    expect(result.classification).not.toBe('SPAM');
  });

  it('should classify "Приняли" as SPAM', () => {
    const result = classifyByKeywords('Приняли');

    expect(result).toMatchObject({
      classification: 'SPAM',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Получено. Спасибо!" as SPAM (matches SPAM pattern first)', () => {
    const result = classifyByKeywords('Получено. Спасибо!');

    // This should match SPAM pattern /^(приняли|принято|получили|получено)\.?\s*(спасибо)?!?\s*$/i
    // Note: Both SPAM and GRATITUDE have priority 2, but SPAM is checked first in the code
    expect(result.classification).toBe('SPAM');
    expect(result.model).toBe('keyword-fallback');
  });

  it('should NOT classify "Приняли документ" as SPAM (has extra word)', () => {
    const result = classifyByKeywords('Приняли документ');

    // Should not match SPAM pattern because of extra word "документ"
    expect(result.classification).not.toBe('SPAM');
  });

  it('should classify "Жду ответа" as SPAM', () => {
    const result = classifyByKeywords('Жду ответа');

    expect(result).toMatchObject({
      classification: 'SPAM',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Ждём с нетерпением" as SPAM', () => {
    const result = classifyByKeywords('Ждём с нетерпением');

    expect(result).toMatchObject({
      classification: 'SPAM',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify emoji-only message as SPAM', () => {
    const result = classifyByKeywords('👍🙏');

    expect(result).toMatchObject({
      classification: 'SPAM',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify standalone "спасибо" as SPAM', () => {
    const result = classifyByKeywords('спасибо');

    expect(result).toMatchObject({
      classification: 'SPAM',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "ок" as SPAM', () => {
    const result = classifyByKeywords('ок');

    expect(result).toMatchObject({
      classification: 'SPAM',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "понятно" as SPAM', () => {
    const result = classifyByKeywords('понятно');

    expect(result).toMatchObject({
      classification: 'SPAM',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe('classifyByKeywords - GRATITUDE patterns', () => {
  it('should classify "Приняли. Спасибо большое!" as GRATITUDE', () => {
    const result = classifyByKeywords('Приняли. Спасибо большое!');

    expect(result).toMatchObject({
      classification: 'GRATITUDE',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Очень ждем. Спасибо!" as GRATITUDE', () => {
    const result = classifyByKeywords('Очень ждем. Спасибо!');

    expect(result).toMatchObject({
      classification: 'GRATITUDE',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Спасибо большое за помощь" as GRATITUDE', () => {
    const result = classifyByKeywords('Спасибо большое за помощь');

    expect(result).toMatchObject({
      classification: 'GRATITUDE',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Благодарю вас" as GRATITUDE', () => {
    const result = classifyByKeywords('Благодарю вас');

    expect(result).toMatchObject({
      classification: 'GRATITUDE',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Выручили!" as GRATITUDE', () => {
    const result = classifyByKeywords('Выручили!');

    expect(result).toMatchObject({
      classification: 'GRATITUDE',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Молодцы!" as GRATITUDE', () => {
    const result = classifyByKeywords('Молодцы!');

    expect(result).toMatchObject({
      classification: 'GRATITUDE',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe('classifyByKeywords - REQUEST patterns', () => {
  it('should classify message ending with ? as REQUEST', () => {
    const result = classifyByKeywords('Когда будет готово?');

    expect(result).toMatchObject({
      classification: 'REQUEST',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Где мой счёт?" as REQUEST', () => {
    const result = classifyByKeywords('Где мой счёт?');

    expect(result).toMatchObject({
      classification: 'REQUEST',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Нужна справка" as REQUEST', () => {
    const result = classifyByKeywords('Нужна справка');

    expect(result).toMatchObject({
      classification: 'REQUEST',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Помогите разобраться" as REQUEST', () => {
    const result = classifyByKeywords('Помогите разобраться');

    expect(result).toMatchObject({
      classification: 'REQUEST',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Не могу оплатить" as REQUEST', () => {
    const result = classifyByKeywords('Не могу оплатить');

    expect(result).toMatchObject({
      classification: 'REQUEST',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Ошибка в документе" as REQUEST', () => {
    const result = classifyByKeywords('Ошибка в документе');

    expect(result).toMatchObject({
      classification: 'REQUEST',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe('classifyByKeywords - CLARIFICATION patterns', () => {
  it('should classify "Ещё вопрос" as CLARIFICATION', () => {
    const result = classifyByKeywords('Ещё вопрос');

    expect(result).toMatchObject({
      classification: 'CLARIFICATION',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Уточняю" as CLARIFICATION', () => {
    const result = classifyByKeywords('Уточняю');

    expect(result).toMatchObject({
      classification: 'CLARIFICATION',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify "Забыл сказать" as CLARIFICATION', () => {
    const result = classifyByKeywords('Забыл сказать');

    expect(result).toMatchObject({
      classification: 'CLARIFICATION',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe('classifyByKeywords - Priority system', () => {
  it('should prioritize REQUEST (priority 3) over SPAM (priority 2) when both match', () => {
    // Message matches both SPAM pattern (/^(жду|ждём|ждем)\s/i) and REQUEST pattern (/\?$/)
    const result = classifyByKeywords('Жду ответа?');

    // REQUEST should win because it has higher priority (3 > 2)
    expect(result).toMatchObject({
      classification: 'REQUEST',
      model: 'keyword-fallback',
    });
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should prioritize SPAM (priority 2) over CLARIFICATION (priority 1) when both match', () => {
    // Message matches both SPAM and potentially CLARIFICATION
    const result = classifyByKeywords('Жду дополнительно');

    // SPAM should win because it has higher priority (2 > 1)
    expect(result).toMatchObject({
      classification: 'SPAM',
      model: 'keyword-fallback',
    });
  });

  it('should prioritize REQUEST over GRATITUDE when both match', () => {
    // Message matches both GRATITUDE (/спасибо/) and REQUEST (/\?$/)
    const result = classifyByKeywords('Спасибо за информацию. Когда готово?');

    // REQUEST should win because it has higher priority (3 > 2)
    expect(result).toMatchObject({
      classification: 'REQUEST',
      model: 'keyword-fallback',
    });
  });
});

describe('classifyByKeywords - Safety net (default REQUEST)', () => {
  it('should return REQUEST with confidence 0.3 when no patterns match', () => {
    // Message with no matching patterns
    const result = classifyByKeywords('Просто обычное сообщение без триггеров');

    expect(result).toMatchObject({
      classification: 'REQUEST',
      confidence: 0.3,
      model: 'keyword-fallback',
      reasoning: 'No patterns matched, defaulting to REQUEST for SLA safety',
    });
  });

  it('should return REQUEST for random text', () => {
    const result = classifyByKeywords('Lorem ipsum dolor sit amet');

    expect(result).toMatchObject({
      classification: 'REQUEST',
      confidence: 0.3,
      model: 'keyword-fallback',
    });
  });

  it('should return REQUEST for empty-looking message', () => {
    const result = classifyByKeywords('   ');

    expect(result).toMatchObject({
      classification: 'REQUEST',
      confidence: 0.3,
      model: 'keyword-fallback',
    });
  });

  it('should return REQUEST for message with no clear intent', () => {
    const result = classifyByKeywords('Текст без ясного намерения');

    expect(result).toMatchObject({
      classification: 'REQUEST',
      confidence: 0.3,
      model: 'keyword-fallback',
    });
  });
});

describe('classifyByKeywords - Edge cases', () => {
  it('should handle case insensitivity', () => {
    const result = classifyByKeywords('СПАСИБО БОЛЬШОЕ');

    expect(result.classification).toBe('GRATITUDE');
  });

  it('should handle extra whitespace', () => {
    const result = classifyByKeywords('   Жду   ответа   ');

    expect(result.classification).toBe('SPAM');
  });

  it('should normalize multiple spaces', () => {
    const result = classifyByKeywords('Где    мой    счёт?');

    expect(result.classification).toBe('REQUEST');
  });

  it('should return reasoning for all results', () => {
    const result = classifyByKeywords('Спасибо большое!');

    expect(result.reasoning).toBeDefined();
    expect(typeof result.reasoning).toBe('string');
  });

  it('should return confidence between 0 and 1', () => {
    const messages = [
      'Спасибо',
      'Где мой счёт?',
      'Жду ответа',
      'Ещё вопрос',
      'Текст без паттернов',
    ];

    for (const message of messages) {
      const result = classifyByKeywords(message);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});
