import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService, private notificationService: NotificationsService) {}

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
  
  async getAllEvents(filters: {
    type?: string;
    city?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  } = {}) {
    await this.updateSoldOutEventsStatus();
  
    const now = new Date();
    const where: any = {
      endTime: { gte: now },
      status: "Опубликовано",
    };
  
    // Тип: online / free
    if (filters.type === 'online') {
      where.location = 'Онлайн';
    }
  
    if (filters.type === 'free') {
      where.AND = [
        { tickets: { some: {} } }, 
        { tickets: { every: { price: 0 } } }, 
      ];
    }
  
    // Даты (startDate + endDate)
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      where.startTime = {
        gte: start,
        lte: end,
      };
    }
  
    // Город
    if (filters.city) {
      where.city = filters.city;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }
  
    return this.prisma.events.findMany({
      where,
      include: {
        images: {
          select: {
            imageUrl: true,
            isMain: true
          },
        },
        organizer: {
          select: {
            organizerName: true,
            avatar: true,
            id: true,
          },
        },
        tickets: {
          select: {
            price: true,
            isSoldOut: true,
          },
        },
      },
    });
  }  

  async getEventById(eventId: number) {
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
          }
        }
      }
    });
  
    if (!event) return null;
  
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

    console.log("пришли данные: ", event)
  
    return {
      ...event,
      refundDate: event.refundDate 
        ? (event.refundDate <= event.createdAt 
          ? false 
          : event.refundDate)
        : false,
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
    await this.updateSoldOutEventsStatus();

    const now = new Date();
  
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
  
    const eventsWithSales = events.map(event => {
      let soldTicketsCount = 0;
      let totalTicketsCount = 0;
      let profit = 0;
  
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
        profit
      };
    });
  
      return eventsWithSales;
  }

  async getEventsByCategory(slug: string, filters: {
    type?: string;
    city?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  } = {}) {
    await this.updateSoldOutEventsStatus();
  
    const now = new Date();
    const where: any = {
      endTime: { gte: now },
      status: "Опубликовано",
      category: { slug },
    };
  
    // Тип: online / free
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
  
    // Даты
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      where.startTime = {
        gte: start,
        lte: end,
      };
    }
  
    // Город
    if (filters.city) {
      where.city = filters.city;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }
  
    return this.prisma.events.findMany({
      where,
      include: {
        images: {
          select: {
            imageUrl: true,
            isMain: true,
          },
        },
        organizer: {
          select: {
            organizerName: true,
            avatar: true,
            id: true,
          },
        },
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
        tickets: {
          select: {
            price: true,
            isSoldOut: true,
          },
        },
      },
    });
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

    await this.notificationService.notifyFollowersOnNewEvent(userId, createdEvent.name);

    return { eventsCount, eventId: createdEvent.id };
  }

  async updateEvent(eventId: number, dto: UpdateEventDto) {
    // Проверка существования события и принадлежности пользователю
    const existingEvent = await this.prisma.events.findUnique({
      where: { id: eventId },
    });
  
    if (!existingEvent) {
      throw new Error('Событие не найдено');
    }
  
    // Подготовка данных к обновлению
    const updateData: any = {};
    console.log(dto.startTime, dto.endTime)
  
    if (dto.title) updateData.name = dto.title;
    if (dto.description) updateData.description = dto.description;
    if (dto.startTime) updateData.startTime = new Date(dto.startTime);
    if (dto.endTime) updateData.endTime = new Date(dto.endTime);
    if (dto.location) updateData.location = dto.location;
    if (dto.onlineInfo) updateData.onlineInfo = dto.onlineInfo;
    if (dto.status) updateData.status = dto.status;
    if (dto.viewsEvent) updateData.viewsEvent = dto.viewsEvent;
    if (typeof dto.isPrime === 'boolean') updateData.isPrime = +dto.isPrime;
    if (dto.refundDate) updateData.refundDate = new Date(dto.refundDate);
    if (typeof dto.isAutoRefund) updateData.isAutoRefund = dto.isAutoRefund;
    if (dto.categoryId) updateData.categoryId = dto.categoryId;

    console.log(updateData)
  
    // Обновляем основную запись
    await this.prisma.events.update({
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

    const shouldNotify =
      dto.status && dto.status !== existingEvent.status ||
      dto.title && dto.title !== existingEvent.name ||
      dto.description && dto.description !== existingEvent.description;

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
    if (!deleteAccess) {
      const purchasedTicketsCount = await this.prisma.ticketPurchase.count({
        where: {
          ticket: {
            eventId: eventId
          }
        }
      });
      console.log(purchasedTicketsCount)
  
      if (purchasedTicketsCount > 0) {
        throw {
          statusCode: 409,
          message: "Невозможно удалить событие: существуют купленные билеты",
          error: "EVENT_HAS_PURCHASES",
          details: {
            purchasedTicketsCount,
            eventId
          }
        };
      }
    }
  
    return await this.prisma.$transaction(async (tx) => {
      await tx.eventImage.deleteMany({ where: { eventId } });
      await tx.eventSchedule.deleteMany({ where: { eventId } });
      await tx.favoriteEvents.deleteMany({ where: { eventId } });

      if (deleteAccess) {
        await tx.ticketPurchase.deleteMany({
          where: {
            ticket: {
              eventId: eventId
            }
          }
        });

        await this.notificationService.notifyUsersForEventChange(eventId, 'cancel');
      }

      await tx.ticket.deleteMany({ where: { eventId } });

      await tx.events.delete({
        where: { id: eventId },
      });
  
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