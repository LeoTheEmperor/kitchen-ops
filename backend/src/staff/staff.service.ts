import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.staff.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.staff.findUnique({ where: { id } });
  }

  findAll() {
    return this.prisma.staff.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
  }

  async create(email: string, password: string, name: string, role: StaffRole) {
    const hashed = await bcrypt.hash(password, 10);
    return this.prisma.staff.create({
      data: { email, password: hashed, name, role },
    });
  }

  setActive(id: string, active: boolean) {
    return this.prisma.staff.update({ where: { id }, data: { active } });
  }
}
