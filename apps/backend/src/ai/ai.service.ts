import {
  Injectable,
  Logger,
  InternalServerErrorException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignmentFeedbackDto,
  GenerateQuizDto,
  CourseSummaryDto,
  StudentAnalysisDto,
  StudyCoachDto,
  ClassInsightsDto,
  CodeReviewDto,
  QuizAssistDto,
  QuizAssistAction,
  KahootInsightsDto,
} from './ai.dto';
import { KahootService } from '../kahoot/kahoot.service';
import { Inject, forwardRef } from '@nestjs/common';

const QuizSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()).length(4),
      correctIndex: z.number().int().min(0).max(3),
      explanation: z.string(),
      // AI tags each question with a difficulty tier so adaptive mode can use it.
      // Default to MEDIUM if Claude omits it (older prompts, schema drift).
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional().default('MEDIUM'),
    }),
  ),
});

const CodeReviewSchema = z.object({
  summary: z.string(),
  language: z.string().optional().default('unknown'),
  issues: z.array(
    z.object({
      line: z.number().int().min(1).nullable(),
      severity: z.enum(['critical', 'major', 'minor', 'info']),
      category: z.enum(['bug', 'style', 'performance', 'security', 'design']),
      message: z.string(),
      suggestion: z.string().optional().default(''),
    }),
  ),
  positiveAspects: z.array(z.string()).optional().default([]),
});

/**
 * Lightweight language detection from a code snippet's first 1 KB.
 * Returns a string label that Claude understands; falls back to 'unknown'.
 */
function detectLanguage(code: string): string {
  const head = code.slice(0, 1024);
  if (/^\s*(def |import |class .+:|print\()/m.test(head)) return 'python';
  if (/(public\s+(class|static)|System\.out\.println)/.test(head)) return 'java';
  if (/(#include|std::|->|::)/.test(head)) return 'cpp';
  if (/(\bfunc\s+\w+\(|package\s+main|fmt\.Println)/.test(head)) return 'go';
  if (/(\binterface\s+\w+|:\s*(string|number|boolean)|import\s+\{)/.test(head)) return 'typescript';
  if (/(\b(function|const|let|var)\s+\w+|require\(|=>)/.test(head)) return 'javascript';
  if (/(SELECT |INSERT |UPDATE |CREATE\s+TABLE)/i.test(head)) return 'sql';
  if (/<\w+[^>]*>.*<\/\w+>/s.test(head)) return 'html';
  return 'unknown';
}

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
function shuffleQuizAnswers<T extends { options: string[]; correctIndex: number }>(questions: T[]): T[] {
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
    assignmentStrengths: [
      'Clear structure and logical flow',
      'Addresses the core requirements',
      'Good use of terminology',
    ],
    assignmentImprovements: [
      'Could expand on supporting arguments',
      'More specific examples would strengthen the response',
    ],
    assignmentSuggestions: [
      'Review lecture notes on this topic',
      'Compare with model solutions if available',
      'Ask your teacher for clarification on any unclear points',
    ],
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
    analysisRecommendations: [
      'Schedule office hours with instructor',
      'Form study groups with peers',
      'Review feedback on past assignments',
    ],
    chatIntro: '[Demo mode]',
    chatYouAsked: 'You asked:',
    chatReply: 'In a real deployment, I would provide a detailed academic response here.',
  },
  ru: {
    note: 'Это демо-ответ. Укажите LLM_API_KEY, чтобы включить настоящий ИИ.',
    assignmentAssessment: 'В целом работа показывает хорошее понимание требований задания.',
    assignmentStrengths: [
      'Понятная структура и логичный ход мысли',
      'Затронуты основные требования задания',
      'Термины использованы уместно',
    ],
    assignmentImprovements: [
      'Можно подробнее раскрыть аргументацию',
      'Более конкретные примеры сделали бы ответ сильнее',
    ],
    assignmentSuggestions: [
      'Повторите конспекты и материалы по теме',
      'Сравните ответ с примерами решений, если они доступны',
      'Уточните спорные моменты у преподавателя',
    ],
    quizQuestionPrefix: '[Демо] Пример вопроса',
    quizQuestionAbout: 'по теме',
    quizCorrect: 'Вариант A (верный)',
    quizOptions: ['Вариант B', 'Вариант C', 'Вариант D'],
    quizExplanation: 'Это демонстрационный вопрос-заглушка.',
    courseSummary: 'охватывает фундаментальные концепции и их практическое применение.',
    courseTopics: ['Базовые концепции', 'Практическое применение', 'Стратегии оценки знаний'],
    courseTips: [
      'Регулярно просматривайте материалы',
      'Сдавайте задания вовремя',
      'Участвуйте в обсуждениях и занятиях',
    ],
    analysis: 'показывает стабильную вовлечённость в курс и своевременно сдаёт работы.',
    analysisStrengths: ['Стабильная сдача заданий', 'Хорошая посещаемость'],
    analysisImprovements: [
      'Есть потенциал улучшить результаты по баллам',
      'Стоит активнее участвовать в учебной работе',
    ],
    analysisRecommendations: [
      'Запишитесь на консультацию к преподавателю',
      'Организуйте учебную группу с однокурсниками',
      'Пересмотрите комментарии к прошлым работам',
    ],
    chatIntro: '[Демо-режим]',
    chatYouAsked: 'Вы спросили:',
    chatReply: 'В реальном режиме я бы дал здесь более подробный академический ответ.',
  },
  kz: {
    note: 'Бұл демо-жауап. Нақты ЖИ қосу үшін LLM_API_KEY орнатыңыз.',
    assignmentAssessment: 'Жалпы алғанда, бұл жұмыс тапсырма талаптарын жақсы түсінетінін көрсетеді.',
    assignmentStrengths: [
      'Құрылымы түсінікті және ой ағымы логикалық',
      'Тапсырманың негізгі талаптары қамтылған',
      'Терминдер орынды қолданылған',
    ],
    assignmentImprovements: ['Дәлелдерді сәл кеңірек ашуға болады', 'Нақты мысалдар жауапты күшейтер еді'],
    assignmentSuggestions: [
      'Тақырып бойынша дәріс жазбаларын қайталаңыз',
      'Мүмкін болса, үлгі шешімдермен салыстырыңыз',
      'Түсініксіз жерлерді оқытушымен нақтылаңыз',
    ],
    quizQuestionPrefix: '[Демо] Үлгі сұрақ',
    quizQuestionAbout: 'тақырыбы бойынша',
    quizCorrect: 'A нұсқасы (дұрыс)',
    quizOptions: ['B нұсқасы', 'C нұсқасы', 'D нұсқасы'],
    quizExplanation: 'Бұл демонстрациялық үлгі сұрақ.',
    courseSummary: 'негізгі ұғымдар мен олардың практикалық қолданылуын қамтиды.',
    courseTopics: ['Негізгі ұғымдар', 'Практикалық қолдану', 'Бағалау стратегиялары'],
    courseTips: [
      'Материалдарды жүйелі түрде қайталаңыз',
      'Тапсырмаларды уақытында тапсырыңыз',
      'Талқылаулар мен сабақтарға белсенді қатысыңыз',
    ],
    analysis: 'курс материалдарына тұрақты түрде қатысып, жұмыстарын уақытында тапсырады.',
    analysisStrengths: ['Тапсырмаларды тұрақты тапсырады', 'Қатысу көрсеткіші жақсы'],
    analysisImprovements: ['Ұпай нәтижелерін әлі де жақсартуға болады', 'Оқу процесіне белсендірек қатысу ұсынылады'],
    analysisRecommendations: [
      'Оқытушымен жеке кеңеске жазылыңыз',
      'Топтастармен бірге оқу тобын құрыңыз',
      'Алдыңғы жұмыстарға берілген пікірлерді қайта қарап шығыңыз',
    ],
    chatIntro: '[Демо режимі]',
    chatYouAsked: 'Сіз сұрадыңыз:',
    chatReply: 'Нақты режимде мен мұнда толығырақ академиялық жауап берер едім.',
  },
} as const;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;
  /**
   * Flips to true on first auth failure from Anthropic. After this, `isDemo`
   * starts returning true, so every AI endpoint silently switches to demo
   * responses instead of bubbling 500s to the UI. The admin still sees a
   * persistent warning in the logs telling them to fix the key.
   *
   * Why runtime detection instead of startup ping:
   *   - A startup ping would block app boot until Anthropic responds, which
   *     hurts container readiness probes and tests.
   *   - Anthropic may transient-fail (5xx) on cold start — we only want to
   *     give up on 401, not on every transient error.
   */
  private keyInvalid = false;

  constructor(
    private db: PrismaService,
    @Inject(forwardRef(() => KahootService))
    private kahootSvc: KahootService,
  ) {
    const apiKey = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.logger.warn('LLM_API_KEY not set — AI features running in demo mode');
    }
  }

  /**
   * True when we have no client OR when the configured key has been proven
   * invalid by a previous request. Either way, callers should serve demo data.
   */
  get isDemo() {
    return !this.client || this.keyInvalid;
  }

  /**
   * Wrapper used by every AI method to call Anthropic with auto-fallback.
   * If the SDK returns 401, we flip `keyInvalid=true` once and re-throw a
   * sentinel error; callers catch it and serve demo data on this request.
   * Subsequent requests skip the network entirely via `isDemo`.
   */
  private flagInvalidIfAuthError(err: unknown): boolean {
    // Anthropic SDK errors expose `status` on APIError
    const status = (err as { status?: number } | null)?.status;
    if (status === 401 || status === 403) {
      if (!this.keyInvalid) {
        this.logger.error(
          'Anthropic returned auth error (401/403) — flipping to demo mode globally. ' +
            'Replace LLM_API_KEY with a valid Anthropic key (sk-ant-api03-...) and restart.',
        );
      }
      this.keyInvalid = true;
      return true;
    }
    return false;
  }

  /**
   * Diagnostic snapshot of AI module configuration. Used by the frontend
   * AI-chat banner to explain WHY responses are demo. Safe to expose to any
   * authenticated user — `keyPrefix` is only the first 12 chars, enough to
   * help debugging without leaking the secret.
   */
  getStatus():
    | { configured: false; demo: true; reason: 'no_key' }
    | { configured: true; demo: true; reason: 'invalid_key'; keyPrefix: string; hint: string }
    | { configured: true; demo: false } {
    if (!this.client) {
      return { configured: false, demo: true, reason: 'no_key' };
    }
    if (this.keyInvalid) {
      const key = process.env.LLM_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '';
      return {
        configured: true,
        demo: true,
        reason: 'invalid_key',
        keyPrefix: key.slice(0, 12),
        hint: 'Anthropic rejected this key with HTTP 401. Replace it in apps/backend/.env (real keys start with sk-ant-api03-) and restart the backend container.',
      };
    }
    return { configured: true, demo: false };
  }

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

  /**
   * Wrap an Anthropic `messages.create` call so a 401/403 cleanly fans out
   * to demo mode for this request *and all subsequent ones*. Other errors
   * (network blip, 500 from Anthropic, malformed JSON) re-throw to the caller.
   *
   * Returns either the real Anthropic response, or `null` if auth failed —
   * caller is expected to check for null and substitute its demo response.
   */
  private async safeCreate(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message | null> {
    try {
      return await this.client!.messages.create(params);
    } catch (err) {
      if (this.flagInvalidIfAuthError(err)) return null;
      throw err;
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

    const demoResponse = {
      _demo: true as const,
      assessment: `${demo.note} ${demo.assignmentAssessment}`,
      strengths: demo.assignmentStrengths,
      improvements: demo.assignmentImprovements,
      suggestions: demo.assignmentSuggestions,
    };
    if (this.isDemo) return demoResponse;

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

    const response = await this.safeCreate({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    if (!response) return demoResponse;

    const textBlock = response.content.find((b) => b.type === 'text');
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

    // Per-level breakdown (Feature #1.5). If the teacher provided ANY of the
    // three counts, require ALL three and enforce sum=questionCount. This
    // mirrors the frontend "calculator" UX — the bad-data UI message is
    // identical to the server-side BadRequest so misuse is caught either side.
    const perLevelProvided =
      dto.easyCount !== undefined || dto.mediumCount !== undefined || dto.hardCount !== undefined;
    const easyN = dto.easyCount ?? 0;
    const mediumN = dto.mediumCount ?? 0;
    const hardN = dto.hardCount ?? 0;
    if (perLevelProvided) {
      if (dto.easyCount === undefined || dto.mediumCount === undefined || dto.hardCount === undefined) {
        throw new BadRequestException(
          'Provide all three counts (easyCount, mediumCount, hardCount) or none — partial breakdown is ambiguous.',
        );
      }
      if (easyN + mediumN + hardN !== count) {
        throw new BadRequestException(
          `Per-level counts must sum to questionCount: got ${easyN}+${mediumN}+${hardN}=${easyN + mediumN + hardN}, expected ${count}. Please enter correct numbers.`,
        );
      }
    }

    const course = await this.db.course.findUnique({ where: { id: dto.courseId } });
    const courseName = course?.title ?? 'the course';

    const buildDemoQuiz = () => {
      // Spread demo questions across EASY/MEDIUM/HARD so adaptive mode has
      // something to walk through in dev without a real LLM key.
      const TIERS: Array<'EASY' | 'MEDIUM' | 'HARD'> = ['EASY', 'MEDIUM', 'HARD'];
      const demoQuestions = Array.from({ length: count }, (_, i) => ({
        question: `${demo.quizQuestionPrefix} ${i + 1} ${demo.quizQuestionAbout} "${dto.topic}"?`,
        options: [demo.quizCorrect, ...demo.quizOptions],
        correctIndex: 0,
        explanation: `${demo.note} ${demo.quizExplanation}`,
        difficulty: TIERS[i % 3],
      }));
      return {
        _demo: true as const,
        questions: shuffleQuizAnswers(demoQuestions),
      };
    };
    if (this.isDemo) return buildDemoQuiz();

    // Difficulty-distribution prompt. Two modes:
    //   1. Per-level (Feature #1.5) — teacher specified exact counts, AI gets
    //      a strict "exactly N EASY, M MEDIUM, K HARD" instruction.
    //   2. Single difficulty (legacy) — soft percentage hint that lets the
    //      AI bias toward the chosen tier but stay varied for adaptive mode.
    const difficultyHint = perLevelProvided
      ? `Generate exactly ${easyN} EASY, ${mediumN} MEDIUM, and ${hardN} HARD questions. The total must be ${count}.`
      : difficulty === 'easy'
        ? 'Distribute as EASY=70%, MEDIUM=30%.'
        : difficulty === 'hard'
          ? 'Distribute as HARD=70%, MEDIUM=30%.'
          : 'Distribute roughly evenly: EASY≈33%, MEDIUM≈33%, HARD≈33%.';

    // When the teacher uploaded a lecture file (Feature #1), use that text
    // as the *primary* source. Without uploaded material, Claude generates
    // generic questions about the topic from its own knowledge — fine, but
    // not aligned to what this teacher actually covered. With uploaded
    // material, Claude is told to ground every question in the text, so
    // the quiz becomes course-specific.
    const materialBlock =
      dto.materialText && dto.materialText.trim().length > 50
        ? `
The teacher provided the following lecture material. Generate questions STRICTLY from this material — do not invent facts that aren't supported by the text. If the material doesn't cover the requested topic well, still anchor every question to a concept that appears in the material.

--- LECTURE MATERIAL START ---
${dto.materialText}
--- LECTURE MATERIAL END ---

`
        : '';

    const prompt = `${materialBlock}Generate a quiz about "${dto.topic}" for the course "${courseName}".
Create exactly ${count} multiple-choice questions.
Each question must have exactly 4 answer options (A, B, C, D).

Each question MUST be tagged with a difficulty tier: EASY, MEDIUM, or HARD.
${difficultyHint}
- EASY = recall of definitions, single-step facts.
- MEDIUM = applying a concept to a concrete situation, one inference step.
- HARD = multi-step reasoning, edge cases, or comparing competing approaches.

Return ONLY valid JSON matching this exact structure:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Brief explanation of the correct answer",
      "difficulty": "MEDIUM"
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
    let response;
    try {
      const stream = this.client!.messages.stream({
        model: 'claude-sonnet-4-6',
        // Hard 15+ question quizzes routinely fill 12-14k tokens because each
        // option may be a multi-line SQL query. Headroom prevents truncation.
        max_tokens: 24000,
        messages: [{ role: 'user', content: prompt }],
      });
      response = await stream.finalMessage();
    } catch (e) {
      if (this.flagInvalidIfAuthError(e)) return buildDemoQuiz();
      throw e;
    }

    const textBlock = response.content.find((b) => b.type === 'text');
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
      throw new InternalServerErrorException(
        'AI returned malformed JSON — please try again, or reduce question count.',
      );
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

  /**
   * Feature #2 — inline AI assist inside the Quiz Editor.
   *
   * Single endpoint handles three discrete teacher actions; the prompt
   * template and response schema change per action but the Claude call
   * and JSON-extraction plumbing are shared so we don't fork the
   * Anthropic-streaming workaround three times.
   *
   *   improve-question     → polish wording of an existing question
   *   generate-options     → produce 4 plausible options (correct + 3
   *                          distractors) for a question that has only
   *                          text
   *   generate-explanation → write the after-answer rationale teachers
   *                          rarely have time to write themselves
   *
   * Demo-mode fallbacks are deliberate strings teachers can recognise
   * as placeholders so a missing LLM key doesn't ship dishonest output.
   */
  async quizAssist(dto: QuizAssistDto, userId: string) {
    const demo = this.demoText(dto.lang);
    const langInstruction = this.langInstructionFor(dto.lang);

    // Demo-mode short-circuit. Returns a deterministic stub per action
    // so frontend smoke-tests don't depend on Anthropic availability.
    if (this.isDemo) {
      return this.buildAssistDemo(dto);
    }

    if (dto.action === 'generate-explanation') {
      // For explanation we want full context (which option is correct)
      // so the explanation actually justifies the right answer.
      if (!dto.options || dto.correctIndex === undefined) {
        throw new BadRequestException(
          'generate-explanation needs both `options` and `correctIndex` so we can explain WHY the chosen answer is correct.',
        );
      }
      if (dto.correctIndex >= dto.options.length) {
        throw new BadRequestException('correctIndex out of range for the provided options array.');
      }
    }

    const prompt = this.buildAssistPrompt(dto, langInstruction);

    let response;
    try {
      const stream = this.client!.messages.stream({
        model: 'claude-sonnet-4-6',
        // Single-question payloads are small; 2k tokens is plenty even
        // for a verbose explanation.
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });
      response = await stream.finalMessage();
    } catch (e) {
      if (this.flagInvalidIfAuthError(e)) return this.buildAssistDemo(dto);
      throw e;
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new InternalServerErrorException('No response from AI');

    const rawText = (textBlock.text as string)
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/```$/g, '')
      .trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      this.logger.error(`quizAssist JSON parse failed (action=${dto.action}). Raw: ${rawText.slice(0, 800)}`);
      throw new InternalServerErrorException('AI returned malformed JSON — please try again.');
    }

    // Light validation per action — strip unexpected keys so the
    // frontend can rely on a stable shape.
    const result = this.shapeAssistResult(dto.action, parsed);
    await this.log(userId, `quiz-assist:${dto.action}`, prompt, JSON.stringify(result));
    return result;
  }

  /** Per-action prompt builder. */
  private buildAssistPrompt(dto: QuizAssistDto, langInstruction: string): string {
    if (dto.action === 'improve-question') {
      return `${langInstruction}Improve this multiple-choice quiz question. Make it clearer, more specific, and pedagogically sound. Keep the same intent and difficulty level — do NOT make it harder or easier.

Current question: "${dto.question}"

Return ONLY valid JSON in this exact shape:
{"question": "the improved question text here"}

No prose, no fences, no commentary.`;
    }
    if (dto.action === 'generate-options') {
      return `${langInstruction}Generate 4 multiple-choice answer options for this quiz question. Index 0 must be the correct answer. Indexes 1-3 are plausible distractors that someone with a partial misunderstanding could pick — not silly throwaways.

Question: "${dto.question}"

Return ONLY valid JSON:
{"options": ["correct answer", "distractor 1", "distractor 2", "distractor 3"], "correctIndex": 0}

correctIndex MUST be 0. No prose, no fences.`;
    }
    // generate-explanation
    const opts = dto.options!.map((o, i) => `${i === dto.correctIndex ? '[CORRECT] ' : ''}${o}`).join('; ');
    return `${langInstruction}Write a 2-3 sentence explanation for why the marked-correct answer is right. This will be shown to students immediately after they answer. Be specific — reference the underlying concept, not just "because it is".

Question: "${dto.question}"
Options: ${opts}

Return ONLY valid JSON:
{"explanation": "your explanation here"}

No prose, no fences.`;
  }

  private langInstructionFor(lang?: string): string {
    const l = this.resolveLang(lang);
    if (l === 'ru') return 'Respond in Russian. ';
    if (l === 'kz') return 'Respond in Kazakh. ';
    return '';
  }

  /** Demo-mode placeholders, marked so teachers know AI isn't configured. */
  private buildAssistDemo(dto: QuizAssistDto) {
    if (dto.action === 'improve-question') {
      return { _demo: true, question: `[demo] ${dto.question.trim().replace(/\?$/, '')} — clearer version?` };
    }
    if (dto.action === 'generate-options') {
      return {
        _demo: true,
        options: ['[demo] correct answer', '[demo] distractor 1', '[demo] distractor 2', '[demo] distractor 3'],
        correctIndex: 0,
      };
    }
    return { _demo: true, explanation: `[demo] This is the correct answer because the LLM key is not configured.` };
  }

  /** Trim parsed AI response to the action's contract. */
  private shapeAssistResult(action: QuizAssistAction, parsed: any) {
    if (action === 'improve-question') {
      const question = String(parsed?.question ?? '').trim();
      if (!question) throw new InternalServerErrorException('AI did not return an improved question.');
      return { question };
    }
    if (action === 'generate-options') {
      const options = Array.isArray(parsed?.options) ? parsed.options.map((o: unknown) => String(o)) : [];
      if (options.length < 2) throw new InternalServerErrorException('AI did not return enough options.');
      const correctIndex = typeof parsed?.correctIndex === 'number' ? parsed.correctIndex : 0;
      if (correctIndex < 0 || correctIndex >= options.length) {
        return { options, correctIndex: 0 };
      }
      return { options, correctIndex };
    }
    // generate-explanation
    const explanation = String(parsed?.explanation ?? '').trim();
    if (!explanation) throw new InternalServerErrorException('AI did not return an explanation.');
    return { explanation };
  }

  /**
   * Feature #3 — AI insights on a finished Kahoot session report.
   *
   * Reuses KahootService.getSessionReport so auth (host-or-admin) and
   * data shape are identical to what the report page already trusts.
   * Two scopes:
   *
   *   - class: 2-paragraph narrative about how the room performed +
   *     per-question "misconception" notes for any question with
   *     accuracy < 50%.
   *   - student: 1-paragraph analysis of one player's answers, leading
   *     with their strongest topics and ending with the gap to focus on.
   *
   * Demo-mode shortcuts return clearly-marked placeholder text so the
   * UI surfaces "AI configured?" status honestly.
   */
  async kahootInsights(dto: KahootInsightsDto, user: { id: string; role: string }) {
    const scope = dto.scope ?? 'class';

    // ensureHostOrAdmin runs inside getSessionReport — 403 propagates
    // through and the controller doesn't need its own check.
    const report = await this.kahootSvc.getSessionReport(dto.sessionId, user as any);

    if (scope === 'student' && !dto.studentId) {
      throw new BadRequestException('studentId is required when scope=student');
    }
    const targetPlayer = scope === 'student' ? report.perPlayer.find((p) => p.userId === dto.studentId) : undefined;
    if (scope === 'student' && !targetPlayer) {
      throw new BadRequestException('studentId not found in this session');
    }

    if (this.isDemo) {
      return this.buildKahootInsightsDemo(scope, report, targetPlayer);
    }

    const prompt = this.buildKahootInsightsPrompt(scope, report, targetPlayer, dto.lang);

    let response;
    try {
      const stream = this.client!.messages.stream({
        model: 'claude-sonnet-4-6',
        // A 20-player × 15-question class JSON sits comfortably under
        // 4k tokens; 8k output ceiling leaves room for a long narrative
        // with per-question misconception bullets.
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });
      response = await stream.finalMessage();
    } catch (e) {
      if (this.flagInvalidIfAuthError(e)) return this.buildKahootInsightsDemo(scope, report, targetPlayer);
      throw e;
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new InternalServerErrorException('No response from AI');

    const rawText = (textBlock.text as string)
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/```$/g, '')
      .trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      this.logger.error(`kahootInsights JSON parse failed (scope=${scope}). Raw: ${rawText.slice(0, 800)}`);
      throw new InternalServerErrorException('AI returned malformed JSON — please try again.');
    }

    const shaped = this.shapeKahootInsights(scope, parsed);
    await this.log(user.id, `kahoot-insights:${scope}`, prompt, JSON.stringify(shaped));
    return shaped;
  }

  private buildKahootInsightsPrompt(scope: 'class' | 'student', report: any, targetPlayer: any, lang?: string): string {
    const langInstr = this.langInstructionFor(lang);

    if (scope === 'class') {
      const perQ = report.perQuestion.map((q: any) => ({
        position: q.position + 1,
        question: q.questionText,
        accuracy: q.accuracyPercent,
        correct: q.options[q.correctIndex],
        distribution: q.options.map((o: string, i: number) => ({ option: o, picked: q.answerDistribution[i] })),
      }));
      return `${langInstr}You are a teaching assistant analysing a class quiz session. Write a concise narrative for the teacher about how the room did, then call out per-question misconceptions for any question with <50% accuracy.

Session: "${report.session.quizTitle}"
Players: ${report.summary.totalPlayers}
Average score: ${report.summary.averageScore}%
Per-question data:
${JSON.stringify(perQ, null, 2)}

Return ONLY valid JSON in this exact shape:
{
  "summary": "2-3 sentence overall narrative for the teacher",
  "strongestTopic": "what the class did best on",
  "weakestTopic": "what they struggled with most",
  "misconceptions": [
    { "questionPosition": 3, "explanation": "Why students likely picked the wrong option, in 1-2 sentences." }
  ]
}

Only include questions with accuracy under 50 percent in misconceptions. No prose outside the JSON, no fences.`;
    }

    // student scope
    const player = targetPlayer;
    const answers = player.answers.map((a: any) => ({
      question: a.questionText,
      picked: a.pickedIndex,
      correct: a.correctIndex,
      isCorrect: a.isCorrect,
    }));
    return `${langInstr}You are a teaching assistant writing personal feedback for one student after a class quiz. Lead with what they did well, end with the single most important gap to address.

Quiz: "${report.session.quizTitle}"
Student: ${player.fullName}
Score: ${player.score}% (${player.correctCount} / ${report.session.totalQuestions} correct)
Answers:
${JSON.stringify(answers, null, 2)}

Return ONLY valid JSON in this exact shape:
{
  "summary": "2-3 sentence personal feedback (uses 'you' — speak to the student)",
  "strengths": ["what they got right and what concept it represents"],
  "gaps": ["concept they missed (1-2 items max)"],
  "nextStep": "ONE concrete action they should take next"
}

No prose outside the JSON, no fences.`;
  }

  private buildKahootInsightsDemo(scope: 'class' | 'student', report: any, targetPlayer?: any) {
    if (scope === 'class') {
      return {
        _demo: true as const,
        summary: `[demo] Class of ${report.summary.totalPlayers} averaged ${report.summary.averageScore}%. Real narrative needs an LLM key.`,
        strongestTopic: '[demo] strongest topic',
        weakestTopic: '[demo] weakest topic',
        misconceptions: report.perQuestion
          .filter((q: any) => q.accuracyPercent < 50)
          .slice(0, 3)
          .map((q: any) => ({
            questionPosition: q.position + 1,
            explanation: `[demo] Q${q.position + 1} had ${q.accuracyPercent}% accuracy — students may have confused the correct option with a similar one.`,
          })),
      };
    }
    return {
      _demo: true as const,
      summary: `[demo] ${targetPlayer?.fullName ?? 'Student'} scored ${targetPlayer?.score ?? 0}%. Connect an LLM key for real feedback.`,
      strengths: ['[demo] strength 1'],
      gaps: ['[demo] gap 1'],
      nextStep: '[demo] Configure LLM_API_KEY and re-run.',
    };
  }

  private shapeKahootInsights(scope: 'class' | 'student', parsed: any) {
    if (scope === 'class') {
      return {
        summary: String(parsed?.summary ?? '').trim(),
        strongestTopic: String(parsed?.strongestTopic ?? '').trim(),
        weakestTopic: String(parsed?.weakestTopic ?? '').trim(),
        misconceptions: Array.isArray(parsed?.misconceptions)
          ? parsed.misconceptions
              .filter((m: any) => typeof m?.explanation === 'string')
              .map((m: any) => ({
                questionPosition: Number(m.questionPosition) || 0,
                explanation: String(m.explanation).trim(),
              }))
          : [],
      };
    }
    return {
      summary: String(parsed?.summary ?? '').trim(),
      strengths: Array.isArray(parsed?.strengths) ? parsed.strengths.map((s: any) => String(s)) : [],
      gaps: Array.isArray(parsed?.gaps) ? parsed.gaps.map((g: any) => String(g)) : [],
      nextStep: String(parsed?.nextStep ?? '').trim(),
    };
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

    const demoSummary = {
      _demo: true as const,
      summary: `${demo.note} ${course.title} ${demo.courseSummary}`,
      keyTopics: demo.courseTopics,
      tips: demo.courseTips,
      workload: 'moderate' as const,
    };
    if (this.isDemo) return demoSummary;

    const assignmentTitles = course.assignments.map((a) => `- ${a.title} (max ${a.maxScore}pts)`).join('\n');
    const recentAnnouncements = course.announcements.map((a) => `- ${a.title}`).join('\n');

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

    const response = await this.safeCreate({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    if (!response) return demoSummary;

    const textBlock = response.content.find((b) => b.type === 'text');
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

    const demoAnalysis = {
      _demo: true as const,
      analysis: `${demo.note} ${student.fullName} ${demo.analysis}`,
      strengths: demo.analysisStrengths,
      areasToImprove: demo.analysisImprovements,
      recommendations: demo.analysisRecommendations,
      riskLevel: 'low' as const,
    };
    if (this.isDemo) return demoAnalysis;

    const gradeLines = student.submissions
      .filter((s) => s.grade)
      .map((s) => `${s.assignment.course.code} / ${s.assignment.title}: ${s.grade!.score}/${s.assignment.maxScore}`)
      .join('\n');

    const totalAttendance = student.attendance.length;
    const presentCount = student.attendance.filter((a) => a.status === 'PRESENT').length;
    const lateCount = student.attendance.filter((a) => a.status === 'LATE').length;

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

    const response = await this.safeCreate({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    if (!response) return demoAnalysis;

    const textBlock = response.content.find((b) => b.type === 'text');
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
  private currentGradePercent(
    submissions: Array<{ grade: { score: number } | null; assignment: { maxScore: number } }>,
  ): number | null {
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
        ...(dto.courseId
          ? { courseId: dto.courseId }
          : {
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

    const demoCoach = {
      _demo: true as const,
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
        {
          pattern: 'You consistently swap LEFT and RIGHT JOIN semantics',
          recommendation: 'Memorize: "LEFT keeps the LEFT table\'s rows"',
        },
      ],
    };
    if (this.isDemo) return demoCoach;

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

    const upcomingLines = upcoming
      .map((a) => `${a.course.code} | ${a.title} (due ${a.dueAt.toISOString().slice(0, 10)}, max ${a.maxScore} pts)`)
      .join('\n');

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

    const response = await this.safeCreate({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    if (!response) return demoCoach;

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

    const demoInsights = {
      _demo: true as const,
      atRiskStudents: [
        {
          studentId: 'demo-1',
          fullName: 'Demo Student A',
          currentGrade: 42,
          predictedFinalGrade: 'F (45%)',
          reason: 'Missed 4 assignments; lowest quiz scores in class',
        },
      ],
      classWeaknesses: [
        { topic: 'SQL JOINs', affectedPercent: 70, suggestion: 'Re-teach with a worked example session' },
      ],
      highPerformers: [
        {
          studentId: 'demo-2',
          fullName: 'Demo Student B',
          observation: 'Consistently 90%+ on every quiz and assignment',
        },
      ],
    };
    if (this.isDemo) return demoInsights;

    type EnrolledStudent = (typeof course.enrollments)[number]['user'];
    const perStudent = course.enrollments.map((e) => {
      const u = e.user as EnrolledStudent;
      const earned = u.submissions.filter((s) => s.grade).reduce((sum, s) => sum + s.grade!.score, 0);
      const possible = u.submissions.filter((s) => s.grade).reduce((sum, s) => sum + s.assignment.maxScore, 0);
      const percent = possible ? Math.round((earned / possible) * 100) : null;
      const submitted = u.submissions.length;
      const att = u.attendance.length;
      const absent = u.attendance.filter((a) => a.status === 'ABSENT').length;
      const quizAvg = u.quizAttempts.length
        ? Math.round(
            u.quizAttempts.reduce((s, q) => s + (q.totalPoints ? (q.score / q.totalPoints) * 100 : 0), 0) /
              u.quizAttempts.length,
          )
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
      .map(
        (s) =>
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

    const response = await this.safeCreate({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    if (!response) return demoInsights;

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
      result.atRiskStudents = result.atRiskStudents.map((r: any) => ({
        ...r,
        studentId: idByName.get(String(r.fullName ?? '').toLowerCase()) ?? r.studentId,
      }));
    }
    if (Array.isArray(result.highPerformers)) {
      result.highPerformers = result.highPerformers.map((r: any) => ({
        ...r,
        studentId: idByName.get(String(r.fullName ?? '').toLowerCase()) ?? r.studentId,
      }));
    }

    await this.log(userId, 'class-insights', prompt.slice(0, 4000), JSON.stringify(result).slice(0, 4000));
    return result;
  }

  async reviewCode(dto: CodeReviewDto, userId: string, userRole: string) {
    const demo = this.demoText(dto.lang);
    const submission = await this.db.submission.findUnique({
      where: { id: dto.submissionId },
      include: { assignment: { select: { id: true, title: true, courseId: true } } },
    });
    if (!submission) throw new InternalServerErrorException('Submission not found');

    // Students may only review their own submissions; staff can review anyone's
    if (userRole === 'STUDENT' && submission.studentId !== userId) {
      throw new ForbiddenException('You can only request a code review on your own submission');
    }

    const code = submission.contentText ?? '';
    if (!code.trim()) {
      return {
        _empty: true,
        summary: 'No code text in this submission to review. Attached files cannot yet be analysed by AI Code Review.',
        language: 'unknown',
        issues: [],
        positiveAspects: [],
      };
    }

    // Cap input to keep token cost predictable (12 KB ≈ ~3k tokens of code)
    const truncated = code.slice(0, 12_000);
    const wasTruncated = code.length > truncated.length;
    const language = dto.language || detectLanguage(truncated);

    const demoReview = {
      _demo: true as const,
      summary: `${demo.note} Demo review: code structure looks reasonable; consider adding input validation and tests.`,
      language,
      issues: [
        {
          line: 1,
          severity: 'info' as const,
          category: 'design' as const,
          message: 'Consider adding a module-level docstring or comment.',
          suggestion: 'Document the purpose, inputs, and outputs at the top of the file.',
        },
        {
          line: Math.max(1, Math.min(10, truncated.split('\n').length)),
          severity: 'minor' as const,
          category: 'style' as const,
          message: 'Variable names could be more descriptive in this section.',
          suggestion: 'Rename short variables like `x` or `n` to convey intent.',
        },
      ],
      positiveAspects: ['Clear logical structure', 'No obvious dead code'],
    };
    if (this.isDemo) return demoReview;

    const systemPrompt = `You are a senior software engineer doing a code review for a university programming assignment.
Be constructive and educational, not condescending. Focus on real issues, not nitpicks.
Return STRICT JSON only — no prose before or after.`;

    const userPrompt = `Review this ${language} submission for assignment "${submission.assignment.title}".
${wasTruncated ? '(Code was truncated to 12 KB for analysis.)\n' : ''}
Code:
\`\`\`${language}
${truncated}
\`\`\`

Return JSON with this shape (no additional fields, no trailing prose):
{
  "summary": "1-2 sentences describing overall quality and main themes",
  "language": "${language}",
  "issues": [
    {
      "line": <1-indexed line number or null if not line-specific>,
      "severity": "critical" | "major" | "minor" | "info",
      "category": "bug" | "style" | "performance" | "security" | "design",
      "message": "what's wrong, in plain language",
      "suggestion": "concrete fix or example"
    }
  ],
  "positiveAspects": ["short bullet of something the student did well", "..."]
}

Rules:
- 0 to 12 issues maximum. Prefer fewer, higher-quality issues over many trivial ones.
- "critical" = correctness bug or security risk. "major" = clear defect. "minor" = code smell. "info" = optional improvement.
- Always include 1-3 positive aspects, even for weak code (this is for student morale).
- Use the EXACT line number from the snippet, not relative offsets.`;

    let raw: string;
    try {
      const response = await this.client!.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') throw new Error('No text in AI response');
      raw = textBlock.text;
    } catch (e: any) {
      if (this.flagInvalidIfAuthError(e)) return demoReview;
      this.logger.warn(`Code review AI call failed: ${e.message}`);
      throw new InternalServerErrorException('AI code review failed — please try again');
    }

    // Extract the largest {...} JSON block; strip ```json fences if present
    const cleaned = raw.replace(/```(?:json)?/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const jsonText = match ? match[0] : cleaned;

    let parsed: z.infer<typeof CodeReviewSchema>;
    try {
      const candidate = JSON.parse(jsonText);
      parsed = CodeReviewSchema.parse(candidate);
    } catch (e: any) {
      this.logger.warn(`Code review JSON parse failed: ${e.message}; raw=${raw.slice(0, 200)}`);
      // Graceful degradation: return the raw text as a single summary issue
      return {
        _parseFailed: true,
        summary: 'AI returned a response that could not be parsed as structured JSON.',
        language,
        issues: [],
        positiveAspects: [],
        rawText: raw.slice(0, 2000),
      };
    }

    await this.log(userId, 'code-review', userPrompt.slice(0, 2000), JSON.stringify(parsed).slice(0, 4000));

    return { ...parsed, truncated: wasTruncated };
  }

  async *chatStream(message: string, userId: string, context?: string, lang?: string): AsyncGenerator<string> {
    // Demo chunks reused on cold start AND on auth fallback.
    const buildDemoChunks = () => {
      const demo = this.demoText(lang);
      const demoMsg = `${demo.chatIntro} ${demo.note} ${demo.chatYouAsked} "${message}". ${demo.chatReply}`;
      return demoMsg.split(' ').map((w) => w + ' ');
    };

    if (this.isDemo) {
      for (const w of buildDemoChunks()) yield w;
      return;
    }

    const systemPrompt = `You are an AI academic assistant for UniLMS, a university learning management system.
You help students understand course material, clarify assignment requirements, and provide study guidance.
Be concise, encouraging, and educational. ${context ? `Context: ${context}` : ''}`;

    let stream;
    try {
      stream = this.client!.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      });
    } catch (e) {
      if (this.flagInvalidIfAuthError(e)) {
        for (const w of buildDemoChunks()) yield w;
        return;
      }
      throw e;
    }

    let fullResponse = '';
    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullResponse += event.delta.text;
          yield event.delta.text;
        }
      }
    } catch (e) {
      // Auth errors surface here for streaming — the SDK throws on first chunk
      // read, not at .stream() construction. Fall through to demo.
      if (this.flagInvalidIfAuthError(e)) {
        for (const w of buildDemoChunks()) yield w;
        return;
      }
      throw e;
    }

    await this.log(userId, 'chat', message, fullResponse);
  }
}
