// Стратегия извлекает из заголовка авторизации fromAuthHeaderAsBearerToken - Bearer, где лежит токен, токен декодируется и если всё нормально, вызывается validate, внутри которого проверяем есть ли такой пользователь

import { ExtractJwt, Strategy, StrategyOptionsWithoutRequest } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService, private readonly prisma: PrismaService) {

    super(<StrategyOptionsWithoutRequest>{
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.users.findUnique({
      where: {
        id: +payload.id,
      }
    })

    if (!user) throw new UnauthorizedException("Не залогинен");

    return user
  }
}
