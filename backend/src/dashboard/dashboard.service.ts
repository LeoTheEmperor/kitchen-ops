import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PrepStatus, DeliveryStatus } from '@prisma/client';

// Every figure here is deliberately simple and its exact definition is
// restated in README.md section 4.11, as required. Cancelled orders are
// excluded from counts/totals everywhere unless a metric is explicitly
// about cancellations. Dates are compared as kitchen-local calendar dates
// (Asia/Kolkata), never server/browser time (see README on timezones).

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private todayDateString(): string {
    // Kitchen operates in Asia/Kolkata; "today" is that zone's calendar date,
    // not the server's. Approximated here with a fixed offset for simplicity
    // (IST = UTC+5:30, no DST) - documented in README.
    const now = new Date();
    const istMs = now.getTime() + (5.5 * 60 + now.getTimezoneOffset()) * 60000;
    return new Date(istMs).toISOString().slice(0, 10);
  }

  // ── Admin dashboard ─────────────────────────────────────────────────
  // What: a same-day operational snapshot plus the near-term order pipeline.
  // Why: an admin needs to see at a glance whether today is on track and
  // whether anything upstream (orders, invoicing) needs attention.
  async getAdminDashboard() {
    const today = this.todayDateString();
    const todayDate = new Date(today);

    const [ordersToday, confirmedToday, kitchenDoneToday, deliveredToday, uninvoicedCount, companiesCount] =
      await Promise.all([
        this.prisma.order.count({ where: { deliveryDate: todayDate, status: { not: OrderStatus.CANCELLED } } }),
        this.prisma.order.count({ where: { deliveryDate: todayDate, status: OrderStatus.CONFIRMED } }),
        this.prisma.order.count({ where: { deliveryDate: todayDate, kitchenReadyActualAt: { not: null } } }),
        this.prisma.order.count({ where: { deliveryDate: todayDate, status: OrderStatus.DELIVERED } }),
        this.prisma.order.count({
          where: { status: { in: [OrderStatus.CONFIRMED, OrderStatus.DELIVERED] }, invoiceId: null },
        }),
        this.prisma.company.count({ where: { active: true } }),
      ]);

    return {
      date: today,
      // "Orders today" = all orders for today's delivery date, excluding
      // cancelled. Includes every other status (draft/placed/confirmed/delivered).
      ordersToday,
      confirmedToday,
      kitchenDoneToday,
      deliveredToday,
      // "Uninvoiced orders" = confirmed or delivered orders with no invoiceId,
      // across all dates, not just today - this is a running backlog figure.
      uninvoicedOrdersCount: uninvoicedCount,
      activeCompaniesCount: companiesCount,
    };
  }

  // ── Kitchen dashboard (what a kitchen lead needs at 6am) ────────────
  // What: today's prep load broken down by station and status.
  // Why: before service starts, a kitchen lead needs to know total units to
  // cook and whether any station is overloaded.
  async getKitchenDashboard() {
    const today = this.todayDateString();
    const todayDate = new Date(today);

    const lines = await this.prisma.orderLine.findMany({
      where: { order: { deliveryDate: todayDate, status: OrderStatus.CONFIRMED } },
      include: { dish: { include: { station: true } }, combinations: { include: { prepUnit: true } } },
    });

    const byStation: Record<string, { pending: number; started: number; done: number }> = {};
    for (const line of lines) {
      const station = line.dish.station?.name ?? 'Unassigned';
      byStation[station] ??= { pending: 0, started: 0, done: 0 };
      for (const combo of line.combinations) {
        const status = combo.prepUnit?.status ?? PrepStatus.PENDING;
        if (status === PrepStatus.PENDING) byStation[station].pending += combo.quantity;
        if (status === PrepStatus.STARTED) byStation[station].started += combo.quantity;
        if (status === PrepStatus.DONE) byStation[station].done += combo.quantity;
      }
    }

    // "At risk": confirmed orders whose kitchenReadyAt (planned) has already
    // passed but kitchenReadyActualAt is still null - i.e. running late.
    const now = new Date();
    const atRiskOrders = await this.prisma.order.count({
      where: {
        deliveryDate: todayDate,
        status: OrderStatus.CONFIRMED,
        kitchenReadyAt: { lt: now },
        kitchenReadyActualAt: null,
      },
    });

    return { date: today, byStation, atRiskOrders };
  }

  // ── Dispatch dashboard ──────────────────────────────────────────────
  // What: today's delivery pipeline by status, and unassigned drops.
  // Why: a dispatcher needs to see what's ready to move and what still
  // needs a driver assigned.
  async getDispatchDashboard() {
    const today = this.todayDateString();
    const todayDate = new Date(today);

    const deliveries = await this.prisma.delivery.findMany({
      where: { order: { deliveryDate: todayDate } },
    });

    const byStatus: Record<string, number> = {
      [DeliveryStatus.KITCHEN_READY]: 0,
      [DeliveryStatus.DISPATCH_READY]: 0,
      [DeliveryStatus.OUT_FOR_DELIVERY]: 0,
      [DeliveryStatus.DELIVERED]: 0,
    };
    let unassigned = 0;
    for (const d of deliveries) {
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      if (!d.driverId) unassigned += 1;
    }

    return { date: today, byStatus, unassignedCount: unassigned, totalDeliveriesToday: deliveries.length };
  }

  // ── Driver dashboard ────────────────────────────────────────────────
  // What: this driver's own deliveries today, counted by status.
  // Why: a driver needs to know how many stops remain, nothing else.
  async getDriverDashboard(driverId: string) {
    const today = this.todayDateString();
    const todayDate = new Date(today);

    const deliveries = await this.prisma.delivery.findMany({
      where: { driverId, order: { deliveryDate: todayDate } },
    });
    const delivered = deliveries.filter((d) => d.status === DeliveryStatus.DELIVERED).length;
    const remaining = deliveries.length - delivered;

    return { date: today, totalStops: deliveries.length, delivered, remaining };
  }
}
