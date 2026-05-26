import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  CreateQuizDto,
  UpdateQuizDto,
  SubmitAttemptDto,
  AdaptiveAnswerDto,
  CreateQuizQuestionDto,
  UpdateQuizQuestionDto,
} from './quiz.dto';
import { Role, CourseRole, QuizSource, QuestionDifficulty } from '@prisma/client';

type AuthUser = { id: string; role: Role };

@Injectable()
export class QuizService {
  constructor(
    private db: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  private async ensureEnrolledOrStaff(userId: string, role: Role, courseId: string) {
    if (role === Role.ADMIN) return;
    const enrolled = await this.db.enrollment.findFirst({ where: { userId, courseId } });
    if (!enrolled) throw new ForbiddenException('errors.common.notEnrolled');
  }

  private async ensureTeacherOfCourse(userId: string, role: Role, courseId: string) {
    if (role === Role.ADMIN) return;
    if (role !== Role.TEACHER) throw new ForbiddenException('errors.common.notTeacher');
    const enrollment = await this.db.enrollment.findFirst({
      where: { userId, courseId, roleInCourse: CourseRole.TEACHER },
    });
    if (!enrollment) throw new ForbiddenException('errors.common.notTeacher');
  }

  async create(courseId: string, dto: CreateQuizDto, user: AuthUser) {
    await this.ensureTeacherOfCourse(user.id, user.role, courseId);

    for (const [i, q] of dto.questions.entries()) {
      if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        throw new BadRequestException(`Question ${i + 1}: correctIndex out of range`);
      }
    }

    const quiz = await this.db.$transaction(async (tx) => {
      const created = await tx.quiz.create({
        data: {
          courseId,
          createdById: user.id,
          title: dto.title,
          description: dto.description ?? '',
          source: dto.source ?? QuizSource.MANUAL,
          isPublished: dto.isPublished ?? false,
          secondsPerQuestion: dto.secondsPerQuestion ?? 30,
        },
      });
      await tx.quizQuestion.createMany({
        data: dto.questions.map((q, idx) => ({
          quizId: created.id,
          position: idx,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation ?? '',
          points: q.points ?? 100,
          difficulty: q.difficulty ?? QuestionDifficulty.MEDIUM,
        })),
      });
      return created;
    });

    await this.activityLog.log(user.id, 'CREATE', 'Quiz', quiz.id);
    return this.findOne(quiz.id, user);
  }

  async listByCourse(courseId: string, user: AuthUser) {
    await this.ensureEnrolledOrStaff(user.id, user.role, courseId);
    const isStaff = user.role === Role.ADMIN || user.role === Role.TEACHER;
    return this.db.quiz.findMany({
      where: {
        courseId,
        deletedAt: null,
        ...(isStaff ? {} : { isPublished: true }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const quiz = await this.db.quiz.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        questions: { orderBy: { position: 'asc' } },
        _count: { select: { questions: true, attempts: true } },
      },
    });
    if (!quiz) throw new NotFoundException();
    await this.ensureEnrolledOrStaff(user.id, user.role, quiz.courseId);

    const isStaff = user.role === Role.ADMIN || user.role === Role.TEACHER;

    // Students get questions WITHOUT correctIndex (set to -1) unless they already
    // completed an attempt — then reveal answers via attempts endpoint.
    if (!isStaff) {
      if (!quiz.isPublished) throw new NotFoundException();
      const questions = quiz.questions.map((q) => ({ ...q, correctIndex: -1 }));
      return { ...quiz, questions };
    }
    return quiz;
  }

  async update(id: string, dto: UpdateQuizDto, user: AuthUser) {
    const quiz = await this.db.quiz.findFirst({ where: { id, deletedAt: null } });
    if (!quiz) throw new NotFoundException();
    if (user.role !== Role.ADMIN && quiz.createdById !== user.id) {
      throw new ForbiddenException('errors.common.notOwner');
    }
    const updated = await this.db.quiz.update({ where: { id }, data: dto });
    await this.activityLog.log(user.id, 'UPDATE', 'Quiz', id);
    return updated;
  }

  async remove(id: string, user: AuthUser) {
    const quiz = await this.db.quiz.findFirst({ where: { id, deletedAt: null } });
    if (!quiz) throw new NotFoundException();
    if (user.role !== Role.ADMIN && quiz.createdById !== user.id) {
      throw new ForbiddenException('errors.common.notOwner');
    }
    await this.db.quiz.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.activityLog.log(user.id, 'DELETE', 'Quiz', id);
    return { deleted: true };
  }

  // ─── Question CRUD ──────────────────────────────────────────────────
  //
  // These exist so teachers can fine-tune quiz content after AI generation
  // (or any other source) without rebuilding the whole thing. Ownership rule
  // mirrors update/remove above: only the original author or an ADMIN can
  // mutate questions — even fellow course-teachers can't (avoids accidental
  // edits by colleagues, matches "Edit own quizzes" intuition).

  /** Throws if user is neither the quiz author nor an admin. */
  private async ensureQuizOwner(quizId: string, user: AuthUser) {
    const quiz = await this.db.quiz.findFirst({
      where: { id: quizId, deletedAt: null },
      select: { id: true, courseId: true, createdById: true },
    });
    if (!quiz) throw new NotFoundException();
    if (user.role !== Role.ADMIN && quiz.createdById !== user.id) {
      throw new ForbiddenException('errors.common.notOwner');
    }
    return quiz;
  }

  async addQuestion(quizId: string, dto: CreateQuizQuestionDto, user: AuthUser) {
    await this.ensureQuizOwner(quizId, user);
    if (dto.correctIndex < 0 || dto.correctIndex >= dto.options.length) {
      throw new BadRequestException('correctIndex out of range');
    }
    // Position = max(existing) + 1. Computed in DB so concurrent inserts
    // don't collide on the same position (sequential adds from one client
    // are fine — true concurrent edits would still race here, but that's
    // acceptable for a teacher editing their own quiz).
    const maxPos = await this.db.quizQuestion.aggregate({
      where: { quizId, deletedAt: null },
      _max: { position: true },
    });
    const created = await this.db.quizQuestion.create({
      data: {
        quizId,
        position: (maxPos._max.position ?? -1) + 1,
        question: dto.question,
        options: dto.options,
        correctIndex: dto.correctIndex,
        explanation: dto.explanation ?? '',
        points: dto.points ?? 100,
        difficulty: dto.difficulty ?? QuestionDifficulty.MEDIUM,
      },
    });
    await this.activityLog.log(user.id, 'CREATE', 'QuizQuestion', created.id);
    return created;
  }

  async updateQuestion(questionId: string, dto: UpdateQuizQuestionDto, user: AuthUser) {
    const existing = await this.db.quizQuestion.findFirst({
      where: { id: questionId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException();
    await this.ensureQuizOwner(existing.quizId, user);

    // If options + correctIndex both supplied, validate consistency.
    // If only correctIndex supplied, validate against existing options length.
    if (dto.correctIndex != null) {
      const optionsLen = dto.options ? dto.options.length : (existing.options as string[]).length;
      if (dto.correctIndex < 0 || dto.correctIndex >= optionsLen) {
        throw new BadRequestException('correctIndex out of range');
      }
    }

    // Position-shift logic: if caller specifies a new position, reindex other
    // questions in the same quiz so positions remain dense (0..N-1).
    if (dto.position != null && dto.position !== existing.position) {
      const target = dto.position;
      const updated = await this.db.$transaction(async (tx) => {
        const peers = await tx.quizQuestion.findMany({
          where: { quizId: existing.quizId, deletedAt: null, id: { not: questionId } },
          orderBy: { position: 'asc' },
          select: { id: true },
        });
        // Insert this question at target, push others down accordingly.
        const reordered = [...peers];
        reordered.splice(Math.max(0, Math.min(target, reordered.length)), 0, { id: questionId });
        await Promise.all(
          reordered.map((q, i) => tx.quizQuestion.update({ where: { id: q.id }, data: { position: i } })),
        );
        return tx.quizQuestion.update({
          where: { id: questionId },
          data: {
            question: dto.question,
            options: dto.options,
            correctIndex: dto.correctIndex,
            explanation: dto.explanation,
            points: dto.points,
            difficulty: dto.difficulty,
          },
        });
      });
      await this.activityLog.log(user.id, 'UPDATE', 'QuizQuestion', questionId);
      return updated;
    }

    const updated = await this.db.quizQuestion.update({
      where: { id: questionId },
      data: {
        question: dto.question,
        options: dto.options,
        correctIndex: dto.correctIndex,
        explanation: dto.explanation,
        points: dto.points,
        difficulty: dto.difficulty,
      },
    });
    await this.activityLog.log(user.id, 'UPDATE', 'QuizQuestion', questionId);
    return updated;
  }

  async deleteQuestion(questionId: string, user: AuthUser) {
    const existing = await this.db.quizQuestion.findFirst({
      where: { id: questionId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException();
    await this.ensureQuizOwner(existing.quizId, user);

    // Soft-delete + reindex remaining questions so positions stay dense.
    // We use soft delete so historical QuizAttemptAnswers still reference a
    // valid question row (their FK is RESTRICT-style for explanatory text in
    // post-session reports).
    await this.db.$transaction(async (tx) => {
      await tx.quizQuestion.update({
        where: { id: questionId },
        data: { deletedAt: new Date() },
      });
      const remaining = await tx.quizQuestion.findMany({
        where: { quizId: existing.quizId, deletedAt: null },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      await Promise.all(
        remaining.map((q, i) => tx.quizQuestion.update({ where: { id: q.id }, data: { position: i } })),
      );
    });
    await this.activityLog.log(user.id, 'DELETE', 'QuizQuestion', questionId);
    return { deleted: true };
  }

  async startAttempt(quizId: string, user: AuthUser) {
    const quiz = await this.db.quiz.findFirst({
      where: { id: quizId, deletedAt: null, isPublished: true },
    });
    if (!quiz) throw new NotFoundException();
    await this.ensureEnrolledOrStaff(user.id, user.role, quiz.courseId);

    const totalPoints = await this.db.quizQuestion
      .aggregate({ where: { quizId }, _sum: { points: true } })
      .then((r) => r._sum.points ?? 0);

    return this.db.quizAttempt.create({
      data: {
        quizId,
        studentId: user.id,
        totalPoints,
      },
    });
  }

  async submitAttempt(quizId: string, attemptId: string, dto: SubmitAttemptDto, user: AuthUser) {
    const attempt = await this.db.quizAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException();
    if (attempt.quizId !== quizId) throw new NotFoundException();
    if (attempt.studentId !== user.id) throw new ForbiddenException('errors.common.notOwner');
    if (attempt.completedAt) throw new BadRequestException('attempt already submitted');

    const questions = await this.db.quizQuestion.findMany({ where: { quizId } });
    const byId = new Map(questions.map((q) => [q.id, q]));

    let score = 0;
    let totalPoints = 0;
    const answerRows = dto.answers
      .filter((a) => byId.has(a.questionId))
      .map((a) => {
        const q = byId.get(a.questionId)!;
        const isCorrect = a.pickedIndex === q.correctIndex;
        const pointsEarned = isCorrect ? q.points : 0;
        score += pointsEarned;
        return {
          attemptId,
          questionId: a.questionId,
          pickedIndex: a.pickedIndex,
          isCorrect,
          pointsEarned,
          responseTimeMs: a.responseTimeMs ?? 0,
        };
      });
    totalPoints = questions.reduce((s, q) => s + q.points, 0);

    await this.db.$transaction([
      this.db.quizAttemptAnswer.deleteMany({ where: { attemptId } }),
      this.db.quizAttemptAnswer.createMany({ data: answerRows }),
      this.db.quizAttempt.update({
        where: { id: attemptId },
        data: { completedAt: new Date(), score, totalPoints },
      }),
    ]);

    await this.activityLog.log(user.id, 'SUBMIT', 'QuizAttempt', attemptId);

    return this.db.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: { include: { question: true } },
        quiz: { select: { id: true, title: true } },
      },
    });
  }

  async myAttempts(quizId: string, user: AuthUser) {
    const quiz = await this.db.quiz.findFirst({ where: { id: quizId, deletedAt: null } });
    if (!quiz) throw new NotFoundException();
    return this.db.quizAttempt.findMany({
      where: { quizId, studentId: user.id },
      orderBy: { startedAt: 'desc' },
      include: { answers: { include: { question: true } } },
    });
  }

  async allAttempts(quizId: string, user: AuthUser) {
    const quiz = await this.db.quiz.findFirst({ where: { id: quizId, deletedAt: null } });
    if (!quiz) throw new NotFoundException();
    if (user.role !== Role.ADMIN) await this.ensureTeacherOfCourse(user.id, user.role, quiz.courseId);
    return this.db.quizAttempt.findMany({
      where: { quizId },
      orderBy: { startedAt: 'desc' },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        answers: true,
      },
    });
  }

  // ─── Adaptive mode ──────────────────────────────────────────────────
  //
  // State machine driven entirely from server-side data — the client posts
  // each answer and we decide what comes next. Rules:
  //
  //   - Start at MEDIUM (or EASY if the quiz has no MEDIUM questions).
  //   - 2 consecutive correct → bump up one tier.
  //   - 2 consecutive wrong   → bump down one tier.
  //   - Never repeat a question we've already shown in this attempt.
  //   - End when we run out of unused questions OR after a soft cap (15
  //     questions) — adaptive sessions should feel quick, not exhaustive.
  //
  // We piggyback on the existing QuizAttempt + QuizAttemptAnswer tables so
  // adaptive attempts show up in the student's history alongside regular ones.

  private readonly ADAPTIVE_QUESTION_CAP = 15;
  private readonly ADAPTIVE_STREAK_THRESHOLD = 2;
  private readonly DIFFICULTY_TIERS: QuestionDifficulty[] = [
    QuestionDifficulty.EASY,
    QuestionDifficulty.MEDIUM,
    QuestionDifficulty.HARD,
  ];

  private stepDifficulty(current: QuestionDifficulty, direction: 'up' | 'down'): QuestionDifficulty {
    const idx = this.DIFFICULTY_TIERS.indexOf(current);
    const next = direction === 'up' ? Math.min(idx + 1, 2) : Math.max(idx - 1, 0);
    return this.DIFFICULTY_TIERS[next];
  }

  /**
   * Pick an unused question at the requested difficulty. If none exist at that
   * tier, search outward (closest tier first) so a thin EASY pool doesn't
   * dead-end a struggling student.
   */
  private async pickNextQuestion(quizId: string, usedQuestionIds: string[], preferred: QuestionDifficulty) {
    const order: QuestionDifficulty[] = (() => {
      if (preferred === QuestionDifficulty.EASY) {
        return [QuestionDifficulty.EASY, QuestionDifficulty.MEDIUM, QuestionDifficulty.HARD];
      }
      if (preferred === QuestionDifficulty.HARD) {
        return [QuestionDifficulty.HARD, QuestionDifficulty.MEDIUM, QuestionDifficulty.EASY];
      }
      return [QuestionDifficulty.MEDIUM, QuestionDifficulty.EASY, QuestionDifficulty.HARD];
    })();

    for (const tier of order) {
      const candidates = await this.db.quizQuestion.findMany({
        where: { quizId, difficulty: tier, id: { notIn: usedQuestionIds } },
        select: { id: true, question: true, options: true, points: true, difficulty: true },
      });
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    return null;
  }

  async startAdaptive(quizId: string, user: AuthUser) {
    const quiz = await this.db.quiz.findFirst({
      where: { id: quizId, deletedAt: null, isPublished: true },
    });
    if (!quiz) throw new NotFoundException();
    await this.ensureEnrolledOrStaff(user.id, user.role, quiz.courseId);

    const totalQuestions = await this.db.quizQuestion.count({ where: { quizId } });
    if (totalQuestions === 0) throw new BadRequestException('Quiz has no questions');

    // Adaptive attempts don't carry totalPoints up-front — we set it as we go,
    // because the question set is dynamic.
    const attempt = await this.db.quizAttempt.create({
      data: { quizId, studentId: user.id, totalPoints: 0 },
    });

    const first = await this.pickNextQuestion(quizId, [], QuestionDifficulty.MEDIUM);
    if (!first) throw new BadRequestException('Could not pick a starting question');

    return {
      attemptId: attempt.id,
      questionIndex: 1,
      cap: Math.min(this.ADAPTIVE_QUESTION_CAP, totalQuestions),
      currentDifficulty: first.difficulty,
      question: {
        id: first.id,
        question: first.question,
        options: first.options,
        points: first.points,
        difficulty: first.difficulty,
      },
    };
  }

  async answerAdaptive(dto: AdaptiveAnswerDto, user: AuthUser) {
    const attempt = await this.db.quizAttempt.findUnique({
      where: { id: dto.attemptId },
      include: {
        answers: {
          orderBy: { answeredAt: 'asc' },
          select: { questionId: true, isCorrect: true, pointsEarned: true },
        },
      },
    });
    if (!attempt) throw new NotFoundException();
    if (attempt.studentId !== user.id) throw new ForbiddenException('errors.common.notOwner');
    if (attempt.completedAt) throw new BadRequestException('attempt already finished');

    const question = await this.db.quizQuestion.findUnique({ where: { id: dto.questionId } });
    if (!question || question.quizId !== attempt.quizId) {
      throw new BadRequestException('invalid question for this attempt');
    }
    if (attempt.answers.some((a) => a.questionId === dto.questionId)) {
      throw new BadRequestException('already answered this question in this attempt');
    }

    const isCorrect = dto.pickedIndex === question.correctIndex;
    const pointsEarned = isCorrect ? question.points : 0;

    // Use a transaction so the answer + attempt score update succeed atomically
    await this.db.$transaction([
      this.db.quizAttemptAnswer.create({
        data: {
          attemptId: attempt.id,
          questionId: question.id,
          pickedIndex: dto.pickedIndex,
          isCorrect,
          pointsEarned,
          responseTimeMs: dto.responseTimeMs ?? 0,
        },
      }),
      this.db.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          score: { increment: pointsEarned },
          totalPoints: { increment: question.points },
        },
      }),
    ]);

    // Compute streak from the just-recorded answer + most recent N answers
    const allAnswers = [...attempt.answers, { questionId: question.id, isCorrect, pointsEarned }];
    let streakDir: 'correct' | 'wrong' | null = null;
    let streakLen = 0;
    for (let i = allAnswers.length - 1; i >= 0; i--) {
      const dir = allAnswers[i].isCorrect ? 'correct' : 'wrong';
      if (streakDir == null) {
        streakDir = dir;
        streakLen = 1;
      } else if (dir === streakDir) {
        streakLen++;
      } else {
        break;
      }
    }

    // Decide next difficulty
    const usedIds = allAnswers.map((a) => a.questionId);
    let nextDifficulty: QuestionDifficulty = question.difficulty;
    if (streakLen >= this.ADAPTIVE_STREAK_THRESHOLD) {
      nextDifficulty = this.stepDifficulty(question.difficulty, streakDir === 'correct' ? 'up' : 'down');
    }

    // Cap or out-of-questions = finish
    const answersGiven = allAnswers.length;
    const totalQuestions = await this.db.quizQuestion.count({ where: { quizId: attempt.quizId } });
    const reachedCap = answersGiven >= Math.min(this.ADAPTIVE_QUESTION_CAP, totalQuestions);
    const next = reachedCap ? null : await this.pickNextQuestion(attempt.quizId, usedIds, nextDifficulty);

    if (!next) {
      const finalised = await this.db.quizAttempt.update({
        where: { id: attempt.id },
        data: { completedAt: new Date() },
      });
      await this.activityLog.log(user.id, 'COMPLETE_ADAPTIVE', 'QuizAttempt', attempt.id);
      return {
        done: true,
        feedback: { isCorrect, pointsEarned, correctIndex: question.correctIndex, explanation: question.explanation },
        attempt: {
          id: finalised.id,
          score: finalised.score,
          totalPoints: finalised.totalPoints,
          answeredCount: answersGiven,
        },
      };
    }

    return {
      done: false,
      feedback: { isCorrect, pointsEarned, correctIndex: question.correctIndex, explanation: question.explanation },
      questionIndex: answersGiven + 1,
      cap: Math.min(this.ADAPTIVE_QUESTION_CAP, totalQuestions),
      currentDifficulty: next.difficulty,
      streakLen,
      streakDir,
      question: {
        id: next.id,
        question: next.question,
        options: next.options,
        points: next.points,
        difficulty: next.difficulty,
      },
    };
  }
}
