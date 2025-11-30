import { PrismaClient, Notification } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  link?: string;
};

export class AppNotificationService {
  constructor(private readonly db: PrismaClient = prisma) {}

  /**
   * Create a new in-app notification
   */
  async create(input: CreateNotificationInput): Promise<Notification> {
    return this.db.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type || 'info',
        link: input.link ?? null,
      },
    });
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId: string, limit = 20, offset = 0): Promise<Notification[]> {
    return this.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.db.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string, userId: string): Promise<Notification> {
    // Verify ownership
    const notification = await this.db.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return this.db.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Delete a notification
   */
  async delete(id: string, userId: string): Promise<void> {
     const notification = await this.db.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await this.db.notification.delete({
      where: { id },
    });
  }
}

export const appNotificationService = new AppNotificationService();
