/**
 * Classifier Feedback Processor
 *
 * Analyzes classification correction patterns to improve the keyword classifier.
 * Consumes ClassificationCorrection records created when managers reclassify messages,
 * extracts common words/phrases from misclassified messages, and generates
 * keyword pattern suggestions.
 *
 * Features:
 * - Pattern analysis across correction records
 * - Keyword suggestion generation with confidence scoring
 * - Misclassification rate calculation per category
 * - Configurable analysis window (default: 30 days)
 *
 * @module services/classifier/feedback.processor
 */

import type { PrismaClient, MessageClassification } from '@prisma/client';
import type { MessageCategory } from './types.js';
import logger from '../../utils/logger.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * A single misclassification pattern: original -> corrected category
 */
export interface MisclassificationPattern {
  /** Original (incorrect) classification */
  from: MessageCategory;
  /** Corrected (correct) classification */
  to: MessageCategory;
  /** Number of times this correction was made */
  count: number;
  /** Example message texts that were corrected (up to 5) */
  examples: string[];
}

/**
 * A suggested keyword pattern for the keyword classifier
 */
export interface KeywordSuggestion {
  /** Target category for this pattern */
  category: MessageCategory;
  /** Suggested keyword or phrase */
  keyword: string;
  /** Confidence score (0.0 - 1.0) based on frequency and distinctiveness */
  confidence: number;
  /** Number of corrections this keyword appeared in */
  occurrences: number;
}

/**
 * Misclassification rate for a single category
 */
export interface MisclassificationRate {
  /** The category being evaluated */
  category: MessageCategory;
  /** Total corrections where this was the original (wrong) class */
  totalMisclassified: number;
  /** Most common corrected-to category */
  mostCommonCorrection: MessageCategory | null;
  /** Rate as fraction of total corrections */
  rate: number;
}

/**
 * Complete feedback analysis result
 */
export interface FeedbackAnalysis {
  /** Total number of corrections in the analysis window */
  totalCorrections: number;
  /** Top misclassification patterns sorted by frequency */
  topMisclassifications: MisclassificationPattern[];
  /** Suggested keywords for the keyword classifier */
  suggestedKeywords: KeywordSuggestion[];
  /** Estimated classification accuracy based on correction rate */
  classificationAccuracy: number;
  /** Misclassification rates by category */
  misclassificationRates: MisclassificationRate[];
  /** Analysis window in days */
  analyzedDays: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum corrections of a single type to consider it a pattern */
const MIN_PATTERN_THRESHOLD = 3;

/** Maximum number of examples to keep per pattern */
const MAX_EXAMPLES = 5;

/** Maximum number of keyword suggestions to return */
const MAX_KEYWORD_SUGGESTIONS = 20;

/** Minimum word length to consider as a keyword */
const MIN_WORD_LENGTH = 3;

/** Maximum word length to filter out very long words */
const MAX_WORD_LENGTH = 30;

/** Service identifier for logging */
const SERVICE_NAME = 'feedback-processor';

/**
 * Russian stop words to exclude from keyword extraction.
 * These are common words that carry no classification signal.
 */
const RUSSIAN_STOP_WORDS = new Set([
  // Pronouns
  'я',
  'мы',
  'ты',
  'вы',
  'он',
  'она',
  'оно',
  'они',
  'мне',
  'мной',
  'нам',
  'нас',
  'тебе',
  'тебя',
  'вам',
  'вас',
  'ему',
  'его',
  'ей',
  'её',
  'им',
  'их',
  'них',
  'нем',
  'ней',
  'ним',
  'нее',
  'него',
  // Prepositions
  'в',
  'на',
  'за',
  'по',
  'из',
  'от',
  'до',
  'для',
  'при',
  'без',
  'про',
  'через',
  'над',
  'под',
  'между',
  'после',
  'перед',
  'около',
  // Conjunctions
  'и',
  'а',
  'но',
  'или',
  'что',
  'как',
  'если',
  'чтобы',
  'когда',
  'потому',
  'хотя',
  'тоже',
  'также',
  // Particles
  'не',
  'ни',
  'бы',
  'ли',
  'же',
  'вот',
  'ведь',
  'даже',
  'уже',
  'ещё',
  'еще',
  // Common verbs (auxiliary / very frequent)
  'быть',
  'был',
  'была',
  'было',
  'были',
  'есть',
  'будет',
  'будут',
  'это',
  'этот',
  'эта',
  'эти',
  'тот',
  'та',
  'те',
  'то',
  'так',
  'все',
  'всё',
  'весь',
  'вся',
  // Demonstratives / misc
  'очень',
  'только',
  'можно',
  'нужно',
  'надо',
  'свой',
  'свою',
  'своё',
  'свои',
  'себя',
  'себе',
]);

// ============================================================================
// FEEDBACK PROCESSOR
// ============================================================================

/**
 * Feedback Processor Service
 *
 * Analyzes classification corrections to identify patterns and generate
 * keyword suggestions for improving the classifier.
 *
 * @example
 * ```typescript
 * const processor = new FeedbackProcessor(prisma);
 * const analysis = await processor.analyzePatterns(30);
 * console.log('Accuracy:', analysis.classificationAccuracy);
 * console.log('Suggestions:', analysis.suggestedKeywords);
 * ```
 */
export class FeedbackProcessor {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Analyze correction patterns from the last N days
   *
   * Groups corrections by original->corrected class, extracts common words
   * from misclassified messages, and generates keyword suggestions.
   *
   * @param daysSince - Number of days to look back (default: 30)
   * @returns Complete feedback analysis with patterns and suggestions
   */
  async analyzePatterns(daysSince: number = 30): Promise<FeedbackAnalysis> {
    const startTime = Date.now();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSince);

    logger.info('Starting feedback analysis', {
      daysSince,
      cutoffDate: cutoffDate.toISOString(),
      service: SERVICE_NAME,
    });

    // Fetch all corrections within the time window
    const corrections = await this.prisma.classificationCorrection.findMany({
      where: {
        correctedAt: { gte: cutoffDate },
      },
      select: {
        originalClass: true,
        correctedClass: true,
        messageText: true,
      },
      orderBy: { correctedAt: 'desc' },
    });

    const totalCorrections = corrections.length;

    if (totalCorrections === 0) {
      logger.info('No corrections found in analysis window', {
        daysSince,
        service: SERVICE_NAME,
      });

      return {
        totalCorrections: 0,
        topMisclassifications: [],
        suggestedKeywords: [],
        classificationAccuracy: 1.0,
        misclassificationRates: [],
        analyzedDays: daysSince,
      };
    }

    // Group corrections by pattern (from -> to)
    const patternMap = new Map<
      string,
      {
        from: MessageCategory;
        to: MessageCategory;
        count: number;
        texts: string[];
      }
    >();

    for (const correction of corrections) {
      const key = `${correction.originalClass}->${correction.correctedClass}`;
      const existing = patternMap.get(key);

      if (existing) {
        existing.count++;
        if (existing.texts.length < MAX_EXAMPLES) {
          existing.texts.push(correction.messageText);
        }
      } else {
        patternMap.set(key, {
          from: correction.originalClass as MessageCategory,
          to: correction.correctedClass as MessageCategory,
          count: 1,
          texts: [correction.messageText],
        });
      }
    }

    // Build top misclassification patterns
    const topMisclassifications: MisclassificationPattern[] = Array.from(patternMap.values())
      .sort((a, b) => b.count - a.count)
      .map((p) => ({
        from: p.from,
        to: p.to,
        count: p.count,
        examples: p.texts.slice(0, MAX_EXAMPLES),
      }));

    // Generate keyword suggestions from significant patterns
    const suggestedKeywords = this.extractKeywordSuggestions(corrections);

    // Calculate misclassification rates per category
    const misclassificationRates = this.calculateMisclassificationRates(corrections);

    // Estimate accuracy: ratio of total requests to corrections
    // We approximate this by checking total requests in the same period
    const totalRequests = await this.prisma.clientRequest.count({
      where: {
        receivedAt: { gte: cutoffDate },
      },
    });

    const classificationAccuracy =
      totalRequests > 0
        ? Math.max(0, Math.round((1 - totalCorrections / totalRequests) * 100) / 100)
        : 1.0;

    const processingTime = Date.now() - startTime;

    logger.info('Feedback analysis completed', {
      totalCorrections,
      totalRequests,
      accuracy: classificationAccuracy,
      patternCount: topMisclassifications.length,
      suggestionCount: suggestedKeywords.length,
      processingTimeMs: processingTime,
      service: SERVICE_NAME,
    });

    return {
      totalCorrections,
      topMisclassifications,
      suggestedKeywords,
      classificationAccuracy,
      misclassificationRates,
      analyzedDays: daysSince,
    };
  }

  /**
   * Generate keyword suggestions based on correction patterns
   *
   * Convenience method that delegates to analyzePatterns.
   *
   * @returns Array of keyword suggestions sorted by confidence
   */
  async generateKeywordSuggestions(): Promise<KeywordSuggestion[]> {
    const analysis = await this.analyzePatterns();
    return analysis.suggestedKeywords;
  }

  /**
   * Get misclassification rates by category
   *
   * @param daysSince - Number of days to look back (default: 30)
   * @returns Array of misclassification rates per category
   */
  async getMisclassificationRates(daysSince: number = 30): Promise<MisclassificationRate[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSince);

    const corrections = await this.prisma.classificationCorrection.findMany({
      where: {
        correctedAt: { gte: cutoffDate },
      },
      select: {
        originalClass: true,
        correctedClass: true,
      },
    });

    return this.calculateMisclassificationRates(corrections);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Extract keyword suggestions from correction data
   *
   * For each significant pattern (>=MIN_PATTERN_THRESHOLD corrections),
   * extracts common words from the corrected messages and scores them
   * based on frequency and distinctiveness.
   *
   * @param corrections - Array of correction records
   * @returns Sorted keyword suggestions
   */
  private extractKeywordSuggestions(
    corrections: {
      originalClass: MessageClassification;
      correctedClass: MessageClassification;
      messageText: string;
    }[]
  ): KeywordSuggestion[] {
    // Group texts by corrected class (what the text SHOULD have been classified as)
    const textsByCorrectClass = new Map<MessageCategory, string[]>();

    for (const correction of corrections) {
      const category = correction.correctedClass as MessageCategory;
      const existing = textsByCorrectClass.get(category);
      if (existing) {
        existing.push(correction.messageText);
      } else {
        textsByCorrectClass.set(category, [correction.messageText]);
      }
    }

    const suggestions: KeywordSuggestion[] = [];

    // For each corrected-to category, find common distinctive words
    for (const [category, texts] of textsByCorrectClass) {
      if (texts.length < MIN_PATTERN_THRESHOLD) {
        continue;
      }

      // Count word frequency within this category's corrections
      const wordFrequency = new Map<string, number>();

      for (const text of texts) {
        const words = this.extractWords(text);
        // Use a set to count each word only once per message
        const uniqueWords = new Set(words);

        for (const word of uniqueWords) {
          wordFrequency.set(word, (wordFrequency.get(word) ?? 0) + 1);
        }
      }

      // Count word frequency across ALL categories (for distinctiveness)
      const globalWordFrequency = new Map<string, number>();
      for (const correction of corrections) {
        const words = this.extractWords(correction.messageText);
        const uniqueWords = new Set(words);
        for (const word of uniqueWords) {
          globalWordFrequency.set(word, (globalWordFrequency.get(word) ?? 0) + 1);
        }
      }

      // Score each word: high frequency in target category + low frequency elsewhere
      for (const [word, categoryCount] of wordFrequency) {
        if (categoryCount < 2) {
          continue; // Word appears in fewer than 2 messages - not a pattern
        }

        const globalCount = globalWordFrequency.get(word) ?? categoryCount;
        const categoryRatio = categoryCount / texts.length; // How common in this category
        const specificityRatio = categoryCount / globalCount; // How specific to this category

        // Confidence = weighted average of frequency and specificity
        const confidence =
          Math.round((categoryRatio * 0.4 + specificityRatio * 0.6) * 100) / 100;

        if (confidence >= 0.3) {
          suggestions.push({
            category,
            keyword: word,
            confidence,
            occurrences: categoryCount,
          });
        }
      }
    }

    // Sort by confidence descending, limit results
    return suggestions
      .sort((a, b) => b.confidence - a.confidence || b.occurrences - a.occurrences)
      .slice(0, MAX_KEYWORD_SUGGESTIONS);
  }

  /**
   * Extract meaningful words from a text
   *
   * Normalizes text, removes stop words, and filters by length.
   *
   * @param text - Raw message text
   * @returns Array of meaningful lowercase words
   */
  private extractWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Keep only letters, numbers, whitespace
      .split(/\s+/)
      .filter(
        (word) =>
          word.length >= MIN_WORD_LENGTH &&
          word.length <= MAX_WORD_LENGTH &&
          !RUSSIAN_STOP_WORDS.has(word)
      );
  }

  /**
   * Calculate misclassification rates per category
   *
   * @param corrections - Array of correction records
   * @returns Misclassification rates sorted by rate descending
   */
  private calculateMisclassificationRates(
    corrections: {
      originalClass: MessageClassification;
      correctedClass: MessageClassification;
    }[]
  ): MisclassificationRate[] {
    if (corrections.length === 0) {
      return [];
    }

    // Count corrections per original class
    const byOriginal = new Map<
      MessageCategory,
      { total: number; correctedTo: Map<MessageCategory, number> }
    >();

    for (const correction of corrections) {
      const from = correction.originalClass as MessageCategory;
      const to = correction.correctedClass as MessageCategory;

      const existing = byOriginal.get(from);
      if (existing) {
        existing.total++;
        existing.correctedTo.set(to, (existing.correctedTo.get(to) ?? 0) + 1);
      } else {
        const correctedTo = new Map<MessageCategory, number>();
        correctedTo.set(to, 1);
        byOriginal.set(from, { total: 1, correctedTo });
      }
    }

    const totalCorrections = corrections.length;

    const rates: MisclassificationRate[] = [];

    for (const [category, data] of byOriginal) {
      // Find the most common correction target
      let mostCommonCorrection: MessageCategory | null = null;
      let maxCount = 0;

      for (const [target, count] of data.correctedTo) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonCorrection = target;
        }
      }

      rates.push({
        category,
        totalMisclassified: data.total,
        mostCommonCorrection,
        rate: Math.round((data.total / totalCorrections) * 100) / 100,
      });
    }

    return rates.sort((a, b) => b.rate - a.rate);
  }
}
