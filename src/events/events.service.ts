import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { NotificationsService } from 'src/notifications/notifications.service';
import dayjs from "dayjs";
import * as cron from 'node-cron';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService, private notificationService: NotificationsService) { }

  private async updateSoldOutEventsStatus() {
    const events = await this.prisma.events.findMany({
      where: {
        status: {
          in: ['Опубликовано', 'Sold Out', 'Черновик'],
        }
      },
      include: {
        tickets: {
          select: {
            isSoldOut: true,
          }
        }
      }
    });

    for (const event of events) {
      const allTicketsSoldOut = event.tickets.length > 0 && event.tickets.every(ticket => ticket.isSoldOut);
      const hasAvailableTickets = event.tickets.some(ticket => !ticket.isSoldOut);

      if (allTicketsSoldOut && event.status !== 'Sold Out') {
        await this.prisma.events.update({
          where: { id: event.id },
          data: { status: 'Sold Out' },
        });
      } else if (hasAvailableTickets && event.status === 'Sold Out') {
        await this.prisma.events.update({
          where: { id: event.id },
          data: { status: 'Черновик' },
        });
      }
    }
  }

  private async updatePastEventsStatus() {
    const offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
    const now = new Date(Date.now() - offsetMs);

    const events = await this.prisma.events.findMany({
      where: {
        endTime: { lt: now },
        status: { in: ['Опубликовано', 'Sold Out'] },
      },
      include: {
        tickets: {
          select: {
            purchases: true,
          }
        }
      }
    });

    for (const event of events) {
      const wasSold = event.tickets.some(t => t.purchases.length > 0);

      await this.prisma.events.update({
        where: { id: event.id },
        data: {
          status: wasSold ? 'Завершено' : 'Черновик',
        },
      });
    }
  }

  onModuleInit() {
    cron.schedule('*/1 * * * *', async () => {
      try {
        await this.updatePastEventsStatus();
      } catch (error) {
        console.error('[CRON] Ошибка при обновлении событий:', error);
      }
    });
  }

  async getAllEvents(filters: {
    type?: string;
    city?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  } = {}) {
    await this.updateSoldOutEventsStatus();

    const offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
    const now = new Date(Date.now() - offsetMs);

    const where: any = {
      endTime: { gte: now },
      status: "Опубликовано",
      tickets: {
        some: {
          isSoldOut: false,
          salesEnd: {
            gt: now,
          },
        },
      },
    };

    if (filters.type === 'online') {
      where.location = 'Онлайн';
    }

    if (filters.type === 'free') {
      where.AND = [
        ...(where.AND || []),
        { tickets: { some: {} } },
        { tickets: { every: { price: 0 } } },
      ];
    }

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);

      end.setHours(26, 59, 59, 999);
      console.log(start, end)

      where.tickets = {
        some: {
          validFrom: { lte: end },
          validTo: { gte: start },
          salesEnd: { gt: now }
        },
      }
    }

    if (filters.type !== 'online' && filters.city) {
      where.location = {
        contains: filters.city,
        mode: 'insensitive',
      };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const events = await this.prisma.events.findMany({
      where,
      include: {
        images: { select: { imageUrl: true, isMain: true } },
        organizer: { select: { organizerName: true, avatar: true, id: true } },
        tickets: true,
      },
    });

    return events
      .map(event => {
        const validTickets = event.tickets.filter(ticket => {
          const isSalesActive = ticket.salesEnd && new Date(ticket.salesEnd) > now;
          const isValidDate =
            ticket.validFrom instanceof Date &&
            ticket.validTo instanceof Date &&
            ticket.validTo > now;

          return !ticket.isSoldOut && isSalesActive && isValidDate;
        });

        if (validTickets.length === 0) return [];

        const isOneDay = event.startTime.toDateString() === event.endTime.toDateString();
        let activeDate: Date | null = null;

        if (isOneDay) {
          activeDate = event.startTime;
        } else {
          const futureOrTodayValidDates = validTickets
            .filter(t => {
              return (
                t.validFrom instanceof Date &&
                t.salesEnd && new Date(t.salesEnd) > now
              );
            })
            .map(t => t.validFrom)
            .filter((d): d is Date => d instanceof Date && d >= new Date(now.toDateString()))
            .sort((a, b) => a.getTime() - b.getTime());

          activeDate =
            futureOrTodayValidDates[0] ||
            validTickets
              .map(t => t.validFrom)
              .filter((d): d is Date => d instanceof Date)
              .sort((a, b) => b.getTime() - a.getTime())[0] || null;
        }

        return { ...event, activeDate };
      })
      .filter((event): event is typeof events[number] & { activeDate: Date } => Boolean(event)).sort((a, b) => a.activeDate.getTime() - b.activeDate.getTime());
  }

  async getEventById(eventId: number) {
    const offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
    const now = new Date(Date.now() - offsetMs);

    const event = await this.prisma.events.findUnique({
      where: {
        id: eventId,
      },
      include: {
        category: {
          select: {
            name: true,
            slug: true,
          }
        },
        images: {
          select: {
            imageUrl: true,
            isMain: true,
            publicId: true,
          }
        },
        organizer: {
          select: {
            organizerName: true,
            avatar: true,
            id: true,
          }
        },
        tickets: {
          select: {
            id: true,
            price: true,
            count: true,
            isSoldOut: true,
            validFrom: true,  // Added this as it's needed for activeDate calculation
            validTo: true,
            salesEnd: true,   // Added this as it's needed for activeDate calculation
          }
        }
      }
    });

    if (!event) return null;

    // Calculate activeDate similar to getAllEvents
    const validTickets = event.tickets.filter(ticket => {
      const isSalesActive = ticket.salesEnd && new Date(ticket.salesEnd) > now;
      const isValidDate =
        ticket.validFrom instanceof Date &&
        ticket.validTo instanceof Date &&
        ticket.validTo > now;

      return !ticket.isSoldOut && isSalesActive && isValidDate;
    });

    let activeDate: Date | null = null;
    if (validTickets.length > 0) {
      const isOneDay = event.startTime.toDateString() === event.endTime.toDateString();

      if (isOneDay) {
        activeDate = event.startTime;
      } else {
        const futureValidDates = validTickets
          .map(t => t.validFrom)
          .filter((d): d is Date => d instanceof Date && d > now)
          .sort((a, b) => a.getTime() - b.getTime());

        activeDate =
          futureValidDates[0] ||
          validTickets
            .map(t => t.validFrom)
            .filter((d): d is Date => d instanceof Date)
            .sort((a, b) => b.getTime() - a.getTime())[0] || null;
      }
    }

    // Получаем количество проданных билетов для каждого типа билета
    const ticketsWithSales = await Promise.all(
      event.tickets.map(async (ticket) => {
        const soldCount = await this.prisma.ticketPurchase.count({
          where: {
            ticketId: ticket.id,
          },
        });
        return {
          ...ticket,
          soldCount,
          availableCount: ticket.count - soldCount,
        };
      })
    );

    const followersCount = await this.prisma.userFollower.count({
      where: {
        userId: event.organizer.id,
      },
    });

    const totalTickets = await this.prisma.ticket.aggregate({
      where: {
        eventId: eventId,
      },
      _sum: {
        count: true,
      },
    });

    // Общее количество проданных билетов для всего события
    const totalSoldTickets = await this.prisma.ticketPurchase.count({
      where: {
        ticket: {
          eventId: eventId,
        },
      },
    });

    return {
      ...event,
      activeDate,  // Added activeDate to the response
      totalTicketsCount: totalTickets._sum.count || 0,
      totalSoldTickets,
      availableTicketsCount: (totalTickets._sum.count || 0) - totalSoldTickets,
      tickets: ticketsWithSales,
      organizer: {
        ...event.organizer,
        followersCount,
      },
    };
  }

  async getEventsByCreator(creatorId: number, filter?: 'upcoming' | 'past') {
    await this.updatePastEventsStatus();
    await this.updateSoldOutEventsStatus();

    const offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
    const now = new Date(Date.now() - offsetMs);

    const whereParams: any = {
      organizerId: creatorId,
    };

    if (filter === 'upcoming') {
      whereParams.endTime = { gte: now };
    } else if (filter === 'past') {
      whereParams.endTime = { lt: now };
    }

    const events = await this.prisma.events.findMany({
      where: whereParams,
      include: {
        images: {
          where: {
            isMain: 1,
          },
        },
        organizer: {
          select: {
            organizerName: true,
            avatar: true,
          }
        },
        tickets: {
          include: {
            purchases: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    const eventsWithSalesAndActiveDate = events.map(event => {
      let soldTicketsCount = 0;
      let totalTicketsCount = 0;
      let profit = 0;

      const validTickets = event.tickets.filter(ticket =>
        !ticket.isSoldOut &&
        ticket.salesEnd &&
        new Date(ticket.salesEnd) > now &&
        ticket.validFrom instanceof Date &&
        ticket.validTo instanceof Date
      );

      const isOneDay = event.startTime.toDateString() === event.endTime.toDateString();

      let activeDate: Date | null = null;

      if (isOneDay) {
        activeDate = event.startTime;
      } else {
        const futureDates = validTickets
          .map(t => t.validFrom)
          .filter((d): d is Date => d instanceof Date && d > now)
          .sort((a, b) => a.getTime() - b.getTime());

        if (futureDates.length > 0) {
          activeDate = futureDates[0];
        } else {
          const latestValid = validTickets
            .map(t => t.validFrom)
            .filter((d): d is Date => d instanceof Date)
            .sort((a, b) => b.getTime() - a.getTime())[0];

          activeDate = latestValid || null;
        }
      }

      for (const ticket of event.tickets) {
        const soldCount = ticket.purchases.length;
        soldTicketsCount += soldCount;
        totalTicketsCount += ticket.count;
        profit += soldCount * ticket.price;
      }

      return {
        ...event,
        soldTicketsCount,
        totalTicketsCount,
        profit,
        activeDate,
      };
    });

    return eventsWithSalesAndActiveDate;
  }

  async getEventsByCategory(slug: string, filters: {
    type?: string;
    city?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  } = {}) {
    await this.updateSoldOutEventsStatus();

    const offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
    const now = new Date(Date.now() - offsetMs);

    const where: any = {
      endTime: { gte: now },
      status: "Опубликовано",
      category: { slug },
      tickets: {
        some: {
          isSoldOut: false,
          salesEnd: {
            gt: now,
          },
        },
      },
    };

    if (filters.type === 'online') {
      where.location = 'Онлайн';
    }

    if (filters.type === 'free') {
      where.AND = [
        ...(where.AND || []),
        { tickets: { some: {} } },
        { tickets: { every: { price: 0 } } },
      ];
    }

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);

      end.setHours(26, 59, 59, 999);
      console.log(start, end)

      where.tickets = {
        some: {
          validFrom: { lte: end },
          validTo: { gte: start },
          salesEnd: { gt: now }
        },
      }
    }

    if (filters.type !== 'online' && filters.city) {
      where.location = {
        contains: filters.city,
        mode: 'insensitive',
      };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const events = await this.prisma.events.findMany({
      where,
      include: {
        images: { select: { imageUrl: true, isMain: true } },
        organizer: { select: { organizerName: true, avatar: true, id: true } },
        category: { select: { name: true, slug: true } },
        tickets: true,
      },
    });

    return events
      .map(event => {
        const validTickets = event.tickets.filter(ticket => {
          const isSalesActive = ticket.salesEnd && new Date(ticket.salesEnd) > now;
          const isValidDate =
            ticket.validFrom instanceof Date &&
            ticket.validTo instanceof Date &&
            ticket.validTo > now;

          return !ticket.isSoldOut && isSalesActive && isValidDate;
        });

        if (validTickets.length === 0) return null;

        const isOneDay = event.startTime.toDateString() === event.endTime.toDateString();
        let activeDate: Date | null = null;

        if (isOneDay) {
          activeDate = event.startTime;
        } else {
          const futureOrTodayValidDates = validTickets
            .filter(t => {
              return (
                t.validFrom instanceof Date &&
                t.salesEnd && new Date(t.salesEnd) > now
              );
            })
            .map(t => t.validFrom)
            .filter((d): d is Date => d instanceof Date && d >= new Date(now.toDateString()))
            .sort((a, b) => a.getTime() - b.getTime());

          activeDate =
            futureOrTodayValidDates[0] ||
            validTickets
              .map(t => t.validFrom)
              .filter((d): d is Date => d instanceof Date)
              .sort((a, b) => b.getTime() - a.getTime())[0] || null;
        }

        return { ...event, activeDate };
      })
      .filter((event): event is typeof events[number] & { activeDate: Date } => Boolean(event)).sort((a, b) => a.activeDate.getTime() - b.activeDate.getTime());
  }

  async createEvent(dto: CreateEventDto, userId: number) {
    const createdEvent = await this.prisma.events.create({
      data: {
        name: dto.title,
        description: dto.description,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        location: dto.location,
        onlineInfo: dto.onlineInfo || '',
        status: dto.status || 'Черновик',
        viewsEvent: dto.viewsEvent || 0,
        isPrime: dto.isPrime || 0,
        categoryId: dto.categoryId,
        organizerId: userId,
        eventDailys: dto.eventDailys,
      },
    });

    // Добавляем изображения
    const imagesData = dto.images.map((img) => ({
      imageUrl: img.imageUrl,
      publicId: img.publicId,
      isMain: +img.isMain,
      eventId: createdEvent.id,
    }));

    await this.prisma.eventImage.createMany({
      data: imagesData,
    });

    const eventsCount = await this.prisma.events.count({
      where: {
        organizerId: userId,
      },
    });

    await this.notificationService.notifyFollowersOnNewEvent(userId, createdEvent.name, createdEvent.id);

    return { eventsCount, eventId: createdEvent.id };
  }

  async updateEvent(eventId: number, dto: UpdateEventDto) {
    const existingEvent = await this.prisma.events.findUnique({
      where: { id: eventId },
    });
    if (!existingEvent) {
      throw new Error('Событие не найдено');
    }

    // Подготовка данных к обновлению
    const updateData: any = {};

    if (dto.title) updateData.name = dto.title;
    if (dto.description) updateData.description = dto.description;
    if (dto.startTime) updateData.startTime = new Date(dto.startTime);
    if (dto.endTime) updateData.endTime = new Date(dto.endTime);
    if (dto.eventDailys) updateData.eventDailys = dto.eventDailys;
    if (dto.location) updateData.location = dto.location;
    if (dto.onlineInfo) updateData.onlineInfo = dto.onlineInfo;
    if (dto.status) updateData.status = dto.status;
    if (dto.viewsEvent) updateData.viewsEvent = dto.viewsEvent;
    if (typeof dto.isPrime === 'boolean') updateData.isPrime = +dto.isPrime;
    if (dto.refundDateCount !== undefined) updateData.refundDateCount = dto.refundDateCount;
    if (typeof dto.isAutoRefund === 'boolean') updateData.isAutoRefund = dto.isAutoRefund;
    if (dto.categoryId) updateData.categoryId = dto.categoryId;

    // Обновляем основную запись
    const updatedEvent = await this.prisma.events.update({
      where: { id: eventId },
      data: updateData,
    });

    if (dto.images?.length) {
      await this.prisma.eventImage.deleteMany({
        where: { eventId },
      });

      const imagesData = dto.images.map((img) => ({
        imageUrl: img.imageUrl,
        publicId: img.publicId,
        isMain: +img.isMain,
        eventId,
      }));

      await this.prisma.eventImage.createMany({
        data: imagesData,
      });
    }

    // Обновляем refundDateCount в билетах
    if (dto.refundDateCount !== undefined) {
      await this.prisma.ticket.updateMany({
        where: { eventId },
        data: {
          refundDateCount: dto.refundDateCount
        },
      });

      // Обновляем refundDateCount в покупках, только если новое значение меньше предыдущего
      if (dto.refundDateCount < (existingEvent.refundDateCount || Infinity)) {
        await this.prisma.ticketPurchase.updateMany({
          where: {
            ticket: {
              eventId: eventId
            },
            // Обновляем только те покупки, у которых refundDateCount больше нового значения
            refundDateCount: {
              gt: dto.refundDateCount
            }
          },
          data: {
            refundDateCount: dto.refundDateCount
          }
        });
      }
    }

    const shouldNotify =
      (dto.status && dto.status !== existingEvent.status) ||
      (dto.title && dto.title !== existingEvent.name) ||
      (dto.description && dto.description !== existingEvent.description);

    if (shouldNotify) {
      if (dto.status === 'Черновик') {
        await this.notificationService.notifyUsersForEventChange(eventId, 'refund');
      } else if (dto.status === 'Опубликовано') {
        await this.notificationService.notifyUsersForEventChange(eventId, 'public');
      } else {
        await this.notificationService.notifyUsersForEventChange(eventId, 'update');
      }
    }

    return { updated: true, eventId };
  }

  async deleteEvent(eventId: number, userId: number, deleteAccess: boolean) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      include: {
        tickets: {
          include: {
            purchases: true,
          },
        },
      },
    });

    if (!event) {
      throw {
        statusCode: 404,
        message: "Событие не найдено",
        error: "EVENT_NOT_FOUND",
      };
    }

    const isCompleted = event.status === "Завершено";

    // Если завершено — сразу удаляем
    if (isCompleted) {
      return await this._hardDeleteEvent(eventId, userId);
    }

    // Проверка покупок, если нет полного доступа
    if (!deleteAccess) {
      const offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
      const now = new Date(Date.now() - offsetMs);

      const activePurchasedTickets = event.tickets.flatMap((ticket) =>
        ticket.purchases.filter((purchase) => dayjs(ticket.validTo).isAfter(now))
      );

      if (activePurchasedTickets.length > 0) {
        throw {
          statusCode: 409,
          message: "Невозможно удалить событие: есть купленные активные билеты",
          error: "EVENT_HAS_ACTIVE_PURCHASES",
          details: {
            eventId,
            activePurchaseCount: activePurchasedTickets.length,
          },
        };
      }
    }

    // Все билеты либо не куплены, либо истекли — удаляем всё
    return await this._hardDeleteEvent(eventId, userId, deleteAccess);
  }

  // Вынес удаление в отдельный приватный метод для переиспользования
  private async _hardDeleteEvent(eventId: number, userId: number, deleteAccess = false) {
    return await this.prisma.$transaction(async (tx) => {
      await tx.eventImage.deleteMany({ where: { eventId } });
      await tx.eventSchedule.deleteMany({ where: { eventId } });
      await tx.favoriteEvents.deleteMany({ where: { eventId } });

      if (deleteAccess) {
        await tx.ticketPurchase.deleteMany({
          where: {
            ticket: { eventId },
          },
        });

        await this.notificationService.notifyUsersForEventChange(eventId, "cancel");
      }

      await tx.ticket.deleteMany({ where: { eventId } });

      await tx.events.delete({ where: { id: eventId } });

      const remainingEventsCount = await tx.events.count({
        where: { organizerId: userId },
      });

      return {
        eventCount: remainingEventsCount,
      };
    });
  }

  async deleteImage(publicId: string) {
    return this.prisma.eventImage.delete({
      where: { publicId },
    });
  }

  async userSetFavoriteEvent(eventId: number, userId: number) {
    const favorite = await this.prisma.favoriteEvents.create({
      data: {
        userId,
        eventId,
      },
      select: {
        eventId: true,
      },
    });

    return favorite.eventId;
  }

  async userUnsetFavoriteEvent(eventId: number, userId: number) {
    await this.prisma.favoriteEvents.deleteMany({
      where: {
        userId,
        eventId,
      },
    });

    return eventId;
  }

  async getMyFavoriteEventsFull(userId: number) {
    const favoriteRecords = await this.prisma.favoriteEvents.findMany({
      where: { userId },
      select: {
        eventId: true,
      },
    });

    const eventIds = favoriteRecords.map(f => f.eventId);

    if (eventIds.length === 0) {
      return [];
    }

    const events = await this.prisma.events.findMany({
      where: { id: { in: eventIds } },
      include: {
        images: {
          select: {
            imageUrl: true,
            isMain: true
          }
        },
        organizer: {
          select: {
            organizerName: true,
            avatar: true,
            id: true,
          }
        },
        tickets: {
          select: {
            price: true,
            isSoldOut: true,
          }
        },
      },
    });

    return events;
  }

  async getPurchaseByEvent(eventId: number) {
    const purchases = await this.prisma.ticketPurchase.findMany({
      where: {
        ticket: {
          eventId: eventId,
        },
      },
      include: {
        ticket: {
          select: {
            price: true,
            name: true,
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      },
      orderBy: {
        purchaseTime: 'desc',
      },
    });

    if (purchases.length === 0) {
      return [];
    }

    return purchases;
  }

}