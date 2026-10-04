import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCompanyDto,
  AddCompanyAddressDto,
  BLOCKED_PUBLIC_DOMAINS,
} from './dto/company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany({
      include: { domains: true, priceTier: true, addresses: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        domains: true,
        addresses: true,
        holidays: true,
        priceTier: true,
        defaultDriver: true,
        employees: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  // Validates domain rules (4.4): no public domains, no domain shared across
  // companies. Checked here, at the service layer, not just in a form.
  private async validateDomains(domains: string[], excludeCompanyId?: string) {
    for (const domain of domains) {
      const normalized = domain.toLowerCase().trim();
      if (BLOCKED_PUBLIC_DOMAINS.includes(normalized)) {
        throw new BadRequestException(
          `"${normalized}" is a public email domain and cannot be used for a company`,
        );
      }
      const existing = await this.prisma.companyDomain.findUnique({
        where: { domain: normalized },
      });
      if (existing && existing.companyId !== excludeCompanyId) {
        throw new ConflictException(
          `Domain "${normalized}" is already claimed by another company`,
        );
      }
    }
  }

  async create(dto: CreateCompanyDto) {
    await this.validateDomains(dto.domains);
    return this.prisma.company.create({
      data: {
        name: dto.name,
        priceTierId: dto.priceTierId,
        defaultDeliveryTime: dto.defaultDeliveryTime,
        dispatchLeadMinutes: dto.dispatchLeadMinutes ?? 60,
        defaultPackagingType: dto.defaultPackagingType,
        driverInstructions: dto.driverInstructions,
        defaultDriverId: dto.defaultDriverId,
        workingDays: dto.workingDays ?? [1, 2, 3, 4, 5],
        domains: {
          create: dto.domains.map((domain) => ({
            domain: domain.toLowerCase().trim(),
          })),
        },
      },
    });
  }

  async addAddress(companyId: string, dto: AddCompanyAddressDto) {
    await this.findOne(companyId);
    return this.prisma.companyAddress.create({ data: { companyId, ...dto } });
  }

  async addHoliday(companyId: string, date: string) {
    await this.findOne(companyId);
    return this.prisma.companyHoliday.create({
      data: { companyId, date: new Date(date) },
    });
  }

  async setOwner(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee || employee.companyId !== companyId) {
      throw new BadRequestException(
        'Owner must be an employee of this company',
      );
    }
    return this.prisma.company.update({
      where: { id: companyId },
      data: { ownerEmployeeId: employeeId },
    });
  }

  async setPriceTier(companyId: string, priceTierId: string) {
    await this.findOne(companyId);
    return this.prisma.company.update({
      where: { id: companyId },
      data: { priceTierId },
    });
  }

  async hideCategory(companyId: string, categoryId: string) {
    return this.prisma.categoryCompanyHidden.upsert({
      where: { categoryId_companyId: { categoryId, companyId } },
      create: { categoryId, companyId },
      update: {},
    });
  }

  async unhideCategory(companyId: string, categoryId: string) {
    return this.prisma.categoryCompanyHidden.deleteMany({
      where: { categoryId, companyId },
    });
  }

  // Working-day / holiday check used by order creation (4.4: "can't receive
  // deliveries on non-working days or holidays").
  async isDeliverableDate(companyId: string, date: Date): Promise<boolean> {
    const company = await this.findOne(companyId);
    const workingDays = company.workingDays as number[];
    const dayOfWeek = date.getUTCDay();
    if (!workingDays.includes(dayOfWeek)) return false;

    const dateStr = date.toISOString().slice(0, 10);
    const isHoliday = company.holidays.some(
      (h) => h.date.toISOString().slice(0, 10) === dateStr,
    );
    return !isHoliday;
  }
}
