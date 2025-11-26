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
      // 1. Save to database using Prisma ORM
      const contact = await ctx.prisma.contactRequest.create({
        data: {
          name: input.name,
          email: input.email,
          company: input.company ?? null,
          message: input.message ?? null,
        },
        select: { id: true },
      });

      // 2. Send notification to Telegram
      await notificationService.notifyNewLead({
        name: input.name,
        email: input.email,
        company: input.company ?? null,
        message: input.message ?? null,
      });

      return { success: true, id: contact.id };
    }),
});
