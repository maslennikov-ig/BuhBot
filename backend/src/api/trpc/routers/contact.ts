import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import { ContactNotificationService } from '../../../services/notification/contact.js';
import { bot } from '../../../bot/bot.js';

// Initialize notification service
const notificationService = new ContactNotificationService(bot);

export const contactRouter = router({
  submit: publicProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string().email(),
        company: z.string().optional(),
        message: z.string().optional(),
        consent: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Save to database using raw SQL (workaround for Prisma 7 UUID bug)
      const result = await ctx.prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO contact_requests (id, name, email, company, message, created_at, is_processed)
        VALUES (gen_random_uuid(), ${input.name}, ${input.email}, ${input.company ?? null}, ${input.message ?? null}, NOW(), false)
        RETURNING id
      `;

      const contactId = result[0]?.id;
      if (!contactId) {
        throw new Error('Failed to create contact request');
      }

      // 2. Send notification to Telegram
      await notificationService.notifyNewLead({
        name: input.name,
        email: input.email,
        company: input.company ?? null,
        message: input.message ?? null,
      });

      return { success: true, id: contactId };
    }),
});
