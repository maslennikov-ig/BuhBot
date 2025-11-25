/**
 * FAQ Router - FAQ Items Management
 *
 * Procedures:
 * - list: List all FAQ items
 * - search: Search FAQ by keywords
 * - create: Create new FAQ item
 * - update: Update existing FAQ item
 * - delete: Delete FAQ item
 *
 * @module api/trpc/routers/faq
 */

import { router, authedProcedure, managerProcedure, adminProcedure } from '../trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

/**
 * FAQ router for FAQ management
 */
export const faqRouter = router({
  /**
   * List all FAQ items
   *
   * @param sortBy - Sort by usage_count (most used first) or created_at (newest first)
   * @returns Array of FAQ items
   * @authorization All authenticated users (read-only)
   */
  list: authedProcedure
    .input(
      z.object({
        sortBy: z.enum(['usage_count', 'created_at']).default('usage_count'),
      })
    )
    .output(
      z.array(
        z.object({
          id: z.string().uuid(),
          question: z.string(),
          answer: z.string(),
          keywords: z.array(z.string()),
          usageCount: z.number().int(),
          createdBy: z.string().uuid(),
          createdAt: z.date(),
          updatedAt: z.date(),
        })
      )
    )
    .query(async ({ ctx, input }) => {
      // Build order by clause
      const orderBy =
        input.sortBy === 'usage_count'
          ? { usageCount: 'desc' as const }
          : { createdAt: 'desc' as const };

      // Fetch FAQ items
      const faqItems = await ctx.prisma.faqItem.findMany({
        select: {
          id: true,
          question: true,
          answer: true,
          keywords: true,
          usageCount: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy,
      });

      return faqItems;
    }),

  /**
   * Search FAQ by keywords
   *
   * Uses keyword array for fast matching. Returns FAQ items with
   * relevance score based on keyword matches.
   *
   * @param query - Search query string
   * @param limit - Maximum results (default: 5, max: 10)
   * @returns Array of matching FAQ items with relevance scores
   * @authorization All authenticated users (used by bot application)
   */
  search: authedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(10).default(5),
      })
    )
    .output(
      z.array(
        z.object({
          id: z.string().uuid(),
          question: z.string(),
          answer: z.string(),
          relevanceScore: z.number(),
        })
      )
    )
    .query(async ({ ctx, input }) => {
      // Normalize query to lowercase
      const queryLower = input.query.toLowerCase();

      // Fetch all FAQ items
      const allFaqItems = await ctx.prisma.faqItem.findMany({
        select: {
          id: true,
          question: true,
          answer: true,
          keywords: true,
        },
      });

      // Score FAQ items based on keyword matches
      const scoredItems = allFaqItems
        .map((item: any) => {
          let score = 0;

          // Check keyword matches
          item.keywords.forEach((keyword: string) => {
            if (queryLower.includes(keyword.toLowerCase())) {
              score += 10; // Keyword match = 10 points
            }
          });

          // Check question matches
          if (item.question.toLowerCase().includes(queryLower)) {
            score += 5; // Question match = 5 points
          }

          // Check answer matches
          if (item.answer.toLowerCase().includes(queryLower)) {
            score += 2; // Answer match = 2 points
          }

          return {
            id: item.id,
            question: item.question,
            answer: item.answer,
            relevanceScore: score,
          };
        })
        .filter((item: any) => item.relevanceScore > 0) // Only return items with matches
        .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore) // Sort by score desc
        .slice(0, input.limit); // Limit results

      return scoredItems;
    }),

  /**
   * Create new FAQ item
   *
   * @param question - FAQ question (1-200 characters)
   * @param answer - FAQ answer (1-2000 characters)
   * @param keywords - Keywords for search (1-20 keywords)
   * @returns Created FAQ item details
   * @authorization Admins and managers only
   */
  create: managerProcedure
    .input(
      z.object({
        question: z.string().min(1).max(200),
        answer: z.string().min(1).max(2000),
        keywords: z.array(z.string()).min(1).max(20),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        faq: z.object({
          id: z.string().uuid(),
          question: z.string(),
          answer: z.string(),
          keywords: z.array(z.string()),
          createdBy: z.string().uuid(),
          createdAt: z.date(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create FAQ item with current user as creator
      const faqItem = await ctx.prisma.faqItem.create({
        data: {
          question: input.question,
          answer: input.answer,
          keywords: input.keywords,
          createdBy: ctx.user.id,
        },
        select: {
          id: true,
          question: true,
          answer: true,
          keywords: true,
          createdBy: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        faq: faqItem,
      };
    }),

  /**
   * Update existing FAQ item
   *
   * @param id - FAQ item UUID
   * @param question - Optional new question
   * @param answer - Optional new answer
   * @param keywords - Optional new keywords array
   * @returns Updated FAQ item details
   * @throws NOT_FOUND if FAQ item doesn't exist
   * @authorization Admins/managers (all), users (own FAQs only)
   */
  update: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        question: z.string().min(1).max(200).optional(),
        answer: z.string().min(1).max(2000).optional(),
        keywords: z.array(z.string()).min(1).max(20).optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        faq: z.object({
          id: z.string().uuid(),
          question: z.string(),
          answer: z.string(),
          keywords: z.array(z.string()),
          updatedAt: z.date(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify FAQ item exists
      const existingFaq = await ctx.prisma.faqItem.findUnique({
        where: { id: input.id },
      });

      if (!existingFaq) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `FAQ item with ID ${input.id} not found`,
        });
      }

      // Build update data from optional fields
      const data: any = {};
      if (input.question !== undefined) {
        data.question = input.question;
      }
      if (input.answer !== undefined) {
        data.answer = input.answer;
      }
      if (input.keywords !== undefined) {
        data.keywords = input.keywords;
      }

      // Update FAQ item
      const updatedFaq = await ctx.prisma.faqItem.update({
        where: { id: input.id },
        data,
        select: {
          id: true,
          question: true,
          answer: true,
          keywords: true,
          updatedAt: true,
        },
      });

      return {
        success: true,
        faq: updatedFaq,
      };
    }),

  /**
   * Delete FAQ item
   *
   * @param id - FAQ item UUID
   * @returns Success indicator
   * @throws NOT_FOUND if FAQ item doesn't exist
   * @authorization Admins only
   */
  delete: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify FAQ item exists before deleting
      const existingFaq = await ctx.prisma.faqItem.findUnique({
        where: { id: input.id },
      });

      if (!existingFaq) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `FAQ item with ID ${input.id} not found`,
        });
      }

      // Delete FAQ item
      await ctx.prisma.faqItem.delete({
        where: { id: input.id },
      });

      return {
        success: true,
      };
    }),
});
