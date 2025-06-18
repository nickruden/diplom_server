// Служит для защиты маршрутов ендпоинтов приложения, проверяет является ли пользователь авторизованным
// Используя Guard, Nest автоматически вызывает стратегию 

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
