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
  salesStart: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  salesEnd: Date;

  @IsInt()
  count: number;
}
