import { IsString, IsEmail, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  companyId: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsBoolean()
  canChooseAddress?: boolean;

  @IsOptional()
  @IsBoolean()
  canChangeTime?: boolean;

  @IsOptional()
  @IsBoolean()
  canChangePackaging?: boolean;

  @IsOptional()
  @IsArray()
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  dietaryTagIds?: string[];
}

export class MoveEmployeeDto {
  @IsString()
  companyId: string;
}
