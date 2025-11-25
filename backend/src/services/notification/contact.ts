import { Telegraf } from 'telegraf';
import { prisma } from '../../lib/prisma.js';

interface ContactNotificationPayload {
  name: string;
  email: string;
  company?: string | null;
  message?: string | null;
}

export class ContactNotificationService {
  constructor(private bot: Telegraf) {}

  async notifyNewLead(lead: ContactNotificationPayload) {
    // 1. Get IDs from database
    const settings = await prisma.globalSettings.findUnique({
      where: { id: 'default' },
      select: { leadNotificationIds: true },
    });

    // 2. Combine DB IDs with env var fallback
    const dbIds = settings?.leadNotificationIds || [];
    const envId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    
    // Create unique set of IDs
    const chatIds = new Set<string>(dbIds);
    if (envId) chatIds.add(envId);
    
    if (chatIds.size === 0) {
      console.warn('No notification chat IDs configured (DB or ENV), skipping lead notification');
      return;
    }

    const text = `
🚀 <b>Новая заявка с лендинга!</b>

👤 <b>Имя:</b> ${this.escapeHtml(lead.name)}
📧 <b>Email:</b> ${this.escapeHtml(lead.email)}
🏢 <b>Компания:</b> ${this.escapeHtml(lead.company || 'Не указана')}

💬 <b>Сообщение:</b>
${this.escapeHtml(lead.message || 'Нет сообщения')}
    `;

    // 3. Send to all IDs
    const promises = Array.from(chatIds).map(chatId => 
      this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' })
        .catch(error => console.error(`Failed to send lead notification to ${chatId}:`, error))
    );

    await Promise.all(promises);
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
