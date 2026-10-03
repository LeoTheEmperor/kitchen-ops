import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StaffModule } from './staff/staff.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { PricingModule } from './pricing/pricing.module';
import { CompaniesModule } from './companies/companies.module';
import { EmployeesModule } from './employees/employees.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { BillingModule } from './billing/billing.module';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    StaffModule,
    CatalogueModule,
    PricingModule,
    CompaniesModule,
    EmployeesModule,
    MenuModule,
    OrdersModule,
    KitchenModule,
    DispatchModule,
    BillingModule,
    SettingsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
