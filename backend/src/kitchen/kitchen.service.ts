import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrepStatus, OrderStatus } from '@prisma/client';

@Injectable()
export class KitchenService {
  constructor(private readonly prisma: PrismaService) {}

  // The board for a chosen delivery date, optionally filtered by station (4.7).
  async getBoard(deliveryDate: string, stationId?: string) {
    const dateObj = new Date(deliveryDate);

    const orders = await this.prisma.order.findMany({
      where: { deliveryDate: dateObj, status: OrderStatus.CONFIRMED },
      include: {
        lines: {
          include: {
            dish: { include: { station: true } },
            combinations: {
              include: { prepUnit: true, chosenOptions: true },
            },
          },
        },
      },
      orderBy: { kitchenReadyAt: 'asc' },
    });

    // Flatten to prep units, each routed to its dish's station (or "Unassigned").
    const units: any[] = [];
    for (const order of orders) {
      for (const line of order.lines) {
        for (const combo of line.combinations) {
          const station = line.dish.station?.name ?? 'Unassigned';
          if (stationId && line.dish.stationId !== stationId && !(stationId === 'unassigned' && !line.dish.stationId)) {
            continue;
          }
          units.push({
            prepUnitId: combo.prepUnit?.id,
            combinationId: combo.id,
            orderId: order.id,
            dishName: line.dish.name,
            station,
            quantity: combo.quantity,
            chosenOptions: combo.chosenOptions.map((o) => o.optionNameSnapshot),
            status: combo.prepUnit?.status ?? PrepStatus.PENDING,
            startedAt: combo.prepUnit?.startedAt,
            doneAt: combo.prepUnit?.doneAt,
            kitchenReadyAt: order.kitchenReadyAt,
            dispatchReadyAt: order.dispatchReadyAt,
          });
        }
      }
    }
    return units;
  }

  // "Finishing a unit that was never started is allowed and also records a
  // start" (4.7) - start() is idempotent-safe for that reason.
  async startUnit(prepUnitId: string) {
    const unit = await this.prisma.prepUnit.findUnique({
      where: { id: prepUnitId },
      include: { combination: { include: { orderLine: { include: { order: true } } } } },
    });
    if (!unit) throw new NotFoundException('Prep unit not found');
    if (unit.combination.orderLine.order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed orders can be worked on');
    }
    if (unit.status === PrepStatus.STARTED || unit.status === PrepStatus.DONE) {
      throw new BadRequestException('Unit already started'); // "can't be started twice" (4.7)
    }

    const updated = await this.prisma.prepUnit.update({
      where: { id: prepUnitId },
      data: { status: PrepStatus.STARTED, startedAt: new Date() },
    });

    // "The order's kitchen started time is its first unit's start" (4.7)
    const orderId = unit.combination.orderLine.orderId;
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!order.kitchenStartedAt) {
      await this.prisma.order.update({ where: { id: orderId }, data: { kitchenStartedAt: new Date() } });
    }

    return updated;
  }

  async finishUnit(prepUnitId: string) {
    const unit = await this.prisma.prepUnit.findUnique({
      where: { id: prepUnitId },
      include: { combination: { include: { orderLine: { include: { order: true } } } } },
    });
    if (!unit) throw new NotFoundException('Prep unit not found');
    if (unit.combination.orderLine.order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed orders can be worked on');
    }
    if (unit.status === PrepStatus.DONE) {
      throw new BadRequestException('Unit already finished'); // "can't be finished twice" (4.7)
    }

    const orderId = unit.combination.orderLine.orderId;
    const now = new Date();

    await this.prisma.prepUnit.update({
      where: { id: prepUnitId },
      data: {
        status: PrepStatus.DONE,
        doneAt: now,
        // Finishing a never-started unit also records a start (4.7).
        startedAt: unit.startedAt ?? now,
      },
    });

    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!order.kitchenStartedAt) {
      await this.prisma.order.update({ where: { id: orderId }, data: { kitchenStartedAt: now } });
    }

    // "Kitchen ready time is set only when every unit is done" (4.7).
    await this.recomputeKitchenReadyIfComplete(orderId);

    return this.prisma.prepUnit.findUniqueOrThrow({ where: { id: prepUnitId } });
  }

  private async recomputeKitchenReadyIfComplete(orderId: string) {
    const lines = await this.prisma.orderLine.findMany({
      where: { orderId },
      include: { combinations: { include: { prepUnit: true } } },
    });
    const allUnits = lines.flatMap((l) => l.combinations.map((c) => c.prepUnit));
    const allDone = allUnits.length > 0 && allUnits.every((u) => u?.status === PrepStatus.DONE);
    if (allDone) {
      await this.prisma.order.update({ where: { id: orderId }, data: { kitchenReadyActualAt: new Date() } });
    }
  }

  // Admin can force-complete a whole order (4.7).
  async forceCompleteOrder(orderId: string) {
    const lines = await this.prisma.orderLine.findMany({
      where: { orderId },
      include: { combinations: { include: { prepUnit: true } } },
    });
    const now = new Date();
    for (const line of lines) {
      for (const combo of line.combinations) {
        if (combo.prepUnit) {
          await this.prisma.prepUnit.update({
            where: { id: combo.prepUnit.id },
            data: { status: PrepStatus.DONE, startedAt: combo.prepUnit.startedAt ?? now, doneAt: now },
          });
        }
      }
    }
    await this.prisma.order.update({
      where: { id: orderId },
      data: { kitchenStartedAt: now, kitchenReadyActualAt: now },
    });
    return this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  }
}
