import { IsInt, IsOptional, IsString, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTicketDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  price: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  salesStart?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  salesEnd?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validTo?: Date;

  @IsOptional()
  @IsInt()
  refundDateCount?: number;

  @IsInt()
  count: number;
}
