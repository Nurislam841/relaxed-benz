import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { KahootController } from './kahoot.controller';
import { KahootService } from './kahoot.service';
import { KahootGateway } from './kahoot.gateway';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    ActivityLogModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change-me-super-secret-jwt-key-at-least-32-chars',
    }),
  ],
  controllers: [KahootController],
  providers: [KahootService, KahootGateway],
})
export class KahootModule {}
