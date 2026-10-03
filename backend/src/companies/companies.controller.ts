import { Body, Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, AddCompanyAddressDto } from './dto/company.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StaffRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // Readable by any staff role (order creation needs company context)
  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Roles(StaffRole.ADMIN)
  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Roles(StaffRole.ADMIN)
  @Post(':id/addresses')
  addAddress(@Param('id') id: string, @Body() dto: AddCompanyAddressDto) {
    return this.companiesService.addAddress(id, dto);
  }

  @Roles(StaffRole.ADMIN)
  @Post(':id/holidays')
  addHoliday(@Param('id') id: string, @Body() dto: { date: string }) {
    return this.companiesService.addHoliday(id, dto.date);
  }

  @Roles(StaffRole.ADMIN)
  @Post(':id/owner')
  setOwner(@Param('id') id: string, @Body() dto: { employeeId: string }) {
    return this.companiesService.setOwner(id, dto.employeeId);
  }

  @Roles(StaffRole.ADMIN)
  @Post(':id/price-tier')
  setPriceTier(@Param('id') id: string, @Body() dto: { priceTierId: string }) {
    return this.companiesService.setPriceTier(id, dto.priceTierId);
  }

  @Roles(StaffRole.ADMIN)
  @Post(':id/hidden-categories/:categoryId')
  hideCategory(@Param('id') id: string, @Param('categoryId') categoryId: string) {
    return this.companiesService.hideCategory(id, categoryId);
  }
}
