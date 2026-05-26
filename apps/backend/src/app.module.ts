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
import { PlagiarismModule } from './plagiarism/plagiarism.module';
import { HealthModule } from './health/health.module';
import { TwoFactorModule } from './two-factor/two-factor.module';
import { TelegramModule } from './telegram/telegram.module';
import { StorageModule } from './storage/storage.module';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

// Jest sets JEST_WORKER_ID automatically. Under tests we raise the throttle
// ceiling massively so chained register/login calls across 12 spec files
// don't hit per-route limits (which would mask real failures with 429s).
const TEST_MODE = !!process.env.JEST_WORKER_ID;

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: TEST_MODE ? 10000 : 100 }]),
    NestScheduleModule.forRoot(), // @nestjs/schedule — for cron-based Telegram reminders (Phase 3)
    StorageModule, // @Global — disk/S3 file storage, used by uploads + Telegram photo submissions
    TelegramModule, // @Global — must be imported once at root
    PrismaModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    CoursesModule,
    EnrollmentsModule,
    AnnouncementsModule,
    AssignmentsModule,
    GradesModule,
    ScheduleModule,
    NotificationsModule,
    MaterialsModule,
    AttendanceModule,
    SearchModule,
    ActivityLogModule,
    AdminModule,
    MailModule,
    AiModule,
    QuizModule,
    KahootModule,
    PlagiarismModule,
    HealthModule,
    TwoFactorModule,
  ],
  providers: [
    // Skip rate-limiting entirely under Jest. Per-route @Throttle() decorators
    // (5/min on login, 3/min on register, etc.) would otherwise cap chained
    // beforeAll setups across spec files that share an IP.
    ...(TEST_MODE ? [] : [{ provide: APP_GUARD, useClass: ThrottlerGuard }]),
  ],
})
export class AppModule {}
