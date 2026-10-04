import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStatus, OrderStatus } from '@prisma/client';

// Order of delivery statuses - each step requires the previous one (4.8).
const STATUS_ORDER: DeliveryStatus[] = [
  DeliveryStatus.KITCHEN_READY,
  DeliveryStatus.DISPATCH_READY,
  DeliveryStatus.OUT_FOR_DELIVERY,
  DeliveryStatus.DELIVERED,
];

@Injectable()
export class DispatchService {
  constructor(private readonly prisma: PrismaService) {}

  // "Orders for the same company, same address and exact same delivery time
  // make up one drop" (4.8). Computed on read rather than stored, to avoid a
  // second source of truth that could drift from the orders themselves -
  // documented trade-off (see README).
  async getBoard(deliveryDate: string) {
    const dateObj = new Date(deliveryDate);
    const orders = await this.prisma.order.findMany({
      where: { deliveryDate: dateObj, status: OrderStatus.CONFIRMED },
      include: {
        company: true,
        address: true,
        delivery: { include: { driver: true } },
      },
    });

    const drops = new Map<string, any>();
    for (const order of orders) {
      const key = `${order.companyId}|${order.addressId}|${order.deliveryTime}`;
      if (!drops.has(key)) {
        drops.set(key, {
          dropKey: key,
          companyName: order.company.name,
          addressLabel: order.address.label,
          deliveryTime: order.deliveryTime,
          driver: order.delivery?.driver ?? null,
          status: order.delivery?.status ?? DeliveryStatus.KITCHEN_READY,
          orders: [],
        });
      }
      drops.get(key).orders.push({
        orderId: order.id,
        deliveryId: order.delivery?.id,
        status: order.delivery?.status,
      });
    }
    return Array.from(drops.values());
  }

  // Assigns a driver to every order in a drop (grouped by company+address+time).
  async assignDriverToDrop(
    companyId: string,
    addressId: string,
    deliveryTime: string,
    driverId: string,
  ) {
    const orders = await this.prisma.order.findMany({
      where: {
        companyId,
        addressId,
        deliveryTime,
        status: OrderStatus.CONFIRMED,
      },
      include: { delivery: true },
    });
    for (const order of orders) {
      if (order.delivery) {
        await this.prisma.delivery.update({
          where: { id: order.delivery.id },
          data: { driverId },
        });
      }
    }
    return { updated: orders.length };
  }

  private assertSequential(current: DeliveryStatus, next: DeliveryStatus) {
    const currentIdx = STATUS_ORDER.indexOf(current);
    const nextIdx = STATUS_ORDER.indexOf(next);
    if (nextIdx !== currentIdx + 1) {
      throw new BadRequestException(
        `Cannot move from ${current} to ${next} - each step requires the previous one`,
      );
    }
  }

  async advanceStatus(deliveryId: string, next: DeliveryStatus) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    this.assertSequential(delivery.status, next);

    if (next === DeliveryStatus.OUT_FOR_DELIVERY && !delivery.driverId) {
      throw new BadRequestException(
        '"Out for delivery" requires an assigned driver',
      ); // (4.8)
    }

    const data: any = { status: next };
    if (next === DeliveryStatus.DISPATCH_READY)
      data.dispatchReadyAt = new Date();
    if (next === DeliveryStatus.OUT_FOR_DELIVERY)
      data.outForDeliveryAt = new Date();

    return this.prisma.delivery.update({ where: { id: deliveryId }, data });
  }

  // ── Driver view ─────────────────────────────────────────────────────
  // "A driver signs in and sees only their own drops for today, in time
  // order" (4.8).
  async getDriverDeliveries(driverId: string, date: string) {
    const dateObj = new Date(date);
    return this.prisma.delivery.findMany({
      where: { driverId, order: { deliveryDate: dateObj } },
      include: { order: { include: { company: true, address: true } } },
      orderBy: { order: { deliveryTime: 'asc' } },
    });
  }

  async markDelivered(deliveryId: string, driverId: string, note?: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.driverId !== driverId) {
      throw new ForbiddenException('This delivery is not assigned to you');
    }
    this.assertSequential(delivery.status, DeliveryStatus.DELIVERED);

    const now = new Date();
    // "Record whether each delivery was on time" (4.8) - on time if delivered
    // at or before the order's delivery time on the delivery date.
    const [hour, minute] = delivery.order.deliveryTime.split(':').map(Number);
    const scheduledDelivery = new Date(delivery.order.deliveryDate);
    scheduledDelivery.setUTCHours(hour, minute, 0, 0);
    const onTime = now <= scheduledDelivery;

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: DeliveryStatus.DELIVERED,
        deliveredAt: now,
        onTime,
        deliveryNote: note,
      },
    });
    await this.prisma.order.update({
      where: { id: delivery.orderId },
      data: { status: OrderStatus.DELIVERED },
    });
    return updated;
  }
}
