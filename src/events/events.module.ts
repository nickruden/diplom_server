import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PrismaService } from 'src/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService, PrismaService, NotificationsService],
})
export class EventsModule {}
