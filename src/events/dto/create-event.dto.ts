import { IsString, IsInt, IsDateString, MaxLength, Min, Max, IsArray, ValidateNested, IsNumber, IsOptional } from 'class-validator';
import { EventImageDto } from './create-event-image.dto';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @IsString()
  @MaxLength(100)
  title: string;

  @IsString()
  description: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsDateString()
  eventDailys: string;

  @IsString()
  @MaxLength(150)
  location: string;

  @IsString()
  onlineInfo: string;

  @IsString()
  status: string;

  @IsNumber()
  viewsEvent: number;

  @IsInt()
  @Min(0)
  @Max(1)
  isPrime: number;

  @IsInt()
  categoryId: number;

  @IsInt()
  organizerId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventImageDto)
  images: EventImageDto[];
}
