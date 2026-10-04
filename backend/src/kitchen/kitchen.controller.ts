import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StaffRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(StaffRole.ADMIN, StaffRole.KITCHEN)
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('board')
  getBoard(
    @Query('deliveryDate') deliveryDate: string,
    @Query('stationId') stationId?: string,
  ) {
    return this.kitchenService.getBoard(deliveryDate, stationId);
  }

  @Post('units/:id/start')
  startUnit(@Param('id') id: string) {
    return this.kitchenService.startUnit(id);
  }

  @Post('units/:id/finish')
  finishUnit(@Param('id') id: string) {
    return this.kitchenService.finishUnit(id);
  }

  @Roles(StaffRole.ADMIN)
  @Post('orders/:id/force-complete')
  forceComplete(@Param('id') id: string) {
    return this.kitchenService.forceCompleteOrder(id);
  }
}
