import { IsString, MinLength, ValidateIf, IsEmail, IsPhoneNumber } from '@nestjs/class-validator';

export class LoginDto {
  @IsString()
  identifier: string;

  @IsString()
  @MinLength(6, { message: 'Пароль должен быть не менее 6 символов' })
  password: string;
}