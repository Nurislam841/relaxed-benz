import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { CoursesModule } from './courses/courses.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { GradesModule } from './grades/grades.module';
import { ScheduleModule } from './schedule/schedule.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MaterialsModule } from './materials/materials.module';
import { AttendanceModule } from './attendance/attendance.module';
import { SearchModule } from './search/search.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { AdminModule } from './admin/admin.module';
import { MailModule } from './mail/mail.module';
import { AiModule } from './ai/ai.module';
import { QuizModule } from './quiz/quiz.module';
import { KahootModule } from './kahoot/kahoot.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule, AuthModule, UsersModule, GroupsModule, CoursesModule,
    EnrollmentsModule, AnnouncementsModule, AssignmentsModule, GradesModule,
    ScheduleModule, NotificationsModule, MaterialsModule, AttendanceModule,
    SearchModule, ActivityLogModule, AdminModule, MailModule, AiModule,
    QuizModule, KahootModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
