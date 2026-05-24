import { Module, forwardRef } from '@nestjs/common';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  // forwardRef avoids the import cycle: Notifications → Telegram → ... never
  // touches Achievements, but Nest's static analysis sometimes detects a false
  // positive when many modules share TelegramModule via @Global.
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
