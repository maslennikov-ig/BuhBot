/**
 * OpenRouter API Client for Message Classification
 *
 * Uses the OpenAI SDK with OpenRouter base URL for AI-powered
 * message classification. Includes retry logic with exponential
 * backoff for rate limit handling.
 *
 * Environment Variables:
 * - OPENROUTER_API_KEY: API key for OpenRouter
 *
 * @module services/classifier/openrouter-client
 */

import OpenAI from 'openai';
import type {
  ClassificationResult,
  AIClassificationResponse,
  MessageCategory,
  ClassifierConfig,
} from './types.js';
import { DEFAULT_CLASSIFIER_CONFIG } from './types.js';
import logger from '../../utils/logger.js';
import {
  createCircuitBreaker,
  type ICircuitBreaker,
  type CircuitState,
} from './circuit-breaker.js';

/**
 * System prompt for message classification
 * Designed for Russian accounting firm communication context
 * Uses priority-based checking with few-shot examples for maximum accuracy
 * Note: Prompt length is not critical due to caching - only cache misses trigger API
 */
const CLASSIFICATION_PROMPT = `Ты классификатор сообщений BuhBot для SLA-мониторинга бухгалтерской фирмы.
Сообщения от клиентов в Telegram на русском языке.

ПРОВЕРЯЙ КАТЕГОРИИ В ПОРЯДКЕ ПРИОРИТЕТА (сверху вниз):

1. REQUEST — требует ответа бухгалтера (запускает SLA-таймер)
   - Любой вопрос (есть "?") или требование действия
   - Ключевые слова: "нужна", "сделайте", "пришлите", "где", "когда", "почему", "как"
   - Проблемы: "не могу", "не получается", "ошибка", "не пришло"
   - Смешанные: Благодарность + Вопрос = REQUEST
   - Новые задачи: "Ещё вопрос...", "А можно ещё..."
   → ПРИ ЛЮБЫХ СОМНЕНИЯХ — ВЫБИРАЙ REQUEST

2. SPAM — не требует ответа, игнорируется
   - Подтверждения: "ок", "да", "нет", "понял", "хорошо", "принято", "ясно"
   - Пассивное ожидание: "жду", "понял, жду", "ожидаю"
   - Эмодзи без текста, "!", приветствия без вопроса

3. GRATITUDE — благодарность (для аналитики)
   - Чистая благодарность БЕЗ вопросов: "спасибо", "благодарю", "выручили", "супер"
   - Есть вопрос → REQUEST, не GRATITUDE

4. CLARIFICATION — уточнение к текущему контексту
   - Дополнительные данные: ИНН, даты, "забыл сказать"
   - Новая просьба → REQUEST

ПРИМЕРЫ:
"Когда будет готова декларация?" → {"classification": "REQUEST", "confidence": 1.0, "reasoning": "вопрос о сроках"}
"Понял, жду" → {"classification": "SPAM", "confidence": 1.0, "reasoning": "пассивное ожидание"}
"Спасибо! А платежку сделали?" → {"classification": "REQUEST", "confidence": 1.0, "reasoning": "благодарность + вопрос"}
"Забыл — ИНН 7712345678" → {"classification": "CLARIFICATION", "confidence": 0.9, "reasoning": "дополнение данных"}
"Ещё нужна справка 2-НДФЛ" → {"classification": "REQUEST", "confidence": 1.0, "reasoning": "новая задача"}
"👍" → {"classification": "SPAM", "confidence": 1.0, "reasoning": "только эмодзи"}
"Спасибо большое!" → {"classification": "GRATITUDE", "confidence": 1.0, "reasoning": "чистая благодарность"}

ФОРМАТ: только JSON, без markdown`;

/**
 * Validates that a string is a valid MessageCategory
 */
function isValidCategory(value: string): value is MessageCategory {
  return ['REQUEST', 'SPAM', 'GRATITUDE', 'CLARIFICATION'].includes(value);
}

/**
 * Parse and validate AI response JSON
 *
 * @param content - Raw response content from AI
 * @returns Parsed classification response
 * @throws Error if response is invalid
 */
function parseAIResponse(content: string): AIClassificationResponse {
  // Handle potential markdown code blocks
  let jsonContent = content.trim();

  // Remove markdown code block if present
  if (jsonContent.startsWith('```')) {
    const match = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match?.[1]) {
      jsonContent = match[1].trim();
    }
  }

  // Extract JSON object if wrapped in other text
  const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in response: ${content.substring(0, 100)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as unknown;

  // Validate structure
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('classification' in parsed) ||
    !('confidence' in parsed)
  ) {
    throw new Error(`Invalid response structure: ${JSON.stringify(parsed)}`);
  }

  const response = parsed as { classification: string; confidence: unknown; reasoning?: string };

  // Validate classification value
  if (!isValidCategory(response.classification)) {
    throw new Error(`Invalid classification value: ${response.classification}`);
  }

  // Validate and normalize confidence
  const confidence =
    typeof response.confidence === 'number' ? Math.min(1, Math.max(0, response.confidence)) : 0.5;

  return {
    classification: response.classification,
    confidence,
    reasoning:
      typeof response.reasoning === 'string' ? response.reasoning : 'No reasoning provided',
  };
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Custom error for empty API responses — should be retried
 */
class EmptyResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmptyResponseError';
  }
}

/**
 * Check if an error is a rate limit error
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof OpenAI.RateLimitError) {
    return true;
  }
  // Check for status code in generic errors
  if (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    (error as { status: number }).status === 429
  ) {
    return true;
  }
  return false;
}

/**
 * Check if an error is retryable (temporary failures)
 */
function isRetryableError(error: unknown): boolean {
  if (isRateLimitError(error)) {
    return true;
  }
  // Retry on server errors and connection issues
  if (error instanceof OpenAI.InternalServerError) {
    return true;
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return true;
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return true;
  }
  if (error instanceof EmptyResponseError) {
    return true;
  }
  return false;
}

/**
 * OpenRouter client for AI-powered classification
 */
class OpenRouterClient {
  private client: OpenAI;
  private config: ClassifierConfig;
  private circuitBreaker: ICircuitBreaker;
  private apiKeyConfigured: boolean;

  constructor(config: Partial<ClassifierConfig> = {}, circuitBreaker?: ICircuitBreaker) {
    this.config = { ...DEFAULT_CLASSIFIER_CONFIG, ...config };
    this.circuitBreaker = circuitBreaker ?? createCircuitBreaker(this.config.circuitBreaker);

    // Use API key from config (DB) or fall back to env (gh-90)
    const apiKey = this.config.openRouterApiKey ?? process.env['OPENROUTER_API_KEY'];
    this.apiKeyConfigured = !!apiKey;

    if (!apiKey) {
      logger.warn(
        'OPENROUTER_API_KEY not set (neither in DB nor env), AI classification disabled',
        {
          service: 'classifier',
        }
      );
    }

    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey || 'not-configured',
      defaultHeaders: {
        'HTTP-Referer': process.env['APP_URL'] ?? 'https://buhbot.ru',
        'X-Title': 'BuhBot Message Classifier',
      },
      timeout: this.config.timeoutMs,
      maxRetries: 0, // We handle retries manually for more control
    });
  }

  /**
   * Classify a message using AI
   *
   * @param text - Message text to classify
   * @returns Classification result
   * @throws Error after max retries exceeded or if circuit breaker is open
   *
   * @example
   * ```typescript
   * const client = new OpenRouterClient();
   * const result = await client.classify("Где мой счёт?");
   * // { classification: 'REQUEST', confidence: 0.95, model: 'openrouter', reasoning: '...' }
   * ```
   */
  async classify(text: string): Promise<ClassificationResult> {
    // Fail fast if API key not configured (gh-90)
    if (!this.apiKeyConfigured) {
      throw new Error('OPENROUTER_API_KEY not configured — AI classification unavailable');
    }

    // Check circuit breaker first
    if (!this.circuitBreaker.canRequest()) {
      logger.warn('Circuit breaker OPEN, skipping OpenRouter', {
        service: 'classifier',
      });
      throw new Error('Circuit breaker OPEN - OpenRouter unavailable');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.config.openRouterModel,
          messages: [
            { role: 'system', content: CLASSIFICATION_PROMPT },
            { role: 'user', content: text },
          ],
          temperature: 0.1, // Low temperature for consistent classification
          max_tokens: 150,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new EmptyResponseError('Empty response from OpenRouter');
        }

        const parsed = parseAIResponse(content);

        logger.debug('AI classification successful', {
          classification: parsed.classification,
          confidence: parsed.confidence,
          model: this.config.openRouterModel,
          attempt,
          service: 'classifier',
        });

        // Record success
        this.circuitBreaker.recordSuccess();

        return {
          classification: parsed.classification,
          confidence: parsed.confidence,
          model: 'openrouter',
          reasoning: parsed.reasoning,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const errorInfo = {
          attempt,
          maxRetries: this.config.maxRetries,
          error: lastError.message,
          isRateLimit: isRateLimitError(error),
          isRetryable: isRetryableError(error),
          service: 'classifier',
        };

        // Record failure only on final attempt or non-retryable error
        if (!isRetryableError(error) || attempt >= this.config.maxRetries) {
          this.circuitBreaker.recordFailure();
        }

        if (isRetryableError(error) && attempt < this.config.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;

          logger.warn(`AI classification failed, retrying in ${delay}ms`, errorInfo);
          await sleep(delay);
          continue;
        }

        logger.error('AI classification failed', errorInfo);
        throw lastError;
      }
    }

    // Should not reach here, but TypeScript needs the throw
    throw lastError ?? new Error('Classification failed after max retries');
  }

  /**
   * Get current circuit breaker state (for monitoring)
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }
}

// Singleton instance
let clientInstance: OpenRouterClient | null = null;

/**
 * Get or create OpenRouter client instance
 *
 * @param config - Optional configuration override
 * @returns OpenRouter client instance
 */
function getClient(config?: Partial<ClassifierConfig>): OpenRouterClient {
  if (!clientInstance || config) {
    clientInstance = new OpenRouterClient(config);
  }
  return clientInstance;
}

/**
 * Classify a message using OpenRouter AI
 *
 * @param text - Message text to classify
 * @param config - Optional configuration override
 * @returns Classification result
 *
 * @example
 * ```typescript
 * import { classifyWithAI } from './openrouter-client.js';
 *
 * const result = await classifyWithAI("Нужна справка 2-НДФЛ");
 * // { classification: 'REQUEST', confidence: 0.92, model: 'openrouter' }
 * ```
 */
export async function classifyWithAI(
  text: string,
  config?: Partial<ClassifierConfig>
): Promise<ClassificationResult> {
  const client = getClient(config);
  return client.classify(text);
}

/**
 * Reset the client instance (useful for testing)
 */
export function resetClient(): void {
  clientInstance = null;
}

/**
 * Get the current circuit breaker state (for monitoring)
 *
 * @returns Current circuit state ('CLOSED', 'OPEN', or 'HALF_OPEN')
 *
 * @example
 * ```typescript
 * import { getCircuitBreakerState } from './openrouter-client.js';
 *
 * const state = getCircuitBreakerState();
 * console.log(`Circuit breaker is ${state}`);
 * ```
 */
export function getCircuitBreakerState(): CircuitState {
  return getClient().getCircuitState();
}

export { OpenRouterClient };
export { CircuitBreaker, type CircuitState, type ICircuitBreaker } from './circuit-breaker.js';
export default classifyWithAI;
