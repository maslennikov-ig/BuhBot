/**
 * Templates Router - Message Templates Management
 *
 * Procedures:
 * - list: List all templates with optional category filter
 * - create: Create new template
 * - update: Update existing template
 * - delete: Delete template
 *
 * @module api/trpc/routers/templates
 */

import { router, authedProcedure, managerProcedure, adminProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

/**
 * Template category schema (matches Prisma TemplateCategory enum)
 */
const TemplateCategorySchema = z.enum([
  'greeting',
  'status',
  'document_request',
  'reminder',
  'closing',
]);

/**
 * Templates router for message template management
 */
export const templatesRouter = router({
  /**
   * List all templates with optional category filter
   *
   * @param category - Optional filter by category
   * @param sortBy - Sort by usage_count (most used first) or created_at (newest first)
   * @returns Array of templates
   * @authorization All authenticated users (read-only)
   */
  list: authedProcedure
    .input(
      z.object({
        category: TemplateCategorySchema.optional(),
        sortBy: z.enum(['usage_count', 'created_at']).default('usage_count'),
      })
    )
    .output(
      z.array(
        z.object({
          id: z.string().uuid(),
          title: z.string(),
          content: z.string(),
          category: TemplateCategorySchema,
          createdBy: z.string().uuid(),
          usageCount: z.number().int(),
          createdAt: z.date(),
          updatedAt: z.date(),
        })
      )
    )
    .query(async ({ ctx, input }) => {
      // Build where clause (empty object means no filter)
      const where = input.category ? { category: input.category } : {};

      // Build order by clause
      const orderBy =
        input.sortBy === 'usage_count'
          ? { usageCount: 'desc' as const }
          : { createdAt: 'desc' as const };

      // Fetch templates
      const templates = await ctx.prisma.template.findMany({
        where,
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          createdBy: true,
          usageCount: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy,
      });

      return templates;
    }),

  /**
   * Create new template
   *
   * @param title - Template title (1-100 characters)
   * @param content - Template content (1-2000 characters, supports {{variable}} syntax)
   * @param category - Template category
   * @returns Created template details
   * @authorization Admins and managers only
   */
  create: managerProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        content: z.string().min(1).max(2000),
        category: TemplateCategorySchema,
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        template: z.object({
          id: z.string().uuid(),
          title: z.string(),
          content: z.string(),
          category: TemplateCategorySchema,
          createdBy: z.string().uuid(),
          createdAt: z.date(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create template with current user as creator
      const template = await ctx.prisma.template.create({
        data: {
          title: input.title,
          content: input.content,
          category: input.category,
          createdBy: ctx.user.id,
        },
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          createdBy: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        template,
      };
    }),

  /**
   * Update existing template
   *
   * @param id - Template UUID
   * @param title - Optional new title
   * @param content - Optional new content
   * @param category - Optional new category
   * @returns Updated template details
   * @throws NOT_FOUND if template doesn't exist
   * @authorization Admins/managers (all), users (own templates only)
   */
  update: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(100).optional(),
        content: z.string().min(1).max(2000).optional(),
        category: TemplateCategorySchema.optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        template: z.object({
          id: z.string().uuid(),
          title: z.string(),
          content: z.string(),
          category: TemplateCategorySchema,
          updatedAt: z.date(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify template exists
      const existingTemplate = await ctx.prisma.template.findUnique({
        where: { id: input.id },
      });

      if (!existingTemplate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Template with ID ${input.id} not found`,
        });
      }

      // Build update data from optional fields
      const data: any = {};
      if (input.title !== undefined) {
        data.title = input.title;
      }
      if (input.content !== undefined) {
        data.content = input.content;
      }
      if (input.category !== undefined) {
        data.category = input.category;
      }

      // Update template
      const updatedTemplate = await ctx.prisma.template.update({
        where: { id: input.id },
        data,
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          updatedAt: true,
        },
      });

      return {
        success: true,
        template: updatedTemplate,
      };
    }),

  /**
   * Delete template
   *
   * @param id - Template UUID
   * @returns Success indicator
   * @throws NOT_FOUND if template doesn't exist
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
      // Verify template exists before deleting
      const existingTemplate = await ctx.prisma.template.findUnique({
        where: { id: input.id },
      });

      if (!existingTemplate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Template with ID ${input.id} not found`,
        });
      }

      // Delete template
      await ctx.prisma.template.delete({
        where: { id: input.id },
      });

      return {
        success: true,
      };
    }),
});
