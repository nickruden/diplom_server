import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from 'src/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleAsuncOptions } from 'src/config/jwt.config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from 'src/config/jwt.strategy';
import { JwtAuthGuard } from 'src/config/jwt-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrismaService, JwtStrategy, JwtAuthGuard],
  imports: [JwtModule.registerAsync(jwtModuleAsuncOptions()), PassportModule],
})
export class AuthModule { }
