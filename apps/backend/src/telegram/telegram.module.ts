import { Module, Global, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramUpdatesService } from './telegram-updates.service';
import { QuizBroadcastService } from './quiz-broadcast.service';
import { TelegramRemindersService } from './reminders.service';
import { ScheduleModule } from '../schedule/schedule.module';
import { GradesModule } from '../grades/grades.module';
import { AiModule } from '../ai/ai.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { KahootModule } from '../kahoot/kahoot.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * @Global so any module (NotificationsService, KahootGateway, cron reminders)
 * can inject TelegramService without re-importing.
 *
 * The forwardRef chain is intentional — TelegramUpdatesService needs to call
 * AiService / AssignmentsService / KahootService which themselves participate
 * in dependency chains. Wrapping with forwardRef keeps the graph acyclic at
 * module-init time.
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      // Same default secret as the main auth module — link-tokens are signed
      // with TELEGRAM_LINK_SECRET if set, else fall back to JWT_SECRET so
      // we don't crash on missing env.
      secret: process.env.TELEGRAM_LINK_SECRET || process.env.JWT_SECRET || 'change-me',
    }),
    forwardRef(() => ScheduleModule),
    forwardRef(() => GradesModule),
    forwardRef(() => AiModule),
    forwardRef(() => AssignmentsModule),
    forwardRef(() => KahootModule),
    forwardRef(() => NotificationsModule),
    ActivityLogModule,
  ],
  controllers: [TelegramController, TelegramWebhookController],
  providers: [TelegramService, TelegramUpdatesService, QuizBroadcastService, TelegramRemindersService],
  exports: [TelegramService, QuizBroadcastService],
})
export class TelegramModule {}
