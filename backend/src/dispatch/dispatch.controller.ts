import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StaffRole, DeliveryStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Roles(StaffRole.ADMIN, StaffRole.DISPATCH)
  @Get('board')
  getBoard(@Query('deliveryDate') deliveryDate: string) {
    return this.dispatchService.getBoard(deliveryDate);
  }

  @Roles(StaffRole.ADMIN, StaffRole.DISPATCH)
  @Post('drops/assign-driver')
  assignDriver(
    @Body()
    dto: {
      companyId: string;
      addressId: string;
      deliveryTime: string;
      driverId: string;
    },
  ) {
    return this.dispatchService.assignDriverToDrop(
      dto.companyId,
      dto.addressId,
      dto.deliveryTime,
      dto.driverId,
    );
  }

  @Roles(StaffRole.ADMIN, StaffRole.DISPATCH)
  @Post('deliveries/:id/advance')
  advance(@Param('id') id: string, @Body() dto: { status: DeliveryStatus }) {
    return this.dispatchService.advanceStatus(id, dto.status);
  }

  // Driver-only: their own deliveries for a given date (defaults to today
  // if not specified on the frontend, but date is required here so "today"
  // is unambiguous regardless of server/browser timezone - see README).
  @Roles(StaffRole.DRIVER)
  @Get('my-deliveries')
  myDeliveries(@Request() req, @Query('date') date: string) {
    return this.dispatchService.getDriverDeliveries(req.user.userId, date);
  }

  @Roles(StaffRole.DRIVER)
  @Post('deliveries/:id/mark-delivered')
  markDelivered(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: { note?: string },
  ) {
    return this.dispatchService.markDelivered(id, req.user.userId, dto.note);
  }
}
