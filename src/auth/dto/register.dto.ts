import { IsEmail, IsString, IsOptional, MinLength } from '@nestjs/class-validator';

export class RegisterDTO {
    @IsEmail({}, { message: 'Некорректный email' })
    email: string;

    @IsString()
    @MinLength(6, { message: 'Пароль должен быть не менее 6 символов' })
    password: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsString()
    firstName: string;

    @IsString()
    lastName: string;

    @IsOptional()
    @IsString()
    avatar?: string;

    @IsString()
    organizerName: string;

    @IsOptional()
    @IsString()
    organizerDesc?: string;

    @IsOptional()
    organizerMedias?: string;
}