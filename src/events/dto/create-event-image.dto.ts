import { IsString, IsInt, Min, Max } from 'class-validator';

export class EventImageDto {
  @IsString()
  imageUrl: string;

  @IsString()
  publicId: string;

  @IsInt()
  @Min(0)
  @Max(1)
  isMain: number;
}