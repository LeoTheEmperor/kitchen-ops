import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDishDto, UpdateDishDto, CreateOptionDto, CreateOptionGroupDto } from './dto/catalogue.dto';

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Dishes ──────────────────────────────────────────────────────────
  // Dishes are deactivated, never hard-deleted, because historical orders
  // reference them (4.1) - there is intentionally no deleteDish method.

  findAllDishes(includeInactive = false) {
    return this.prisma.dish.findMany({
      where: includeInactive ? {} : { active: true },
      include: {
        station: true,
        allergens: { include: { allergen: true } },
        dietaryTags: { include: { dietaryTag: true } },
        optionGroups: { include: { options: { include: { option: true } } } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findDish(id: string) {
    const dish = await this.prisma.dish.findUnique({
      where: { id },
      include: {
        station: true,
        allergens: { include: { allergen: true } },
        dietaryTags: { include: { dietaryTag: true } },
        optionGroups: {
          orderBy: { displayOrder: 'asc' },
          include: { options: { include: { option: true }, orderBy: { displayOrder: 'asc' } } },
        },
      },
    });
    if (!dish) throw new NotFoundException('Dish not found');
    return dish;
  }

  createDish(dto: CreateDishDto) {
    return this.prisma.dish.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        temperature: dto.temperature,
        costPrice: dto.costPrice,
        minOrderQty: dto.minOrderQty,
        stationId: dto.stationId,
        allergens: dto.allergenIds
          ? { create: dto.allergenIds.map((allergenId) => ({ allergenId })) }
          : undefined,
        dietaryTags: dto.dietaryTagIds
          ? { create: dto.dietaryTagIds.map((dietaryTagId) => ({ dietaryTagId })) }
          : undefined,
      },
    });
  }

  async updateDish(id: string, dto: UpdateDishDto) {
    await this.findDish(id); // 404s if missing
    // Replace allergen/dietary-tag join rows wholesale rather than diffing -
    // simple and correct for a catalogue that's edited by one admin at a time.
    if (dto.allergenIds) {
      await this.prisma.dishAllergen.deleteMany({ where: { dishId: id } });
    }
    if (dto.dietaryTagIds) {
      await this.prisma.dishDietaryTag.deleteMany({ where: { dishId: id } });
    }
    return this.prisma.dish.update({
      where: { id },
      data: {
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        temperature: dto.temperature,
        costPrice: dto.costPrice,
        minOrderQty: dto.minOrderQty,
        stationId: dto.stationId,
        allergens: dto.allergenIds
          ? { create: dto.allergenIds.map((allergenId) => ({ allergenId })) }
          : undefined,
        dietaryTags: dto.dietaryTagIds
          ? { create: dto.dietaryTagIds.map((dietaryTagId) => ({ dietaryTagId })) }
          : undefined,
      },
    });
  }

  deactivateDish(id: string) {
    return this.prisma.dish.update({ where: { id }, data: { active: false } });
  }

  activateDish(id: string) {
    return this.prisma.dish.update({ where: { id }, data: { active: true } });
  }

  // ── Options ─────────────────────────────────────────────────────────

  findAllOptions() {
    return this.prisma.option.findMany({
      where: { active: true },
      include: { allergens: { include: { allergen: true } }, dietaryTags: { include: { dietaryTag: true } } },
      orderBy: { name: 'asc' },
    });
  }

  createOption(dto: CreateOptionDto) {
    return this.prisma.option.create({
      data: {
        name: dto.name,
        costPrice: dto.costPrice,
        allergens: dto.allergenIds
          ? { create: dto.allergenIds.map((allergenId) => ({ allergenId })) }
          : undefined,
        dietaryTags: dto.dietaryTagIds
          ? { create: dto.dietaryTagIds.map((dietaryTagId) => ({ dietaryTagId })) }
          : undefined,
      },
    });
  }

  // ── Option groups ───────────────────────────────────────────────────
  // "Choose your protein: paneer, tofu or chickpeas" - belongs to one dish.

  async createOptionGroup(dishId: string, dto: CreateOptionGroupDto) {
    await this.findDish(dishId);
    return this.prisma.optionGroup.create({
      data: {
        dishId,
        name: dto.name,
        required: dto.required,
        displayOrder: dto.displayOrder ?? 0,
        usesPortions: dto.usesPortions ?? false,
        options: {
          create: dto.optionIds.map((optionId, index) => ({ optionId, displayOrder: index })),
        },
      },
      include: { options: { include: { option: true } } },
    });
  }

  // ── Reference data ──────────────────────────────────────────────────

  findAllergens() {
    return this.prisma.allergen.findMany({ orderBy: { name: 'asc' } });
  }

  createAllergen(name: string) {
    return this.prisma.allergen.create({ data: { name } });
  }

  findDietaryTags() {
    return this.prisma.dietaryTag.findMany({ orderBy: { name: 'asc' } });
  }

  createDietaryTag(name: string) {
    return this.prisma.dietaryTag.create({ data: { name } });
  }

  findStations() {
    return this.prisma.kitchenStation.findMany({ orderBy: { name: 'asc' } });
  }

  createStation(name: string) {
    return this.prisma.kitchenStation.create({ data: { name } });
  }

  findPortionSizes() {
    return this.prisma.portionSize.findMany({ orderBy: { order: 'asc' } });
  }

  createPortionSize(name: string, order: number) {
    return this.prisma.portionSize.create({ data: { name, order } });
  }
}
