import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async getTicketsByEvent(eventId: number) {
    const tickets = await this.prisma.ticket.findMany({
      where: { eventId },
      include: {
        purchases: true,
      },
    });

    if (tickets.length === 0) {
      return [];
    }
  
    const totalTickets = await this.prisma.ticket.aggregate({
      where: { eventId },
      _sum: {
        count: true,
      },
    });
  
    const detailedTickets = tickets.map(ticket => {
      const soldCount = ticket.purchases.length;
      const profit = soldCount * ticket.price;
  
      return {
        id: ticket.id,
        name: ticket.name,
        description: ticket.description,
        price: ticket.price,
        salesStart: ticket.salesStart,
        salesEnd: ticket.salesEnd,
        count: ticket.count,
        soldCount,
        profit,
        isSoldOut: ticket.isSoldOut,
      };
    });
  
    return {
      tickets: detailedTickets,
      totalTickets: totalTickets._sum.count || 0,
    };
  }

  async createTicket(eventId: number, dto: CreateTicketDto) {
    return await this.prisma.ticket.create({
      data: {
        ...dto,
        isSoldOut: false,
        event: {
          connect: { id: eventId },
        },
      },
    });
  }

  async updateTicket(ticketId: number, dto: UpdateTicketDto) {
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: dto,
    });
  }

  async deleteTicket(ticketId: number) {
    // Проверяем, есть ли покупки этого билета
    const purchasesCount = await this.prisma.ticketPurchase.count({
      where: { ticketId }
    });
  
    if (purchasesCount > 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT, // 409 Conflict
          message: 'Невозможно удалить билет: существуют покупки',
          error: 'TICKET_HAS_PURCHASES',
          details: {
            purchasesCount,
            ticketId
          }
        },
        HttpStatus.CONFLICT
      );
    }
  
    // Если покупок нет - удаляем билет
    await this.prisma.ticket.delete({
      where: { id: ticketId },
    });
  
    return { success: true };
  }
}
