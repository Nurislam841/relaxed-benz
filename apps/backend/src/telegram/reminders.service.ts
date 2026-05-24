import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType, CourseRole, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Phase 3 — proactive Telegram reminders.
 *
 * Two cron jobs:
 *  1. **Class reminder** (every 5 minutes): finds ScheduleItems starting in
 *     55-65 minutes that we haven't notified about. Sends students with linked
 *     Telegram a one-line "🕐 In 1h: <course>, room X". Marks
 *     `reminderSentAt` so a slow tick or retry doesn't double-send.
 *  2. **Deadline reminders** (every hour): finds Assignments due in the next
 *     ~24h and ~1h windows, filters to students who haven't submitted, sends
 *     each a reminder. Uses AssignmentReminderLog for idempotency per-user
 *     per-kind (h24 / h1).
 *
 * Both use NotificationsService.create — so the same fan-out path that
 * powers grade notifications drives these reminders. Inline buttons (Phase
 * 1.6) make every reminder one-tap actionable.
 */
@Injectable()
export class TelegramRemindersService {
  private readonly logger = new Logger(TelegramRemindersService.name);

  constructor(
    private db: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // Suspended under Jest — these cron jobs shouldn't fire during tests.
  private get isTestEnv() {
    return !!process.env.JEST_WORKER_ID;
  }

  /**
   * Class reminders: 1-hour heads-up for upcoming lectures/labs/practices.
   * Tick every 5 minutes — we look at a 10-minute window (55-65 min ahead)
   * so even if cron is late by a couple of minutes we still hit each item.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async classReminderTick() {
    if (this.isTestEnv) return;
    const now = new Date();
    const windowStart = new Date(now.getTime() + 55 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 65 * 60 * 1000);

    const items = await this.db.scheduleItem.findMany({
      where: {
        startsAt: { gte: windowStart, lte: windowEnd },
        reminderSentAt: null,
        deletedAt: null,
      },
      include: {
        course: { select: { id: true, title: true, code: true } },
        group: { select: { id: true } },
      },
    });
    if (items.length === 0) return;

    for (const item of items) {
      try {
        // Find students who SHOULD hear about this: enrolled in the course AND
        // (if scheduled for a specific group) belong to that group.
        const enrollments = await this.db.enrollment.findMany({
          where: {
            courseId: item.courseId,
            roleInCourse: CourseRole.STUDENT,
            user: {
              telegramChatId: { not: null },
              deletedAt: null,
              ...(item.groupId ? { groupId: item.groupId } : {}),
            },
          },
          select: { userId: true },
        });

        if (enrollments.length > 0) {
          const startTime = new Date(item.startsAt);
          const hhmm = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
          const body = `${item.course?.title ?? 'Class'} — ${item.type.toLowerCase()}, room ${item.room}, starts at ${hhmm}`;
          await this.notifications.createMany(
            enrollments.map((e) => ({
              userId: e.userId,
              type: NotificationType.CLASS_REMINDER,
              title: '🕐 Class in 1 hour',
              body,
              link: '/schedule',
            })),
          );
        }

        // Mark as sent even if no one was notified — we still don't want to
        // re-scan this item next tick.
        await this.db.scheduleItem.update({
          where: { id: item.id },
          data: { reminderSentAt: new Date() },
        });
      } catch (e: any) {
        this.logger.warn(`class reminder failed for item ${item.id}: ${e?.message ?? e}`);
      }
    }
  }

  /**
   * Deadline reminders: 24h-before and 1h-before for unsubmitted assignments.
   * Tick hourly — the 24h check has a ±30min window; the 1h check has a ±15min
   * window. AssignmentReminderLog is the idempotency key per (assignment,
   * user, kind).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async deadlineReminderTick() {
    if (this.isTestEnv) return;
    const now = new Date();

    // Window definitions — overlap with the next tick is fine because the
    // unique constraint in AssignmentReminderLog prevents duplicates.
    const h24Lo = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const h24Hi = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);
    const h1Lo = new Date(now.getTime() + 45 * 60 * 1000);
    const h1Hi = new Date(now.getTime() + 75 * 60 * 1000);

    await this.processDeadlineWindow(h24Lo, h24Hi, 'h24', '⚠️ Due in 24 hours');
    await this.processDeadlineWindow(h1Lo, h1Hi, 'h1', '🚨 Due in 1 hour');
  }

  private async processDeadlineWindow(from: Date, to: Date, kind: 'h24' | 'h1', titlePrefix: string) {
    const assignments = await this.db.assignment.findMany({
      where: { dueAt: { gte: from, lte: to } },
      include: { course: { select: { id: true, title: true } } },
    });
    if (assignments.length === 0) return;

    for (const a of assignments) {
      // All students enrolled in the course who haven't submitted yet AND
      // have Telegram linked. We could remind even unlinked students via
      // the in-app inbox, but Phase 3's promise is *Telegram* reminders.
      const enrollments = await this.db.enrollment.findMany({
        where: {
          courseId: a.courseId,
          roleInCourse: CourseRole.STUDENT,
          user: { telegramChatId: { not: null }, deletedAt: null },
        },
        select: { userId: true },
      });
      if (enrollments.length === 0) continue;

      // Subtract students who already submitted, OR already received this
      // exact reminder (idempotency).
      const userIds = enrollments.map((e) => e.userId);
      const submitted = await this.db.submission.findMany({
        where: {
          assignmentId: a.id,
          studentId: { in: userIds },
          status: SubmissionStatus.SUBMITTED,
        },
        select: { studentId: true },
      });
      const submittedSet = new Set(submitted.map((s) => s.studentId));
      const alreadyReminded = await this.db.assignmentReminderLog.findMany({
        where: { assignmentId: a.id, userId: { in: userIds }, kind },
        select: { userId: true },
      });
      const remindedSet = new Set(alreadyReminded.map((r) => r.userId));
      const targets = userIds.filter((id) => !submittedSet.has(id) && !remindedSet.has(id));
      if (targets.length === 0) continue;

      const body = `${a.title} — ${a.course?.title ?? ''} — max ${a.maxScore} pts. Submit before the deadline.`;
      try {
        await this.notifications.createMany(
          targets.map((userId) => ({
            userId,
            type: NotificationType.DEADLINE_REMINDER,
            title: titlePrefix,
            body,
            link: `/courses/${a.courseId}/assignments/${a.id}`,
          })),
        );
        await this.db.assignmentReminderLog.createMany({
          data: targets.map((userId) => ({ assignmentId: a.id, userId, kind })),
          skipDuplicates: true,
        });
      } catch (e: any) {
        this.logger.warn(`deadline reminder failed for ${a.id} (${kind}): ${e?.message ?? e}`);
      }
    }
  }
}
