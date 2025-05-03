import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { JwtAuthGuard } from 'src/config/jwt-auth.guard';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get(':id')
  getTicketsByEvent(@Param('id') eventId: string) {
    return this.ticketsService.getTicketsByEvent(+eventId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post(':eventId')
  createTicket(@Param('eventId') eventId: string, @Body() dto: CreateTicketDto) {
    return this.ticketsService.createTicket(+eventId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':ticketId')
  updateTicket(@Param('ticketId') ticketId: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.updateTicket(+ticketId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':ticketId')
  deleteTicket(@Param('ticketId') ticketId: string) {
    return this.ticketsService.deleteTicket(+ticketId);
  }

  @HttpCode(200)
  @Post('buy/ticket')
  async buyTickets(@Body() body: { idBuyer: string; tickets: { idTicket: string; count: number }[] }) {
    return this.ticketsService.buyTickets(body.idBuyer, body.tickets);
  }
}
