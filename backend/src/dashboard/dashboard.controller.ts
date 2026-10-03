import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StaffRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles(StaffRole.ADMIN)
  @Get('admin')
  getAdmin() {
    return this.dashboardService.getAdminDashboard();
  }

  @Roles(StaffRole.ADMIN, StaffRole.KITCHEN)
  @Get('kitchen')
  getKitchen() {
    return this.dashboardService.getKitchenDashboard();
  }

  @Roles(StaffRole.ADMIN, StaffRole.DISPATCH)
  @Get('dispatch')
  getDispatch() {
    return this.dashboardService.getDispatchDashboard();
  }

  @Roles(StaffRole.DRIVER)
  @Get('driver')
  getDriver(@Request() req) {
    return this.dashboardService.getDriverDashboard(req.user.userId);
  }
}
