import { Module } from '@nestjs/common';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [ActivityLogModule, AchievementsModule],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
