import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { SettingsService } from '../settings/settings.service';
import { CreateOrderDto } from './dto/order.dto';
import { OrderStatus, PrepStatus, DeliveryStatus } from '@prisma/client';
import { isPastCutoff } from './cutoff.util';
import {
  validateCombinationQuantities,
  validateRequiredGroupsSatisfied,
  mergeDuplicateCombinations,
} from './combination.util';
import { DateTime } from 'luxon';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly settingsService: SettingsService,
  ) {}

  // ── Cut-off helpers ─────────────────────────────────────────────────

  private async getCutoffInputsForDate(deliveryDate: string) {
    const [
      cutoffDays,
      cutoffTime,
      kitchenWorkingDays,
      kitchenHolidays,
      timezone,
    ] = await Promise.all([
      this.settingsService.getCutoffDays(),
      this.settingsService.getCutoffTime(),
      this.settingsService.getKitchenWorkingDays(),
      this.settingsService.getKitchenHolidays(),
      this.settingsService.getTimezone(),
    ]);
    return {
      deliveryDate,
      cutoffDays,
      cutoffTime,
      kitchenWorkingDays,
      kitchenHolidays,
      timezone,
    };
  }

  async isOrderPastCutoff(deliveryDate: Date): Promise<boolean> {
    const dateStr = deliveryDate.toISOString().slice(0, 10);
    const inputs = await this.getCutoffInputsForDate(dateStr);
    return isPastCutoff(inputs);
  }

  // ── Planned times (4.7): worked back from delivery time ─────────────
  // dispatch-ready = delivery time - company's delivery minutes
  // kitchen-ready = dispatch-ready - 30 minutes
  private computePlannedTimes(
    deliveryDate: string,
    deliveryTime: string,
    dispatchLeadMinutes: number,
    timezone: string,
  ) {
    const [hour, minute] = deliveryTime.split(':').map(Number);
    const deliveryInstant = DateTime.fromFormat(deliveryDate, 'yyyy-MM-dd', {
      zone: timezone,
    }).set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    });
    const dispatchReadyAt = deliveryInstant.minus({
      minutes: dispatchLeadMinutes,
    });
    const kitchenReadyAt = dispatchReadyAt.minus({ minutes: 30 });
    return {
      dispatchReadyAt: dispatchReadyAt.toJSDate(),
      kitchenReadyAt: kitchenReadyAt.toJSDate(),
    };
  }

  // ── Creating an order (4.6) ─────────────────────────────────────────

  async create(dto: CreateOrderDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: { company: { include: { addresses: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    const company = employee.company;

    // Company calendar check (4.4): no deliveries on non-working days/holidays.
    const deliveryDateObj = new Date(dto.deliveryDate + 'T00:00:00Z');
    const dayOfWeek = deliveryDateObj.getUTCDay();
    const workingDays = company.workingDays as number[];
    if (!workingDays.includes(dayOfWeek)) {
      throw new BadRequestException(
        'Company does not receive deliveries on this day of the week',
      );
    }

    // Permission checks (4.5): can the employee choose address/time/packaging?
    const addressId = dto.addressId ?? company.addresses[0]?.id;
    if (!addressId)
      throw new BadRequestException(
        'No delivery address available for this company',
      );
    if (
      dto.addressId &&
      dto.addressId !== company.addresses[0]?.id &&
      !employee.canChooseAddress
    ) {
      throw new ForbiddenException(
        'This employee is not permitted to choose a delivery address',
      );
    }
    const deliveryTime =
      dto.deliveryTime ?? company.defaultDeliveryTime ?? '12:00';
    if (
      dto.deliveryTime &&
      dto.deliveryTime !== company.defaultDeliveryTime &&
      !employee.canChangeTime
    ) {
      throw new ForbiddenException(
        'This employee is not permitted to change the delivery time',
      );
    }
    const packagingType =
      dto.packagingType ?? company.defaultPackagingType ?? undefined;
    if (
      dto.packagingType &&
      dto.packagingType !== company.defaultPackagingType &&
      !employee.canChangePackaging
    ) {
      throw new ForbiddenException(
        'This employee is not permitted to change packaging',
      );
    }

    const tierId = await this.pricingService.resolveEmployeeTierId(company.id);
    const timezone = await this.settingsService.getTimezone();
    const { dispatchReadyAt, kitchenReadyAt } = this.computePlannedTimes(
      dto.deliveryDate,
      deliveryTime,
      company.dispatchLeadMinutes,
      timezone,
    );

    // Build each line with server-validated, server-priced combinations.
    // Every rule here is enforced server-side, not only in the form (4.6).
    const lineCreates: any[] = [];
    for (const line of dto.lines) {
      const dish = await this.prisma.dish.findUnique({
        where: { id: line.dishId },
        include: { optionGroups: true },
      });
      if (!dish || !dish.active)
        throw new BadRequestException(`Dish ${line.dishId} is not available`);
      if (dish.minOrderQty && line.quantity < dish.minOrderQty) {
        throw new BadRequestException(
          `${dish.name} requires a minimum order quantity of ${dish.minOrderQty}`,
        );
      }

      const dishPrice = await this.pricingService.resolveDishPrice(
        dish.id,
        tierId,
      );
      if (dishPrice == null)
        throw new BadRequestException(
          `${dish.name} has no price on this employee's tier`,
        );

      const rawCombinations = line.combinations.map((c) => ({
        quantity: c.quantity,
        selectedOptionIdsByGroup: Object.fromEntries(
          c.chosenOptions.map((o) => [o.groupId, o.optionId]),
        ),
      }));
      const merged = mergeDuplicateCombinations(rawCombinations);

      validateCombinationQuantities(line.quantity, merged);
      validateRequiredGroupsSatisfied(
        dish.optionGroups.map((g) => ({ id: g.id, required: g.required })),
        merged,
      );

      const combinationCreates: any[] = [];
      for (let i = 0; i < merged.length; i++) {
        const comboOptionIds = Object.values(
          merged[i].selectedOptionIdsByGroup,
        ).filter(Boolean) as string[];

        let optionsTotal = new Decimal(0);
        const chosenOptionCreates: any[] = [];
        for (const optionId of comboOptionIds) {
          const option = await this.prisma.option.findUnique({
            where: { id: optionId },
          });
          if (!option)
            throw new BadRequestException(`Option ${optionId} not found`);
          const optionPrice = await this.pricingService.resolveOptionPrice(
            optionId,
            tierId,
          );
          if (optionPrice == null)
            throw new BadRequestException(
              `${option.name} has no price on this employee's tier`,
            );
          optionsTotal = optionsTotal.add(optionPrice);
          chosenOptionCreates.push({
            optionNameSnapshot: option.name,
            priceSnapshot: optionPrice,
          });
        }

        const unitTotal = dishPrice.add(optionsTotal);
        const comboTotal = unitTotal.mul(merged[i].quantity);

        combinationCreates.push({
          quantity: merged[i].quantity,
          totalPriceSnapshot: comboTotal,
          chosenOptions: { create: chosenOptionCreates },
        });
      }

      lineCreates.push({
        dishId: dish.id,
        quantity: line.quantity,
        unitPriceSnapshot: dishPrice,
        combinations: { create: combinationCreates },
      });
    }

    const status = dto.asDraft ? OrderStatus.DRAFT : OrderStatus.PLACED;

    return this.prisma.order.create({
      data: {
        companyId: company.id,
        employeeId: employee.id,
        deliveryDate: deliveryDateObj,
        deliveryTime,
        addressId,
        packagingType,
        status,
        dispatchReadyAt,
        kitchenReadyAt,
        lines: { create: lineCreates },
        statusHistory: { create: { status } },
      },
      include: {
        lines: {
          include: { combinations: { include: { chosenOptions: true } } },
        },
      },
    });
  }

  // ── Reading orders (4.6) ───────────────────────────────────────────

  async findMany(filters: {
    deliveryDateFrom?: string;
    deliveryDateTo?: string;
    status?: OrderStatus;
    companyId?: string;
    invoiced?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;

    const where: any = {};
    if (filters.deliveryDateFrom || filters.deliveryDateTo) {
      where.deliveryDate = {};
      if (filters.deliveryDateFrom)
        where.deliveryDate.gte = new Date(filters.deliveryDateFrom);
      if (filters.deliveryDateTo)
        where.deliveryDate.lte = new Date(filters.deliveryDateTo);
    }
    if (filters.status) where.status = filters.status;
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.invoiced !== undefined) {
      where.invoiceId = filters.invoiced ? { not: null } : null;
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { company: true, employee: true, address: true },
        orderBy: { deliveryDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        company: true,
        employee: true,
        address: true,
        invoice: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        lines: {
          include: {
            dish: true,
            combinations: { include: { chosenOptions: true, prepUnit: true } },
          },
        },
        delivery: { include: { driver: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ── Editing / cancelling before cut-off (4.6) ───────────────────────

  private async assertEditable(orderId: string, isAdmin: boolean) {
    const order = await this.findOne(orderId);
    if (order.invoiceId) {
      throw new BadRequestException(
        'Cannot modify an invoiced order (see README billing decision)',
      );
    }
    if (
      order.status !== OrderStatus.DRAFT &&
      order.status !== OrderStatus.PLACED
    ) {
      throw new BadRequestException(
        `Order in status ${order.status} cannot be edited`,
      );
    }
    const pastCutoff = await this.isOrderPastCutoff(order.deliveryDate);
    if (pastCutoff && !isAdmin) {
      throw new ForbiddenException(
        'Order is past cut-off and can only be changed by an admin',
      );
    }
    return order;
  }

  async cancel(orderId: string, isAdmin: boolean) {
    await this.assertEditable(orderId, isAdmin);
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        statusHistory: { create: { status: OrderStatus.CANCELLED } },
      },
    });
  }

  // Admin overrides after confirmation (4.6: "Admins can change an order's
  // delivery time, address or packaging after confirmation").
  async adminOverride(
    orderId: string,
    changes: {
      deliveryTime?: string;
      addressId?: string;
      packagingType?: string;
    },
  ) {
    const order = await this.findOne(orderId);
    if (order.invoiceId) {
      throw new BadRequestException(
        'Cannot modify an order that has already been invoiced (see README billing decision)',
      );
    }

    let dispatchReadyAt = order.dispatchReadyAt;
    let kitchenReadyAt = order.kitchenReadyAt;
    if (changes.deliveryTime) {
      const company = await this.prisma.company.findUniqueOrThrow({
        where: { id: order.companyId },
      });
      const timezone = await this.settingsService.getTimezone();
      const deliveryDateStr = order.deliveryDate.toISOString().slice(0, 10);
      const planned = this.computePlannedTimes(
        deliveryDateStr,
        changes.deliveryTime,
        company.dispatchLeadMinutes,
        timezone,
      );
      dispatchReadyAt = planned.dispatchReadyAt;
      kitchenReadyAt = planned.kitchenReadyAt;
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryTime: changes.deliveryTime,
        addressId: changes.addressId,
        packagingType: changes.packagingType,
        dispatchReadyAt,
        kitchenReadyAt,
      },
    });
  }

  // ── Cut-off processing (4.6) ────────────────────────────────────────
  // Idempotent via CutoffRun's unique(deliveryDate): a second run for the
  // same date is a safe no-op that reports the already-recorded counts.
  async processCutoff(deliveryDate: string) {
    const existing = await this.prisma.cutoffRun.findUnique({
      where: { deliveryDate: new Date(deliveryDate) },
    });
    if (existing) {
      return { alreadyProcessed: true, ...existing };
    }

    const dateObj = new Date(deliveryDate);
    const result = await this.prisma.$transaction(async (tx) => {
      const draftOrders = await tx.order.findMany({
        where: { deliveryDate: dateObj, status: OrderStatus.DRAFT },
      });
      await tx.order.updateMany({
        where: { id: { in: draftOrders.map((o) => o.id) } },
        data: { status: OrderStatus.CANCELLED },
      });
      for (const order of draftOrders) {
        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            status: OrderStatus.CANCELLED,
            note: 'Cut-off: draft auto-cancelled',
          },
        });
      }

      const placedOrders = await tx.order.findMany({
        where: { deliveryDate: dateObj, status: OrderStatus.PLACED },
      });
      await tx.order.updateMany({
        where: { id: { in: placedOrders.map((o) => o.id) } },
        data: { status: OrderStatus.CONFIRMED },
      });
      for (const order of placedOrders) {
        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            status: OrderStatus.CONFIRMED,
            note: 'Cut-off: auto-confirmed, now billable',
          },
        });
        // Seed a Delivery row so the dispatch board (4.8) has something to track.
        await tx.delivery.create({
          data: { orderId: order.id, status: DeliveryStatus.KITCHEN_READY },
        });
        // Seed PrepUnits for the kitchen board (4.7): one per combination.
        const lines = await tx.orderLine.findMany({
          where: { orderId: order.id },
          include: { combinations: true },
        });
        for (const line of lines) {
          for (const combo of line.combinations) {
            await tx.prepUnit.create({
              data: { combinationId: combo.id, status: PrepStatus.PENDING },
            });
          }
        }
      }

      return tx.cutoffRun.create({
        data: {
          deliveryDate: dateObj,
          draftsCancelled: draftOrders.length,
          ordersConfirmed: placedOrders.length,
        },
      });
    });

    return { alreadyProcessed: false, ...result };
  }
}
