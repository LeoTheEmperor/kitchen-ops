import { Body, Controller, Get, Post, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, MoveEmployeeDto } from './dto/employee.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StaffRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAllByCompany(@Query('companyId') companyId: string) {
    return this.employeesService.findAllByCompany(companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Roles(StaffRole.ADMIN)
  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Roles(StaffRole.ADMIN)
  @Patch(':id/move')
  move(@Param('id') id: string, @Body() dto: MoveEmployeeDto) {
    return this.employeesService.moveToCompany(id, dto.companyId);
  }

  @Roles(StaffRole.ADMIN)
  @Patch(':id/permissions')
  setPermissions(
    @Param('id') id: string,
    @Body() dto: { canChooseAddress?: boolean; canChangeTime?: boolean; canChangePackaging?: boolean },
  ) {
    return this.employeesService.setPermissions(id, dto);
  }

  @Roles(StaffRole.ADMIN)
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.employeesService.deactivate(id);
  }
}
