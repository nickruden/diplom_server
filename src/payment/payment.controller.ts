// src/payment/payment.controller.ts
import { Controller, Post, Body, HttpCode, UseGuards, Param, Req } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from 'src/config/jwt-auth.guard';
import { CurrentUser } from 'src/coolUser/decorator/current-user.decorator';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) { }

  // Запрос для создания платежа
  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createPayment(@Body() body: { amount: number }) {
    return this.paymentService.createPayment(body.amount);
  }

  // Запрос для отмены платежа
  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  @HttpCode(200)
  async cancelPayment(@Body() body: { paymentId: string }) {
    return this.paymentService.cancelPayment(body.paymentId);
  }

  // Запрос для подтверждения оплаты
  @UseGuards(JwtAuthGuard)
  @Post('confirm')
  @HttpCode(200)
  async confirmPayment(@Body() body: { idBuyer: number; tickets: { idTicket: number; count: number; price: number; validFrom: string; validTo: string; refundDateCount: number }[] }) {
    return this.paymentService.confirmTickets(body.idBuyer, body.tickets);
  }

  @UseGuards(JwtAuthGuard)
  @Post('return/:id')
  async returnTicket(@Param('id') id: string, @CurrentUser() user: any) {
    const userId = user.id;
    return this.paymentService.returnTicket(+id, +userId);
  }

}
