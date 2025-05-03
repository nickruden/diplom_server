import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { CategoriesModule } from './categories/categories.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { TicketsModule } from './tickets/tickets.module';
import { coolUserModule } from './coolUser/user.module';

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true}), CategoriesModule, EventsModule, coolUserModule, AuthModule, TicketsModule],
  providers: [PrismaService],
})

export class AppModule {};

