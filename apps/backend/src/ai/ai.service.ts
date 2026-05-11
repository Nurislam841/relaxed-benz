import { Injectable, Logger, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentFeedbackDto, GenerateQuizDto, CourseSummaryDto, StudentAnalysisDto } from './ai.dto';

const QuizSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string(),
  })),
});

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
      return {
        _demo: true,
        questions: Array.from({ length: count }, (_, i) => ({
          question: `${demo.quizQuestionPrefix} ${i + 1} ${demo.quizQuestionAbout} "${dto.topic}"?`,
          options: [demo.quizCorrect, ...demo.quizOptions],
          correctIndex: 0,
          explanation: `${demo.note} ${demo.quizExplanation}`,
        })),
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

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new InternalServerErrorException('No response from AI');

    let result: any;
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      const raw = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
      result = QuizSchema.parse(raw);
    } catch (e) {
      this.logger.error('Quiz parse error', e);
      throw new InternalServerErrorException('Failed to parse quiz response');
    }

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
