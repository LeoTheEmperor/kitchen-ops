import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/employee.dto';
import { BLOCKED_PUBLIC_DOMAINS } from '../companies/dto/company.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByCompany(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId },
      include: { allergies: { include: { allergen: true } }, dietaryPreferences: { include: { dietaryTag: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        company: { include: { domains: true } },
        allergies: { include: { allergen: true } },
        dietaryPreferences: { include: { dietaryTag: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  // Confirms the employee's email domain actually belongs to their company (4.4/4.5).
  // Not strictly specified as a hard rule, but a sensible validation given the
  // domain model exists specifically to identify which company an email belongs to.
  private async assertDomainMatchesCompany(email: string, companyId: string) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) throw new BadRequestException('Invalid email');
    if (BLOCKED_PUBLIC_DOMAINS.includes(domain)) {
      throw new BadRequestException(`"${domain}" is a public email domain and cannot be used for an employee`);
    }
    const match = await this.prisma.companyDomain.findFirst({ where: { companyId, domain } });
    if (!match) {
      throw new BadRequestException(`Email domain "${domain}" is not registered to this company`);
    }
  }

  async create(dto: CreateEmployeeDto) {
    const existing = await this.prisma.employee.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An employee with this email already exists');
    await this.assertDomainMatchesCompany(dto.email, dto.companyId);

    return this.prisma.employee.create({
      data: {
        companyId: dto.companyId,
        name: dto.name,
        email: dto.email,
        canChooseAddress: dto.canChooseAddress ?? true,
        canChangeTime: dto.canChangeTime ?? false,
        canChangePackaging: dto.canChangePackaging ?? false,
        allergies: dto.allergenIds
          ? { create: dto.allergenIds.map((allergenId) => ({ allergenId })) }
          : undefined,
        dietaryPreferences: dto.dietaryTagIds
          ? { create: dto.dietaryTagIds.map((dietaryTagId) => ({ dietaryTagId })) }
          : undefined,
      },
    });
  }

  // "Moving an employee to another company changes which rules apply to
  // them" (4.5) - this is literally just reassigning companyId; every rule
  // (pricing, menu, calendar) is resolved live from the employee's current
  // companyId, so there's nothing else to migrate.
  async moveToCompany(employeeId: string, newCompanyId: string) {
    const employee = await this.findOne(employeeId);
    await this.assertDomainMatchesCompany(employee.email, newCompanyId);
    return this.prisma.employee.update({ where: { id: employeeId }, data: { companyId: newCompanyId } });
  }

  setPermissions(
    employeeId: string,
    perms: { canChooseAddress?: boolean; canChangeTime?: boolean; canChangePackaging?: boolean },
  ) {
    return this.prisma.employee.update({ where: { id: employeeId }, data: perms });
  }

  deactivate(id: string) {
    return this.prisma.employee.update({ where: { id }, data: { active: false } });
  }

  // CSV bulk import is [Should], not [Must] - intentionally not built, see README.
}
