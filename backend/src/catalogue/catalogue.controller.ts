import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CatalogueService } from './catalogue.service';
import {
  CreateDishDto,
  UpdateDishDto,
  CreateOptionDto,
  CreateOptionGroupDto,
} from './dto/catalogue.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StaffRole } from '@prisma/client';

// Catalogue editing is ADMIN-only. Reads are open to any authenticated staff
// (kitchen/dispatch may need to look up dish details), writes are gated below.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('catalogue')
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Get('dishes')
  findAllDishes(@Query('includeInactive') includeInactive?: string) {
    return this.catalogueService.findAllDishes(includeInactive === 'true');
  }

  @Get('dishes/:id')
  findDish(@Param('id') id: string) {
    return this.catalogueService.findDish(id);
  }

  @Roles(StaffRole.ADMIN)
  @Post('dishes')
  createDish(@Body() dto: CreateDishDto) {
    return this.catalogueService.createDish(dto);
  }

  @Roles(StaffRole.ADMIN)
  @Patch('dishes/:id')
  updateDish(@Param('id') id: string, @Body() dto: UpdateDishDto) {
    return this.catalogueService.updateDish(id, dto);
  }

  @Roles(StaffRole.ADMIN)
  @Patch('dishes/:id/deactivate')
  deactivateDish(@Param('id') id: string) {
    return this.catalogueService.deactivateDish(id);
  }

  @Roles(StaffRole.ADMIN)
  @Patch('dishes/:id/activate')
  activateDish(@Param('id') id: string) {
    return this.catalogueService.activateDish(id);
  }

  @Get('options')
  findAllOptions() {
    return this.catalogueService.findAllOptions();
  }

  @Roles(StaffRole.ADMIN)
  @Post('options')
  createOption(@Body() dto: CreateOptionDto) {
    return this.catalogueService.createOption(dto);
  }

  @Roles(StaffRole.ADMIN)
  @Post('dishes/:dishId/option-groups')
  createOptionGroup(
    @Param('dishId') dishId: string,
    @Body() dto: CreateOptionGroupDto,
  ) {
    return this.catalogueService.createOptionGroup(dishId, dto);
  }

  // Reference data
  @Get('allergens')
  findAllergens() {
    return this.catalogueService.findAllergens();
  }

  @Roles(StaffRole.ADMIN)
  @Post('allergens')
  createAllergen(@Body() dto: { name: string }) {
    return this.catalogueService.createAllergen(dto.name);
  }

  @Get('dietary-tags')
  findDietaryTags() {
    return this.catalogueService.findDietaryTags();
  }

  @Roles(StaffRole.ADMIN)
  @Post('dietary-tags')
  createDietaryTag(@Body() dto: { name: string }) {
    return this.catalogueService.createDietaryTag(dto.name);
  }

  @Get('stations')
  findStations() {
    return this.catalogueService.findStations();
  }

  @Roles(StaffRole.ADMIN)
  @Post('stations')
  createStation(@Body() dto: { name: string }) {
    return this.catalogueService.createStation(dto.name);
  }

  @Get('portion-sizes')
  findPortionSizes() {
    return this.catalogueService.findPortionSizes();
  }

  @Roles(StaffRole.ADMIN)
  @Post('portion-sizes')
  createPortionSize(@Body() dto: { name: string; order: number }) {
    return this.catalogueService.createPortionSize(dto.name, dto.order);
  }
}
