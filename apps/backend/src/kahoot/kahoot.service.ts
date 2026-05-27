import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateSessionDto, SubmitAnswerDto } from './kahoot.dto';
import { Role, CourseRole, QuizSessionStatus } from '@prisma/client';

type AuthUser = { id: string; role: Role };

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function generateJoinCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  }
  return out;
}

@Injectable()
export class KahootService {
  constructor(
    private db: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  private async ensureHostOrAdmin(sessionId: string, user: AuthUser) {
    const session = await this.db.quizSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException();
    if (user.role !== Role.ADMIN && session.hostId !== user.id) {
      throw new ForbiddenException('errors.common.notHost');
    }
    return session;
  }

  async createSession(dto: CreateSessionDto, user: AuthUser) {
    if (user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
      throw new ForbiddenException('errors.common.notTeacher');
    }
    const quiz = await this.db.quiz.findFirst({
      where: { id: dto.quizId, deletedAt: null },
      include: { _count: { select: { questions: true } } },
    });
    if (!quiz) throw new NotFoundException('quiz not found');
    if (quiz._count.questions === 0) throw new BadRequestException('quiz has no questions');

    if (user.role === Role.TEACHER) {
      const enrolled = await this.db.enrollment.findFirst({
        where: { userId: user.id, courseId: quiz.courseId, roleInCourse: CourseRole.TEACHER },
      });
      if (!enrolled) throw new ForbiddenException('errors.common.notTeacher');
    }

    let joinCode = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateJoinCode();
      const collision = await this.db.quizSession.findUnique({ where: { joinCode: candidate } });
      if (!collision) {
        joinCode = candidate;
        break;
      }
    }
    if (!joinCode) throw new BadRequestException('could not allocate join code');

    const session = await this.db.quizSession.create({
      data: {
        quizId: quiz.id,
        hostId: user.id,
        joinCode,
        status: QuizSessionStatus.LOBBY,
      },
    });

    await this.activityLog.log(user.id, 'CREATE', 'QuizSession', session.id);

    return {
      sessionId: session.id,
      joinCode: session.joinCode,
      quizTitle: quiz.title,
      totalQuestions: quiz._count.questions,
      secondsPerQuestion: quiz.secondsPerQuestion,
    };
  }

  async joinByCode(joinCode: string, user: AuthUser) {
    const session = await this.db.quizSession.findUnique({
      where: { joinCode: joinCode.toUpperCase() },
      include: {
        quiz: { include: { _count: { select: { questions: true } } } },
        host: { select: { fullName: true } },
      },
    });
    if (!session) throw new NotFoundException('session not found');
    if (session.status === QuizSessionStatus.FINISHED || session.status === QuizSessionStatus.CANCELLED) {
      throw new BadRequestException('session already ended');
    }

    return {
      sessionId: session.id,
      joinCode: session.joinCode,
      status: session.status,
      currentIndex: session.currentIndex,
      quizTitle: session.quiz.title,
      hostName: session.host.fullName,
      totalQuestions: session.quiz._count.questions,
      secondsPerQuestion: session.quiz.secondsPerQuestion,
    };
  }

  async start(sessionId: string, user: AuthUser) {
    const session = await this.ensureHostOrAdmin(sessionId, user);
    if (session.status !== QuizSessionStatus.LOBBY) {
      throw new BadRequestException('session already started');
    }
    return this.db.quizSession.update({
      where: { id: sessionId },
      data: { status: QuizSessionStatus.IN_PROGRESS, currentIndex: 0, startedAt: new Date() },
    });
  }

  async next(sessionId: string, user: AuthUser) {
    const session = await this.ensureHostOrAdmin(sessionId, user);
    if (session.status !== QuizSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('session not running');
    }
    const total = await this.db.quizQuestion.count({ where: { quizId: session.quizId } });
    const nextIndex = session.currentIndex + 1;
    if (nextIndex >= total) {
      return this.db.quizSession.update({
        where: { id: sessionId },
        data: { status: QuizSessionStatus.FINISHED, endedAt: new Date() },
      });
    }
    return this.db.quizSession.update({
      where: { id: sessionId },
      data: { currentIndex: nextIndex },
    });
  }

  async currentQuestion(sessionId: string) {
    const session = await this.db.quizSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException();
    if (session.status !== QuizSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('session not running');
    }
    const question = await this.db.quizQuestion.findFirst({
      where: { quizId: session.quizId, position: session.currentIndex },
    });
    if (!question) throw new NotFoundException('no question at current index');
    const total = await this.db.quizQuestion.count({ where: { quizId: session.quizId } });
    const quiz = await this.db.quiz.findUnique({
      where: { id: session.quizId },
      select: { secondsPerQuestion: true },
    });
    return {
      id: question.id,
      index: session.currentIndex,
      total,
      question: question.question,
      options: question.options,
      points: question.points,
      // Per-question override → quiz default → 30s ultimate fallback.
      // Same precedence as the WebSocket emitCurrentQuestion path.
      secondsPerQuestion: question.secondsPerQuestion ?? quiz?.secondsPerQuestion ?? 30,
    };
  }

  async answer(sessionId: string, dto: SubmitAnswerDto, user: AuthUser) {
    const session = await this.db.quizSession.findUnique({
      where: { id: sessionId },
      include: { quiz: true },
    });
    if (!session) throw new NotFoundException();
    if (session.status !== QuizSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('session not running');
    }

    const question = await this.db.quizQuestion.findUnique({ where: { id: dto.questionId } });
    if (!question || question.quizId !== session.quizId) throw new BadRequestException('invalid question');

    // Find or create an attempt for this player in this session
    let attempt = await this.db.quizAttempt.findFirst({
      where: { sessionId, studentId: user.id },
    });
    if (!attempt) {
      attempt = await this.db.quizAttempt.create({
        data: { quizId: session.quizId, studentId: user.id, sessionId },
      });
    }
    if (attempt.completedAt) throw new BadRequestException('attempt already finished');

    // Reject double-answer for the same question
    const existing = await this.db.quizAttemptAnswer.findUnique({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
    });
    if (existing) throw new BadRequestException('already answered');

    const isCorrect = dto.pickedIndex === question.correctIndex;
    // Score model: DB stores raw correct-count (0..N) in attempt.score
    // and 0/1 in pointsEarned per answer. The displayed score and
    // accuracy are derived in the report/leaderboard endpoints as
    // (count / totalQuestions) × 100, kept to one decimal so 100/8
    // shows as exactly 12.5 instead of getting rounded to 13. Storing
    // raw counts avoids the rounding-drift problem where 8 × 13 = 104
    // would exceed the theoretical 100-point ceiling.
    const pointsEarned = isCorrect ? 1 : 0;

    await this.db.quizAttemptAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: question.id,
        pickedIndex: dto.pickedIndex,
        isCorrect,
        pointsEarned,
        responseTimeMs: dto.responseTimeMs,
      },
    });
    await this.db.quizAttempt.update({
      where: { id: attempt.id },
      data: { score: { increment: pointsEarned } },
    });

    return { isCorrect, pointsEarned };
  }

  async leaderboard(sessionId: string) {
    const session = await this.db.quizSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException();

    const totalQuestions = await this.db.quizQuestion.count({
      where: { quizId: session.quizId, deletedAt: null },
    });

    const attempts = await this.db.quizAttempt.findMany({
      where: { sessionId },
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: { score: 'desc' },
    });
    return attempts.map((a, i) => ({
      rank: i + 1,
      userId: a.student.id,
      fullName: a.student.fullName,
      // Display = (correctCount / totalQuestions) × 100, one decimal.
      // Eg. 8 questions / 1 correct → 12.5; full sweep → 100.
      score: totalQuestions > 0 ? Math.round((a.score / totalQuestions) * 1000) / 10 : 0,
    }));
  }

  async finish(sessionId: string, user: AuthUser) {
    const session = await this.ensureHostOrAdmin(sessionId, user);
    if (session.status === QuizSessionStatus.FINISHED) return session;
    await this.db.quizAttempt.updateMany({
      where: { sessionId, completedAt: null },
      data: { completedAt: new Date() },
    });
    return this.db.quizSession.update({
      where: { id: sessionId },
      data: { status: QuizSessionStatus.FINISHED, endedAt: new Date() },
    });
  }

  /**
   * Detailed post-session report — host-or-admin only.
   *
   * Two slices of the same data:
   *  - `perPlayer`: every player's full answer trail (for "what did Alice
   *    pick on Q3?") — sorted by score DESC, with rank.
   *  - `perQuestion`: per-question aggregate (option distribution, accuracy,
   *    average response time) — the "where did the class struggle most?"
   *    teacher question.
   *
   * Both views share the same QuizAttempt + QuizAttemptAnswer rows. We pull
   * everything in one query (with question payloads) and reshape in memory
   * — sessions usually have <50 players × <20 questions, so no streaming
   * pagination needed.
   */
  async getSessionReport(sessionId: string, user: AuthUser) {
    await this.ensureHostOrAdmin(sessionId, user);

    const session = await this.db.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quiz: {
          include: {
            questions: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException();

    const attempts = await this.db.quizAttempt.findMany({
      where: { sessionId },
      include: {
        student: { select: { id: true, fullName: true } },
        answers: { include: { question: true } },
      },
      orderBy: { score: 'desc' },
    });

    const questions = session.quiz.questions;
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // ── perPlayer ───────────────────────────────────────────────────────
    const totalQuestions = questions.length;
    const perPlayer = attempts.map((attempt, i) => {
      const totalAnswered = attempt.answers.length;
      const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
      // Both score and accuracy are derived from the same formula —
      // (correctCount / totalQuestions) × 100 with one decimal place —
      // so the columns can never disagree. 100 / 8 = 12.5 exactly.
      // Accuracy denominator is the FULL question count, not just what
      // the player got around to answering; otherwise a player who
      // answered only the one question they knew would show 100%.
      const percent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 1000) / 10 : 0;
      return {
        userId: attempt.student.id,
        fullName: attempt.student.fullName,
        score: percent,
        rank: i + 1,
        accuracy: percent,
        correctCount,
        totalAnswered,
        completedAt: attempt.completedAt,
        answers: attempt.answers
          .map((a) => {
            const q = a.question ?? questionMap.get(a.questionId);
            return {
              questionId: a.questionId,
              questionText: q?.question ?? '(question deleted)',
              pickedIndex: a.pickedIndex,
              correctIndex: q?.correctIndex ?? -1,
              isCorrect: a.isCorrect,
              pointsEarned: a.pointsEarned,
              responseTimeMs: a.responseTimeMs,
            };
          })
          // Render in the same order the questions appear in the quiz
          .sort((a, b) => {
            const pa = questionMap.get(a.questionId)?.position ?? 0;
            const pb = questionMap.get(b.questionId)?.position ?? 0;
            return pa - pb;
          }),
      };
    });

    // ── perQuestion ─────────────────────────────────────────────────────
    const perQuestion = questions.map((q) => {
      const optionCount = (q.options as string[]).length;
      const distribution: number[] = new Array(optionCount).fill(0);
      let correctCount = 0;
      let totalAnswered = 0;
      let totalResponseTimeMs = 0;

      for (const attempt of attempts) {
        const a = attempt.answers.find((x) => x.questionId === q.id);
        if (!a) continue;
        totalAnswered++;
        if (a.pickedIndex >= 0 && a.pickedIndex < optionCount) {
          distribution[a.pickedIndex]++;
        }
        if (a.isCorrect) correctCount++;
        totalResponseTimeMs += a.responseTimeMs;
      }

      return {
        questionId: q.id,
        position: q.position,
        questionText: q.question,
        options: q.options as string[],
        correctIndex: q.correctIndex,
        answerDistribution: distribution,
        correctCount,
        totalAnswered,
        accuracyPercent: totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0,
        avgResponseTimeMs: totalAnswered > 0 ? Math.round(totalResponseTimeMs / totalAnswered) : 0,
      };
    });

    return {
      session: {
        id: session.id,
        joinCode: session.joinCode,
        quizTitle: session.quiz.title,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        totalQuestions: questions.length,
      },
      summary: {
        totalPlayers: attempts.length,
        averageAccuracy:
          perPlayer.length > 0 ? Math.round(perPlayer.reduce((s, p) => s + p.accuracy, 0) / perPlayer.length) : 0,
        averageScore:
          perPlayer.length > 0 ? Math.round(perPlayer.reduce((s, p) => s + p.score, 0) / perPlayer.length) : 0,
      },
      perPlayer,
      perQuestion,
    };
  }

  /**
   * Feature #4 — student-facing per-session results.
   *
   * Where getSessionReport is host-only and dumps everyone's data,
   * this returns only the caller's own row plus the bare-minimum
   * leaderboard slot they need to see "rank #3 of 12". Used by the
   * student results page that the Telegram deep-link drops them into
   * after Game Over.
   *
   * Auth: any authenticated user who actually has an attempt in the
   * session. Anonymous and "I peeked at the URL" cases get 403/404 —
   * no leaking another student's answers.
   */
  async getMyResults(sessionId: string, user: AuthUser) {
    const session = await this.db.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            questions: {
              where: { deletedAt: null },
              orderBy: { position: 'asc' },
              select: {
                id: true,
                position: true,
                question: true,
                options: true,
                correctIndex: true,
                explanation: true,
              },
            },
          },
        },
      },
    });
    if (!session) throw new NotFoundException();

    const attempt = await this.db.quizAttempt.findFirst({
      where: { sessionId, studentId: user.id },
      include: { answers: true },
    });
    if (!attempt) {
      throw new ForbiddenException('You did not play this session');
    }

    // Compute the student's score/accuracy with the same formula the
    // host report uses, so the two views match exactly (no off-by-1
    // surprise when the teacher reads out "you got 60% — pretty good"
    // and the student sees a different number).
    const totalQuestions = session.quiz.questions.length;
    const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
    const percent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 1000) / 10 : 0;

    // Map answers in question order; include the correct answer + the
    // teacher's explanation so the student gets a built-in retro.
    const answers = session.quiz.questions.map((q) => {
      const a = attempt.answers.find((x) => x.questionId === q.id);
      return {
        questionId: q.id,
        position: q.position,
        questionText: q.question,
        options: q.options as string[],
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        pickedIndex: a?.pickedIndex ?? null,
        isCorrect: a?.isCorrect ?? false,
        responseTimeMs: a?.responseTimeMs ?? 0,
      };
    });

    // Rank vs the rest of the room — we don't ship per-player rows
    // (that's the host's view) but the student wants to know where
    // they landed.
    const allAttempts = await this.db.quizAttempt.findMany({
      where: { sessionId },
      orderBy: { score: 'desc' },
      select: { studentId: true, score: true },
    });
    const myRank = allAttempts.findIndex((a) => a.studentId === user.id) + 1;

    return {
      session: {
        id: session.id,
        joinCode: session.joinCode,
        quizTitle: session.quiz.title,
        quizId: session.quiz.id,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        totalQuestions,
      },
      me: {
        score: percent,
        accuracy: percent,
        correctCount,
        totalAnswered: attempt.answers.length,
        rank: myRank,
        totalPlayers: allAttempts.length,
      },
      answers,
    };
  }
}
