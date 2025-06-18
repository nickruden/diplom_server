import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createNotificationForUser(userId: number, title: string, message: string, type: string, eventId?: number,) {
    return this.prisma.userNotification.create({
      data: {
        userId,
        title,
        message,
        type,
        eventId,
        isRead: 0,
      },
    });
  }

  async notifyUsersForEventChange(eventId: number, changeType: 'update' | 'refund' | 'cancel' | 'public') {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      include: {
        favoriteEvents: { include: { user: true } },
        tickets: {
          include: {
            purchases: { include: { user: true } },
          },
        },
      },
    });

    const users = new Set<number>();

    if (!event) return "Нет мероприятия для уведомления";

    // Пользователи, купившие билеты
    for (const ticket of event.tickets) {
      for (const purchase of ticket.purchases) {
        users.add(purchase.user.id);
      }
    }

    // Пользователи, добавившие в избранное
    for (const fav of event.favoriteEvents) {
      users.add(fav.user.id);
    }

    const title = `Изменение мероприятия: ${event.name}`;
    const message =
      changeType === 'update'
        ? 'Произошли изменения в мероприятии, следите за обновлениями.'
        : changeType === 'refund'
        ? 'Мероприятие снято с публикации, возможен возврат средств, если оно не опубликуется снова.'
        : changeType === 'public' ? 'Мероприятие снова опубликовано. Посмотрите что изменилось.'
        : 'Мероприятие отменено.';

for (const id of users) {
  await this.createNotificationForUser(id, title, message, 'event', eventId);
}
  }

  async notifyFollowersOnNewEvent(organizerId: number, eventName: string, eventId: number) {
  const followers = await this.prisma.userFollower.findMany({
    where: { userId: organizerId },
    include: { user: true, follower: true },
  });

  const title = 'Новая публикация от организатора';
  const message = `Организатор, на которого вы подписаны, добавил новое мероприятие: ${eventName}`;

  for (const follow of followers) {
    await this.createNotificationForUser(follow.follower.id, title, message, 'event', eventId);
  }
}
}
