import { IsString, IsInt, IsArray, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CombinationOptionDto {
  @IsString()
  groupId: string;

  @IsString()
  optionId: string;
}

export class CombinationDto {
  @IsInt()
  @Min(1)
  quantity: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CombinationOptionDto)
  chosenOptions: CombinationOptionDto[];
}

export class CreateOrderLineDto {
  @IsString()
  dishId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CombinationDto)
  combinations: CombinationDto[];
}

export class CreateOrderDto {
  @IsString()
  employeeId: string;

  @IsString()
  deliveryDate: string; // "YYYY-MM-DD"

  @IsOptional()
  @IsString()
  deliveryTime?: string; // "HH:mm" - defaults to company default if omitted

  @IsOptional()
  @IsString()
  addressId?: string; // defaults to employee's default/company default if omitted

  @IsOptional()
  @IsString()
  packagingType?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineDto)
  lines: CreateOrderLineDto[];

  @IsOptional()
  asDraft?: boolean;
}

export class UpdateOrderStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AdminOverrideOrderDto {
  @IsOptional()
  @IsString()
  deliveryTime?: string;

  @IsOptional()
  @IsString()
  addressId?: string;

  @IsOptional()
  @IsString()
  packagingType?: string;
}
