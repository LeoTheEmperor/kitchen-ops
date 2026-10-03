import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  // "Every confirmed order not yet invoiced" for a company (4.9).
  async getUninvoicedOrders(companyId: string) {
    return this.prisma.order.findMany({
      where: { companyId, status: { in: [OrderStatus.CONFIRMED, OrderStatus.DELIVERED] }, invoiceId: null },
      include: { lines: { include: { combinations: true } } },
      orderBy: { deliveryDate: 'asc' },
    });
  }

  private computeOrderTotal(order: { lines: { combinations: { totalPriceSnapshot: Decimal }[] }[] }): Decimal {
    return order.lines.reduce(
      (sum, line) => sum.add(line.combinations.reduce((s, c) => s.add(c.totalPriceSnapshot), new Decimal(0))),
      new Decimal(0),
    );
  }

  // Groups a set of confirmed, uninvoiced orders into one invoice.
  // "An order can be on at most one invoice" is enforced by the invoiceId
  // relation itself (one-to-many from Invoice), so a second attempt to
  // invoice the same order is simply impossible via this code path.
  async createInvoice(companyId: string, orderIds: string[]) {
    if (orderIds.length === 0) throw new BadRequestException('Select at least one order to invoice');

    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds }, companyId, invoiceId: null },
      include: { lines: { include: { combinations: true } } },
    });
    if (orders.length !== orderIds.length) {
      throw new BadRequestException('One or more orders are invalid, already invoiced, or belong to a different company');
    }
    const notConfirmedOrDelivered = orders.filter(
      (o) => o.status !== OrderStatus.CONFIRMED && o.status !== OrderStatus.DELIVERED,
    );
    if (notConfirmedOrDelivered.length > 0) {
      throw new BadRequestException('Only confirmed or delivered orders can be invoiced');
    }

    const total = orders.reduce((sum, o) => sum.add(this.computeOrderTotal(o)), new Decimal(0));

    return this.prisma.invoice.create({
      data: {
        companyId,
        total,
        orders: { connect: orderIds.map((id) => ({ id })) },
      },
      include: { orders: true },
    });
  }

  async markPaid(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.prisma.invoice.update({ where: { id: invoiceId }, data: { paid: true, paidAt: new Date() } });
  }

  findByCompany(companyId: string) {
    return this.prisma.invoice.findMany({
      where: { companyId },
      include: { orders: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { company: true, orders: { include: { lines: { include: { combinations: true } } } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // Decision documented in README (4.9): once an order is invoiced, it is
  // locked - OrdersService.adminOverride() and cancel() both reject changes
  // to an order with a non-null invoiceId. Adjustments to an invoiced order
  // are out of scope for this submission; a credit/adjustment record is
  // the natural next step, listed under "what I'd do next".
}
