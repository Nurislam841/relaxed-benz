import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { buildIcs, IcsEvent } from './ics-builder';

@Injectable()
export class CalendarExportService {
  constructor(private db: PrismaService) {}

  /**
   * Emit an iCalendar feed combining:
   *   - all schedule items (lectures/practices/labs/exams) on courses the
   *     user is enrolled in
   *   - all assignment due dates from the same courses, encoded as 30-min
   *     all-day-ish events ending at the dueAt timestamp
   *
   * The feed covers from `now - 30d` to `now + 180d` to keep file size
   * reasonable while preserving recent-past history (helps when students
   * re-subscribe and want to see what they missed).
   */
  async forUser(user: { id: string; role: Role; fullName: string }): Promise<string> {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

    const enrollments = await this.db.enrollment.findMany({
      where: { userId: user.id, deletedAt: null },
      select: { courseId: true },
    });
    const courseIds = enrollments.map((e) => e.courseId);

    // Admin gets the full institution calendar; staff/student get scoped feed.
    const scheduleWhere =
      user.role === Role.ADMIN
        ? { startsAt: { gte: from, lte: to } }
        : { courseId: { in: courseIds }, startsAt: { gte: from, lte: to } };

    const [scheduleItems, assignments] = await Promise.all([
      this.db.scheduleItem.findMany({
        where: scheduleWhere,
        include: { course: { select: { id: true, code: true, title: true } } },
        orderBy: { startsAt: 'asc' },
      }),
      user.role === Role.ADMIN
        ? this.db.assignment.findMany({
            where: { deletedAt: null, dueAt: { gte: from, lte: to } },
            include: { course: { select: { code: true, title: true } } },
            orderBy: { dueAt: 'asc' },
          })
        : this.db.assignment.findMany({
            where: { deletedAt: null, courseId: { in: courseIds }, dueAt: { gte: from, lte: to } },
            include: { course: { select: { code: true, title: true } } },
            orderBy: { dueAt: 'asc' },
          }),
    ]);

    const events: IcsEvent[] = [];

    for (const s of scheduleItems) {
      events.push({
        uid: `schedule-${s.id}@unilms`,
        start: s.startsAt,
        end: s.endsAt,
        summary: `${s.type}: ${s.course.code} — ${s.course.title}`,
        location: s.room,
        description: `${s.course.title} (${s.type})`,
      });
    }

    for (const a of assignments) {
      // Assignment due → 30-minute event ending exactly at dueAt
      const due = a.dueAt;
      const start = new Date(due.getTime() - 30 * 60 * 1000);
      events.push({
        uid: `assignment-${a.id}@unilms`,
        start,
        end: due,
        summary: `Due: ${a.title}`,
        description: `${a.course.code} ${a.course.title} — ${a.description || 'assignment due'}`,
      });
    }

    const calendarName = `UniLMS — ${user.fullName}`;
    return buildIcs(events, calendarName);
  }
}
