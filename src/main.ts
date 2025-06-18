import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: ['https://nickruden-diplom-client-373c.twc1.net',],
  });
  await app.listen(process.env.PORT || 5000);
}
bootstrap();
