import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, NotificationType } from '@prisma/client';
import { ACHIEVEMENT_CATALOG, AchievementDef, getAchievementDef } from './achievements.catalog';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    private db: PrismaService,
    /**
     * Optional so legacy callers (and isolated unit tests) can construct
     * AchievementsService without the notifications module wired up. In the
     * real app NotificationsModule is loaded into AchievementsModule's
     * imports, so this is always injected at runtime.
     */
    @Optional() private notifications?: NotificationsService,
  ) {}

  /**
   * Recompute and grant any newly-earned achievements for `userId`.
   * Idempotent: existing grants are kept, new ones are inserted, nothing is
   * revoked (achievements are append-only by design — a student who scored
   * 100% once doesn't lose the badge later).
   *
   * Call this on user-triggered events:
   *   - after login (lightweight)
   *   - after submit, grade, quiz attempt, attendance mark
   *
   * Returns the keys of newly-granted achievements so callers can show a
   * "🏆 unlocked!" toast.
   */
  async recomputeForUser(userId: string): Promise<string[]> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) return [];

    const existing = await this.db.userAchievement.findMany({
      where: { userId },
      select: { achievementKey: true },
    });
    const alreadyEarned = new Set(existing.map((r) => r.achievementKey));

    const candidates: AchievementDef[] = ACHIEVEMENT_CATALOG.filter((a) => {
      const allowedRoles = a.roles ?? [Role.STUDENT];
      return allowedRoles.includes(user.role) && !alreadyEarned.has(a.key);
    });

    if (candidates.length === 0) return [];

    const newlyGranted: { key: string; metadata: Record<string, unknown> | null }[] = [];

    for (const c of candidates) {
      const result = await this.evaluate(c.key, userId, user.role);
      if (result.earned) {
        newlyGranted.push({ key: c.key, metadata: result.metadata });
      }
    }

    if (newlyGranted.length === 0) return [];

    await this.db.userAchievement.createMany({
      data: newlyGranted.map((g) => ({
        userId,
        achievementKey: g.key,
        metadata: g.metadata as any,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Granted ${newlyGranted.length} achievement(s) to ${userId}: ${newlyGranted.map((g) => g.key).join(', ')}`,
    );

    // Fire an in-app + Telegram notification per badge. Async / silent
    // failure — badges are an add-on, never block grading or quiz flow.
    if (this.notifications) {
      for (const g of newlyGranted) {
        const def = getAchievementDef(g.key);
        if (!def) continue;
        this.notifications
          .create({
            userId,
            type: NotificationType.ACHIEVEMENT,
            title: `🏆 Badge unlocked: ${def.title}`,
            body: def.description,
            link: '/achievements',
          })
          .catch(() => {
            // already best-effort inside fanOutToTelegram; just don't crash
          });
      }
    }

    return newlyGranted.map((g) => g.key);
  }

  /**
   * Evaluate a single achievement against current user state.
   *
   * Each branch runs a focused, indexed query — no joins more expensive
   * than what an enrollment lookup already costs in the rest of the app.
   */
  private async evaluate(
    key: string,
    userId: string,
    role: Role,
  ): Promise<{ earned: boolean; metadata: Record<string, unknown> | null }> {
    switch (key) {
      case 'first_steps':
        // Just having a User row is enough — granted on first recompute call.
        return { earned: true, metadata: null };

      case 'first_submission': {
        const count = await this.db.submission.count({
          where: { studentId: userId, status: 'SUBMITTED' },
        });
        return { earned: count >= 1, metadata: count >= 1 ? { count } : null };
      }

      case 'five_submissions': {
        const count = await this.db.submission.count({
          where: { studentId: userId, status: 'SUBMITTED' },
        });
        return { earned: count >= 5, metadata: count >= 5 ? { count } : null };
      }

      case 'perfect_score': {
        const grade = await this.db.grade.findFirst({
          where: {
            submission: { studentId: userId },
            // score >= assignment.maxScore — needs raw because Prisma can't
            // compare two fields in a where; fall back to fetching candidates.
          },
          include: { submission: { include: { assignment: { select: { maxScore: true, title: true } } } } },
          orderBy: { gradedAt: 'desc' },
        });
        if (!grade) return { earned: false, metadata: null };
        // Inspect a small batch of recent grades to find any 100%
        const recent = await this.db.grade.findMany({
          where: { submission: { studentId: userId } },
          include: { submission: { include: { assignment: { select: { maxScore: true, title: true } } } } },
          orderBy: { gradedAt: 'desc' },
          take: 50,
        });
        const perfect = recent.find((g) => g.score >= g.submission.assignment.maxScore);
        if (!perfect) return { earned: false, metadata: null };
        return {
          earned: true,
          metadata: { score: perfect.score, assignmentTitle: perfect.submission.assignment.title },
        };
      }

      case 'three_perfect_scores': {
        const recent = await this.db.grade.findMany({
          where: { submission: { studentId: userId } },
          include: { submission: { include: { assignment: { select: { maxScore: true } } } } },
          take: 200,
        });
        const perfectCount = recent.filter((g) => g.score >= g.submission.assignment.maxScore).length;
        return {
          earned: perfectCount >= 3,
          metadata: perfectCount >= 3 ? { perfectCount } : null,
        };
      }

      case 'first_quiz': {
        const count = await this.db.quizAttempt.count({
          where: { studentId: userId, completedAt: { not: null } },
        });
        return { earned: count >= 1, metadata: count >= 1 ? { count } : null };
      }

      case 'five_quizzes': {
        const count = await this.db.quizAttempt.count({
          where: { studentId: userId, completedAt: { not: null } },
        });
        return { earned: count >= 5, metadata: count >= 5 ? { count } : null };
      }

      case 'quiz_perfect': {
        const recent = await this.db.quizAttempt.findMany({
          where: { studentId: userId, completedAt: { not: null }, totalPoints: { gt: 0 } },
          orderBy: { completedAt: 'desc' },
          take: 100,
        });
        const perfect = recent.find((a) => a.totalPoints > 0 && a.score === a.totalPoints);
        if (!perfect) return { earned: false, metadata: null };
        return {
          earned: true,
          metadata: { quizId: perfect.quizId, score: perfect.score },
        };
      }

      case 'attendance_streak_5': {
        const records = await this.db.attendance.findMany({
          where: { studentId: userId },
          orderBy: { date: 'desc' },
          take: 30,
        });
        // Walk back from most recent — find longest PRESENT run
        let bestStreak = 0;
        let currentStreak = 0;
        for (const r of records) {
          if (r.status === 'PRESENT') {
            currentStreak++;
            bestStreak = Math.max(bestStreak, currentStreak);
          } else {
            currentStreak = 0;
          }
        }
        return {
          earned: bestStreak >= 5,
          metadata: bestStreak >= 5 ? { streak: bestStreak } : null,
        };
      }

      case 'perfect_attendance_course': {
        // For each course the student is in, count their attendance records;
        // if ≥5 records and all are PRESENT, the badge is earned.
        const enrollments = await this.db.enrollment.findMany({
          where: { userId, deletedAt: null },
          select: { courseId: true, course: { select: { title: true } } },
        });
        for (const e of enrollments) {
          const records = await this.db.attendance.findMany({
            where: { studentId: userId, courseId: e.courseId },
          });
          if (records.length >= 5 && records.every((r) => r.status === 'PRESENT')) {
            return {
              earned: true,
              metadata: { courseTitle: e.course.title, sessions: records.length },
            };
          }
        }
        return { earned: false, metadata: null };
      }

      case 'teacher_first_quiz_created': {
        if (role !== Role.TEACHER && role !== Role.ADMIN) {
          return { earned: false, metadata: null };
        }
        const count = await this.db.quiz.count({ where: { createdById: userId, deletedAt: null } });
        return { earned: count >= 1, metadata: count >= 1 ? { count } : null };
      }

      case 'teacher_active_grader': {
        if (role !== Role.TEACHER && role !== Role.ADMIN) {
          return { earned: false, metadata: null };
        }
        const count = await this.db.grade.count({ where: { gradedById: userId } });
        return { earned: count >= 10, metadata: count >= 10 ? { count } : null };
      }

      default:
        return { earned: false, metadata: null };
    }
  }

  /**
   * Return the full catalog with `earned` and `earnedAt` annotations for `userId`.
   * Used by the frontend to render a locked/unlocked grid.
   */
  async listForUser(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) return [];

    const grants = await this.db.userAchievement.findMany({
      where: { userId },
      select: { achievementKey: true, earnedAt: true, metadata: true },
    });
    const grantMap = new Map(grants.map((g) => [g.achievementKey, g]));

    return ACHIEVEMENT_CATALOG.filter((a) => (a.roles ?? [Role.STUDENT]).includes(user.role)).map((a) => {
      const grant = grantMap.get(a.key);
      return {
        ...a,
        earned: !!grant,
        earnedAt: grant?.earnedAt ?? null,
        metadata: grant?.metadata ?? null,
      };
    });
  }
}
