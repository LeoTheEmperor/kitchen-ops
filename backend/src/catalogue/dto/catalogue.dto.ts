import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsInt, Min, IsArray } from 'class-validator';
import { Temperature } from '@prisma/client';

export class CreateDishDto {
  @IsString()
  sku: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsEnum(Temperature)
  temperature: Temperature;

  @IsNumber()
  @Min(0)
  costPrice: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minOrderQty?: number;

  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsArray()
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  dietaryTagIds?: string[];
}

export class UpdateDishDto extends CreateDishDto {}

export class CreateOptionDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  costPrice: number;

  @IsOptional()
  @IsArray()
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  dietaryTagIds?: string[];
}

export class CreateOptionGroupDto {
  @IsString()
  name: string;

  @IsBoolean()
  required: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  usesPortions?: boolean;

  @IsArray()
  optionIds: string[]; // in display order
}
