import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from 'src/prisma.service';
import { JwtAuthGuard } from 'src/config/jwt-auth.guard';
import { CurrentUser } from 'src/coolUser/decorator/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService, private readonly prisma: PrismaService) { }

@Get(':userId')
getUserNotifications(@Param('userId') userId: string) {
  return this.prisma.userNotification.findMany({
    where: { userId: +userId },
    orderBy: { createdAt: 'desc' },
    include: {
      event: {
        select: { id: true, name: true }, // или любые другие нужные поля
      },
    },
  });
}

  @UseGuards(JwtAuthGuard)
  @Post(':id/read')
  @HttpCode(200)
  markAsRead(@Param('id') id: number, @CurrentUser() user: any) {
    return this.prisma.userNotification.updateMany({
      where: { userId: user.id, isRead: 0 },
      data: { isRead: 1 },
    });
  }

}
