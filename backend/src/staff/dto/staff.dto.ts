import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator';
import { StaffRole } from '@prisma/client';

export class CreateStaffDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsEnum(StaffRole)
  role: StaffRole;
}
