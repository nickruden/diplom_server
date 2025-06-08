import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { PrismaService } from 'src/prisma.service';
import dayjs from 'dayjs';


@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) { }

  async getTicketsByEvent(eventId: number) {
    const tickets = await this.prisma.ticket.findMany({
      where: { eventId },
      include: {
        purchases: true,
      },
    });

    if (tickets.length === 0) {
      return {
        tickets: [],
        totalTickets: 0,
        totalSold: 0,
        totalRemaining: 0
      };
    }

    const totalTickets = await this.prisma.ticket.aggregate({
      where: { eventId },
      _sum: {
        count: true,
      },
    });

    const totalSoldTickets = await this.prisma.ticketPurchase.count({
      where: {
        ticket: {
          eventId: eventId
        }
      }
    });

    const detailedTickets = tickets.map(ticket => {
      const soldCount = ticket.purchases.length;
      const remainingCount = ticket.count - soldCount;
      const profit = soldCount * ticket.price;

      return {
        id: ticket.id,
        name: ticket.name,
        description: ticket.description,
        price: ticket.price,
        salesStart: ticket.salesStart,
        salesEnd: ticket.salesEnd,
        count: ticket.count,
        validFrom: ticket.validFrom,
        validTo: ticket.validTo,
        soldCount,
        remainingCount,
        profit,
        isSoldOut: ticket.isSoldOut || remainingCount <= 0,
      };
    });

    return {
      tickets: detailedTickets,
      totalTickets: totalTickets._sum.count || 0,
      totalSold: totalSoldTickets,
      totalRemaining: (totalTickets._sum.count || 0) - totalSoldTickets
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
    const existingTicket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        purchases: true,
      },
    });

    if (!existingTicket) {
      throw new Error('Ticket not found');
    }

    const purchasesCount = existingTicket.purchases.length;

    let newCount = dto.count ?? existingTicket.count;
    let isSoldOut = existingTicket.isSoldOut;

    if (purchasesCount == newCount) {
      isSoldOut = true;
    } else {
      isSoldOut = false;
    }

    console.log(isSoldOut)

    return await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        ...dto,
        isSoldOut,
      },
    });
  }

  async deleteTicket(ticketId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        purchases: true,
      },
    });

    if (!ticket) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Билет не найден',
          error: 'TICKET_NOT_FOUND',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const hasPurchases = ticket.purchases.length > 0;
    const now = Date.now();

    const ticketValidTo = ticket.validTo ? new Date(ticket.validTo).getTime() : null;
    const isExpired = ticketValidTo !== null && ticketValidTo < now;

    if (hasPurchases && !isExpired) {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          message:
            'Невозможно удалить билет: существуют покупки и срок действия билета ещё не истёк',
          error: 'TICKET_HAS_PURCHASES',
          details: {
            purchasesCount: ticket.purchases.length,
            ticketId,
          },
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.ticket.delete({
      where: { id: ticketId },
    });

    return { success: true };
  }

  async deleteAllPurchasesByTicketId(ticketId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        purchases: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Билет с id ${ticketId} не найден`);
    }

    if (ticket.purchases.length === 0) {
      return {
        message: 'Для этого билета нет покупок',
        deletedCount: 0,
      };
    }

    const deleted = await this.prisma.ticketPurchase.deleteMany({
      where: {
        ticketId,
      },
    });

    return {
      message: `Удалено ${deleted.count} покупок билета`,
      deletedCount: deleted.count,
    };
  }

}
