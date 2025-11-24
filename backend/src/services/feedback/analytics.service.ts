/**
 * Feedback Analytics Service
 *
 * Provides analytics calculations for client feedback:
 * - NPS (Net Promoter Score) calculation
 * - Rating distribution
 * - Trend analysis
 *
 * NPS Formula: % Promoters (4-5) - % Detractors (1-3)
 *
 * @module services/feedback/analytics
 */

import { prisma } from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RatingDistribution {
  rating: number;
  count: number;
  percentage: number;
}

export interface NPSResult {
  score: number; // -100 to +100
  promoters: number; // count of 4-5 ratings
  detractors: number; // count of 1-3 ratings
  total: number;
  promoterPercentage: number;
  detractorPercentage: number;
}

export interface FeedbackAggregates {
  totalResponses: number;
  averageRating: number;
  nps: NPSResult;
  distribution: RatingDistribution[];
}

export interface TrendDataPoint {
  period: string; // "2025-Q1"
  averageRating: number;
  responseCount: number;
  npsScore: number;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

// ============================================================================
// ANALYTICS FUNCTIONS
// ============================================================================

/**
 * Calculate NPS from rating distribution
 *
 * NPS = (% Promoters) - (% Detractors)
 * - Promoters: ratings 4-5
 * - Detractors: ratings 1-3
 *
 * @param ratings - Array of rating values (1-5)
 * @returns NPS result object
 */
export function calculateNPS(ratings: number[]): NPSResult {
  if (ratings.length === 0) {
    return {
      score: 0,
      promoters: 0,
      detractors: 0,
      total: 0,
      promoterPercentage: 0,
      detractorPercentage: 0,
    };
  }

  const promoters = ratings.filter((r) => r >= 4).length;
  const detractors = ratings.filter((r) => r <= 3).length;
  const total = ratings.length;

  const promoterPercentage = (promoters / total) * 100;
  const detractorPercentage = (detractors / total) * 100;
  const score = Math.round(promoterPercentage - detractorPercentage);

  return {
    score,
    promoters,
    detractors,
    total,
    promoterPercentage: Math.round(promoterPercentage * 10) / 10,
    detractorPercentage: Math.round(detractorPercentage * 10) / 10,
  };
}

/**
 * Calculate rating distribution from ratings array
 *
 * @param ratings - Array of rating values (1-5)
 * @returns Distribution for each rating level
 */
export function calculateDistribution(ratings: number[]): RatingDistribution[] {
  const counts = new Map<number, number>();

  // Initialize all ratings to 0
  for (let i = 1; i <= 5; i++) {
    counts.set(i, 0);
  }

  // Count occurrences
  for (const rating of ratings) {
    counts.set(rating, (counts.get(rating) || 0) + 1);
  }

  const total = ratings.length || 1; // Avoid division by zero

  return Array.from(counts.entries()).map(([rating, count]) => ({
    rating,
    count,
    percentage: Math.round((count / total) * 100 * 10) / 10,
  }));
}

/**
 * Get aggregate feedback statistics
 *
 * @param dateRange - Optional date filter
 * @param surveyId - Optional survey filter
 * @returns Aggregate statistics
 */
export async function getAggregates(
  dateRange?: DateRange,
  surveyId?: string
): Promise<FeedbackAggregates> {
  // Build where clause with proper typing
  const submittedAtFilter: { gte?: Date; lte?: Date } | undefined =
    dateRange?.from || dateRange?.to
      ? {
          ...(dateRange.from && { gte: dateRange.from }),
          ...(dateRange.to && { lte: dateRange.to }),
        }
      : undefined;

  const responses = await prisma.feedbackResponse.findMany({
    where: {
      ...(submittedAtFilter && { submittedAt: submittedAtFilter }),
      ...(surveyId && { surveyId }),
    },
    select: {
      rating: true,
    },
  });

  const ratings = responses.map((r) => r.rating);
  const totalResponses = ratings.length;

  const averageRating =
    totalResponses > 0
      ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / totalResponses) * 10) / 10
      : 0;

  const nps = calculateNPS(ratings);
  const distribution = calculateDistribution(ratings);

  logger.debug('Feedback aggregates calculated', {
    totalResponses,
    averageRating,
    npsScore: nps.score,
    dateRange,
    surveyId,
    service: 'analytics-service',
  });

  return {
    totalResponses,
    averageRating,
    nps,
    distribution,
  };
}

/**
 * Get trend data grouped by quarter
 *
 * @param quarters - Number of quarters to include (default: 4)
 * @returns Array of trend data points
 */
export async function getTrendData(quarters: number = 4): Promise<TrendDataPoint[]> {
  // Get date range for the specified number of quarters
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const currentYear = now.getFullYear();

  const results: TrendDataPoint[] = [];

  for (let i = 0; i < quarters; i++) {
    let quarter = currentQuarter - i;
    let year = currentYear;

    while (quarter <= 0) {
      quarter += 4;
      year -= 1;
    }

    const periodLabel = `${year}-Q${quarter}`;

    // Calculate date range for this quarter
    const quarterStart = new Date(year, (quarter - 1) * 3, 1);
    const quarterEnd = new Date(year, quarter * 3, 0, 23, 59, 59);

    const responses = await prisma.feedbackResponse.findMany({
      where: {
        submittedAt: {
          gte: quarterStart,
          lte: quarterEnd,
        },
      },
      select: {
        rating: true,
      },
    });

    const ratings = responses.map((r) => r.rating);
    const responseCount = ratings.length;

    const averageRating =
      responseCount > 0
        ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / responseCount) * 10) / 10
        : 0;

    const nps = calculateNPS(ratings);

    results.push({
      period: periodLabel,
      averageRating,
      responseCount,
      npsScore: nps.score,
    });
  }

  // Sort by period (oldest first)
  results.sort((a, b) => a.period.localeCompare(b.period));

  logger.debug('Trend data calculated', {
    quarters,
    dataPoints: results.length,
    service: 'analytics-service',
  });

  return results;
}

/**
 * Get recent comments (anonymized for accountant view)
 *
 * @param limit - Maximum number of comments to return
 * @param includeClientInfo - Whether to include client identifying info (manager only)
 * @returns Array of comment objects
 */
export async function getRecentComments(
  limit: number = 10,
  includeClientInfo: boolean = false
): Promise<
  Array<{
    comment: string;
    rating: number;
    submittedAt: Date;
    chatId?: string;
    clientUsername?: string | null;
  }>
> {
  const responses = await prisma.feedbackResponse.findMany({
    where: {
      comment: {
        not: null,
      },
    },
    select: {
      comment: true,
      rating: true,
      submittedAt: true,
      chatId: includeClientInfo,
      clientUsername: includeClientInfo,
    },
    orderBy: {
      submittedAt: 'desc',
    },
    take: limit,
  });

  return responses.map((r) => ({
    comment: r.comment!,
    rating: r.rating,
    submittedAt: r.submittedAt,
    ...(includeClientInfo && { chatId: r.chatId?.toString(), clientUsername: r.clientUsername }),
  }));
}

/**
 * Get feedback summary for a specific survey
 *
 * @param surveyId - Survey ID to get summary for
 * @returns Survey feedback summary
 */
export async function getSurveySummary(surveyId: string): Promise<{
  survey: { id: string; quarter: string; status: string } | null;
  aggregates: FeedbackAggregates;
  lowRatingCount: number;
}> {
  const survey = await prisma.feedbackSurvey.findUnique({
    where: { id: surveyId },
    select: {
      id: true,
      quarter: true,
      status: true,
    },
  });

  if (!survey) {
    return {
      survey: null,
      aggregates: {
        totalResponses: 0,
        averageRating: 0,
        nps: calculateNPS([]),
        distribution: calculateDistribution([]),
      },
      lowRatingCount: 0,
    };
  }

  const aggregates = await getAggregates(undefined, surveyId);

  // Count low ratings (1-3) for manager attention
  const lowRatingCount = await prisma.feedbackResponse.count({
    where: {
      surveyId,
      rating: { lte: 3 },
    },
  });

  logger.info('Survey summary retrieved', {
    surveyId,
    quarter: survey.quarter,
    totalResponses: aggregates.totalResponses,
    lowRatingCount,
    service: 'analytics-service',
  });

  return {
    survey,
    aggregates,
    lowRatingCount,
  };
}

export default {
  calculateNPS,
  calculateDistribution,
  getAggregates,
  getTrendData,
  getRecentComments,
  getSurveySummary,
};
