import {
    IsString,
    IsInt,
    IsDateString,
    MaxLength,
    Min,
    Max,
    IsArray,
    ValidateNested,
    IsOptional,
    IsNumber,
  } from 'class-validator';
  import { EventImageDto } from './create-event-image.dto';
  import { Type } from 'class-transformer';
  
  export class UpdateEventDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    title?: string;
  
    @IsOptional()
    @IsString()
    description?: string;
  
    @IsOptional()
    @IsDateString()
    startTime?: string;
  
    @IsOptional()
    @IsDateString()
    endTime?: string;

    @IsOptional()
    @IsDateString()
    eventDailys?: string;
  
    @IsOptional()
    @IsString()
    @MaxLength(150)
    location?: string;

    @IsOptional()
    @IsString()
    onlineInfo?: string;
  
    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsNumber()
    viewsEvent?: number;
  
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1)
    isPrime?: number;

    @IsOptional()
    @IsInt()
    refundDateCount?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1)
    isAutoRefund?: number;

    @IsOptional()
    @IsInt()
    categoryId?: number;
  
    @IsOptional()
    @IsInt()
    organizerId?: number;
  
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EventImageDto)
    images?: EventImageDto[];
  }
  