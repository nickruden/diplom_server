import { IsEmail, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateGoodUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  organizerName?: string;

  @IsOptional()
  @IsString()
  organizerDesc?: string;

  @IsOptional()
  @IsString()
  organizerMedias?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
