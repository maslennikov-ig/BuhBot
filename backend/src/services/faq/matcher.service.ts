/**
 * FAQ Matcher Service
 *
 * Provides FAQ matching functionality for automatic responses to common questions.
 * Uses keyword-based matching algorithm with usage count as tiebreaker.
 *
 * Matching Algorithm:
 * 1. Get all active FaqItems from database
 * 2. Split message into words, lowercase
 * 3. Match against FAQ keywords array
 * 4. Score = number of matching keywords
 * 5. If tie, use usageCount as tiebreaker (higher = better)
 * 6. Return best match if score >= 1, else null
 *
 * @module services/faq/matcher
 */

import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

// ============================================================================
// FAQ CACHE (gh-124)
// ============================================================================

/** Cached FAQ items with TTL to avoid DB query on every classification */
interface CachedFaqItem {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  usageCount: number;
}

let faqCache: CachedFaqItem[] | null = null;
let faqCacheExpiry = 0;
const FAQ_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCachedFaqItems(): Promise<CachedFaqItem[]> {
  const now = Date.now();
  if (faqCache && now < faqCacheExpiry) {
    return faqCache;
  }

  const items = await prisma.faqItem.findMany({
    select: {
      id: true,
      question: true,
      answer: true,
      keywords: true,
      usageCount: true,
    },
  });

  faqCache = items;
  faqCacheExpiry = now + FAQ_CACHE_TTL_MS;

  logger.debug('FAQ cache refreshed', {
    itemCount: items.length,
    service: 'faq-matcher',
  });

  return items;
}

/** Invalidate FAQ cache (call after FAQ CRUD operations) */
export function invalidateFaqCache(): void {
  faqCache = null;
  faqCacheExpiry = 0;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of FAQ matching operation
 */
export interface FAQMatch {
  /** UUID of the matched FAQ item */
  faqId: string;
  /** The question text */
  question: string;
  /** The answer to send */
  answer: string;
  /** Match score (number of matching keywords) */
  score: number;
}

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Find a matching FAQ for the given message text
 *
 * Uses keyword-based matching:
 * - Splits message into words
 * - Matches against FAQ keywords (case-insensitive)
 * - Returns best match if score >= 1
 *
 * @param messageText - The incoming message text to match
 * @returns Matching FAQ or null if no match found
 *
 * @example
 * ```typescript
 * const match = await findMatchingFAQ('Когда сдавать отчетность?');
 * if (match) {
 *   await ctx.reply(match.answer);
 *   await incrementUsageCount(match.faqId);
 * }
 * ```
 */
export async function findMatchingFAQ(messageText: string): Promise<FAQMatch | null> {
  try {
    // 1. Get all FAQ items from cache (gh-124)
    const faqItems = await getCachedFaqItems();

    if (faqItems.length === 0) {
      logger.debug('No FAQ items found in database', {
        service: 'faq-matcher',
      });
      return null;
    }

    // 2. Split message into words and lowercase
    const messageWords = normalizeText(messageText);

    if (messageWords.length === 0) {
      logger.debug('Message has no valid words after normalization', {
        service: 'faq-matcher',
      });
      return null;
    }

    // 3. Score each FAQ item
    const scoredItems = faqItems.map((item) => {
      const score = calculateMatchScore(messageWords, item.keywords);
      return {
        faqId: item.id,
        question: item.question,
        answer: item.answer,
        score,
        usageCount: item.usageCount,
      };
    });

    // 4. Filter items with score >= 1
    const matchingItems = scoredItems.filter((item) => item.score >= 1);

    if (matchingItems.length === 0) {
      logger.debug('No FAQ matches found', {
        messageWordsCount: messageWords.length,
        faqItemsCount: faqItems.length,
        service: 'faq-matcher',
      });
      return null;
    }

    // 5. Sort by score (desc), then by usageCount (desc) as tiebreaker
    matchingItems.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.usageCount - a.usageCount;
    });

    // 6. Return best match
    const bestMatch = matchingItems[0];
    if (!bestMatch) {
      return null;
    }

    logger.info('FAQ match found', {
      faqId: bestMatch.faqId,
      score: bestMatch.score,
      question: bestMatch.question.substring(0, 50),
      service: 'faq-matcher',
    });

    return {
      faqId: bestMatch.faqId,
      question: bestMatch.question,
      answer: bestMatch.answer,
      score: bestMatch.score,
    };
  } catch (error) {
    logger.error('Error finding FAQ match', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      service: 'faq-matcher',
    });
    return null;
  }
}

/**
 * Increment the usage count for a FAQ item
 *
 * Called after successfully sending an FAQ response.
 * Helps with relevance ranking (higher usage = better tiebreaker).
 *
 * @param faqId - UUID of the FAQ item
 *
 * @example
 * ```typescript
 * await incrementUsageCount('faq-uuid');
 * ```
 */
export async function incrementUsageCount(faqId: string): Promise<void> {
  try {
    await prisma.faqItem.update({
      where: { id: faqId },
      data: {
        usageCount: { increment: 1 },
      },
    });

    logger.debug('FAQ usage count incremented', {
      faqId,
      service: 'faq-matcher',
    });
  } catch (error) {
    logger.error('Error incrementing FAQ usage count', {
      error: error instanceof Error ? error.message : String(error),
      faqId,
      service: 'faq-matcher',
    });
    // Don't throw - this is not critical
  }
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Normalize text by splitting into lowercase words
 *
 * Removes punctuation and extra whitespace.
 *
 * @param text - Input text
 * @returns Array of lowercase words
 */
function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Remove punctuation, keep letters/numbers
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Calculate match score between message words and FAQ keywords
 *
 * @param messageWords - Normalized message words
 * @param keywords - FAQ keywords array
 * @returns Number of matching keywords
 */
function calculateMatchScore(messageWords: string[], keywords: string[]): number {
  let score = 0;

  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase();

    // Check if any message word contains the keyword
    // or if the keyword contains any message word
    for (const word of messageWords) {
      if (word.includes(normalizedKeyword) || normalizedKeyword.includes(word)) {
        score++;
        break; // Count each keyword only once
      }
    }
  }

  return score;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  findMatchingFAQ,
  incrementUsageCount,
  invalidateFaqCache,
};
