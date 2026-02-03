/**
 * Keyword-based Message Classifier
 *
 * Fallback classifier using Russian keyword patterns.
 * Used when AI classification fails or returns low confidence.
 *
 * Categories:
 * - REQUEST: Questions, document requests, problems (triggers SLA timer)
 * - SPAM: Thanks, confirmations, emoji only (ignored)
 * - GRATITUDE: Specific thanks messages (analytics only)
 * - CLARIFICATION: Follow-up to previous request (extends context)
 *
 * @module services/classifier/keyword-classifier
 */

import type { ClassificationResult, MessageCategory } from './types.js';
import logger from '../../utils/logger.js';

/**
 * Pattern definition with category and priority
 */
interface PatternGroup {
  category: MessageCategory;
  patterns: RegExp[];
  /** Higher priority wins when multiple patterns match */
  priority: number;
}

// REQUEST patterns - questions, document requests, problems
// These require a response and trigger SLA timer
const REQUEST_PATTERNS: RegExp[] = [
  // Questions with interrogative words
  /где\s+(мой|моя|мое|мои)/i, // "Где мой счёт?"
  /когда\s+(будет|можно|готов)/i, // "Когда будет готов?"
  /как\s+(можно|сделать|получить)/i, // "Как получить справку?"
  /почему\s+(не|нет)/i, // "Почему не пришло?"
  /что\s+(делать|случилось|произошло)/i, // "Что делать?"

  // Document requests
  /нужн[аоы]\s+(справк|документ|выписк|счёт|счет|акт)/i, // "Нужна справка"
  /пришлите\s+(справк|документ|выписк|счёт|счет|акт)/i, // "Пришлите справку"
  /отправьте\s+(справк|документ|выписк|счёт|счет|акт)/i, // "Отправьте документ"
  /можно\s+(справк|документ|выписк|счёт|счет|акт)/i, // "Можно справку?"
  /пожалуйста.*(справк|документ|выписк|счёт|счет|акт)/i, // "Пожалуйста, справку"

  // Problems and issues
  /не\s+(могу|получается|работает|приходит)/i, // "Не могу оплатить"
  /ошибк[аиу]/i, // "Ошибка в документе"
  /проблем[аыу]/i, // "Проблема с оплатой"
  /не\s+пришл[оа]/i, // "Не пришло письмо"
  /не\s+(вижу|нашел|нашла|найду)/i, // "Не вижу документ"

  // Requests for help
  /помогите/i, // "Помогите"
  /подскажите/i, // "Подскажите"
  /посоветуйте/i, // "Посоветуйте"

  // Direct questions (end with ?)
  /\?$/,
];

// SPAM patterns - thanks, confirmations, emoji only
// These are ignored for SLA purposes
const SPAM_PATTERNS: RegExp[] = [
  // Simple thanks/confirmations (standalone)
  /^(спасибо|благодарю|ок|okay|хорошо|договорились|понятно|ясно|принято|получил[аи]?)$/i,
  /^(да|нет|угу|ага)$/i,

  // Emoji only patterns
  /^[\p{Emoji}\s]+$/u,
  /^[👍🙏✅💪👌🔥]+$/u,

  // Short acknowledgments (standalone)
  /^(ок|ok|ладно|понял[аи]?|принял[аи]?)$/i,
  /^[йй]+$/i, // Just "й" repeated (typing artifact)

  // Single word confirmations
  /^отлично$/i,
  /^прекрасно$/i,
  /^здорово$/i,
];

// GRATITUDE patterns - specific thanks expressions
// Tracked for analytics but don't require response
const GRATITUDE_PATTERNS: RegExp[] = [
  /спасибо\s+(большое|огромное|вам|за)/i, // "Спасибо большое!"
  /благодар[юим]\s+(вас|за)/i, // "Благодарю вас"
  /очень\s+благодар/i, // "Очень благодарен"
  /выручили/i, // "Выручили!"
  /молодц[ыы]/i, // "Молодцы!"
  /супер\s+(работа)?/i, // "Супер!" or "Супер работа!"
  /замечательно/i, // "Замечательно!"
  /отличная\s+работа/i, // "Отличная работа!"
  /спас[иш]б[оа]\s+за\s+(помощь|работу)/i, // "Спасибо за помощь"
];

// CLARIFICATION patterns - follow-ups, additional context
// Extend existing conversation context
const CLARIFICATION_PATTERNS: RegExp[] = [
  /ещё\s+(вопрос|один|уточнение)/i, // "Ещё вопрос"
  /еще\s+(вопрос|один|уточнение)/i, // "Еще вопрос" (alternative spelling)
  /дополн(ительно|ение)/i, // "Дополнительно"
  /уточн(яю|ение|ить)/i, // "Уточняю"
  /имел[аи]?\s+в\s+виду/i, // "Имел в виду"
  /то\s+есть/i, // "То есть..."
  /в\s+продолжение/i, // "В продолжение"
  /по\s+поводу\s+предыдущ/i, // "По поводу предыдущего"
  /к\s+предыдущему/i, // "К предыдущему"
  /забыл[аи]?\s+(сказать|добавить|уточнить)/i, // "Забыл сказать"
];

/**
 * Pattern groups with priorities
 * Higher priority wins when multiple categories match
 */
const PATTERN_GROUPS: PatternGroup[] = [
  { category: 'REQUEST', patterns: REQUEST_PATTERNS, priority: 3 },
  { category: 'SPAM', patterns: SPAM_PATTERNS, priority: 2 },
  { category: 'GRATITUDE', patterns: GRATITUDE_PATTERNS, priority: 2 },
  { category: 'CLARIFICATION', patterns: CLARIFICATION_PATTERNS, priority: 1 },
];

/**
 * Normalize text for consistent matching
 *
 * @param text - Raw message text
 * @returns Normalized text
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' '); // Collapse multiple spaces
}

/**
 * Calculate confidence score based on pattern matches
 *
 * @param matchCount - Number of patterns matched
 * @param totalPatterns - Total patterns in the group
 * @param textLength - Length of the input text
 * @returns Confidence score (0.0 - 1.0)
 */
function calculateConfidence(
  matchCount: number,
  totalPatterns: number,
  textLength: number
): number {
  // Base confidence from match ratio
  const matchRatio = matchCount / totalPatterns;

  // Shorter messages get higher confidence for exact matches
  const lengthBonus = textLength < 20 ? 0.2 : textLength < 50 ? 0.1 : 0;

  // Multiple matches increase confidence
  const multiMatchBonus = matchCount > 1 ? 0.15 : 0;

  // Calculate final confidence, capped at 0.95
  const confidence = Math.min(0.95, 0.5 + matchRatio * 0.3 + lengthBonus + multiMatchBonus);

  return Math.round(confidence * 100) / 100; // Round to 2 decimal places
}

/**
 * Classify a message using keyword patterns
 *
 * @param text - Message text to classify
 * @returns Classification result with category and confidence
 *
 * @example
 * ```typescript
 * const result = classifyByKeywords("Где мой счёт?");
 * // { classification: 'REQUEST', confidence: 0.75, model: 'keyword-fallback' }
 * ```
 */
export function classifyByKeywords(text: string): ClassificationResult {
  const normalizedText = normalizeText(text);

  // Track matches for each category
  const categoryScores = new Map<
    MessageCategory,
    { matches: number; total: number; priority: number }
  >();

  for (const group of PATTERN_GROUPS) {
    let matchCount = 0;

    for (const pattern of group.patterns) {
      if (pattern.test(normalizedText)) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      categoryScores.set(group.category, {
        matches: matchCount,
        total: group.patterns.length,
        priority: group.priority,
      });
    }
  }

  // No matches - default to CLARIFICATION (safe default requiring human review)
  if (categoryScores.size === 0) {
    logger.debug('No keyword patterns matched, defaulting to CLARIFICATION', {
      text: text.substring(0, 50),
      service: 'classifier',
    });

    return {
      classification: 'CLARIFICATION',
      confidence: 0.3,
      model: 'keyword-fallback',
      reasoning: 'No patterns matched, requires human review',
    };
  }

  // Find best match by priority, then by match count
  let bestCategory: MessageCategory = 'CLARIFICATION';
  let bestScore = { matches: 0, total: 1, priority: 0 };

  for (const [category, score] of categoryScores) {
    const isBetterPriority = score.priority > bestScore.priority;
    const isSamePriorityMoreMatches =
      score.priority === bestScore.priority && score.matches > bestScore.matches;

    if (isBetterPriority || isSamePriorityMoreMatches) {
      bestCategory = category;
      bestScore = score;
    }
  }

  const confidence = calculateConfidence(bestScore.matches, bestScore.total, normalizedText.length);

  const reasoning = `Matched ${bestScore.matches} of ${bestScore.total} ${bestCategory} patterns`;

  logger.debug('Keyword classification result', {
    category: bestCategory,
    confidence,
    matchCount: bestScore.matches,
    text: text.substring(0, 50),
    service: 'classifier',
  });

  return {
    classification: bestCategory,
    confidence,
    model: 'keyword-fallback',
    reasoning,
  };
}

export default classifyByKeywords;
