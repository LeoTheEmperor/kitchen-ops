import { Body, Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StaffRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(StaffRole.ADMIN)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('companies/:companyId/uninvoiced-orders')
  getUninvoiced(@Param('companyId') companyId: string) {
    return this.billingService.getUninvoicedOrders(companyId);
  }

  @Post('invoices')
  createInvoice(@Body() dto: { companyId: string; orderIds: string[] }) {
    return this.billingService.createInvoice(dto.companyId, dto.orderIds);
  }

  @Post('invoices/:id/mark-paid')
  markPaid(@Param('id') id: string) {
    return this.billingService.markPaid(id);
  }

  @Get('companies/:companyId/invoices')
  findByCompany(@Param('companyId') companyId: string) {
    return this.billingService.findByCompany(companyId);
  }

  @Get('invoices/:id')
  findOne(@Param('id') id: string) {
    return this.billingService.findOne(id);
  }
}
