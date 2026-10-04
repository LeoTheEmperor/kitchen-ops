import { IsString, IsOptional, IsInt, IsArray, Min } from 'class-validator';

const BLOCKED_PUBLIC_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'mail.com',
];
export { BLOCKED_PUBLIC_DOMAINS };

export class CreateCompanyDto {
  @IsString()
  name: string;

  @IsArray()
  domains: string[]; // e.g. ["acme.com"]

  @IsOptional()
  @IsString()
  priceTierId?: string;

  @IsOptional()
  @IsString()
  defaultDeliveryTime?: string; // "HH:mm"

  @IsOptional()
  @IsInt()
  @Min(0)
  dispatchLeadMinutes?: number;

  @IsOptional()
  @IsString()
  defaultPackagingType?: string;

  @IsOptional()
  @IsString()
  driverInstructions?: string;

  @IsOptional()
  @IsString()
  defaultDriverId?: string;

  @IsOptional()
  @IsArray()
  workingDays?: number[]; // 0=Sun..6=Sat
}

export class AddCompanyAddressDto {
  @IsString()
  label: string;

  @IsString()
  line1: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class AddCompanyHolidayDto {
  @IsString()
  date: string; // "YYYY-MM-DD"
}
