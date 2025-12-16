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
 */
const CLASSIFICATION_PROMPT = `Ты классификатор сообщений для бухгалтерской фирмы. Сообщения приходят от клиентов в Telegram-чатах на русском языке.

Классифицируй сообщение в ОДНУ из 4 категорий:

## REQUEST — запрос, требующий ответа бухгалтера
Примеры:
- "Когда будут готовы документы?"
- "Нужна справка 2-НДФЛ"
- "Где мой счёт?"
- "Не могу найти акт сверки"
- "Подскажите по налогам"
- Любой вопрос (заканчивается на ?)
- Просьба о документе/действии

## SPAM — не требует ответа, игнорируется
Примеры:
- "Ок", "Да", "Нет", "Понятно", "Хорошо"
- Одиночные эмодзи: 👍 ✅ 👌
- "Ага", "Угу", "Ясно"
- Односложные подтверждения

## GRATITUDE — благодарность (для аналитики)
Примеры:
- "Спасибо большое!"
- "Благодарю за помощь"
- "Отлично, выручили!"
- "Супер, молодцы!"

## CLARIFICATION — уточнение к предыдущему запросу
Примеры:
- "Забыл сказать, ИНН: 123456"
- "Ещё один вопрос..."
- "Дополнительно нужно..."
- "Имел в виду за прошлый месяц"

ВАЖНО:
- При сомнениях выбирай REQUEST (лучше отследить лишнее, чем пропустить)
- Короткие сообщения без вопроса — обычно SPAM
- Вопросы с "?" почти всегда REQUEST

Ответ ТОЛЬКО в JSON:
{"classification": "REQUEST", "confidence": 0.95, "reasoning": "вопрос о документах"}`;

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
    typeof response.confidence === 'number'
      ? Math.min(1, Math.max(0, response.confidence))
      : 0.5;

  return {
    classification: response.classification,
    confidence,
    reasoning: typeof response.reasoning === 'string' ? response.reasoning : 'No reasoning provided',
  };
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  return false;
}

/**
 * OpenRouter client for AI-powered classification
 */
class OpenRouterClient {
  private client: OpenAI;
  private config: ClassifierConfig;
  private circuitBreaker: ICircuitBreaker;

  constructor(
    config: Partial<ClassifierConfig> = {},
    circuitBreaker?: ICircuitBreaker
  ) {
    this.config = { ...DEFAULT_CLASSIFIER_CONFIG, ...config };
    this.circuitBreaker = circuitBreaker ?? createCircuitBreaker(this.config.circuitBreaker);

    const apiKey = process.env['OPENROUTER_API_KEY'];
    if (!apiKey) {
      logger.warn('OPENROUTER_API_KEY not set, AI classification will fail', {
        service: 'classifier',
      });
    }

    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey ?? '',
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
          throw new Error('Empty response from OpenRouter');
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
