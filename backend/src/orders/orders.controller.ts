import { Body, Controller, Get, Post, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, AdminOverrideOrderDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StaffRole, OrderStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Staff create orders on behalf of employees (no customer-facing app).
  @Roles(StaffRole.ADMIN)
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get()
  findMany(
    @Query('deliveryDateFrom') deliveryDateFrom?: string,
    @Query('deliveryDateTo') deliveryDateTo?: string,
    @Query('status') status?: OrderStatus,
    @Query('companyId') companyId?: string,
    @Query('invoiced') invoiced?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ordersService.findMany({
      deliveryDateFrom,
      deliveryDateTo,
      status,
      companyId,
      invoiced: invoiced === undefined ? undefined : invoiced === 'true',
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Roles(StaffRole.ADMIN)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req) {
    return this.ordersService.cancel(id, req.user.role === StaffRole.ADMIN);
  }

  @Roles(StaffRole.ADMIN)
  @Patch(':id/admin-override')
  adminOverride(@Param('id') id: string, @Body() dto: AdminOverrideOrderDto) {
    return this.ordersService.adminOverride(id, dto);
  }

  // Manual trigger so a reviewer can run cut-off for a past date without
  // waiting for real time to pass (explicit requirement, 4.6).
  @Roles(StaffRole.ADMIN)
  @Post('cutoff/:deliveryDate')
  processCutoff(@Param('deliveryDate') deliveryDate: string) {
    return this.ordersService.processCutoff(deliveryDate);
  }
}
