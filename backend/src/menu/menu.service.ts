import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  findAllCategories() {
    return this.prisma.category.findMany({
      include: { items: { include: { dish: true }, orderBy: { displayOrder: 'asc' } } },
      orderBy: { displayOrder: 'asc' },
    });
  }

  createCategory(name: string, displayOrder: number, secret: boolean) {
    return this.prisma.category.create({ data: { name, displayOrder, secret } });
  }

  async addItem(categoryId: string, dishId: string, displayOrder: number) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    return this.prisma.categoryItem.create({ data: { categoryId, dishId, displayOrder } });
  }

  hideItemForCompany(categoryItemId: string, companyId: string) {
    return this.prisma.categoryItemCompanyHidden.upsert({
      where: { categoryItemId_companyId: { categoryItemId, companyId } },
      create: { categoryItemId, companyId },
      update: {},
    });
  }

  // ── The employee-facing menu preview (4.2) ─────────────────────────
  // Applies: active flags, company-level category/item hiding, "secret"
  // categories excluded from listing, and tier-based pricing (4.3) -
  // a dish/option with no price on the employee's tier is excluded
  // entirely, never shown at $0 (4.3.5).
  async getMenuForEmployee(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { company: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const tierId = await this.pricingService.resolveEmployeeTierId(employee.companyId);

    const categories = await this.prisma.category.findMany({
      where: { active: true, secret: false },
      orderBy: { displayOrder: 'asc' },
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
          include: {
            dish: {
              include: {
                allergens: { include: { allergen: true } },
                dietaryTags: { include: { dietaryTag: true } },
                optionGroups: {
                  orderBy: { displayOrder: 'asc' },
                  include: { options: { include: { option: true }, orderBy: { displayOrder: 'asc' } } },
                },
              },
            },
            hidden: { where: { companyId: employee.companyId } },
          },
        },
        hidden: { where: { companyId: employee.companyId } },
      },
    });

    const menu: Array<{ id: string; name: string; items: any[] }> = [];
    for (const category of categories) {
      if (category.hidden.length > 0) continue; // hidden for this company

      const items: any[] = [];
      for (const item of category.items) {
        if (item.hidden.length > 0) continue; // item-level hide for this company
        if (!item.dish.active) continue;

        const dishPrice = await this.pricingService.resolveDishPrice(item.dish.id, tierId);
        if (dishPrice == null) continue; // 4.3.5: no price on this tier => excluded entirely

        const optionGroups: any[] = [];
        for (const group of item.dish.optionGroups) {
          const options: any[] = [];
          for (const link of group.options) {
            if (!link.option.active) continue;
            const optionPrice = await this.pricingService.resolveOptionPrice(link.option.id, tierId);
            if (optionPrice == null) continue;
            options.push({ ...link.option, price: optionPrice });
          }
          optionGroups.push({ ...group, options });
        }

        items.push({ ...item.dish, price: dishPrice, optionGroups });
      }
      if (items.length > 0) {
        menu.push({ id: category.id, name: category.name, items });
      }
    }
    return menu;
  }
}
