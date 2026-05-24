import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import express from 'express';
import { verify } from 'jsonwebtoken';
import { AppModule } from './app.module';
import { LocalizedHttpExceptionFilter } from './common/filters/localized-http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use(helmet());
  const JWT_SECRET = process.env.JWT_SECRET || 'change-me-super-secret-jwt-key-at-least-32-chars';
  app.use('/uploads', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token =
      req.cookies?.['access_token'] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
    if (!token) return res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
    try {
      verify(token, JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
    }
  });
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new LocalizedHttpExceptionFilter());
  const cfg = new DocumentBuilder()
    .setTitle('UniLMS API')
    .setDescription('Unified LMS platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth')
    .addTag('Courses')
    .addTag('Assignments')
    .addTag('Attendance')
    .addTag('Materials')
    .addTag('Notifications')
    .addTag('Schedule')
    .addTag('Search')
    .addTag('Admin')
    .addTag('Activity Log')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, cfg));
  // Render / Railway / Fly inject $PORT — fall back to 4000 for local dev so
  // existing scripts and docker-compose mappings keep working.
  const port = parseInt(process.env.PORT || '4000', 10);
  const server = await app.listen(port);
  // Increase timeouts for long-running AI requests (quiz generation can take 60s+)
  server.headersTimeout = 300000; // 5 minutes
  server.requestTimeout = 300000;
  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();
