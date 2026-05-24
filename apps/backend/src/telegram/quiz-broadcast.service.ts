import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Role, CourseRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

type AuthUser = { id: string; role: Role };

/**
 * Phase 2.1 — Telegram quiz broadcast.
 *
 * Teacher publishes a quiz → `broadcast()` fans every question out as a
 * **native Telegram quiz poll** to each linked student in the course. Native
 * polls win over web-link callbacks because:
 *   - Telegram shows confetti on the correct answer (visceral feedback).
 *   - The poll lives natively in the chat — no app-switch.
 *   - We get `poll_answer` events for free (handled in TelegramUpdatesService).
 *
 * Throughput: every poll goes through TelegramService.sendQuizPoll, which
 * itself goes through p-queue (25 concurrent / sec). So a 5-question quiz
 * blasted to 30 students = 150 polls, completes in ~6 seconds, well below
 * Telegram's 30/sec global cap.
 *
 * We don't block the HTTP request on the entire broadcast — we kick it off
 * and return a `started` ack to the caller; progress is observable via the
 * QuizTelegramPoll table.
 */
@Injectable()
export class QuizBroadcastService {
  private readonly logger = new Logger(QuizBroadcastService.name);

  constructor(
    private db: PrismaService,
    private tg: TelegramService,
    private activityLog: ActivityLogService,
  ) {}

  /**
   * Kick off the broadcast. Returns immediately with the count of recipients;
   * the actual sending happens in the background. Idempotent at the per-poll
   * level — re-broadcasting the same quiz creates new poll rows (different
   * `pollId`s) so students can retake.
   */
  async broadcast(quizId: string, user: AuthUser): Promise<{ recipientCount: number; questionCount: number }> {
    if (!this.tg.isEnabled) {
      throw new ForbiddenException('Telegram bot is not configured on this server.');
    }

    const quiz = await this.db.quiz.findFirst({
      where: { id: quizId, deletedAt: null },
      include: {
        questions: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
        course: { select: { id: true, title: true } },
      },
    });
    if (!quiz) throw new NotFoundException();
    if (user.role !== Role.ADMIN && quiz.createdById !== user.id) {
      // Match the ownership rules used by QuizService.update — author or admin.
      throw new ForbiddenException('errors.common.notOwner');
    }
    if (quiz.questions.length === 0) {
      throw new ForbiddenException('Quiz has no questions to broadcast.');
    }

    // All linked students enrolled in this quiz's course.
    const enrolled = await this.db.enrollment.findMany({
      where: {
        courseId: quiz.courseId,
        roleInCourse: CourseRole.STUDENT,
        user: { telegramChatId: { not: null }, deletedAt: null },
      },
      include: { user: { select: { id: true, telegramChatId: true, fullName: true } } },
    });

    if (enrolled.length === 0) {
      return { recipientCount: 0, questionCount: quiz.questions.length };
    }

    // Kick off the actual sending in the background — the queue inside
    // TelegramService throttles, so we just await them all and let p-queue
    // pace the actual API calls.
    this.fireBroadcast(quiz, enrolled).catch((e) =>
      this.logger.warn(`broadcast crashed for quiz ${quizId}: ${e?.message ?? e}`),
    );

    await this.activityLog.log(user.id, 'BROADCAST_TELEGRAM', 'Quiz', quiz.id);
    return { recipientCount: enrolled.length, questionCount: quiz.questions.length };
  }

  private async fireBroadcast(
    quiz: { id: string; title: string; questions: any[]; course: { id: string; title: string } | null },
    enrolled: Array<{ user: { id: string; telegramChatId: string | null; fullName: string } }>,
  ) {
    // Per-student intro message first so the poll sequence isn't out-of-context.
    for (const e of enrolled) {
      if (!e.user.telegramChatId) continue;
      await this.tg.sendMessage(
        e.user.telegramChatId,
        `📝 *New quiz from your teacher*\n\n*${quiz.title}*\n${quiz.course?.title ?? ''}\n\nAnswer the polls below — they're scored automatically!`,
      );

      // Then fan out one quiz poll per question, in order.
      for (const q of quiz.questions) {
        const pollId = await this.tg.sendQuizPoll(
          e.user.telegramChatId,
          q.question,
          (q.options as string[]).slice(0, 10), // TG hard-caps at 10 options
          q.correctIndex,
          {
            explanation: q.explanation || undefined,
            isAnonymous: false,
          },
        );
        if (pollId) {
          await this.db.quizTelegramPoll
            .create({
              data: {
                pollId,
                quizId: quiz.id,
                questionId: q.id,
                studentId: e.user.id,
              },
            })
            .catch((err) =>
              this.logger.warn(`Could not persist QuizTelegramPoll for ${pollId}: ${err?.message ?? err}`),
            );
        }
      }
    }
    this.logger.log(`Broadcast finished for quiz ${quiz.id} → ${enrolled.length} students`);
  }
}
