import { Injectable, NotFoundException } from '@nestjs/common';
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
      throw new NotFoundException('Билеты для указанного мероприятия не найдены');
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
        isSoldOut: 0,
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
    return this.prisma.ticket.delete({
      where: { id: ticketId },
    });
  }

  async buyTickets(idBuyer: string, tickets: { idTicket: string; count: number }[]) {
    const result = await Promise.all(
      tickets.map(({ idTicket, count }) =>
        this.prisma.ticketPurchase.create({
          data: {
            userId: +idBuyer,
            ticketId: +idTicket,
            ticketsCount: count,
          },
        })
      )
    );
  }
  
}
