import { Injectable, Logger, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentFeedbackDto, GenerateQuizDto, CourseSummaryDto, StudentAnalysisDto, StudyCoachDto, ClassInsightsDto } from './ai.dto';

const QuizSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string(),
  })),
});

/**
 * Randomize the position of the correct answer per question.
 *
 * Claude (and most LLMs) have a strong positional bias: when asked to produce
 * multiple-choice questions with `correctIndex: 0`, they will obediently
 * keep the right answer in slot A for every question. From the student's
 * perspective the quiz becomes trivial ("just pick A every time").
 *
 * We mitigate this server-side: for each question we Fisher-Yates shuffle
 * the four options, then re-derive `correctIndex` from the new position
 * of the original correct option. The explanation text is unchanged.
 */
function shuffleQuizAnswers<T extends { options: string[]; correctIndex: number }>(
  questions: T[],
): T[] {
  return questions.map((q) => {
    const correctOption = q.options[q.correctIndex];
    const shuffled = [...q.options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return { ...q, options: shuffled, correctIndex: shuffled.indexOf(correctOption) };
  });
}

type AiLang = 'en' | 'ru' | 'kz';

const DEMO_TEXT = {
  en: {
    note: 'This is a demo response. Set LLM_API_KEY to enable real AI.',
    assignmentAssessment: 'Overall this submission demonstrates a solid understanding of the assignment requirements.',
    assignmentStrengths: ['Clear structure and logical flow', 'Addresses the core requirements', 'Good use of terminology'],
    assignmentImprovements: ['Could expand on supporting arguments', 'More specific examples would strengthen the response'],
    assignmentSuggestions: ['Review lecture notes on this topic', 'Compare with model solutions if available', 'Ask your teacher for clarification on any unclear points'],
    quizQuestionPrefix: '[Demo] Sample question',
    quizQuestionAbout: 'about',
    quizCorrect: 'Option A (correct)',
    quizOptions: ['Option B', 'Option C', 'Option D'],
    quizExplanation: 'This is a placeholder question.',
    courseSummary: 'covers fundamental concepts and practical applications in the field.',
    courseTopics: ['Core concepts', 'Practical applications', 'Assessment strategies'],
    courseTips: ['Review materials regularly', 'Complete assignments on time', 'Participate in discussions'],
    analysis: 'shows consistent engagement with course materials and submits work on time.',
    analysisStrengths: ['Consistent assignment submission', 'Good attendance record'],
    analysisImprovements: ['Could improve grade scores', 'More active participation recommended'],
    analysisRecommendations: ['Schedule office hours with instructor', 'Form study groups with peers', 'Review feedback on past assignments'],
    chatIntro: '[Demo mode]',
    chatYouAsked: 'You asked:',
    chatReply: 'In a real deployment, I would provide a detailed academic response here.',
  },
  ru: {
    note: 'Это демо-ответ. Укажите LLM_API_KEY, чтобы включить настоящий ИИ.',
    assignmentAssessment: 'В целом работа показывает хорошее понимание требований задания.',
    assignmentStrengths: ['Понятная структура и логичный ход мысли', 'Затронуты основные требования задания', 'Термины использованы уместно'],
    assignmentImprovements: ['Можно подробнее раскрыть аргументацию', 'Более конкретные примеры сделали бы ответ сильнее'],
    assignmentSuggestions: ['Повторите конспекты и материалы по теме', 'Сравните ответ с примерами решений, если они доступны', 'Уточните спорные моменты у преподавателя'],
    quizQuestionPrefix: '[Демо] Пример вопроса',
    quizQuestionAbout: 'по теме',
    quizCorrect: 'Вариант A (верный)',
    quizOptions: ['Вариант B', 'Вариант C', 'Вариант D'],
    quizExplanation: 'Это демонстрационный вопрос-заглушка.',
    courseSummary: 'охватывает фундаментальные концепции и их практическое применение.',
    courseTopics: ['Базовые концепции', 'Практическое применение', 'Стратегии оценки знаний'],
    courseTips: ['Регулярно просматривайте материалы', 'Сдавайте задания вовремя', 'Участвуйте в обсуждениях и занятиях'],
    analysis: 'показывает стабильную вовлечённость в курс и своевременно сдаёт работы.',
    analysisStrengths: ['Стабильная сдача заданий', 'Хорошая посещаемость'],
    analysisImprovements: ['Есть потенциал улучшить результаты по баллам', 'Стоит активнее участвовать в учебной работе'],
    analysisRecommendations: ['Запишитесь на консультацию к преподавателю', 'Организуйте учебную группу с однокурсниками', 'Пересмотрите комментарии к прошлым работам'],
    chatIntro: '[Демо-режим]',
    chatYouAsked: 'Вы спросили:',
    chatReply: 'В реальном режиме я бы дал здесь более подробный академический ответ.',
  },
  kz: {
    note: 'Бұл демо-жауап. Нақты ЖИ қосу үшін LLM_API_KEY орнатыңыз.',
    assignmentAssessment: 'Жалпы алғанда, бұл жұмыс тапсырма талаптарын жақсы түсінетінін көрсетеді.',
    assignmentStrengths: ['Құрылымы түсінікті және ой ағымы логикалық', 'Тапсырманың негізгі талаптары қамтылған', 'Терминдер орынды қолданылған'],
    assignmentImprovements: ['Дәлелдерді сәл кеңірек ашуға болады', 'Нақты мысалдар жауапты күшейтер еді'],
    assignmentSuggestions: ['Тақырып бойынша дәріс жазбаларын қайталаңыз', 'Мүмкін болса, үлгі шешімдермен салыстырыңыз', 'Түсініксіз жерлерді оқытушымен нақтылаңыз'],
    quizQuestionPrefix: '[Демо] Үлгі сұрақ',
    quizQuestionAbout: 'тақырыбы бойынша',
    quizCorrect: 'A нұсқасы (дұрыс)',
    quizOptions: ['B нұсқасы', 'C нұсқасы', 'D нұсқасы'],
    quizExplanation: 'Бұл демонстрациялық үлгі сұрақ.',
    courseSummary: 'негізгі ұғымдар мен олардың практикалық қолданылуын қамтиды.',
    courseTopics: ['Негізгі ұғымдар', 'Практикалық қолдану', 'Бағалау стратегиялары'],
    courseTips: ['Материалдарды жүйелі түрде қайталаңыз', 'Тапсырмаларды уақытында тапсырыңыз', 'Талқылаулар мен сабақтарға белсенді қатысыңыз'],
    analysis: 'курс материалдарына тұрақты түрде қатысып, жұмыстарын уақытында тапсырады.',
    analysisStrengths: ['Тапсырмаларды тұрақты тапсырады', 'Қатысу көрсеткіші жақсы'],
    analysisImprovements: ['Ұпай нәтижелерін әлі де жақсартуға болады', 'Оқу процесіне белсендірек қатысу ұсынылады'],
    analysisRecommendations: ['Оқытушымен жеке кеңеске жазылыңыз', 'Топтастармен бірге оқу тобын құрыңыз', 'Алдыңғы жұмыстарға берілген пікірлерді қайта қарап шығыңыз'],
    chatIntro: '[Демо режимі]',
    chatYouAsked: 'Сіз сұрадыңыз:',
    chatReply: 'Нақты режимде мен мұнда толығырақ академиялық жауап берер едім.',
  },
} as const;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;

  constructor(private db: PrismaService) {
    const apiKey = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.logger.warn('LLM_API_KEY not set — AI features running in demo mode');
    }
  }

  get isDemo() { return !this.client; }

  private resolveLang(lang?: string): AiLang {
    return lang === 'ru' || lang === 'kz' ? lang : 'en';
  }

  private demoText(lang?: string) {
    return DEMO_TEXT[this.resolveLang(lang)];
  }

  private async log(userId: string, type: string, prompt: string, response: string) {
    try {
      await this.db.aiRequestLog.create({ data: { userId, type, prompt, response } });
    } catch (e) {
      this.logger.warn('Failed to write AI request log', e);
    }
  }

  async getAssignmentFeedback(dto: AssignmentFeedbackDto, userId: string, userRole: string) {
    const demo = this.demoText(dto.lang);
    const submission = await this.db.submission.findUnique({
      where: { id: dto.submissionId },
      include: { assignment: true, grade: true },
    });
    if (!submission) throw new InternalServerErrorException('Submission not found');

    // Students may only get feedback on their own submissions
    if (userRole === 'STUDENT' && submission.studentId !== userId) {
      throw new ForbiddenException('You can only get AI feedback on your own submissions');
    }

    if (this.isDemo) {
      return {
        _demo: true,
        assessment: `${demo.note} ${demo.assignmentAssessment}`,
        strengths: demo.assignmentStrengths,
        improvements: demo.assignmentImprovements,
        suggestions: demo.assignmentSuggestions,
      };
    }

    const prompt = `You are an educational assistant. Provide constructive feedback for this student submission.

Assignment: ${submission.assignment.title}
Description: ${submission.assignment.description || 'N/A'}
Max Score: ${submission.assignment.maxScore}
Student Answer: ${submission.contentText || submission.contentUrl || '(file submission)'}
${submission.grade ? `Current Score: ${submission.grade.score}/${submission.assignment.maxScore}\nTeacher Comment: ${submission.grade.feedback || 'none'}` : 'Not graded yet'}

Provide:
1. Overall quality assessment (2-3 sentences)
2. Specific strengths (2-3 bullet points)
3. Areas for improvement (2-3 bullet points)
4. Actionable suggestions to improve the grade

Be encouraging and constructive. Format as JSON: { "assessment": "...", "strengths": ["..."], "improvements": ["..."], "suggestions": ["..."] }`;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new InternalServerErrorException('No response from AI');

    let result: any;
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
    } catch {
      result = { assessment: textBlock.text, strengths: [], improvements: [], suggestions: [] };
    }

    await this.log(userId, 'assignment-feedback', prompt, JSON.stringify(result));
    return result;
  }

  async generateQuiz(dto: GenerateQuizDto, userId: string) {
    const demo = this.demoText(dto.lang);
    const count = dto.questionCount ?? 5;
    const difficulty = dto.difficulty ?? 'medium';

    const course = await this.db.course.findUnique({ where: { id: dto.courseId } });
    const courseName = course?.title ?? 'the course';

    if (this.isDemo) {
      const demoQuestions = Array.from({ length: count }, (_, i) => ({
        question: `${demo.quizQuestionPrefix} ${i + 1} ${demo.quizQuestionAbout} "${dto.topic}"?`,
        options: [demo.quizCorrect, ...demo.quizOptions],
        correctIndex: 0,
        explanation: `${demo.note} ${demo.quizExplanation}`,
      }));
      return {
        _demo: true,
        questions: shuffleQuizAnswers(demoQuestions),
      };
    }

    const prompt = `Generate a ${difficulty} difficulty quiz about "${dto.topic}" for the course "${courseName}".
Create exactly ${count} multiple-choice questions.
Each question must have exactly 4 answer options (A, B, C, D).

Return ONLY valid JSON matching this exact structure:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Brief explanation of the correct answer"
    }
  ]
}

correctIndex is 0-based (0=A, 1=B, 2=C, 3=D). Do not include any text outside the JSON.`;

    // We use the SDK's streaming helper rather than `.create()` because the
    // SDK enforces a "must use streaming for potentially long requests"
    // guardrail (returns 500 immediately) once max_tokens × model rate
    // suggests >10 minutes. Quiz generation is one short request, but with
    // 15+ hard questions we routinely cross that threshold.
    //
    // `.stream(...).finalMessage()` waits for the whole response while
    // staying on Anthropic's good side. No real client-streaming needed —
    // this endpoint returns a single JSON blob to the frontend.
    const stream = this.client!.messages.stream({
      model: 'claude-sonnet-4-6',
      // Hard 15+ question quizzes routinely fill 12-14k tokens because each
      // option may be a multi-line SQL query. Headroom prevents truncation.
      max_tokens: 24000,
      messages: [{ role: 'user', content: prompt }],
    });
    const response = await stream.finalMessage();

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new InternalServerErrorException('No response from AI');

    // Robust extraction: Claude sometimes wraps JSON in ```json ... ``` fences
    // or includes a short preamble despite "Return ONLY valid JSON". Strip
    // fences first, then take the largest {...} block.
    const rawText = textBlock.text
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/```$/g, '')
      .trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      this.logger.error(
        `Quiz JSON.parse failed (topic="${dto.topic}", count=${count}, diff=${difficulty}). ` +
        `Raw response (first 1200 chars): ${rawText.slice(0, 1200)}`,
      );
      throw new InternalServerErrorException('AI returned malformed JSON — please try again, or reduce question count.');
    }

    // Use safeParse so a single malformed question doesn't blow up the whole
    // quiz. If strict validation fails, fall back to filtering only the
    // questions that DO match the schema.
    const strict = QuizSchema.safeParse(parsed);
    let result: { questions: any[] };
    if (strict.success) {
      result = strict.data;
    } else {
      this.logger.warn(
        `Quiz schema validation failed; attempting per-question filter. ` +
        `Issues: ${JSON.stringify(strict.error.issues).slice(0, 400)}`,
      );
      const QuestionSchema = QuizSchema.shape.questions.element;
      const valid = Array.isArray(parsed?.questions)
        ? parsed.questions.filter((q: any) => QuestionSchema.safeParse(q).success)
        : [];
      if (!valid.length) {
        this.logger.error('No valid questions after filtering. Raw: ' + rawText.slice(0, 800));
        throw new InternalServerErrorException('AI response had no valid questions — please try again.');
      }
      result = { questions: valid };
    }

    // Shuffle answer positions — Claude tends to place the correct answer
    // in slot A for every question, which makes the quiz trivial.
    result = { ...result, questions: shuffleQuizAnswers(result.questions) };

    await this.log(userId, 'generate-quiz', prompt, JSON.stringify(result));
    return result;
  }

  async getCourseSummary(dto: CourseSummaryDto, userId: string) {
    const demo = this.demoText(dto.lang);
    const course = await this.db.course.findUnique({
      where: { id: dto.courseId },
      include: {
        assignments: true,
        announcements: { take: 5, orderBy: { createdAt: 'desc' } },
        materials: true,
      },
    });
    if (!course) throw new InternalServerErrorException('Course not found');

    if (this.isDemo) {
      return {
        _demo: true,
        summary: `${demo.note} ${course.title} ${demo.courseSummary}`,
        keyTopics: demo.courseTopics,
        tips: demo.courseTips,
        workload: 'moderate' as const,
      };
    }

    const assignmentTitles = course.assignments.map(a => `- ${a.title} (max ${a.maxScore}pts)`).join('\n');
    const recentAnnouncements = course.announcements.map(a => `- ${a.title}`).join('\n');

    const prompt = `Summarize this university course for students:

Course: ${course.title} (${course.code})
Description: ${course.description || 'N/A'}
Assignments (${course.assignments.length}):
${assignmentTitles || 'None yet'}
Materials available: ${course.materials.length}
Recent announcements:
${recentAnnouncements || 'None'}

Provide a helpful course overview as JSON:
{
  "summary": "2-3 sentence overview of what this course covers",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "tips": ["study tip 1", "study tip 2"],
  "workload": "light | moderate | heavy"
}`;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new InternalServerErrorException('No response from AI');

    let result: any;
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
    } catch {
      result = { summary: textBlock.text, keyTopics: [], tips: [], workload: 'moderate' };
    }

    await this.log(userId, 'course-summary', prompt, JSON.stringify(result));
    return result;
  }

  async getStudentAnalysis(dto: StudentAnalysisDto, userId: string, userRole: string) {
    const demo = this.demoText(dto.lang);
    if (userRole === 'STUDENT' && dto.studentId !== userId) {
      throw new ForbiddenException('Students can only view their own analysis');
    }

    const student = await this.db.user.findUnique({
      where: { id: dto.studentId },
      include: {
        submissions: {
          include: {
            assignment: { include: { course: true } },
            grade: true,
          },
          ...(dto.courseId ? { where: { assignment: { courseId: dto.courseId } } } : {}),
        },
        attendance: {
          ...(dto.courseId ? { where: { courseId: dto.courseId } } : {}),
        },
      },
    });
    if (!student) throw new InternalServerErrorException('Student not found');

    if (this.isDemo) {
      return {
        _demo: true,
        analysis: `${demo.note} ${student.fullName} ${demo.analysis}`,
        strengths: demo.analysisStrengths,
        areasToImprove: demo.analysisImprovements,
        recommendations: demo.analysisRecommendations,
        riskLevel: 'low' as const,
      };
    }

    const gradeLines = student.submissions
      .filter(s => s.grade)
      .map(s => `${s.assignment.course.code} / ${s.assignment.title}: ${s.grade!.score}/${s.assignment.maxScore}`)
      .join('\n');

    const totalAttendance = student.attendance.length;
    const presentCount = student.attendance.filter(a => a.status === 'PRESENT').length;
    const lateCount = student.attendance.filter(a => a.status === 'LATE').length;

    const prompt = `Analyze this student's academic performance and provide actionable insights.

Student: ${student.fullName}
Submissions: ${student.submissions.length}
Grades:
${gradeLines || 'No grades yet'}
Attendance: ${presentCount} present, ${lateCount} late, ${totalAttendance - presentCount - lateCount} absent out of ${totalAttendance} sessions

Provide analysis as JSON:
{
  "analysis": "2-3 sentence overall performance summary",
  "strengths": ["strength 1", "strength 2"],
  "areasToImprove": ["area 1", "area 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "riskLevel": "low | medium | high"
}`;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new InternalServerErrorException('No response from AI');

    let result: any;
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
    } catch {
      result = { analysis: textBlock.text, strengths: [], areasToImprove: [], recommendations: [], riskLevel: 'low' };
    }

    await this.log(userId, 'student-analysis', prompt, JSON.stringify(result));
    return result;
  }

  // ─── AI Study Coach (replaces the descriptive-only Student Analysis) ────────

  /**
   * Compute the student's current grade as a 0-100 percentage from all
   * graded submissions. Returns `null` if there are no grades yet.
   */
  private currentGradePercent(submissions: Array<{ grade: { score: number } | null; assignment: { maxScore: number } }>): number | null {
    const graded = submissions.filter((s) => s.grade);
    if (!graded.length) return null;
    const earned = graded.reduce((sum, s) => sum + s.grade!.score, 0);
    const possible = graded.reduce((sum, s) => sum + s.assignment.maxScore, 0);
    if (!possible) return null;
    return Math.round((earned / possible) * 100);
  }

  /**
   * Personal AI Study Coach: trajectory, study plan, mistake patterns.
   * This replaces the value-light Student Analysis. The committee said the
   * old version was "useless because students can already see their grades";
   * here we go beyond description to prediction and prescription.
   */
  async getStudyCoach(dto: StudyCoachDto, userId: string, userRole: string) {
    const demo = this.demoText(dto.lang);
    const targetStudentId = dto.studentId ?? userId;

    if (userRole === 'STUDENT' && targetStudentId !== userId) {
      throw new ForbiddenException('Students can only view their own coach');
    }

    // Collect rich academic record: grades, submissions, attendance, quiz
    // attempts, materials. Each input shapes a different part of the prompt.
    const student = await this.db.user.findFirst({
      where: { id: targetStudentId },
      include: {
        submissions: {
          include: {
            assignment: { include: { course: { select: { id: true, code: true, title: true } } } },
            grade: true,
          },
          ...(dto.courseId ? { where: { assignment: { courseId: dto.courseId } } } : {}),
        },
        attendance: {
          ...(dto.courseId ? { where: { courseId: dto.courseId } } : {}),
        },
        quizAttempts: {
          where: { completedAt: { not: null } },
          include: {
            quiz: { select: { title: true, courseId: true } },
            answers: { include: { question: { select: { question: true, correctIndex: true } } } },
          },
          ...(dto.courseId ? { where: { completedAt: { not: null }, quiz: { courseId: dto.courseId } } } : {}),
          orderBy: { completedAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!student) throw new InternalServerErrorException('Student not found');

    // Also pull the assignments the student has NOT submitted yet — this
    // determines what they can still influence in their grade trajectory.
    const submittedIds = new Set(student.submissions.map((s) => s.assignmentId));
    const upcoming = await this.db.assignment.findMany({
      where: {
        ...(dto.courseId ? { courseId: dto.courseId } : {
          course: { enrollments: { some: { userId: targetStudentId } } },
        }),
        id: { notIn: [...submittedIds] },
        dueAt: { gte: new Date() },
      },
      include: { course: { select: { code: true, title: true } } },
      orderBy: { dueAt: 'asc' },
      take: 10,
    });

    const currentGrade = this.currentGradePercent(student.submissions);

    if (this.isDemo) {
      return {
        _demo: true,
        trajectory: {
          currentGrade: currentGrade ?? 75,
          predictedFinalGrade: 82,
          confidenceLevel: 'medium' as const,
          trend: 'improving' as const,
          requirementForA: 'Average 88+ on the remaining 3 assignments to reach an A.',
        },
        weaknesses: [
          { topic: 'SQL JOINs', evidence: 'Missed 2 of 3 questions on the last quiz', severity: 'high' as const },
          { topic: 'Normalization', evidence: 'Lost 8 points on Assignment 4', severity: 'medium' as const },
        ],
        studyPlan: [
          { day: 1, focus: 'Review LEFT/RIGHT/INNER JOIN with worked examples', estimatedMinutes: 45 },
          { day: 2, focus: 'Practice 10 JOIN queries on the course exercise set', estimatedMinutes: 60 },
          { day: 3, focus: 'Read 3NF normalization handout, then redo Assignment 4 problem 2', estimatedMinutes: 50 },
          { day: 4, focus: 'Take the AI quiz on "JOINs" — target 80%+', estimatedMinutes: 20 },
        ],
        mistakePatterns: [
          { pattern: 'You consistently swap LEFT and RIGHT JOIN semantics', recommendation: 'Memorize: "LEFT keeps the LEFT table\'s rows"' },
        ],
      };
    }

    // Build a compact prompt — too verbose and Claude rambles, too short and
    // it makes things up. We pack only the most signal-dense facts.
    const gradeLines = student.submissions
      .filter((s) => s.grade)
      .slice(0, 20)
      .map((s) => `${s.assignment.course.code} | ${s.assignment.title}: ${s.grade!.score}/${s.assignment.maxScore}`)
      .join('\n');

    const attTotal = student.attendance.length;
    const attPresent = student.attendance.filter((a) => a.status === 'PRESENT').length;
    const attLate = student.attendance.filter((a) => a.status === 'LATE').length;
    const attAbsent = attTotal - attPresent - attLate;

    const quizLines = student.quizAttempts
      .slice(0, 10)
      .map((a) => {
        const wrong = a.answers.filter((x) => !x.isCorrect).map((x) => x.question.question.slice(0, 60));
        const wrongFmt = wrong.length ? ` | wrong on: ${wrong.slice(0, 3).join('; ')}` : '';
        return `${a.quiz.title}: ${a.score}/${a.totalPoints}${wrongFmt}`;
      })
      .join('\n');

    const upcomingLines = upcoming.map((a) => `${a.course.code} | ${a.title} (due ${a.dueAt.toISOString().slice(0, 10)}, max ${a.maxScore} pts)`).join('\n');

    const prompt = `You are a personal academic coach for ${student.fullName}. Use the data below to produce a SPECIFIC, ACTIONABLE plan — predictions and prescriptions, never just descriptions of what they already know.

CURRENT GRADE: ${currentGrade !== null ? currentGrade + '%' : 'no graded work yet'}

GRADED WORK (most recent):
${gradeLines || 'None yet'}

QUIZ HISTORY (newest first, with topics they got wrong):
${quizLines || 'No quizzes taken yet'}

ATTENDANCE: ${attPresent} present / ${attLate} late / ${attAbsent} absent out of ${attTotal} sessions

UPCOMING WORK (what they can still influence):
${upcomingLines || 'No upcoming assignments'}

LANGUAGE: respond in ${dto.lang ?? 'en'} (English/Russian/Kazakh)

Return ONLY valid JSON (no commentary) matching this exact shape:
{
  "trajectory": {
    "currentGrade": <integer 0-100, the percent above>,
    "predictedFinalGrade": <integer 0-100, your honest prediction>,
    "confidenceLevel": "high" | "medium" | "low",
    "trend": "improving" | "stable" | "declining",
    "requirementForA": "<one specific sentence: 'You need X on Y to reach an A' — must reference specific upcoming work>"
  },
  "weaknesses": [
    { "topic": "<concrete topic>", "evidence": "<specific data point>", "severity": "high" | "medium" | "low" }
  ],
  "studyPlan": [
    { "day": 1, "focus": "<specific action, not 'review notes'>", "estimatedMinutes": <number> }
    // Generate 5-7 days. Tie each day to a real weakness above. Avoid generic advice.
  ],
  "mistakePatterns": [
    { "pattern": "<specific recurring error>", "recommendation": "<concrete fix>" }
  ]
}`;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new InternalServerErrorException('No response from AI');

    let result: any;
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
    } catch (e) {
      this.logger.error('Study coach parse error', e);
      throw new InternalServerErrorException('Failed to parse study coach response');
    }

    await this.log(userId, 'study-coach', prompt.slice(0, 4000), JSON.stringify(result).slice(0, 4000));
    return result;
  }

  /**
   * Teacher-only insight report across an entire course.
   * Identifies at-risk students, common class-wide weak topics, and high
   * performers — answers the question "where should I spend my next class
   * minute, and which students need a 1:1 first?"
   */
  async getClassInsights(dto: ClassInsightsDto, userId: string, userRole: string) {
    if (userRole !== 'ADMIN' && userRole !== 'TEACHER') {
      throw new ForbiddenException('Teachers and admins only');
    }
    const demo = this.demoText(dto.lang);

    const course = await this.db.course.findFirst({
      where: { id: dto.courseId },
      include: {
        enrollments: {
          where: { roleInCourse: 'STUDENT' },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                submissions: {
                  where: { assignment: { courseId: dto.courseId } },
                  include: { grade: true, assignment: { select: { maxScore: true, title: true } } },
                },
                attendance: { where: { courseId: dto.courseId } },
                quizAttempts: {
                  where: { completedAt: { not: null }, quiz: { courseId: dto.courseId } },
                  include: { answers: { include: { question: { select: { question: true } } } } },
                },
              },
            },
          },
        },
      },
    });
    if (!course) throw new InternalServerErrorException('Course not found');

    if (this.isDemo) {
      return {
        _demo: true,
        atRiskStudents: [
          { studentId: 'demo-1', fullName: 'Demo Student A', currentGrade: 42, predictedFinalGrade: 'F (45%)', reason: 'Missed 4 assignments; lowest quiz scores in class' },
        ],
        classWeaknesses: [
          { topic: 'SQL JOINs', affectedPercent: 70, suggestion: 'Re-teach with a worked example session' },
        ],
        highPerformers: [
          { studentId: 'demo-2', fullName: 'Demo Student B', observation: 'Consistently 90%+ on every quiz and assignment' },
        ],
      };
    }

    type EnrolledStudent = typeof course.enrollments[number]['user'];
    const perStudent = course.enrollments.map((e) => {
      const u = e.user as EnrolledStudent;
      const earned = u.submissions.filter((s) => s.grade).reduce((sum, s) => sum + s.grade!.score, 0);
      const possible = u.submissions.filter((s) => s.grade).reduce((sum, s) => sum + s.assignment.maxScore, 0);
      const percent = possible ? Math.round((earned / possible) * 100) : null;
      const submitted = u.submissions.length;
      const att = u.attendance.length;
      const absent = u.attendance.filter((a) => a.status === 'ABSENT').length;
      const quizAvg = u.quizAttempts.length
        ? Math.round(u.quizAttempts.reduce((s, q) => s + (q.totalPoints ? (q.score / q.totalPoints) * 100 : 0), 0) / u.quizAttempts.length)
        : null;
      return {
        id: u.id,
        fullName: u.fullName,
        percent,
        submitted,
        attTotal: att,
        attAbsent: absent,
        quizAvg,
      };
    });

    // Aggregate which quiz questions the class is failing most often, so
    // Claude can surface "the whole class struggles with X".
    const wrongTally = new Map<string, number>();
    for (const enr of course.enrollments) {
      for (const attempt of enr.user.quizAttempts) {
        for (const ans of attempt.answers) {
          if (!ans.isCorrect) {
            const key = ans.question.question.slice(0, 80);
            wrongTally.set(key, (wrongTally.get(key) ?? 0) + 1);
          }
        }
      }
    }
    const topMissed = [...wrongTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const rosterLines = perStudent
      .map((s) =>
        `${s.fullName} | grade ${s.percent !== null ? s.percent + '%' : 'no graded work'} | ${s.submitted} subs | ${s.attAbsent}/${s.attTotal} absent | quiz avg ${s.quizAvg !== null ? s.quizAvg + '%' : 'n/a'}`,
      )
      .join('\n');

    const missedLines = topMissed.map(([q, c]) => `[${c}×] ${q}`).join('\n');

    const prompt = `You are an academic analytics assistant for the course "${course.title}" (${course.code}).
Identify which students are at risk of failing, what topics the class struggles with, and who is excelling.
Be specific — name students, cite numbers. Avoid generic advice.

STUDENT ROSTER (one per line):
${rosterLines}

QUESTIONS MOST OFTEN ANSWERED INCORRECTLY (count × question):
${missedLines || 'No quiz data yet'}

LANGUAGE: respond in ${dto.lang ?? 'en'}.

Return ONLY valid JSON in this exact shape:
{
  "atRiskStudents": [
    { "studentId": "<uuid from roster>", "fullName": "<name>", "currentGrade": <int 0-100>, "predictedFinalGrade": "<letter grade or 'fail risk'>", "reason": "<one specific sentence citing numbers>" }
  ],
  "classWeaknesses": [
    { "topic": "<concept>", "affectedPercent": <int 0-100>, "suggestion": "<concrete teaching action>" }
  ],
  "highPerformers": [
    { "studentId": "<uuid>", "fullName": "<name>", "observation": "<specific compliment>" }
  ]
}`;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new InternalServerErrorException('No response from AI');

    let result: any;
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
    } catch (e) {
      this.logger.error('Class insights parse error', e);
      throw new InternalServerErrorException('Failed to parse class insights response');
    }

    // Replace studentIds with real UUIDs (Claude often makes them up)
    const idByName = new Map(perStudent.map((s) => [s.fullName.toLowerCase(), s.id]));
    if (Array.isArray(result.atRiskStudents)) {
      result.atRiskStudents = result.atRiskStudents.map((r: any) => ({ ...r, studentId: idByName.get(String(r.fullName ?? '').toLowerCase()) ?? r.studentId }));
    }
    if (Array.isArray(result.highPerformers)) {
      result.highPerformers = result.highPerformers.map((r: any) => ({ ...r, studentId: idByName.get(String(r.fullName ?? '').toLowerCase()) ?? r.studentId }));
    }

    await this.log(userId, 'class-insights', prompt.slice(0, 4000), JSON.stringify(result).slice(0, 4000));
    return result;
  }

  async *chatStream(message: string, userId: string, context?: string, lang?: string): AsyncGenerator<string> {
    if (this.isDemo) {
      const demo = this.demoText(lang);
      const demoMsg = `${demo.chatIntro} ${demo.note} ${demo.chatYouAsked} "${message}". ${demo.chatReply}`;
      for (const word of demoMsg.split(' ')) {
        yield word + ' ';
      }
      return;
    }

    const systemPrompt = `You are an AI academic assistant for UniLMS, a university learning management system.
You help students understand course material, clarify assignment requirements, and provide study guidance.
Be concise, encouraging, and educational. ${context ? `Context: ${context}` : ''}`;

    const stream = this.client!.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    });

    let fullResponse = '';
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        fullResponse += event.delta.text;
        yield event.delta.text;
      }
    }

    await this.log(userId, 'chat', message, fullResponse);
  }
}
