import { Body, Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StaffRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('categories')
  findAllCategories() {
    return this.menuService.findAllCategories();
  }

  @Roles(StaffRole.ADMIN)
  @Post('categories')
  createCategory(@Body() dto: { name: string; displayOrder?: number; secret?: boolean }) {
    return this.menuService.createCategory(dto.name, dto.displayOrder ?? 0, dto.secret ?? false);
  }

  @Roles(StaffRole.ADMIN)
  @Post('categories/:categoryId/items')
  addItem(@Param('categoryId') categoryId: string, @Body() dto: { dishId: string; displayOrder?: number }) {
    return this.menuService.addItem(categoryId, dto.dishId, dto.displayOrder ?? 0);
  }

  @Roles(StaffRole.ADMIN)
  @Post('items/:categoryItemId/hide/:companyId')
  hideItemForCompany(@Param('categoryItemId') categoryItemId: string, @Param('companyId') companyId: string) {
    return this.menuService.hideItemForCompany(categoryItemId, companyId);
  }

  // Staff preview of exactly what an employee would see (4.2) - any staff role may need this.
  @Get('preview/:employeeId')
  previewForEmployee(@Param('employeeId') employeeId: string) {
    return this.menuService.getMenuForEmployee(employeeId);
  }
}
