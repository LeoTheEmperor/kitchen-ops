import { Body, Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StaffRole, DerivationType } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(StaffRole.ADMIN)
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('tiers')
  findAllTiers() {
    return this.pricingService.findAllTiers();
  }

  @Post('tiers')
  createTier(@Body() dto: { name: string; isDefault?: boolean }) {
    return this.pricingService.createTier(dto.name, dto.isDefault ?? false);
  }

  @Post('tiers/:id/set-default')
  setDefault(@Param('id') id: string) {
    return this.pricingService.setDefaultTier(id);
  }

  // The "fast way to see and edit a whole tier, and spot gaps" (4.3.7)
  @Get('tiers/:id/sheet')
  getTierSheet(@Param('id') id: string) {
    return this.pricingService.getTierSheet(id);
  }

  @Post('tiers/:tierId/dishes/:dishId')
  upsertDishPrice(
    @Param('tierId') tierId: string,
    @Param('dishId') dishId: string,
    @Body() dto: { explicitPrice?: number; derivation?: DerivationType; derivationValue?: number },
  ) {
    return this.pricingService.upsertDishPrice(dishId, tierId, dto);
  }

  @Post('tiers/:tierId/options/:optionId')
  upsertOptionPrice(
    @Param('tierId') tierId: string,
    @Param('optionId') optionId: string,
    @Body() dto: { explicitPrice?: number; derivation?: DerivationType; derivationValue?: number },
  ) {
    return this.pricingService.upsertOptionPrice(optionId, tierId, dto);
  }
}
