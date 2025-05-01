import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDTO } from './dto/register.dto';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import { RefreshTokenDto } from './dto/refreshToken.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtServise: JwtService) { }

  async loginUser(dto: LoginDto) {
    // валидация
    const isEmail = dto.identifier.includes('@');

    const user = await this.prisma.users.findFirst({
      where: {
        OR: [
          isEmail
            ? { email: dto.identifier }
            : { phone: dto.identifier }
        ]
      }
    });

    if (!user) throw new UnauthorizedException("Пользователь не найден");

    const isPasswordValid = await verify(user.password, dto.password);

    if (!isPasswordValid) throw new UnauthorizedException("Неверный пароль")

    // генерация токена
    const tokens = await this.generateTokens(String(user.id))

    return {
      id: user.id,
      ...tokens,
    }
  }

  async registerUser(dto: RegisterDTO) {
    // валидация
    const oldUser = await this.prisma.users.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { phone: dto.phone }
        ]
      }
    })

    if (oldUser) throw new BadRequestException("Такой пользователь уже зарегестрирован");

    const newUser = await this.prisma.users.create({
      data: {
        email: dto.email,
        password: await hash(dto.password),
        phone: dto.phone || null,
        firstName: dto.firstName,
        lastName: dto.lastName,
        avatar: dto.avatar || null,
        organizerName: dto.organizerName,
        organizerDesc: dto.organizerDesc || null,
        organizerMedias: dto.organizerMedias ? JSON.stringify(dto.organizerMedias) : null,
      },
    });

    // генерация токена
    const tokens = await this.generateTokens(String(newUser.id))

    return {
      id: newUser.id,
      ...tokens,
    }
  }

  async generateTokens(id: string) {
    const payload = { id: id };

    const accessToken = this.jwtServise.sign({...payload, type: 'access'}, {
      expiresIn: '30s',
    });

    const refreshToken = this.jwtServise.sign({...payload, type: 'refresh'}, {
      expiresIn: '14d',
    });

    return { accessToken, refreshToken };
  }

  async getNewTokens(dto: RefreshTokenDto) {
    try {
      const payload = await this.jwtServise.verifyAsync(dto.refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Неверный тип токена');
      }

      const user = await this.prisma.users.findUnique({
        where: {
          id: +payload.id,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Пользователь не найден');
      }

      const tokens = await this.generateTokens(String(user.id));

      return {
        ...tokens,
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('RefreshToken истек');
      }
      throw new UnauthorizedException('RefreshToken не валидный');
    }
  }

}
