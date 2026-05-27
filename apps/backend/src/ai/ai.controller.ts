import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Res,
  HttpCode,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { AiService } from './ai.service';
import { extractMaterialText } from './material-extractor';
import { StorageService } from '../storage/storage.service';
import {
  AssignmentFeedbackDto,
  GenerateQuizDto,
  CourseSummaryDto,
  StudentAnalysisDto,
  ChatMessageDto,
  StudyCoachDto,
  ClassInsightsDto,
  CodeReviewDto,
  QuizAssistDto,
  KahootInsightsDto,
  KahootStudyGuideDto,
  SelfStudyQuizDto,
} from './ai.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('ai')
export class AiController {
  constructor(
    private svc: AiService,
    private storage: StorageService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'AI module status — tells the UI whether AI is fully configured or running in demo mode',
  })
  @ApiResponse({
    status: 200,
    description:
      'Returns { configured, demo, reason? }. reason is "no_key" (env unset) or "invalid_key" (Anthropic returned 401).',
  })
  status() {
    return this.svc.getStatus();
  }

  @Post('assignment-feedback')
  @HttpCode(200)
  @ApiOperation({ summary: 'AI feedback for a student submission (student: own submission only; teacher/admin: any)' })
  @ApiResponse({
    status: 200,
    description: 'Feedback with assessment, strengths, improvements, suggestions. _demo:true when no LLM key.',
  })
  @ApiResponse({ status: 403, description: "Student accessing another student's submission" })
  assignmentFeedback(@Body() dto: AssignmentFeedbackDto, @CurrentUser() user: any) {
    return this.svc.getAssignmentFeedback(dto, user.id, user.role);
  }

  @Post('generate-quiz')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate a quiz for a course topic (teacher/admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Quiz with questions, options, correctIndex, explanation. _demo:true when no LLM key.',
  })
  @ApiResponse({ status: 403, description: 'Students cannot generate quizzes' })
  generateQuiz(@Body() dto: GenerateQuizDto, @CurrentUser() user: any) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teachers and admins can generate quizzes');
    }
    return this.svc.generateQuiz(dto, user.id);
  }

  /**
   * Feature #1: lecture upload → text extraction.
   *
   * Teacher uploads PDF/DOCX/TXT, we hand back the plaintext that the
   * frontend then includes as `materialText` on the follow-up
   * /generate-quiz call. Split into two endpoints (vs. accepting the
   * file directly on /generate-quiz) so the UI can show "extracted 18,000
   * characters from your slides" feedback before the slow Claude call,
   * and so future features can reuse the same extraction (e.g., feeding
   * material into the per-student plan in Feature #4).
   *
   * 25MB upload cap on multer + 200KB cap on returned text — see
   * material-extractor.ts.
   */
  /**
   * Feature #2 — inline AI assist inside the Quiz Editor. The editor
   * fires one of three actions per click; the service picks the right
   * prompt template and returns a shape that matches the action.
   *
   * Teacher/admin only — students don't see the editor at all.
   */
  @Post('quiz-assist')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inline AI assist for the quiz editor (teacher/admin only)' })
  @ApiResponse({
    status: 200,
    description: '{ question } | { options, correctIndex } | { explanation }, plus _demo:true when LLM key absent.',
  })
  @ApiResponse({ status: 400, description: 'Missing options/correctIndex when action=generate-explanation' })
  @ApiResponse({ status: 403, description: 'Students cannot use the editor assist' })
  quizAssist(@Body() dto: QuizAssistDto, @CurrentUser() user: any) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teachers and admins can use editor AI assist');
    }
    return this.svc.quizAssist(dto, user.id);
  }

  /**
   * Feature #3 — AI insights on a finished Kahoot session report.
   * Teacher-only (host-or-admin check runs inside the service via
   * KahootService.getSessionReport).
   *
   * Two scopes (request body picks which):
   *   - 'class'   → 2-paragraph narrative + per-question misconception
   *                 bullets for whichever questions had accuracy < 50%.
   *   - 'student' → personal feedback for one student (requires studentId).
   */
  @Post('kahoot-insights')
  @HttpCode(200)
  @ApiOperation({ summary: 'AI narrative for a finished Kahoot session (host/admin only)' })
  @ApiResponse({ status: 200, description: 'Class- or student-scoped JSON narrative; _demo:true without LLM key.' })
  @ApiResponse({ status: 400, description: 'Missing studentId when scope=student' })
  @ApiResponse({ status: 403, description: 'Caller is not the session host (or admin)' })
  kahootInsights(@Body() dto: KahootInsightsDto, @CurrentUser() user: any) {
    return this.svc.kahootInsights(dto, user);
  }

  /**
   * Personalized study guide for a student after a Kahoot session.
   * Auto-picks "extract from teacher's material" vs "generate from
   * scratch" based on whether the quiz has uploaded source material.
   * Self-lookup is allowed for students (own studentId); other-student
   * lookups are host/admin only.
   */
  @Post('kahoot-study-guide')
  @HttpCode(200)
  @ApiOperation({ summary: 'Personalized study guide post-session (auto: material-anchored or AI-generated)' })
  @ApiResponse({
    status: 200,
    description: '{ hasMaterial, topLine, sections[], mostImportant }; _demo:true without LLM key.',
  })
  @ApiResponse({ status: 403, description: 'Not the session host AND not asking about yourself' })
  kahootStudyGuide(@Body() dto: KahootStudyGuideDto, @CurrentUser() user: any) {
    return this.svc.kahootStudyGuide(dto, user);
  }

  /**
   * Self-study quiz from weak topics (Feature #5). After a Kahoot
   * session the student can click "Practice on what you missed" and
   * play a fresh AI-generated quiz on the exact topics they got
   * wrong. Ephemeral — the response JSON is played client-side, NOT
   * persisted in the Quiz library so the course doesn't accumulate
   * stale per-student practice quizzes.
   */
  @Post('self-study-quiz')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ephemeral AI quiz drilling the student own wrong-answer topics' })
  @ApiResponse({
    status: 200,
    description: '{ questions: [{ question, options, correctIndex, explanation }] }; _demo:true without LLM key.',
  })
  @ApiResponse({ status: 403, description: 'Not host AND not asking about yourself' })
  selfStudyQuiz(@Body() dto: SelfStudyQuizDto, @CurrentUser() user: any) {
    return this.svc.selfStudyQuiz(dto, user);
  }

  @Post('extract-text')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Extract plain text from a lecture file (PDF/DOCX/TXT) for AI quiz generation (teacher/admin only)',
  })
  @ApiResponse({ status: 200, description: '{ text, rawCharCount, truncated, kind }' })
  @ApiResponse({ status: 400, description: 'Unsupported file type or unreadable content' })
  @ApiResponse({ status: 403, description: 'Students cannot extract lecture material' })
  async extractText(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teachers and admins can upload lecture material');
    }
    const extracted = await extractMaterialText(file);
    // Persist the raw file too so end-of-game Telegram fan-out can later
    // deliver it to students via the "Get study material" inline button.
    // Saved to S3 (or disk in dev) via the shared StorageService — same
    // path used for assignment submissions.
    const stored = await this.storage.upload(file.buffer, file.originalname, file.mimetype);
    return {
      ...extracted,
      materialKey: stored.key,
      materialFileName: file.originalname,
      materialMime: file.mimetype,
    };
  }

  @Post('course-summary')
  @HttpCode(200)
  @ApiOperation({ summary: 'AI-generated course overview and study tips (all authenticated users)' })
  @ApiResponse({ status: 200, description: 'Summary with keyTopics, tips, workload. _demo:true when no LLM key.' })
  courseSummary(@Body() dto: CourseSummaryDto, @CurrentUser() user: any) {
    return this.svc.getCourseSummary(dto, user.id);
  }

  @Post('student-analysis')
  @HttpCode(200)
  @ApiOperation({ summary: '[Deprecated] AI analysis of student performance. Use /ai/study-coach instead.' })
  @ApiResponse({
    status: 200,
    description: 'Analysis with strengths, areasToImprove, recommendations, riskLevel. _demo:true when no LLM key.',
  })
  @ApiResponse({ status: 403, description: "Student accessing another student's analysis" })
  studentAnalysis(@Body() dto: StudentAnalysisDto, @CurrentUser() user: any) {
    return this.svc.getStudentAnalysis(dto, user.id, user.role);
  }

  @Post('study-coach')
  @HttpCode(200)
  @ApiOperation({ summary: 'Personal AI Study Coach: predicted grade trajectory + study plan + mistake patterns' })
  @ApiResponse({
    status: 200,
    description: 'trajectory{}, weaknesses[], studyPlan[], mistakePatterns[]. _demo:true when no LLM key.',
  })
  studyCoach(@Body() dto: StudyCoachDto, @CurrentUser() user: any) {
    return this.svc.getStudyCoach(dto, user.id, user.role);
  }

  @Post('class-insights')
  @HttpCode(200)
  @ApiOperation({ summary: 'Teacher-only: at-risk students + class weakness map + high performers (course-wide)' })
  @ApiResponse({
    status: 200,
    description: 'atRiskStudents[], classWeaknesses[], highPerformers[]. _demo:true when no LLM key.',
  })
  @ApiResponse({ status: 403, description: 'Students cannot view class insights' })
  classInsights(@Body() dto: ClassInsightsDto, @CurrentUser() user: any) {
    return this.svc.getClassInsights(dto, user.id, user.role);
  }

  @Post('code-review')
  @HttpCode(200)
  @ApiOperation({ summary: 'AI code review of a submission — bugs, style, performance, security with line numbers' })
  @ApiResponse({
    status: 200,
    description:
      'summary, language, issues[{line, severity, category, message, suggestion}], positiveAspects[]. _demo:true when no LLM key.',
  })
  @ApiResponse({ status: 403, description: "Student requesting review for another student's submission" })
  codeReview(@Body() dto: CodeReviewDto, @CurrentUser() user: any) {
    return this.svc.reviewCode(dto, user.id, user.role);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Streaming AI assistant chat (SSE). Demo mode streams placeholder text when no LLM key.' })
  async chat(@Body() dto: ChatMessageDto, @CurrentUser() user: any, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.svc.chatStream(dto.message, user.id, dto.context, dto.lang)) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (e: any) {
      res.write(`data: ${JSON.stringify({ error: e.message || 'AI error' })}\n\n`);
    } finally {
      res.end();
    }
  }
}
