import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULTS = {
  CUTOFF_DAYS: '2',
  CUTOFF_TIME: '16:00',
  KITCHEN_WORKING_DAYS: '[1,2,3,4,5]',
  KITCHEN_HOLIDAYS: '[]',
  KITCHEN_TIMEZONE: 'Asia/Kolkata',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: keyof typeof DEFAULTS): Promise<string> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? DEFAULTS[key];
  }

  async set(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...DEFAULTS, ...stored };
  }

  async getCutoffDays(): Promise<number> {
    return parseInt(await this.get('CUTOFF_DAYS'), 10);
  }

  async getCutoffTime(): Promise<string> {
    return this.get('CUTOFF_TIME');
  }

  async getKitchenWorkingDays(): Promise<number[]> {
    return JSON.parse(await this.get('KITCHEN_WORKING_DAYS'));
  }

  async getKitchenHolidays(): Promise<string[]> {
    return JSON.parse(await this.get('KITCHEN_HOLIDAYS'));
  }

  async getTimezone(): Promise<string> {
    return this.get('KITCHEN_TIMEZONE');
  }
}
