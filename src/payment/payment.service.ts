import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentService {
  constructor(private prisma: PrismaService) {}

  async createPayment(amount: number) {
    const paymentData = {
      amount: {
        value: amount.toFixed(2), // сумма в рублях с точностью до двух знаков
        currency: 'RUB', // валюта
      },
      confirmation: {
        type: 'embedded',
      },
      capture_mode: 'AUTOMATIC', // автоматически подтверждать платеж
      description: 'Покупка билетов', // описание транзакции
      merchant_order_ext_ref: uuidv4(), // уникальный идентификатор для заказа
    };

    try {
      // Генерация уникального ключа Idempotence-Key
      const idempotenceKey = uuidv4(); // Генерация уникального ID для каждого запроса

      const response = await axios.post(
        'https://api.yookassa.ru/v3/payments', // URL YooKassa API для создания платежа
        paymentData,
        {
          headers: {
            'Content-Type': 'application/json', // тип данных
            'Authorization': `Basic ${Buffer.from('1082612:test_ijHQsI84_NL9fVl_KkM9fHKKduHKKYG7-4ZkTF9vI1k').toString('base64')}`, // Авторизация
            'Idempotence-Key': idempotenceKey, // Уникальный Idempotence-Key
          },
        }
      );

      return response.data; // Ответ с данными платежа (ссылка на оплату, id платежа и т.д.)
    } catch (error) {
      console.error('Ошибка при создании платежа:', error.response ? error.response.data : error.message);
      throw new Error('Ошибка при создании платежа: ' + error.message);
    }
  }

  async cancelPayment(paymentId: string) {
    try {
      const idempotenceKey = uuidv4();

      const response = await axios.post(
        `https://api.yookassa.ru/v3/payments/${paymentId}/cancel`, // URL для отмены платежа
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from('1082612:test_ijHQsI84_NL9fVl_KkM9fHKKduHKKYG7-4ZkTF9vI1k').toString('base64')}`,
            'Idempotence-Key': idempotenceKey,
          },
        }
      );

      return response.data; // Ответ с данными отмены платежа
    } catch (error) {
      console.error('Ошибка при отмене платежа:', error.response ? error.response.data : error.message);
      throw new Error('Ошибка при отмене платежа: ' + error.message);
    }
  }

  async confirmTickets(userId: number, tickets: { idTicket: number; count: number; price: number; validFrom: string; validTo: string; refundDateCount: number }[]) {
    // Получаем информацию о билетах
    const ticketsInfo = await this.prisma.ticket.findMany({
      where: {
        id: { in: tickets.map(t => t.idTicket) }
      },
      select: {
        id: true,
        price: true,
        eventId: true,
        count: true
      }
    });
  
    // Проверяем, что все билеты принадлежат одному событию
    const eventIds = new Set(ticketsInfo.map(t => t.eventId));
    if (eventIds.size !== 1) {
      throw new Error("Все билеты должны принадлежать одному событию");
    }
    const eventId = ticketsInfo[0].eventId;
  
    // Рассчитываем общую сумму
    const totalAmount = tickets.reduce((sum, t) => {
      const ticketInfo = ticketsInfo.find(ti => ti.id === t.idTicket);
      return sum + (ticketInfo ? ticketInfo.price * t.count : 0);
    }, 0);
  
    // Создаем записи о покупках и обновляем статусы в транзакции
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Создаем покупки
      const data = tickets.flatMap(t =>
        Array.from({ length: t.count }, () => ({
          userId,
          ticketId: t.idTicket,
          price: t.price,
          validFrom: new Date(t.validFrom),
          validTo: new Date(t.validTo),
          refundDateCount: t.refundDateCount,
        }))
      );
      await tx.ticketPurchase.createMany({ data });
  
      // 2. Обновляем выручку события
      await tx.events.update({
        where: { id: eventId },
        data: { revenue: { increment: totalAmount } }
      });
  
      // 3. Проверяем и обновляем статусы билетов
      for (const ticket of ticketsInfo) {
        const purchasesCount = await tx.ticketPurchase.count({
          where: { ticketId: ticket.id }
        });
  
        if (purchasesCount >= ticket.count) {
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { isSoldOut:  true }
          });
        }
      }
  
      return { success: true, totalAmount };
    });
  
    return result;
  }

async returnTicket(purchaseId: number, userId: number) {
  const purchase = await this.prisma.ticketPurchase.findFirst({
    where: { id: purchaseId, userId },
    include: { 
      ticket: { 
        include: { 
          event: {
            select: {
              id: true,
              revenue: true
            }
          },
          _count: {
            select: { purchases: true }
          }
        } 
      } 
    },
  });

  if (!purchase) throw new Error("Билет не найден или не принадлежит пользователю");

    const offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
    const now = new Date(Date.now() - offsetMs);
    
  const refundDateCount = purchase.refundDateCount;
  const { validFrom } = purchase.ticket;

  if (!refundDateCount || !validFrom) {
    throw new Error("Возврат невозможен: не указаны параметры возврата или дата начала действия билета");
  }

  // Вычисляем дедлайн для возврата: validFrom - refundDateCount (в днях)
  const refundDeadline = new Date(validFrom);
  refundDeadline.setDate(refundDeadline.getDate() - refundDateCount);

  if (now > refundDeadline) {
    return {
      success: false,
      error: {
        code: "REFUND_EXPIRED",
        message: "Срок возврата истёк",
      },
    };
  }

  // Выполняем в транзакции
  const result = await this.prisma.$transaction(async (tx) => {
    // 1. Удаляем покупку
    await tx.ticketPurchase.delete({
      where: { id: purchaseId }
    });

    // 2. Обновляем выручку
    await tx.events.update({
      where: { id: purchase.ticket.event.id },
      data: { 
        revenue: { decrement: purchase.ticket.price } 
      }
    });

    // 3. Снимаем флаг soldOut если нужно
    const purchasesCount = purchase.ticket._count.purchases - 1;
    if (purchasesCount < purchase.ticket.count) {
      await tx.ticket.update({
        where: { id: purchase.ticket.id },
        data: { isSoldOut: false }
      });
    }

    return { success: true, refundAmount: purchase.ticket.price };
  });

  return result;
}

}
