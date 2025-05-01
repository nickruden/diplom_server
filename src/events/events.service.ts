import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async getAllEvents() {
    const now = new Date();

    const events = this.prisma.events.findMany({
      where: {
        endTime: {gte: now}
      },
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
          }
        },
        tickets: {
          select: {
            price: true,
            isSoldOut: true,
          }
        },
      },
    })
  
   
    return events;
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
  
    const totalTickets = await this.prisma.ticket.aggregate({
      where: {
        eventId: eventId,
      },
      _sum: {
        count: true,
      },
    });
  
    return {
      ...event,
      totalTicketsCount: totalTickets._sum.count || 0,
    };
  }

  async getEventsByCreator(creatorId: number, filter?: 'upcoming' | 'past') {
    const now = new Date();
  
    const whereParams: any = {
      organizerId: creatorId
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

  async getEventsByCategory(slug: string) {
    const now = new Date();

      const events = await this.prisma.events.findMany({
        where: {
          endTime: { gte: now },
          category: {
            slug: slug
          },
        },
        include: {
          images: {
            select: {
              imageUrl: true,
              isMain: true
            }
          },
          category: {
            select: {
              name: true,
              slug: true
            }
          },
          tickets: {
            select: {
              price: true,
              isSoldOut: true,
            }
          }
        },
      });

      return events;
  }

  async createEvent(dto: CreateEventDto, userId: number) {
    const createdEvent = await this.prisma.events.create({
      data: {
        name: dto.title,
        description: dto.description,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        location: dto.location,
        status: dto.status || 'Черновик',
        isPrime: dto.isPrime || 0,
        refundDate: new Date(),
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

    return { eventsCount, eventId: createdEvent.id };
  }

  async updateEvent(eventId: number, dto: UpdateEventDto) {
    console.log('пришло при публикации', dto)
    // Проверка существования события и принадлежности пользователю
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
    if (dto.location) updateData.location = dto.location;
    if (dto.status) updateData.status = dto.status;
    if (typeof dto.isPrime === 'boolean') updateData.isPrime = +dto.isPrime;
    if (dto.refundDate) updateData.refundDate = new Date(dto.refundDate);
    if (typeof dto.isAutoRefund) updateData.isAutoRefund = dto.isAutoRefund;
    if (dto.categoryId) updateData.categoryId = dto.categoryId;
  
    // Обновляем основную запись
    await this.prisma.events.update({
      where: { id: eventId },
      data: updateData,
    });
  
    if (dto.images.length !== 0) {
      await this.prisma.eventImage.deleteMany({
        where: { eventId },
      })

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
  
    return { updated: true, eventId };
  }
  
  async delterEvent(eventId: number, userId: number) {
    // Удаляем связанные данные
    await this.prisma.eventImage.deleteMany({ where: { eventId } });
    await this.prisma.eventSchedule.deleteMany({ where: { eventId } });
    await this.prisma.ticket.deleteMany({ where: { eventId } });
  
    // Удаляем само событие
    await this.prisma.events.delete({
      where: { id: eventId },
    });
  
    // Считаем оставшееся количество событий у пользователя
    const remainingEventsCount = await this.prisma.events.count({
      where: { organizerId: userId },
    });
  
    return {
      eventCount: remainingEventsCount,
    };
  } 

  async deleteImage(publicId: string) {
    console.log(publicId)
    return this.prisma.eventImage.delete({
      where: { publicId },
    });
  }

  
  }