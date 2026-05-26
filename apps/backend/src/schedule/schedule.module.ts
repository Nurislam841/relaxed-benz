import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
// Exporting ScheduleService so other modules (TelegramUpdatesService for the
// /today and /schedule bot commands, RemindersService for the 1h-before-class
// cron) can inject it without re-providing.
@Module({
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
