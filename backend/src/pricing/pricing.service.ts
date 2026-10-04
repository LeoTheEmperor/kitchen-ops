import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DerivationType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Tiers ───────────────────────────────────────────────────────────

  findAllTiers() {
    return this.prisma.priceTier.findMany({ orderBy: { name: 'asc' } });
  }

  async createTier(name: string, isDefault: boolean) {
    if (isDefault) {
      // Only one tier may be default at a time.
      await this.prisma.priceTier.updateMany({
        data: { isDefault: false },
        where: { isDefault: true },
      });
    }
    return this.prisma.priceTier.create({ data: { name, isDefault } });
  }

  async setDefaultTier(tierId: string) {
    await this.prisma.priceTier.updateMany({
      data: { isDefault: false },
      where: { isDefault: true },
    });
    return this.prisma.priceTier.update({
      where: { id: tierId },
      data: { isDefault: true },
    });
  }

  private async getDefaultTier() {
    const tier = await this.prisma.priceTier.findFirst({
      where: { isDefault: true },
    });
    if (!tier)
      throw new BadRequestException('No default price tier configured');
    return tier;
  }

  // ── Rounding rule (4.3.6): derived prices round UP to the next 5 cents ──
  // $2.11 -> $2.15. Done in integer cents to avoid floating-point error.
  roundUpToNickel(amount: Decimal | number): Decimal {
    const cents = new Decimal(amount).mul(100);
    const roundedCents = cents.div(5).ceil().mul(5);
    return roundedCents.div(100);
  }

  // ── Resolve a single dish's price on a tier ────────────────────────
  // Returns null if the dish has no price on this tier at all (4.3.5: must
  // not appear on the menu, not show $0).
  async resolveDishPrice(
    dishId: string,
    tierId: string,
  ): Promise<Decimal | null> {
    const row = await this.prisma.dishPrice.findUnique({
      where: { dishId_priceTierId: { dishId, priceTierId: tierId } },
    });
    if (!row) return null;
    return this.resolvePriceRow(
      row,
      async () => {
        const dish = await this.prisma.dish.findUniqueOrThrow({
          where: { id: dishId },
        });
        return dish.costPrice;
      },
      async () => {
        const defaultTier = await this.getDefaultTier();
        if (defaultTier.id === tierId) return null; // avoid infinite recursion on the default tier itself
        return this.resolveDishPrice(dishId, defaultTier.id);
      },
    );
  }

  async resolveOptionPrice(
    optionId: string,
    tierId: string,
  ): Promise<Decimal | null> {
    const row = await this.prisma.optionPrice.findUnique({
      where: { optionId_priceTierId: { optionId, priceTierId: tierId } },
    });
    if (!row) return null;
    return this.resolvePriceRow(
      row,
      async () => {
        const option = await this.prisma.option.findUniqueOrThrow({
          where: { id: optionId },
        });
        return option.costPrice;
      },
      async () => {
        const defaultTier = await this.getDefaultTier();
        if (defaultTier.id === tierId) return null;
        return this.resolveOptionPrice(optionId, defaultTier.id);
      },
    );
  }

  // Shared resolution logic for both DishPrice and OptionPrice rows (4.3.6):
  // - NONE: use explicitPrice as-is (staff override or plain fixed price)
  // - COST_MULTIPLIER: costPrice * derivationValue, then round up to nickel
  // - MARKUP_PERCENT: (price on default tier) * (1 + value/100), then round up
  // In every derived case, an explicitPrice if also set acts as a staff override
  // that wins over the formula (4.3.6: "staff can still override individual prices").
  private async resolvePriceRow(
    row: {
      explicitPrice: Decimal | null;
      derivation: DerivationType;
      derivationValue: Decimal | null;
    },
    getCostPrice: () => Promise<Decimal>,
    getDefaultTierPrice: () => Promise<Decimal | null>,
  ): Promise<Decimal | null> {
    if (row.derivation === DerivationType.NONE) {
      return row.explicitPrice ?? null;
    }
    if (row.explicitPrice != null) {
      // Staff override takes precedence even on a derived tier.
      return row.explicitPrice;
    }
    if (!row.derivationValue) return null;

    if (row.derivation === DerivationType.COST_MULTIPLIER) {
      const cost = await getCostPrice();
      return this.roundUpToNickel(cost.mul(row.derivationValue));
    }
    if (row.derivation === DerivationType.MARKUP_PERCENT) {
      const basePrice = await getDefaultTierPrice();
      if (basePrice == null) return null; // nothing to mark up from
      const markedUp = basePrice.mul(
        new Decimal(1).add(row.derivationValue.div(100)),
      );
      return this.roundUpToNickel(markedUp);
    }
    return null;
  }

  // ── Admin tier editing view (4.3.7): see/edit a whole tier, spot gaps ──
  async getTierSheet(tierId: string) {
    const [dishes, dishPrices] = await Promise.all([
      this.prisma.dish.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.dishPrice.findMany({ where: { priceTierId: tierId } }),
    ]);
    const priceByDish = new Map(dishPrices.map((p) => [p.dishId, p]));

    const rows = await Promise.all(
      dishes.map(async (dish) => {
        const resolved = await this.resolveDishPrice(dish.id, tierId);
        return {
          dishId: dish.id,
          dishName: dish.name,
          sku: dish.sku,
          costPrice: dish.costPrice,
          row: priceByDish.get(dish.id) ?? null,
          resolvedPrice: resolved, // null => gap: no price on this tier
        };
      }),
    );
    return rows;
  }

  async upsertDishPrice(
    dishId: string,
    tierId: string,
    data: {
      explicitPrice?: number;
      derivation?: DerivationType;
      derivationValue?: number;
    },
  ) {
    return this.prisma.dishPrice.upsert({
      where: { dishId_priceTierId: { dishId, priceTierId: tierId } },
      create: {
        dishId,
        priceTierId: tierId,
        explicitPrice: data.explicitPrice,
        derivation: data.derivation ?? DerivationType.NONE,
        derivationValue: data.derivationValue,
      },
      update: {
        explicitPrice: data.explicitPrice,
        derivation: data.derivation,
        derivationValue: data.derivationValue,
      },
    });
  }

  async upsertOptionPrice(
    optionId: string,
    tierId: string,
    data: {
      explicitPrice?: number;
      derivation?: DerivationType;
      derivationValue?: number;
    },
  ) {
    return this.prisma.optionPrice.upsert({
      where: { optionId_priceTierId: { optionId, priceTierId: tierId } },
      create: {
        optionId,
        priceTierId: tierId,
        explicitPrice: data.explicitPrice,
        derivation: data.derivation ?? DerivationType.NONE,
        derivationValue: data.derivationValue,
      },
      update: {
        explicitPrice: data.explicitPrice,
        derivation: data.derivation,
        derivationValue: data.derivationValue,
      },
    });
  }

  // ── Resolve the tier an employee actually prices against (4.3.4) ──────
  async resolveEmployeeTierId(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });
    if (company.priceTierId) return company.priceTierId;
    const defaultTier = await this.getDefaultTier();
    return defaultTier.id;
  }
}
